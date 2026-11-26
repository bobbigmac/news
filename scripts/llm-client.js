import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SYSTEM_PROMPT } from './prompts.js';
import { extractJson } from './extract-json.js';
import { loadJson, MODEL_REGISTRY_FILE, saveJson } from './cache-io.js';

export const MAX_RETRIES = 5;
export const BASE_DELAY_MS = 5000;
export const MAX_DELAY_MS = 60000;
export const INTER_CALL_DELAY_MS = 2000; // pause between LLM calls to avoid rate limiting

// --- Model registry ---
// When openrouter/free gives us a good :free model, we remember it. On
// subsequent calls we try known-good models directly (still free — :free
// suffix means zero cost) instead of gambling on the random router. This
// eliminates the retry-roulette with safety classifier models.
// Falls back to openrouter/free if all known-good models are unavailable.
const MODEL_REGISTRY = loadJson(MODEL_REGISTRY_FILE, { good: [], bad: [] });
function saveModelRegistry() { saveJson(MODEL_REGISTRY_FILE, MODEL_REGISTRY); }
export function rememberGoodModel(modelId) {
  if (!modelId || !modelId.endsWith(':free')) return;
  if (!MODEL_REGISTRY.good.includes(modelId)) {
    MODEL_REGISTRY.good.unshift(modelId); // most recent first
    if (MODEL_REGISTRY.good.length > 10) MODEL_REGISTRY.good.pop();
    saveModelRegistry();
  }
}
export function rememberBadModel(modelId) {
  if (!modelId) return;
  if (!MODEL_REGISTRY.bad.includes(modelId)) {
    MODEL_REGISTRY.bad.push(modelId);
    if (MODEL_REGISTRY.bad.length > 20) MODEL_REGISTRY.bad.shift();
    saveModelRegistry();
  }
}
export function isKnownBad(modelId) {
  return MODEL_REGISTRY.bad.includes(modelId);
}

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const PROVIDERS = [
  // OpenRouter free router: 'openrouter/free' randomly picks from available
  // free models. Some of those models are content-safety classifiers (e.g.
  // nvidia/nemotron-3.5-content-safety:free) that return "User Safety: safe"
  // instead of chat completions, and some wrap JSON in markdown fences. The
  // free router doesn't support excluded_models, so we handle bad-model
  // responses in callLLM by detecting them and retrying (each retry gets a
  // new random model). Override with OPENROUTER_MODEL to pin a specific model.
  { name: 'OpenRouter', keyEnv: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1', model: process.env.OPENROUTER_MODEL || 'openrouter/free', headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://github.com/bobbigmac/news', 'X-Title': 'News Dashboard' }) },
  { name: 'Featherless', keyEnv: 'FEATHERLESS_API_KEY', baseUrl: 'https://api.featherless.ai/v1', model: process.env.FEATHERLESS_MODEL || 'meta-llama/Llama-3.3-70B-Instruct', headers: (key) => ({ 'Authorization': `Bearer ${key}` }) },
  { name: 'OpenAI', keyEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', headers: (key) => ({ 'Authorization': `Bearer ${key}` }) },
];

export const PROVIDER = PROVIDERS.find(p => process.env[p.keyEnv]);
if (!PROVIDER) {
  console.error('No LLM API key found. Set one of: OPENROUTER_API_KEY, FEATHERLESS_API_KEY, OPENAI_API_KEY');
  process.exit(0);
}
const API_KEY = process.env[PROVIDER.keyEnv];
const LLM_BASE = PROVIDER.baseUrl;
export const MODEL = PROVIDER.model;

// --- Paid-model safeguard ---
// The $10 OpenRouter credit is a daily-limit unlock, NOT spendable budget.
// We must NEVER call paid models. The free router should only pick :free
// models, but if it ever routes to a paid model (bug, config change, etc.)
// we reject the response immediately and retry. We also check the usage
// object for any non-zero cost as a belt-and-braces check.
export function isPaidModel(modelId) {
  // Free models on OpenRouter always end with ':free'.
  return !modelId || !modelId.endsWith(':free');
}

export function hasCost(usage) {
  if (!usage) return false;
  // OpenRouter returns cost in USD as a number (e.g. 0.0001).
  // Any non-zero cost means we spent real money.
  const cost = typeof usage.cost === 'number' ? usage.cost
    : typeof usage.total_cost === 'number' ? usage.total_cost
    : 0;
  return cost > 0;
}

// Models in the openrouter/free pool that are not chat completion models.
// The free router picks randomly and doesn't support exclusions, so we detect
// these by their output and retry to get a different model.
const BAD_MODEL_PATTERNS = [
  /user safety/i,
  /^safe$/i,
  /^unsafe$/i,
];

// Models known to be non-generative (classifiers, safety models).
const BAD_MODEL_IDS = new Set([
  'nvidia/nemotron-3.5-content-safety:free',
]);

