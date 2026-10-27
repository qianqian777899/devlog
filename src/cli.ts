#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { configPath, initConfig, loadConfig, resolveAI } from './config.js';
import { canonicalRoots, expandPath, object } from './fs.js';
import { getPeriod } from './time.js';
import { collectGit } from './git.js';
import { CodexAdapter } from './adapters/codex.js';
import { ClaudeAdapter } from './adapters/claude.js';
import { renderReport } from './report.js';
import { redact } from './redact.js';
import { polishReport } from './ai.js';
import type { SessionActivity, Template } from './types.js';

const help = `devlog 0.1.0 — local evidence → daily / weekly Markdown reports

Usage:
  devlog init [--yes] [--force]
  devlog today [options]
  devlog week [options]                 Monday through today, local timezone
  devlog range --since DATE --until DATE [options]

Options:
  --root PATH          Scan root (repeatable, replaces configured roots)
  --email EMAIL        Exact author email (repeatable, case-insensitive)
  --all-authors        Include every author (explicit opt-in)
  --since DATE         YYYY-MM-DD or ISO timestamp with offset (range only)
  --until DATE         Date is inclusive; ISO timestamp is exclusive
  --template FORMAT    daily | weekly | okr
  --lang LANG          zh | en
  --no-sessions        Read Git only
  --redact             Mask common credentials and absolute paths
  --ai                 Send a redacted report to your configured AI provider
  --output FILE        Write report instead of stdout; --force to overwrite
  --config FILE        Config path (default ~/.config/devlog/config.json)
  --yes                Noninteractive init with defaults
  --force              Overwrite an existing config / output file
  --help, -h           Show this help
  --version, -v        Show version

No telemetry. Offline unless --ai is explicitly provided.
`;
async function main(): Promise<void> {
  const {values, positionals} = parseArgs({allowPositionals: true, strict: true, options: {
    root: {type: 'string', multiple: true}, email: {type: 'string', multiple: true},
    since: {type: 'string'}, until: {type: 'string'}, template: {type: 'string'}, lang: {type: 'string'},
    output: {type: 'string'}, config: {type: 'string'}, 'all-authors': {type: 'boolean'},
    'no-sessions': {type: 'boolean'}, redact: {type: 'boolean'}, ai: {type: 'boolean'},
    yes: {type: 'boolean'}, force: {type: 'boolean'}, help: {type: 'boolean', short: 'h'}, version: {type: 'boolean', short: 'v'}
  }});
  if (values.version) { process.stdout.write('0.1.0\n'); return; }
  if (values.help || !positionals.length) { process.stdout.write(help); return; }
  if (positionals.length !== 1) throw new Error('Expected exactly one command. Use --help.');
  const command = positionals[0]!;
  if (command === 'init') {
    if (values.root || values.email || values.since || values.until || values.template || values.lang || values.output || values.ai || values.redact || values['all-authors'] || values['no-sessions']) throw new Error('init supports --config, --yes and --force only.');
    await initConfig(values.config ?? configPath(), !!values.force, !!values.yes);
    process.stderr.write('devlog: configuration saved. Run devlog today.\n'); return;
  }
  if (values.yes) throw new Error('--yes is only supported by init.');
  if (values.lang && !['zh', 'en'].includes(values.lang)) throw new Error('--lang must be zh or en.');
  if (values.template && !['daily', 'weekly', 'okr'].includes(values.template)) throw new Error('--template must be daily, weekly or okr.');
  if (values['all-authors'] && values.email) throw new Error('Choose --all-authors or --email, not both.');
  if (values.root?.some(v => !v.trim()) || values.email?.some(v => !v.trim())) throw new Error('--root / --email cannot be empty.');
  const period = getPeriod(command, values.since, values.until);
  const config = await loadConfig(values.config, !!values.config);
  const language = values.lang === 'en' ? 'en' : values.lang === 'zh' ? 'zh' : config.language;
  const template = (values.template ?? (command === 'week' ? 'weekly' : 'daily')) as Template;
  const warnings: string[] = [];
  const warn = (message: string): void => { warnings.push(message); };
  const roots = await canonicalRoots(values.root ?? config.roots, warn);
  if (!roots.length) throw new Error('No accessible scan roots. Check --root / config.');
  const commits = await collectGit(roots, period, values.email ?? config.emails, !!values['all-authors'], warn);
  const activities: SessionActivity[] = [];
  if (!values['no-sessions']) {
    const context = {period, roots, warn};
    if (config.codexPath) activities.push(...await new CodexAdapter().read(expandPath(config.codexPath), context));
    if (config.claudePath) activities.push(...await new ClaudeAdapter().read(expandPath(config.claudePath), context));
  }
  let report = renderReport({period, commits, activities, warnings}, language, template);
  if (values.ai) {
    process.stderr.write('devlog: --ai enabled; sending a redacted report to your configured provider.\n');
    try { report = await polishReport(report, resolveAI(config), language, roots); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      warn(`AI polishing failed; kept the offline report. ${message}`);
      report = renderReport({period, commits, activities, warnings}, language, template);
    }
  }
  if (values.redact) report = redact(report, roots);
  for (const warning of [...new Set(warnings)]) process.stderr.write(`devlog: ${values.redact ? redact(warning, roots) : warning}\n`);
  if (values.output) {
    try { await writeFile(expandPath(values.output), report, {flag: values.force ? 'w' : 'wx', mode: 0o600}); }
    catch (error) {
      if (object(error).code === 'EEXIST') throw new Error('Output already exists; use --force to overwrite.');
      throw new Error('Cannot write output file. Check the parent directory and permissions.');
    }
  } else process.stdout.write(report);
}
main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Config parse / network errors never echo raw files or remote response bodies.
  process.stderr.write(`devlog: ${redact(message)}\n`); process.exitCode = 1;
});
process.stdout.on('error', error => {
  if (object(error).code === 'EPIPE') process.exit(0);
  throw error;
});
