import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
const exec = promisify(execFile), temps: string[] = [];
const cli = resolve('src/cli.ts');
const loader = resolve('node_modules/tsx/dist/loader.mjs');
async function run(args: string[], env: NodeJS.ProcessEnv = {}): Promise<{stdout: string; stderr: string}> {
  return exec(process.execPath, ['--import', loader, cli, ...args], {env: {...process.env, ...env}, timeout: 15_000});
}
async function fixture(): Promise<{root: string; config: string}> {
  const root = await mkdtemp(join(tmpdir(), 'devlog-cli-')); temps.push(root);
  const config = join(root, 'config.json'); await writeFile(config, JSON.stringify({roots: [root], codexPath: null, claudePath: null}));
  return {root, config};
}
afterEach(async () => {await Promise.all(temps.splice(0).map(path => rm(path, {recursive: true, force: true})));});
describe('CLI end-to-end', () => {
  it('prints help and version', async () => {
    expect((await run(['--help'])).stdout).toContain('No telemetry');
    expect((await run(['--version'])).stdout.trim()).toBe('0.1.0');
  });
  it('renders in both languages, writes output safely and refuses invalid commands', async () => {
    const {root, config} = await fixture(), output = join(root, 'report.md');
    const args = ['range', '--since', '2026-10-27', '--until', '2026-10-27', '--config', config];
    expect((await run(args)).stdout).toContain('工作日报');
    expect((await run([...args, '--lang', 'en'])).stdout).toContain('Daily work report');
    await run([...args, '--output', output]); expect(await readFile(output, 'utf8')).toContain('工作日报');
    await expect(run([...args, '--output', output])).rejects.toThrow();
    await run([...args, '--output', output, '--force']);
    for (const invalid of [['range'], ['oops'], ['today', '--lang', 'fr'], ['today', '--template', 'fake'], ['today', '--all-authors', '--email', 'a@b.test']]) await expect(run(invalid)).rejects.toThrow();
  });
  it('initializes noninteractively without clobbering config', async () => {
    const {root} = await fixture(), path = join(root, 'new-config.json');
    await run(['init', '--yes', '--config', path]);
    expect(JSON.parse(await readFile(path, 'utf8'))).toHaveProperty('roots');
    await expect(run(['init', '--yes', '--config', path])).rejects.toThrow();
    await run(['init', '--yes', '--force', '--config', path]);
  });
  it('makes no API request by default, uses --ai explicitly and falls back on failure', async () => {
    const {config} = await fixture(); let calls = 0;
    const server = createServer((_req, res) => {calls++; res.writeHead(500); res.end('PRIVATE PROVIDER ERROR');});
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    try {
      const address = server.address(); if (!address || typeof address === 'string') throw new Error('no address');
      const env = {DEVLOG_BASE_URL: `http://127.0.0.1:${address.port}/v1`, DEVLOG_MODEL: 'fixture', DEVLOG_API_KEY: ''};
      expect((await run(['today', '--config', config], env)).stdout).toContain('工作日报'); expect(calls).toBe(0);
      const result = await run(['today', '--config', config, '--ai'], env);
      expect(calls).toBe(1); expect(result.stdout).toContain('工作日报'); expect(result.stderr).toContain('kept the offline report');
      expect(result.stderr + result.stdout).not.toContain('PRIVATE PROVIDER ERROR');
    } finally { await new Promise<void>((r, reject) => server.close(e => e ? reject(e) : r())); }
  });
});
