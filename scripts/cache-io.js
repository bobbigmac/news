import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const CACHE_DIR = 'cache';
export const RAW_FILE = join(CACHE_DIR, 'raw-new.json');
export const DIGEST_FILE = join(CACHE_DIR, 'digest.json');
export const STORY_STORE_FILE = join(CACHE_DIR, 'stories.json');
export const SUMMARISED_IDS_FILE = join(CACHE_DIR, 'summarised-ids.json');
export const RUN_LOG_FILE = join(CACHE_DIR, 'run-log.json');
export const MODEL_REGISTRY_FILE = join(CACHE_DIR, 'model-registry.json');

export function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

export function saveJson(path, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
