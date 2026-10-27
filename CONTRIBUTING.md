# Contributing / 参与贡献

欢迎提交 Issue 和 PR。小修复可以直接提交；增加数据源或改变隐私行为时，请先在 Issue 中说明数据来源和预期行为。

## Local setup

```sh
git clone https://github.com/qianqian777899/devlog.git
cd devlog
npm ci
npm run check
```

Use Node.js 20+ and Git. Keep runtime dependencies at zero unless there is a concrete need. Do not add telemetry or implicit network requests.

## Pull requests

- Explain the concrete problem and resulting behavior.
- Add meaningful tests for new parsing, time, attribution or privacy behavior.
- Run `npm run check`, then include the regenerated `dist/` files.
- Keep Chinese and English README instructions consistent.
- Use synthetic or thoroughly anonymized fixtures. Never commit real session logs, API keys, personal paths or customer data.
- Do not infer completed work from a user request or an attempted tool call.

## Reporting a format issue

Include your OS, Node version, tool version, expected behavior and a minimal sanitized JSONL example. Replace all project names, personal paths, prompt content, tool output and credentials. Preserve only field shapes needed to reproduce the bug.

请勿把完整私密会话贴到公开 Issue。安全问题请参考 [SECURITY.md](SECURITY.md)。

Contributions are provided under the project's MIT license.
