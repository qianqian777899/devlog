<div align="center">

# devlog

**把 Git 提交与 AI 编程会话，整理成有据可查的工作记录。**

默认离线 · 零运行时依赖 · Codex CLI / Claude Code · 中英双语 · MIT

[English](README.en.md) · [快速开始](#快速开始) · [示例周报](docs/example-weekly.zh.md) · [参与贡献](CONTRIBUTING.md)

[![CI](https://github.com/qianqian777899/devlog/actions/workflows/ci.yml/badge.svg)](https://github.com/qianqian777899/devlog/actions/workflows/ci.yml)

</div>

你一天做了不少事，到了写日报时却想不起来。Git 记住了提交，AI 工具记住了任务，`devlog` 把两者放进同一份 Markdown 报告。

```sh
devlog today --root ~/code --redact
devlog week --lang zh --output weekly.md
```

![基于虚构测试仓库的真实 CLI 输出演示](docs/demo.gif)

> v0.1.0：可用的第一版。GitHub 源码安装可用；尚未发布到 npm registry。包名预设为 `@qianqian777899/devlog`，命令名是 `devlog`。请勿直接运行 `npx devlog`，那可能是其他作者的同名包。

## 能做什么

| 功能 | 行为 |
| --- | --- |
| `today` / `week` / `range` | 今天、本周（周一至今天）、自定义日期 |
| 递归扫描 Git 仓库 | 包含 `.git` 目录和 worktree 的 `.git` 文件；重叠目录去重 |
| 作者筛选 | 精确匹配邮箱，默认读取各仓库 `git config user.email` |
| AI 会话适配器 | Codex CLI 与 Claude Code 的 JSONL；提取用户请求与工具涉及文件 |
| 默认离线 | 不联网、不遥测、不执行日志中的命令 |
| 可选 `--ai` | 显式开启后，发送脱敏报告到你指定的 OpenAI 兼容接口 |
| Markdown 模板 | 日报、周报、OKR；`zh` / `en` |
| `--redact` | 遮盖常见凭证、私钥、绝对路径；同时处理采集提示 |

## 快速开始

需要 **Node.js 20+**、**Git**。支持 macOS、Linux、Windows；Windows 示例可用 PowerShell 执行，目录换成自己的路径。

从 GitHub 安装已提交的构建版本：

```sh
npm install --global github:qianqian777899/devlog
devlog --help
devlog init
devlog today
```

或从源码运行：

```sh
git clone https://github.com/qianqian777899/devlog.git
cd devlog
npm ci
npm run build
node dist/cli.js today --root /path/to/your/projects --redact
# 可选：注册本机 devlog 命令
npm link
```

不想交互时：`devlog init --yes`。默认配置保存在 `~/.config/devlog/config.json`；已有文件不会被覆盖，除非加 `--force`。未创建配置时，默认扫描当前工作目录。

## 常用命令

```sh
# 多目录；--root 替换配置目录，--email 替换配置邮箱，可多次指定
devlog today --root ~/code --root ~/side-projects --email me@example.com

# 当前分支可达的本周提交 + 同目录范围的 AI 会话
devlog week --template weekly --lang zh --redact --output weekly.md

# 起止日期都包含在内（机器本地时区）
devlog range --since 2026-10-19 --until 2026-10-25

# ISO 时间必须有时区；ISO --until 为排除上界
devlog range --since 2026-10-27T00:00:00+08:00 --until 2026-10-28T00:00:00+08:00

# 英文 OKR 进展证据；不自动捏造目标或完成率
devlog week --template okr --lang en

# 只读 Git；汇总所有作者需显式开启
devlog today --no-sessions
devlog week --all-authors

# 覆盖已存在的报告
devlog week --output weekly.md --force
```

`stdout` 仅输出报告，采集提示写到 `stderr`；可安全重定向。输出文件父目录需要已存在。没有数据时返回空报告，不会编造工作。

## 配置

完整示例见 [config.example.json](docs/config.example.json)。`null` 可关闭某个会话源。

```json
{
  "roots": ["~/code"],
  "emails": ["me@example.com"],
  "language": "zh",
  "codexPath": "~/.codex/sessions",
  "claudePath": "~/.claude/projects",
  "ai": {
    "baseURL": "https://api.openai.com/v1",
    "model": "your-model-id",
    "apiKeyEnv": "DEVLOG_API_KEY"
  }
}
```

目录建议填绝对路径或 `~/...`。相对路径以运行命令时的工作目录解析。没有指定邮箱时逐仓库读取 `user.email`；缺少邮箱会跳过仓库并提示。`--all-authors` 只影响 Git；会话按项目目录筛选，不推断登录用户。

### 可选 AI 润色

`--ai` 会把**生成的脱敏报告**发送到你配置的服务商。请先确认服务商与报告内容适合你的项目；默认不会触发请求。

```sh
# macOS / Linux
export DEVLOG_API_KEY="your-key"
export DEVLOG_BASE_URL="https://your-provider.example/v1"
export DEVLOG_MODEL="your-model-id"
devlog week --ai --redact
```

```powershell
# PowerShell
$env:DEVLOG_API_KEY = "your-key"
$env:DEVLOG_BASE_URL = "https://your-provider.example/v1"
$env:DEVLOG_MODEL = "your-model-id"
devlog week --ai --redact
```

接口调用为 `POST {baseURL}/chat/completions`。适用于实现此协议的服务，包括配置正确的 DeepSeek、通义或本地服务；不同厂商的扩展参数与特殊鉴权不在第一版范围内。模型 ID 请填服务商实际支持的值。

- 环境变量优先于配置；`apiKeyEnv` 可指定其他密钥变量名。兼容配置内 `apiKey`，但建议使用环境变量。
- 外部接口要求 HTTPS；本机 `localhost` / `127.0.0.1` / `[::1]` 可使用 HTTP 且不要求密钥。
- 禁止跟随重定向，避免将鉴权信息转发给其他地址。
- 60 秒超时、100,000 字符输入上限、2 MiB 响应上限；失败回退到离线报告并提示，退出码仍为 0（因为报告已成功生成）。
- AI 输出带草稿标记，发送前应人工核对。其他命令/配置/写入错误退出码为 1。

## 数据与隐私边界

- **Git**：读取当前 `HEAD` 可达的非合并提交，按**作者时间**筛选，包含未推送提交。不包含其他分支、stash、未提交文件或 bare 仓库。不会修改仓库。
- **统计**：根提交正常计数；重命名按删除旧文件、增加新文件统计；二进制文件不计行数。行数是提交累计值，不能用来衡量绩效。
- **会话**：逐条按时间过滤；跨日会话只取报告时段内的事件。只纳入 `cwd` 位于扫描目录内的记录；缺失 `cwd` 的记录跳过。已删除的项目目录若保留绝对 `cwd`，仍按路径归属判定。
- **避免重复**：Codex 的两种用户消息格式配对去重；Claude 用 UUID / tool ID 去重。不同 worktree 的路径视作不同仓库，可能分别出现相同提交。
- **仅采集必要字段**：不读取项目源文件内容，不输出完整工具结果、模型思考内容或 assistant 的完成声明。用户请求最多保留 240 个字符，可能包含机密，请自行检查。
- **任务不等于成果**：AI 用户指令记录为“请求”；工具文件可能只是读取或尝试修改，不自动宣布任务已完成、测试通过或上线。
- **容错**：未知格式、坏行、超过 2 MiB 的单行跳过并提示。缺少默认会话目录视作未使用该工具。每次目录扫描最多 100,000 个目录项，忽略符号链接、`.git`、`node_modules`、`vendor`、构建与缓存目录。Git 单次调用 30 秒 / 32 MiB 上限，失败跳过仓库并提示。
- **脱敏是尽力匹配**：常见 token、键值凭证、私钥、Unix/Windows 绝对路径。未知格式的密钥、个人信息、带空格的非扫描根路径可能漏过。`--ai` 无论是否加 `--redact`，发送前都执行脱敏；这不等于“数据不上传”。

日志格式依据与限制见 [适配器说明](docs/adapters.md)。所有演示、fixture 和示例报告均为虚构测试数据。

## 开发与验证

```sh
npm ci
npm run check        # ESLint + TypeScript + Vitest + 构建
npm pack --dry-run   # 检查发布内容
```

测试使用临时 Git 仓库和合成 JSONL，覆盖日期边界、邮箱过滤、worktree、改名、损坏记录、重复消息、脱敏、CLI、离线行为与 AI 错误回退。CI 在 Node 20 / 22 / 24、Linux / Windows 上运行。

仓库包含 `dist/`，便于直接从 GitHub 安装；修改代码后需运行 `npm run build` 并提交构建结果。npm 发布流程见 [RELEASING.md](RELEASING.md)，需要仓库所有者自己的 npm 身份。

## 后续方向

- [ ] Cursor / Gemini CLI 适配器
- [ ] 基于配置的排除目录与自定义脱敏规则
- [ ] 飞书 / 钉钉导出（需用户显式授权）
- [ ] VS Code 插件

欢迎通过 [Issue](https://github.com/qianqian777899/devlog/issues) 提交匿名化的格式样本或使用反馈。请勿上传真实密钥或完整私密会话。

## 许可证

[MIT](LICENSE) © 2026 qianqian777899
