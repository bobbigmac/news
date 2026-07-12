/**
 * Robust JSON extraction from LLM responses.
 * Adapted from voice-videos/src/abridge/extract-json.js — handles:
 * - <think> blocks (GLM/DeepSeek reasoning prefixes)
 * - Fenced code blocks (```json and ~~~)
 * - Truncated responses (auto-closing braces)
 * - Trailing commas, single quotes, unquoted keys
 * - Partial cluster recovery from malformed output
 */

function stripLeadingThinkBlocks(text) {
  let output = String(text || '').replace(/^\uFEFF/, '').trimStart();
  output = output.replace(/\r\n/g, '\n');

  while (true) {
    const thinkOpen = output.match(/^<(?:think|redacted_thinking)>/i);
    if (!thinkOpen) break;
    const tag = thinkOpen[0].slice(1, -1).toLowerCase();
    const closeTag = `</${tag}>`;
    const closeIndex = output.toLowerCase().indexOf(closeTag.toLowerCase());
    if (closeIndex < 0) break;
    output = output.slice(closeIndex + closeTag.length).trimStart();
  }

  // Also strip a closing think tag if it appears mid-text (some models close late)
  const closeThink = output.match(/<\/(?:think|redacted_thinking)>\s*/i);
  if (closeThink) {
    output = output.slice(output.indexOf(closeThink[0]) + closeThink[0].length).trim();
  }

  return output;
}

