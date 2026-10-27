import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { expandPath, object } from './fs.js';
import type { Config, AIConfig } from './types.js';

export function configPath(): string { return join(homedir(), '.config', 'devlog', 'config.json'); }
export function defaults(): Config {
  return { roots: [process.cwd()], emails: [], language: 'zh', codexPath: join(homedir(), '.codex', 'sessions'), claudePath: join(homedir(), '.claude', 'projects') };
}
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Config must be a JSON object.');
  const raw = object(value), fallback = defaults();
  for (const key of ['roots', 'emails'] as const) {
    if (raw[key] !== undefined && (!Array.isArray(raw[key]) || !(raw[key] as unknown[]).every(v => typeof v === 'string' && !!v.trim())))
      throw new Error(`Config ${key} must be an array of non-empty strings.`);
  }
  if (Array.isArray(raw.roots) && !raw.roots.length) throw new Error('Config roots cannot be empty.');
  if (raw.language !== undefined && raw.language !== 'zh' && raw.language !== 'en') throw new Error('Config language must be zh or en.');
  for (const key of ['codexPath', 'claudePath']) {
    if (raw[key] !== undefined && raw[key] !== null && (typeof raw[key] !== 'string' || !(raw[key] as string).trim())) throw new Error(`Config ${key} must be a non-empty path or null.`);
  }
  let ai: AIConfig | undefined;
  if (raw.ai !== undefined) {
    const source = object(raw.ai);
    if (typeof source.baseURL !== 'string' || !source.baseURL || typeof source.model !== 'string' || !source.model) throw new Error('Config ai requires baseURL and model strings.');
    if (source.apiKeyEnv !== undefined && (typeof source.apiKeyEnv !== 'string' || !source.apiKeyEnv)) throw new Error('Config ai.apiKeyEnv must be a non-empty string.');
    if (source.apiKey !== undefined && typeof source.apiKey !== 'string') throw new Error('Config ai.apiKey must be a string.');
    ai = { baseURL: source.baseURL, model: source.model, apiKeyEnv: typeof source.apiKeyEnv === 'string' ? source.apiKeyEnv : 'DEVLOG_API_KEY', ...(typeof source.apiKey === 'string' ? {apiKey: source.apiKey} : {}) };
  }
  return { roots: raw.roots as string[] ?? fallback.roots, emails: raw.emails as string[] ?? [], language: raw.language === 'en' ? 'en' : 'zh',
    codexPath: raw.codexPath === undefined ? fallback.codexPath : raw.codexPath as string | null,
    claudePath: raw.claudePath === undefined ? fallback.claudePath : raw.claudePath as string | null, ...(ai ? {ai} : {}) };
}
export async function loadConfig(path = configPath(), explicit = false): Promise<Config> {
  let content: string;
  try { content = await readFile(expandPath(path), 'utf8'); }
  catch (error) {
    if (!explicit && object(error).code === 'ENOENT') return defaults();
    throw new Error('Cannot read config file. Check --config and file permissions.');
  }
  let value: unknown;
  try { value = JSON.parse(content); } catch { throw new Error('Invalid config JSON. No config content was printed.'); }
  return validateConfig(value);
}
export function resolveAI(config: Config, env: NodeJS.ProcessEnv = process.env): AIConfig {
  const ai = config.ai;
  const keyEnv = ai?.apiKeyEnv ?? 'DEVLOG_API_KEY';
  const result = {
    baseURL: env.DEVLOG_BASE_URL || ai?.baseURL || '', model: env.DEVLOG_MODEL || ai?.model || '', apiKeyEnv: keyEnv,
    apiKey: env.DEVLOG_API_KEY || env[keyEnv] || ai?.apiKey
  };
  if (!result.baseURL || !result.model) throw new Error('AI requires DEVLOG_BASE_URL / DEVLOG_MODEL or ai.baseURL / ai.model in config.');
  return result;
}
export async function saveConfig(path: string, value: Config, force = false): Promise<void> {
  const expanded = expandPath(path);
  await mkdir(dirname(expanded), {recursive: true, mode: 0o700});
  await writeFile(expanded, JSON.stringify(value, null, 2) + '\n', {flag: force ? 'w' : 'wx', mode: 0o600});
}
export async function initConfig(path: string, force: boolean, yes: boolean): Promise<void> {
  const value = defaults();
  if (!yes) {
    if (!process.stdin.isTTY) throw new Error('Interactive init needs a terminal; use devlog init --yes for defaults.');
    const rl = createInterface({input: process.stdin, output: process.stderr});
    try {
      const roots = await rl.question(`Scan roots, comma separated [${process.cwd()}]: `);
      if (roots.trim()) value.roots = roots.split(',').map(v => expandPath(v.trim())).filter(Boolean);
      const emails = await rl.question('Author emails, comma separated [infer from each Git repository]: ');
      value.emails = emails.split(',').map(v => v.trim()).filter(Boolean);
      const language = await rl.question('Language zh/en [zh]: ');
      if (language && language !== 'zh' && language !== 'en') throw new Error('Language must be zh or en.');
      if (language === 'en') value.language = 'en';
      const enabled = await rl.question('Read in-scope Codex / Claude local sessions? Y/n [Y]: ');
      if (/^n/i.test(enabled)) { value.codexPath = null; value.claudePath = null; }
    } finally { rl.close(); }
  }
  try { await saveConfig(path, validateConfig(value), force); }
  catch (error) {
    if (object(error).code === 'EEXIST') throw new Error('Config already exists; use --force to overwrite.');
    throw error;
  }
}
