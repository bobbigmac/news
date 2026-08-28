// Test script: verify LLM batch and solo summarisation calls work correctly.
// Uses the REAL callLLM from summarise.js (with model registry, bad model
// detection, retry logic, etc.) to test end-to-end behaviour.
import { readFileSync } from 'fs';
import { SYSTEM_PROMPT, buildSummaryPrompt, buildBatchPrompt } from './prompts.js';

// We can't import callLLM directly (it's not exported), so we replicate
// the minimal model registry + bad model detection logic here.
const env = readFileSync('.env', 'utf8');
const apiKey = env.match(/OPENROUTER_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) { console.error('No OPENROUTER_API_KEY in .env'); process.exit(1); }

const LLM_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'openrouter/free';

const BAD_MODEL_IDS = new Set([
  'nvidia/nemotron-3.5-content-safety:free',
  'liquid/liquid-lfm-7b:free',
  'thudm/cogvlm2-llama3-chat-990m:free',
]);
const BAD_MODEL_PATTERNS = [
  /user safety/i,
  /^safe$/i,
  /^unsafe$/i,
  /content policy/i,
  /i cannot (generate|produce|create|help)/i,
  /safety classification/i,
];

function stripMarkdownFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

async function callLLM(prompt, label) {
  console.log(`\n--- Calling LLM: ${label} ---`);
  const maxRetries = 5;
  let attempt = 0;

  for (let qi = 0; qi < maxRetries + 5; qi++) {
    if (qi > 0) {
      const delay = Math.min(5000 * Math.pow(1.5, attempt), 60000);
      console.log(`  Retry in ${Math.round(delay / 1000)}s (attempt ${attempt + 1})`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }

    try {
      const res = await fetch(`${LLM_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/bobdavies/news',
          'X-Title': 'news-test',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`  HTTP ${res.status}: ${errText.slice(0, 200)}`);
        if (res.status === 429) continue;
        return null;
      }

      const data = await res.json();
      const usedModel = data.model || MODEL;
      const text = data.choices?.[0]?.message?.content;
      const usage = data.usage;
      console.log(`  Model: ${usedModel}`);
      console.log(`  Usage: prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens}, cost=${usage?.cost}`);

      // Check for bad models
      if (BAD_MODEL_IDS.has(usedModel)) {
        console.log(`  Known bad model ${usedModel} — retrying`);
        continue;
      }
      if (text && BAD_MODEL_PATTERNS.some(p => p.test(text.trim()))) {
        console.log(`  Safety-classifier response from ${usedModel} — retrying`);
        continue;
      }

      if (!text) {
        console.log(`  Empty response from ${usedModel} — retrying`);
        continue;
      }

      console.log(`  Response: ${text.length} chars`);
      return stripMarkdownFences(text);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      continue;
    }
  }
  return null;
}

// Prepare test stories from the real digest
const digest = JSON.parse(readFileSync('cache/digest.json', 'utf8'));

// Pick 5 small clusters for the batch test
const smallClusters = digest.clusters
  .filter(c => (c.stories || []).length <= 2)
  .slice(0, 5)
  .map(c => ({
    id: c.id,
    stories: (c.stories || []).slice(0, 2).map(s => ({
      title: s.title || s.originalTitle || '',
      originalTitle: s.originalTitle || s.title || '',
      published: s.published || new Date().toISOString(),
      sourceName: s.sourceName || 'Unknown',
      description: (s.description || '').slice(0, 200),
      content: (s.content || '').slice(0, 300),
    }))
  }));

console.log('=== Test 1: BATCH prompt (5 small clusters in 1 call) ===');
smallClusters.forEach((c, i) => console.log(`  [${i}] ${c.id}: ${c.stories[0]?.title?.slice(0, 50)}`));

const batchPrompt = buildBatchPrompt(smallClusters);
console.log('Prompt length:', batchPrompt.length, 'chars');

const batchResponse = await callLLM(batchPrompt, 'BATCH (5 clusters)');

if (batchResponse) {
  console.log('\n=== Parsing batch response ===');
  console.log('First 200 chars:', batchResponse.slice(0, 200));
  console.log('...');

  let parsed;
  try {
    parsed = JSON.parse(batchResponse);
  } catch {
    console.log('Direct parse failed, trying regex extraction...');
    const match = batchResponse.match(/\[[\s\S]*\]/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
  }

  // Extract the clusters array (response is wrapped in { clusters: [...] })
  const results = Array.isArray(parsed) ? parsed : (parsed?.clusters || parsed?.data || parsed?.results || []);

  if (Array.isArray(results) && results.length > 0) {
    console.log(`\nSUCCESS: Got ${results.length} cluster entries`);
    results.forEach((entry, i) => {
      console.log(`\n  [${i}] id: ${entry.id}`);
      console.log(`      headline: ${entry.headline}`);
      console.log(`      summary: ${(entry.summary || '').slice(0, 80)}...`);
      console.log(`      category: ${entry.category}`);
      console.log(`      trigger_words: ${JSON.stringify(entry.trigger_words)}`);
    });
    const expectedIds = smallClusters.map(c => c.id);
    const gotIds = results.map(e => e.id);
    const missing = expectedIds.filter(id => !gotIds.includes(id));
    if (missing.length) {
      console.log(`\nWARNING: Missing ${missing.length} cluster ids: ${missing.join(', ')}`);
    } else {
      console.log('\nAll cluster ids present in response.');
    }
  } else if (parsed && typeof parsed === 'object') {
    console.log('\nGot object but no clusters array. Full structure:');
    console.log(JSON.stringify(parsed, null, 2).slice(0, 1500));
    console.log('\nPROBLEM: Need to adjust prompt or parsing.');
  } else {
    console.log('\nFAILED: Could not parse response');
    console.log('Full response:');
    console.log(batchResponse);
  }
} else {
  console.log('\nFAILED: No response from LLM');
}

// Test 2: SOLO prompt for comparison
console.log('\n\n=== Test 2: SOLO prompt (1 cluster) ===');
const soloStories = smallClusters[0].stories;
const soloPrompt = buildSummaryPrompt(soloStories, null);
console.log('Prompt length:', soloPrompt.length, 'chars');

const soloResponse = await callLLM(soloPrompt, 'SOLO (1 cluster)');

if (soloResponse) {
  console.log('\n=== Parsing solo response ===');
  try {
    const parsed = JSON.parse(soloResponse);
    console.log('SUCCESS:');
    console.log('  headline:', parsed.headline);
    console.log('  summary:', (parsed.summary || '').slice(0, 100));
    console.log('  category:', parsed.category);
    console.log('  trigger_words:', JSON.stringify(parsed.trigger_words));
  } catch (err) {
    console.error('Parse failed:', err.message);
    console.log('Raw:', soloResponse.slice(0, 500));
  }
} else {
  console.log('\nFAILED: No response from LLM');
}

console.log('\n=== Test complete ===');
