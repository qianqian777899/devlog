import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getPeriod, inPeriod, parseDate } from '../src/time.js';
import { canonicalRoots, isWithin, jsonLines, walk } from '../src/fs.js';
import { collectGit, parseNumstat } from '../src/git.js';
import { CodexAdapter } from '../src/adapters/codex.js';
import { ClaudeAdapter } from '../src/adapters/claude.js';
import { renderReport } from '../src/report.js';
import { redact } from '../src/redact.js';
import { loadConfig, resolveAI, saveConfig, validateConfig } from '../src/config.js';
import { endpoint, polishReport } from '../src/ai.js';
import type { ReportData } from '../src/types.js';
const temp: string[] = [];
async function directory(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'devlog-test-')); temp.push(path); return path; }
afterEach(async () => { await Promise.all(temp.splice(0).map(path => rm(path, {recursive: true, force: true}))); });
const period = {since: new Date('2026-10-27T00:00:00Z'), until: new Date('2026-10-28T00:00:00Z')};
const empty: ReportData = {period, commits: [], activities: [], warnings: []};

describe('calendar boundaries', () => {
  it('uses local calendar midnight and a Monday week start', () => {
    const now = new Date(2026, 9, 27, 13, 25);
    expect(getPeriod('today', undefined, undefined, now).since).toEqual(new Date(2026, 9, 27));
    expect(getPeriod('week', undefined, undefined, now).since).toEqual(new Date(2026, 9, 26));
    expect(getPeriod('week', undefined, undefined, new Date(2026, 10, 1)).since).toEqual(new Date(2026, 9, 26));
  });
  it('makes date-only until inclusive and timestamps exclusive', () => {
    expect(getPeriod('range', '2026-10-27', '2026-10-27').until).toEqual(new Date(2026, 9, 28));
    expect(getPeriod('range', '2026-10-27T00:00:00Z', '2026-10-28T00:00:00Z')).toEqual(period);
    expect(inPeriod('2026-10-27T00:00:00Z', period)).toBe(true);
    expect(inPeriod('2026-10-28T00:00:00Z', period)).toBe(false);
  });
  it.each(['2026-02-30', '2026-13-01', 'yesterday', '2026-10-27T12:00:00', '2026-10-27T33:00:00Z'])('rejects invalid date %s', date => expect(() => parseDate(date)).toThrow());
  it('rejects reversed periods and irrelevant options', () => {
    expect(() => getPeriod('range', '2026-10-28', '2026-10-26')).toThrow();
    expect(() => getPeriod('range')).toThrow();
    expect(() => getPeriod('today', '2026-10-27')).toThrow();
    expect(() => getPeriod('unknown')).toThrow();
  });
});
describe('filesystem and JSONL safety', () => {
  it('checks path boundaries instead of string prefixes', () => {
    expect(isWithin('/work/app/file', '/work/app')).toBe(true);
    expect(isWithin('/work/app2/file', '/work/app')).toBe(false);
    expect(isWithin('/work/app/../private', '/work/app')).toBe(false);
  });
  it('canonicalizes and deduplicates roots, skips symlink traversal and node_modules', async () => {
    const root = await directory(); await mkdir(join(root, 'project', '.git'), {recursive: true});
    await mkdir(join(root, 'node_modules', 'hidden', '.git'), {recursive: true});
    await symlink(root, join(root, 'loop'), process.platform === 'win32' ? 'junction' : 'dir');
    const warnings: string[] = [];
    expect(await canonicalRoots([root, root, join(root, 'missing')], m => warnings.push(m))).toEqual([root]);
    const found = []; for await (const item of walk(root, m => warnings.push(m))) if (item.repository) found.push(item.path);
    expect(found).toEqual([join(root, 'project')]); expect(warnings).toHaveLength(1);
  });
  it('streams Unicode, skips broken/oversized records, accepts the last line without newline', async () => {
    const root = await directory(), path = join(root, 'log.jsonl'), warnings: string[] = [];
    await writeFile(path, '\uFEFF{"text":"中文"}\r\nnot json\n' + JSON.stringify({long: 'x'.repeat(2 * 1024 * 1024)}) + '\n{"last":true}');
    const rows = []; for await (const row of jsonLines(path, m => warnings.push(m))) rows.push(row);
    expect(rows).toEqual([{text: '中文'}, {last: true}]); expect(warnings).toHaveLength(2);
  });
});
describe('real Git fixture', () => {
  it('filters exact email and author time, handles root commits, nested paths, worktrees and renames', async () => {
    const root = await directory(), repo = join(root, 'repo'); await mkdir(repo);
    const git = (...args: string[]): string => execFileSync('git', args, {cwd: repo, encoding: 'utf8', env: {...process.env, GIT_CONFIG_NOSYSTEM: '1'}});
    git('init', '-b', 'main'); git('config', 'user.email', 'me@example.test'); git('config', 'user.name', 'Fixture User');
    const commit = (message: string, date: string, email = 'me@example.test'): void => {
      git('add', '.'); execFileSync('git', ['commit', '-m', message], {cwd: repo, env: {...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_EMAIL: email}, stdio: 'pipe'});
    };
    await writeFile(join(repo, 'first.txt'), 'one\ntwo\n'); commit('root change', '2026-10-27T02:00:00Z');
    await writeFile(join(repo, 'other.txt'), 'other\n'); commit('teammate', '2026-10-27T03:00:00Z', 'other@example.test');
    await writeFile(join(repo, 'another.txt'), 'another\n'); commit('substring email', '2026-10-27T04:00:00Z', 'not-me@example.test');
    git('mv', 'first.txt', 'renamed with space.txt'); commit('rename file', '2026-10-27T05:00:00Z');
    await writeFile(join(repo, 'tomorrow.txt'), 'next\n'); commit('tomorrow', '2026-10-28T00:00:00Z');
    const warnings: string[] = [], warn = (m: string): void => {warnings.push(m);};
    const commits = await collectGit([root, repo], period, ['ME@example.test'], false, warn);
    expect(commits.map(c => c.message)).toEqual(['root change', 'rename file']);
    expect(commits[0]?.additions).toBe(2); expect(commits[1]?.files).toEqual(['first.txt', 'renamed with space.txt']);
    expect(commits[1]?.deletions).toBe(2); expect(warnings).toEqual([]);
    expect((await collectGit([repo], period, [], false, warn)).length).toBe(2);
    expect((await collectGit([repo], period, [], true, warn)).length).toBe(4);
    git('worktree', 'add', '-b', 'worktree-fixture', join(root, 'worktree'));
    expect((await collectGit([join(root, 'worktree')], period, [], false, warn)).length).toBe(2);
  });
  it('parses binary and filenames containing tabs/newlines', () => {
    expect(parseNumstat('2\t1\tname\twith\nnewline\0-\t-\timage.png\0')).toEqual({files: ['name\twith\nnewline', 'image.png'], additions: 2, deletions: 1, binaryFiles: 1});
  });
  it('warns instead of crashing on an empty repository', async () => {
    const root = await directory(); execFileSync('git', ['init', '-b', 'main', root], {stdio: 'pipe'});
    const warnings: string[] = [];
    expect(await collectGit([root], period, ['me@example.test'], false, m => warnings.push(m))).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
describe('session adapters', () => {
  async function fixture(name: string): Promise<{root: string; project: string; warnings: string[]}> {
    const root = await directory(), project = join(root, 'project'); await mkdir(project);
    const content = await readFile(new URL(`./fixtures/${name}.jsonl`, import.meta.url), 'utf8');
    await writeFile(join(root, 'session.jsonl'), content.replaceAll('__PROJECT__', project.replaceAll('\\', '\\\\')));
    return {root, project, warnings: []};
  }
  it('reads both Codex turn shapes without double counting or exposing tool output', async () => {
    const {root, project, warnings} = await fixture('codex');
    const rows = await new CodexAdapter().read(root, {period, roots: [project], warn: m => warnings.push(m)});
    expect(rows.filter(r => r.kind === 'task').map(r => r.summary)).toEqual(['Fix weekly task migration', 'Add a regression test']);
    expect(rows.flatMap(r => r.files)).toEqual(['src/week.ts']);
    expect(JSON.stringify(rows)).not.toContain('unverified'); expect(JSON.stringify(rows)).not.toContain('SECRET'); expect(warnings).toEqual([]);
  });
  it('preserves repeated Codex requests and reads JSON function-call patches', async () => {
    const root = await directory();
    const rows = [
      {type: 'session_meta', payload: {cwd: root}},
      ...['09:00:00', '09:00:01', '09:01:00', '09:01:01'].map((time, i) => ({timestamp: `2026-10-27T${time}Z`, type: i % 2 ? 'response_item' : 'event_msg', payload: i % 2 ? {type: 'message', role: 'user', content: [{type: 'input_text', text: 'continue'}]} : {type: 'user_message', message: 'continue'}})),
      {timestamp: '2026-10-27T09:02:00Z', type: 'response_item', payload: {type: 'function_call', name: 'apply_patch', arguments: JSON.stringify({patch: '*** Add File: new.ts\n*** Move to: moved.ts'})}}
    ];
    await writeFile(join(root, 'log.jsonl'), rows.map(r => JSON.stringify(r)).join('\n'));
    const activities = await new CodexAdapter().read(root, {period, roots: [root], warn: () => {}});
    expect(activities.filter(r => r.kind === 'task')).toHaveLength(2);
    expect(activities.flatMap(r => r.files)).toEqual(['new.ts', 'moved.ts']);
  });
  it('reads Claude user text and file paths, skips duplicates, meta, reasoning and results', async () => {
    const {root, project, warnings} = await fixture('claude');
    const rows = await new ClaudeAdapter().read(root, {period, roots: [project], warn: m => warnings.push(m)});
    expect(rows.map(r => r.kind)).toEqual(['task', 'file']);
    expect(rows[0]?.summary).toBe('Improve the report layout'); expect(rows[1]?.files).toEqual(['src/report.ts']);
    expect(JSON.stringify(rows)).not.toMatch(/MUST NOT APPEAR|PRIVATE|unverified/); expect(warnings).toEqual([]);
  });
  it('ignores absent session directories and warns for unknown formats', async () => {
    const root = await directory(), warnings: string[] = [], context = {period, roots: [root], warn: (m: string): void => {warnings.push(m);}};
    for (const adapter of [new CodexAdapter(), new ClaudeAdapter()]) {
      expect(await adapter.read(join(root, 'missing'), context)).toEqual([]);
      await writeFile(join(root, 'unknown.jsonl'), '{"new_schema":true}\nnot-json');
      expect(await adapter.read(root, context)).toEqual([]);
    }
    expect(warnings.some(w => w.includes('Unknown Codex'))).toBe(true);
    expect(warnings.some(w => w.includes('Unknown Claude'))).toBe(true);
  });
});
describe('privacy and output', () => {
  it('redacts credentials, auth headers, private keys and Unix/Windows paths without damaging URLs', () => {
    const raw = 'sk-proj-abcdefghijklmnopqrstuvwxyz ghp_abcdefghijklmnopqrstuvwxyz github_pat_abcdefghijklmnopqrstuvwxyz AKIAABCDEFGHIJKLMNOP\napi_key="super-secret-value" token: abc123\nAuthorization: Bearer abc.def.ghi\n/home/alice/work/main.ts C:\\Users\\Alice\\work\\main.ts\nhttps://api.example.test/v1\n-----BEGIN RSA PRIVATE KEY-----\nSENSITIVE\n-----END RSA PRIVATE KEY-----';
    const result = redact(raw);
    expect(result).not.toMatch(/super-secret|abc123|abc.def.ghi|abcdefghijklmnopqrstuvwxyz|SENSITIVE|alice|Alice/);
    expect(result).toContain('https://api.example.test/v1');
  });
  it('redacts truncated private keys in request summaries', () => {
    expect(redact('-----BEGIN PRIVATE KEY-----\nSENSITIVE PARTIAL')).not.toContain('SENSITIVE');
  });
  it('redacts exact roots with spaces and does not remove relative paths', () => {
    expect(redact('/work/my project/src/test.ts src/test.ts', ['/work/my project'])).toBe('[PATH]/src/test.ts src/test.ts');
  });
  it.each(['zh', 'en'] as const)('renders empty reports and explicit evidence limits in %s', language => {
    const result = renderReport(empty, language, 'daily');
    expect(result).toContain(language === 'zh' ? '未找到' : 'No matching');
    expect(result).toContain(language === 'zh' ? '请求不等于完成' : 'requests do not imply completion');
  });
  it('escapes Markdown injections and leaves OKR unknown instead of fabricating progress', () => {
    const result = renderReport({...empty, commits: [{repository: '/test/project', hash: '123456789', email: 'me@example.test', timestamp: '2026-10-27T09:00:00Z', message: '[click](https://evil.test)\n# fake', files: ['<script>.ts'], additions: 1, deletions: 0, binaryFiles: 0}]}, 'en', 'okr');
    expect(result).toContain('to fill in'); expect(result).toContain('\\[click\\]'); expect(result).not.toContain('\n# fake');
  });
});
describe('configuration', () => {
  it('rejects invalid shapes without displaying sensitive input', () => {
    for (const config of [null, [], {roots: []}, {roots: [4]}, {language: 'fr'}, {codexPath: false}, {ai: {}}, {ai: {baseURL: 'https://example.test/v1', model: 'm', apiKeyEnv: 5}}]) expect(() => validateConfig(config)).toThrow();
  });
  it('saves and loads without overwriting by default', async () => {
    const root = await directory(), path = join(root, 'config.json');
    const config = validateConfig({roots: [root], codexPath: null, claudePath: null});
    await saveConfig(path, config); expect(await loadConfig(path, true)).toEqual(config);
    await expect(saveConfig(path, config)).rejects.toThrow();
    await writeFile(path, '{secret-data'); await expect(loadConfig(path, true)).rejects.toThrow('Invalid config JSON');
    await expect(loadConfig(join(root, 'missing'), true)).rejects.toThrow('Cannot read');
  });
  it('resolves environment overrides and custom key variable', () => {
    const config = validateConfig({ai: {baseURL: 'https://example.test/v1', model: 'original', apiKeyEnv: 'CUSTOM_KEY'}});
    expect(resolveAI(config, {CUSTOM_KEY: 'test-value', DEVLOG_MODEL: 'override'})).toMatchObject({model: 'override', apiKey: 'test-value'});
    expect(() => resolveAI(validateConfig({}), {})).toThrow();
  });
});
describe('opt-in AI', () => {
  it('uses HTTPS, allows local HTTP and rejects credential URLs or redirects', () => {
    expect(endpoint('https://example.test/v1/').href).toBe('https://example.test/v1/chat/completions');
    expect(endpoint('http://localhost:1234/v1').protocol).toBe('http:');
    for (const url of ['http://example.test/v1', 'https://user:pass@example.test/v1', 'https://example.test/v1?key=secret']) expect(() => endpoint(url)).toThrow();
  });
  it('redacts before sending, disables redirects and keeps untrusted data in the user message', async () => {
    let body = '';
    const fake: typeof fetch = async (_url, options) => { body = String(options?.body); expect(options?.redirect).toBe('error'); return new Response(JSON.stringify({choices: [{message: {content: 'Verified summary'}}]})); };
    const result = await polishReport('api_key=secret-value /home/alice/work/file.ts', {baseURL: 'https://example.test/v1', model: 'test-model', apiKeyEnv: 'TEST', apiKey: 'test-value'}, 'en', [], fake);
    expect(body).not.toContain('secret-value'); expect(body).not.toContain('alice'); expect(body).toContain('untrusted evidence'); expect(result).toContain('AI-polished draft');
  });
  it('fails safely without exposing provider errors or sending excessive data', async () => {
    const config = {baseURL: 'https://example.test/v1', model: 'test', apiKeyEnv: 'TEST', apiKey: 'test-value'};
    await expect(polishReport('test', config, 'en', [], async () => new Response('secret-provider-body', {status: 401}))).rejects.toThrow('AI HTTP 401');
    await expect(polishReport('test', config, 'en', [], async () => new Response('{}'))).rejects.toThrow('missing');
    await expect(polishReport('test', config, 'en', [], async () => {throw new Error('secret-network-body');})).rejects.toThrow('no response body');
    await expect(polishReport('x'.repeat(100_001), config, 'en', [], async () => {throw new Error('must not call');})).rejects.toThrow('100,000');
  });
});
