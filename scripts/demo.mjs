import { URL } from 'node:url';
import process from 'node:process';
// Generates reproducible examples from synthetic data, never from the user's projects.
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = await mkdtemp(join(tmpdir(), 'devlog-demo-'));
const env = {...process.env, TZ: 'UTC'};
try {
  const project = join(root, 'sample-project'); await mkdir(project);
  const git = (...args) => execFileSync('git', args, {cwd: project, env, stdio: 'pipe'});
  git('init', '-b', 'main'); git('config', 'user.email', 'demo@example.test'); git('config', 'user.name', 'Demo User');
  for (const [file, body, message, date] of [
    ['planner.ts', 'export const tasks = [];\n', 'feat: add weekly task planner', '2026-10-26T09:00:00Z'],
    ['migration.ts', 'export const migrate = tasks => [...new Set(tasks)];\n', 'fix: deduplicate migrated tasks', '2026-10-27T09:30:00Z'],
    ['README.md', '# Sample project\n\nA synthetic demo.\n', 'docs: explain task migration', '2026-10-27T10:00:00Z']
  ]) {
    await writeFile(join(project, file), body); git('add', '.');
    execFileSync('git', ['commit', '-m', message], {cwd: project, env: {...env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date}, stdio: 'pipe'});
  }
  const sessions = join(root, 'sessions'); await mkdir(sessions);
  const codex = await readFile(new URL('../test/fixtures/codex.jsonl', import.meta.url), 'utf8');
  await writeFile(join(sessions, 'demo.jsonl'), codex.replaceAll('__PROJECT__', project.replaceAll('\\', '\\\\')));
  const config = join(root, 'config.json');
  await writeFile(config, JSON.stringify({roots: [project], emails: ['demo@example.test'], codexPath: sessions, claudePath: null}));
  for (const lang of ['zh', 'en']) {
    const output = execFileSync(process.execPath, [resolve('dist/cli.js'), 'range', '--since', '2026-10-26', '--until', '2026-10-27', '--config', config, '--template', 'weekly', '--lang', lang, '--redact'], {env, encoding: 'utf8'});
    await writeFile(resolve(`docs/example-weekly.${lang}.md`), output);
  }
  process.stdout.write('Generated synthetic example reports in docs/.\n');
} finally { await rm(root, {recursive: true, force: true}); }
