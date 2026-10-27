# Session adapters / 会话适配器

The adapters are best-effort readers, not a stable vendor API. They inspect JSONL records rather than trusting a filename to imply a schema. No real user sessions are bundled. This project's development environment did not contain local Codex / Claude sessions; fixtures are synthetic, based on the vendor shapes referenced below. Live-version compatibility must be validated with anonymized samples as upstream formats evolve.

当前开发环境没有本机会话文件。测试样本按官方记录结构合成，并不代表覆盖所有版本。格式变化可能导致部分记录缺失；请留意采集提示。

## Codex CLI

Default: `~/.codex/sessions/**/*.jsonl`.

Supported records:

- `session_meta.payload.cwd` / `.id` establish project and session.
- `turn_context.payload.cwd` updates project context.
- `event_msg.payload.type = user_message`, text in `payload.message`.
- `response_item.payload.type = message`, `role = user`, text in `content[].text` for `input_text` / `text` parts.
- Paired messages with identical full text across these two channels within 5 seconds are counted once. Repeated requests on the same channel are retained, subject to identical event deduplication.
- `response_item` with `function_call` or `custom_tool_call`: recognized `apply_patch` inputs yield Add/Update/Delete/Move file paths. JSON arguments and raw patch text are accepted. Direct recognized read/write/edit tool names are also supported.

Shell commands are **not** parsed for paths. `function_call_output`, token counts, model reasoning and assistant text are ignored. Tool calls only establish referenced files, not success.

Upstream references:

- [Codex rollout model context](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/model_context.rs)
- [Codex rollout reconstruction tests](https://github.com/openai/codex/blob/main/codex-rs/core/src/session/rollout_reconstruction_tests.rs)
- [Codex session storage](https://github.com/openai/codex/blob/main/codex-rs/core/src/session/mod.rs)

## Claude Code

Default: `~/.claude/projects/**/*.jsonl` (including nested JSONL files).

Supported records:

- Top-level `type = user|assistant`, `timestamp`, `cwd`, optional `sessionId` / `uuid`.
- User `message.content` as a string or a list of text parts; `isMeta` user messages are ignored.
- Assistant `message.content[]` with `type = tool_use`, tool `name` and `input`.
- Read/Edit/Write/MultiEdit use `input.file_path`; NotebookEdit uses `input.notebook_path`.
- Repeated UUIDs and tool IDs within the same session are ignored.

`tool_result` and thinking blocks are never included. Known metadata records are ignored. Message records without an absolute in-scope `cwd` are skipped rather than guessing the project from directory encoding.

Upstream references:

- [Claude Code programmatic use and transcript resumption](https://code.claude.com/docs/en/headless)
- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code monitoring and tool field definitions](https://code.claude.com/docs/en/monitoring-usage)

## Add another adapter

Implement `SessionAdapter` in `src/types.ts`, add it to CLI collection, and provide synthetic fixtures with:

1. Valid user task and file reference.
2. Out-of-period and out-of-root events.
3. Corrupt and unknown records.
4. Replayed or duplicate events.
5. Secret tool output that must not appear in a report.

Never execute extracted commands or treat assistant claims as verified outcomes. Keep a clear distinction between requests and commits.
