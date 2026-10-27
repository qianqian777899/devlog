import { homedir } from 'node:os';
function escape(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function redact(text, paths = []) {
    let result = text
        .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED_PRIVATE_KEY]')
        .replace(/\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[A-Z0-9]{16})\b/g, '[REDACTED_TOKEN]')
        .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
        .replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|authorization)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;\r\n}]+)/gi, '$1[REDACTED]')
        .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1[REDACTED]@');
    for (const path of [...new Set([...paths, homedir()])].filter(p => p.length > 1).sort((a, b) => b.length - a.length)) {
        result = result.replace(new RegExp(escape(path) + '(?=$|[/\\\\\\s"\'`):,])', 'g'), '[PATH]');
    }
    result = result.replace(/\b[A-Za-z]:[\\/][^\s"'`<>|)\]}]+/g, '[PATH]');
    // Leave HTTPS URLs intact, including API paths. POSIX paths are token-based;
    // paths with spaces are best covered by passing exact scan roots above.
    result = result.replace(/(^|[\s("'`=:[])(\/(?!\/)[^\s"'`<>),\]}]+)/gm, '$1[PATH]');
    return result;
}
//# sourceMappingURL=redact.js.map