function stripModelJsonNoise(text) {
  return stripLeadingThinkBlocks(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractBalancedSlice(raw, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;
  let closingIndex = -1;

  for (let i = startIndex; i < raw.length; i++) {
    const char = raw[i];
    if (!started) {
      if (char === '{' || char === '[') {
        started = true;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{' || char === '[') { depth++; continue; }
    if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) { closingIndex = i; break; }
    }
  }

  if (closingIndex >= 0) {
    return raw.slice(startIndex, closingIndex + 1).trim();
  }
  return null;
}

function extractOutermostJsonObject(text) {
  const raw = stripModelJsonNoise(text);
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1).trim();
}

function extractJsonPayload(text) {
  const raw = stripModelJsonNoise(text);
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    || raw.match(/~~~(?:json|text)?\s*([\s\S]*?)~~~/i);
  if (fencedMatch) return fencedMatch[1].trim();

  const braceIndex = raw.indexOf('{');
  const bracketIndex = raw.indexOf('[');
  let startIndex = -1;
  if (braceIndex >= 0 && (bracketIndex < 0 || braceIndex <= bracketIndex)) {
    startIndex = braceIndex;
  } else if (bracketIndex >= 0) {
    startIndex = bracketIndex;
  }
  if (startIndex < 0) return raw;

  return extractBalancedSlice(raw, startIndex) || raw;
}

function repairTrailingCommas(text) {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

function repairSingleQuotes(text) {
  return text.replace(/'/g, '"');
}

function repairUnquotedKeys(text) {
  // Match keys that are either fully unquoted (word followed by colon)
  // or have a stray quote before the key but no opening quote ("key: instead of "key":)
  return text
    .replace(/"(\w+)\s*:/g, '"$1":')  // "key: -> "key":
    .replace(/(?<!["\w])(\w+)\s*:/g, '"$1":'); // key: -> "key":
}

function repairComments(text) {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function closeOpenJsonContainers(text) {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) { escaped = false; }
      else if (char === '\\') { escaped = true; }
      else if (char === '"') { inString = false; }
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  let closed = text.replace(/,\s*"[^"\n\\]*(?:\\.[^"\n\\]*)*$/m, '');
  closed = closed.replace(/,\s*$/m, '');
  while (openBrackets > 0) { closed += ']'; openBrackets--; }
  while (openBraces > 0) { closed += '}'; openBraces--; }
  return closed;
}

function tryJsonParse(candidate) {
  if (!candidate) return null;
  try { return JSON.parse(candidate); } catch { return null; }
}

/**
 * Extract individual cluster objects from a truncated or malformed response.
 * Looks for objects containing a "headline" field.
 */
function extractClusters(text) {
  const clusters = [];
  const raw = stripModelJsonNoise(text);

  // Try regex extraction of individual cluster objects
  const clusterRegex = /\{[^{}]*?"headline"\s*[:=]\s*["']?[^"'}]+["']?[^{}]*?\}/gs;
  let match;
  while ((match = clusterRegex.exec(raw)) !== null) {
    const parsed = tryParseJson(match[0])
      || tryJsonParse(repairTrailingCommas(match[0]))
      || tryJsonParse(repairSingleQuotes(match[0]));
    if (parsed && parsed.headline) {
      normaliseClusterIds(parsed);
      clusters.push(parsed);
    }
  }

  // Line-by-line fallback for models that output one cluster per line
  if (!clusters.length) {
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') || !trimmed.includes('headline')) continue;
      const parsed = tryParseJson(trimmed)
        || tryJsonParse(repairTrailingCommas(trimmed));
      if (parsed && parsed.headline) {
        normaliseClusterIds(parsed);
        clusters.push(parsed);
      }
    }
  }

  return clusters;
}

function normaliseClusterIds(cluster) {
  if (!cluster.story_ids) {
    cluster.story_ids = [];
  } else if (typeof cluster.story_ids === 'string') {
    cluster.story_ids = cluster.story_ids.split(',').map(s => s.trim()).filter(Boolean);
  } else if (!Array.isArray(cluster.story_ids)) {
    cluster.story_ids = [String(cluster.story_ids)];
  }
}

/**
 * Main entry point — tries every strategy to extract JSON from an LLM response.
 * Returns { clusters: [...] } or null.
 */
export function extractJson(text) {
  if (!text || !text.trim()) return null;

  const cleaned = stripModelJsonNoise(text);

  // Build candidate list — each will be tried with multiple repair strategies
  const candidates = [];

  const outer = extractOutermostJsonObject(cleaned);
  if (outer) candidates.push(outer);

  const payload = extractJsonPayload(cleaned);
  if (payload && payload !== cleaned) candidates.push(payload);

  candidates.push(cleaned);

  // Add repaired variants of each candidate
  const allCandidates = [];
  for (const candidate of candidates) {
    allCandidates.push(candidate);
    allCandidates.push(repairTrailingCommas(candidate));
    allCandidates.push(repairSingleQuotes(candidate));
    allCandidates.push(repairTrailingCommas(repairSingleQuotes(candidate)));
    allCandidates.push(repairComments(candidate));
    allCandidates.push(repairUnquotedKeys(candidate));
    allCandidates.push(repairTrailingCommas(repairUnquotedKeys(candidate)));
    allCandidates.push(closeOpenJsonContainers(candidate));
    allCandidates.push(closeOpenJsonContainers(repairTrailingCommas(candidate)));
    allCandidates.push(closeOpenJsonContainers(repairUnquotedKeys(candidate)));
  }

  // Try each candidate
  for (const candidate of allCandidates) {
    const parsed = tryJsonParse(candidate);
    if (parsed) {
      if (parsed.clusters && Array.isArray(parsed.clusters)) {
        parsed.clusters.forEach(normaliseClusterIds);
        return parsed;
      }
      // Some models return an array directly
      if (Array.isArray(parsed) && parsed.length && parsed[0]?.headline) {
        parsed.forEach(normaliseClusterIds);
        return { clusters: parsed };
      }
    }
  }

  // Last resort: extract individual cluster objects
  const clusters = extractClusters(cleaned);
  if (clusters.length) {
    console.log(`  Recovered ${clusters.length} clusters from partial response`);
    return { clusters };
  }

  console.log(`  Could not parse any JSON from response`);
  console.log(`  Raw response (first 500 chars): ${text.substring(0, 500)}`);
  console.log(`  Raw response (last 200 chars): ${text.substring(text.length - 200)}`);
  return null;
}
