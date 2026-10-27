# Security and privacy

`devlog` reads local Git metadata and AI conversation records. These records can contain credentials or private information.

- Offline mode makes no network requests.
- AI mode sends a best-effort redacted report to the configured endpoint.
- Redaction is not a guarantee. Review reports before sharing or enabling AI.
- Only HTTPS is allowed for external AI endpoints; HTTP is allowed for loopback hosts. Redirects are rejected.
- Session files are treated as data; extracted commands are never executed.
- Never include real secrets or full private transcripts in public issues.

For a vulnerability with sensitive details, use GitHub private vulnerability reporting if available on this repository. If unavailable, open an issue asking for a private reporting channel without including the exploit, credentials or private data.

Only the current development version is maintained at this stage.
