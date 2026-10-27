import { createReadStream } from 'node:fs';
import { readdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
export function expandPath(path) {
    return resolve(path === '~' ? homedir() : /^~[/\\]/.test(path) ? resolve(homedir(), path.slice(2)) : path);
}
export function isWithin(path, root) {
    const rel = relative(root, path);
    return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}
export async function canonicalRoots(roots, warn) {
    const result = new Set();
    for (const root of roots) {
        try {
            result.add(await realpath(expandPath(root)));
        }
        catch {
            warn(`Cannot access scan root: ${root}`);
        }
    }
    return [...result].sort();
}
const ignored = new Set(['.git', 'node_modules', 'vendor', '.next', 'dist', 'build', '.cache', '.venv', 'venv']);
export async function* walk(root, warn, maxEntries = 100_000) {
    const pending = [root];
    let visited = 0;
    while (pending.length) {
        const dir = pending.pop();
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            warn(`Cannot read directory: ${dir}`);
            continue;
        }
        if ((visited += entries.length) > maxEntries) {
            warn(`Scan entry limit reached: ${root}`);
            return;
        }
        const repository = entries.some(e => e.name === '.git' && !e.isSymbolicLink());
        yield { path: dir, repository };
        for (const entry of entries.sort((a, b) => b.name.localeCompare(a.name))) {
            if (entry.isDirectory() && !ignored.has(entry.name))
                pending.push(resolve(dir, entry.name));
        }
    }
}
export async function* jsonLines(file, warn) {
    // Avoid readline's unbounded allocation for giant tool-result records.
    const input = createReadStream(file);
    let parts = [], bytes = 0, dropping = false, bad = 0, oversized = 0;
    const maxLine = 2 * 1024 * 1024;
    function parse() {
        const line = Buffer.concat(parts).toString('utf8').replace(/^\uFEFF/, '').trim();
        parts = [];
        bytes = 0;
        if (!line)
            return;
        try {
            const value = JSON.parse(line);
            if (value && typeof value === 'object' && !Array.isArray(value))
                return value;
            bad++;
        }
        catch {
            bad++;
        }
    }
    try {
        for await (const chunk of input) {
            const buffer = chunk;
            let offset = 0;
            while (offset < buffer.length) {
                const newline = buffer.indexOf(10, offset);
                const end = newline < 0 ? buffer.length : newline;
                const part = buffer.subarray(offset, end);
                if (!dropping) {
                    bytes += part.length;
                    if (bytes > maxLine) {
                        dropping = true;
                        parts = [];
                        oversized++;
                    }
                    else
                        parts.push(part);
                }
                if (newline >= 0) {
                    if (!dropping) {
                        const row = parse();
                        if (row)
                            yield row;
                    }
                    parts = [];
                    bytes = 0;
                    dropping = false;
                }
                offset = end + 1;
            }
        }
        if (bytes && !dropping) {
            const row = parse();
            if (row)
                yield row;
        }
    }
    catch {
        warn(`Cannot read session file: ${file}`);
    }
    if (bad)
        warn(`Skipped ${bad} malformed JSONL record(s): ${file}`);
    if (oversized)
        warn(`Skipped ${oversized} oversized (>2 MiB) JSONL record(s): ${file}`);
}
export async function* sessionFiles(root, warn) {
    for await (const directory of walk(root, warn)) {
        let entries;
        try {
            entries = await readdir(directory.path, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.isFile() && entry.name.endsWith('.jsonl'))
                yield resolve(directory.path, entry.name);
        }
    }
}
export function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
//# sourceMappingURL=fs.js.map