// Some free models wrap JSON in markdown fences despite response_format
// json_object. Strip fences so the parser can handle the content.
export function stripMarkdownFences(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

// Parse the single-cluster JSON object returned by buildSummaryPrompt.
// The prompt asks for a flat { headline, summary, category, impact,
// trigger_words } object — not the old { clusters: [...] } wrapper — so we
// parse directly. callLLM already strips markdown fences; we also tolerate
// fences here and fall back to extractJson (which handles truncated/malformed
// JSON) if direct parse fails.
export function parseSummaryResponse(text) {
  const cleaned = stripMarkdownFences(text).trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && obj.headline) return obj;
    // Some models wrap in a clusters array despite the prompt
    if (obj && obj.clusters && obj.clusters[0]?.headline) return obj.clusters[0];
  } catch { /* fall through to extractJson */ }
  const recovered = extractJson(text);
  if (recovered && recovered.clusters && recovered.clusters[0]?.headline) {
    return recovered.clusters[0];
  }
  return null;
}

// Build the list of models to try for a single LLM call.
// Known-good :free models first (direct calls, still zero cost), then
// openrouter/free as a fallback to discover new good models.
function buildModelQueue() {
  const queue = [];
  // Only use known-good models for OpenRouter free router
  if (PROVIDER.name === 'OpenRouter') {
    for (const m of MODEL_REGISTRY.good) {
      if (!isKnownBad(m)) queue.push(m);
    }
    // Always include the free router last to discover new good models
    // (or as the only option if no known-good models yet)
    if (MODEL === 'openrouter/free' && !queue.includes('openrouter/free')) {
      queue.push('openrouter/free');
    } else if (!queue.includes(MODEL)) {
      queue.push(MODEL);
    }
  } else {
    queue.push(MODEL);
  }
  return queue;
}

// Shared chat-completion caller. Summary and topic-slug prompts use different
// system prompts/temperatures but the same retry, cost-safety, and bad-model logic.
export async function callLLM(prompt, { systemPrompt = SYSTEM_PROMPT, temperature = 0.3 } = {}) {
  let lastError = null;
  const queue = buildModelQueue();
  let attempt = 0;

  for (let qi = 0; qi < queue.length + MAX_RETRIES; qi++) {
    const modelToTry = queue[qi % queue.length];
    // After the first pass through the queue, we're retrying — add delay
    if (qi >= queue.length) {
      const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, attempt), MAX_DELAY_MS);
      console.log(`  Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }

    try {
      const res = await fetch(`${LLM_BASE}/chat/completions`, {
        method: 'POST',
        headers: { ...PROVIDER.headers(API_KEY), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToTry,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          temperature,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const retryable = res.status === 429 || res.status === 503 || res.status === 502;
        const reason = res.status === 429 ? 'rate limited' : res.status === 503 ? 'service unavailable' : res.status === 502 ? 'bad gateway' : `HTTP ${res.status}`;
        lastError = new Error(`${PROVIDER.name} ${reason}: ${errText.substring(0, 300)}`);
        if (!retryable) throw lastError;
        // Rate-limited on a specific model — try the next one in the queue
        if (res.status === 429 && modelToTry !== 'openrouter/free') {
          console.log(`  ${modelToTry} rate limited — trying next model`);
          continue;
        }
        continue;
      }

      const data = await res.json();
      const usedModel = data.model || modelToTry;
      const text = data.choices?.[0]?.message?.content;

      // Paid-model safeguard: reject immediately, no retry.
      if (isPaidModel(usedModel)) {
        lastError = new Error(`PAID MODEL BLOCKED: ${usedModel} is not a :free model — refusing to spend credit`);
        console.error(`  ${lastError.message}`);
        throw lastError;
      }
      if (hasCost(data.usage)) {
        lastError = new Error(`PAID USAGE BLOCKED: response from ${usedModel} has non-zero cost (${data.usage.cost || data.usage.total_cost})`);
        console.error(`  ${lastError.message}`);
        throw lastError;
      }

      // Detect content-safety classifier models by ID or output.
      // Remember as bad and try the next model in the queue.
      if (BAD_MODEL_IDS.has(usedModel) || isKnownBad(usedModel)) {
        console.log(`  Known bad model ${usedModel} — trying next`);
        rememberBadModel(usedModel);
        continue;
      }
      if (text && BAD_MODEL_PATTERNS.some(p => p.test(text.trim()))) {
        console.log(`  Safety-classifier response from ${usedModel} — remembering as bad, trying next`);
        rememberBadModel(usedModel);
        continue;
      }

      if (!text) {
        const finish = data.choices?.[0]?.finish_reason;
        lastError = new Error(`${PROVIDER.name} returned empty response${finish ? ` (finish_reason: ${finish})` : ''} from ${usedModel}`);
        if (finish === 'length' || finish === 'content_filter') throw lastError;
        console.log(`  ${lastError.message} — trying next model`);
        continue;
      }

      // Success! Remember this model as good for future calls.
      if (usedModel !== modelToTry) {
        // The free router picked a model — remember which one
        rememberGoodModel(usedModel);
      } else if (modelToTry !== 'openrouter/free') {
        // Direct model call succeeded — make sure it's in the registry
        rememberGoodModel(modelToTry);
      }

      return stripMarkdownFences(text);
    } catch (err) {
      lastError = err;
      const isNetwork = err.cause?.code || err.name === 'TypeError' || /fetch|network|connection|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|aborted/i.test(err.message);
      if (isNetwork && attempt < MAX_RETRIES - 1) {
        console.log(`  Network error (${err.cause?.code || err.message}) — retrying`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error(`${PROVIDER.name}: all retries exhausted`);
}
