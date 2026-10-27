import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { walk } from './fs.js';
import { inPeriod } from './time.js';
const exec = promisify(execFile);
async function git(cwd, args) {
    const result = await exec('git', ['-c', 'core.quotepath=false', ...args], {
        cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30_000,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
    });
    return result.stdout;
}
export function parseNumstat(raw) {
    const result = { files: [], additions: 0, deletions: 0, binaryFiles: 0 };
    for (const record of raw.split('\0').filter(Boolean)) {
        const match = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(record);
        if (!match)
            continue;
        result.files.push(match[3]);
        if (match[1] === '-' || match[2] === '-')
            result.binaryFiles++;
        else {
            result.additions += Number(match[1]);
            result.deletions += Number(match[2]);
        }
    }
    return result;
}
export async function collectGit(roots, period, emails, allAuthors, warn) {
    const repositories = new Set();
    for (const root of roots)
        for await (const item of walk(root, warn))
            if (item.repository)
                repositories.add(item.path);
    const commits = [];
    for (const repository of [...repositories].sort()) {
        try {
            const allowed = new Set(emails.map(email => email.toLowerCase()));
            if (!allowed.size && !allAuthors) {
                const email = (await git(repository, ['config', 'user.email'])).trim();
                if (email)
                    allowed.add(email.toLowerCase());
            }
            if (!allAuthors && !allowed.size) {
                warn(`No author email configured; skipped repository: ${repository}`);
                continue;
            }
            // Filter author timestamps ourselves, including out-of-order commit dates.
            // Only commits reachable from HEAD are included; merge commits are excluded.
            const raw = await git(repository, ['log', '--no-merges', '-z', '--format=%H%x00%aI%x00%ae%x00%s', 'HEAD']);
            const fields = raw.split('\0');
            for (let i = 0; i + 3 < fields.length; i += 4) {
                const [hash, timestamp, email, message] = fields.slice(i, i + 4);
                if (!inPeriod(timestamp, period) || (!allAuthors && !allowed.has(email.toLowerCase())))
                    continue;
                const stats = parseNumstat(await git(repository, ['diff-tree', '--root', '--no-commit-id', '--numstat', '-r', '-z', '--no-renames', hash]));
                commits.push({ repository, hash, timestamp, email, message, ...stats });
            }
        }
        catch (error) {
            const code = objectCode(error);
            if (code === 'ENOENT')
                throw new Error('Git is not installed or not on PATH.');
            warn(`Cannot read Git history (empty repository, missing email, permission, timeout or size limit): ${repository}`);
        }
    }
    return commits.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.hash.localeCompare(b.hash));
}
function objectCode(error) {
    return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
}
//# sourceMappingURL=git.js.map