<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发，或在执行实现计划之前使用——通过原生工具或 git worktree 回退机制确保隔离工作区存在
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->

---

# 项目概述

- **项目名**：hotel-compare（酒店价格对比小程序）
- **技术栈**：
  - 前端：uni-app (Vue 3 + Vite) → 编译为微信小程序
  - 后端：Express + Puppeteer + stealth 插件 → 爬取四平台酒店价格
  - 状态管理：Pinia
  - 地图：高德 AMap API
- **服务器**：162.14.75.110:3001（Ubuntu，用户 ubuntu，SSH Key 已配置）
- **GitHub**：git@github.com:magj900530/test-AI.git（SSH 协议，别用 HTTPS）

# 项目核心规则

1. **爬虫只抓真实价格** — 不做任何估算/兜底（`_estimated` 已废弃），抓取不到就该平台显示"未上架"
2. **酒店匹配需名称+地址双重校验** — combinedScore = nameScore × 0.6 + addrScore × 0.4，阈值 0.35+
3. **修改代码后必须验证编译** — 前端 `npm run build:mp-weixin`，后端 scp 到服务器后重启
4. **Git 推送用 SSH** — HTTPS 被 GFW 阻断，远程用 `git@github.com:magj900530/test-AI.git`

# 常用命令

| 操作 | 命令 |
|------|------|
| 前端编译 | `cd D:/AI项目/hotel-compare && npm run build:mp-weixin` |
| 后端部署 | `scp 文件 ubuntu@162.14.75.110:~/hotel-scraper-server/` |
| 后端重启 | `ssh ubuntu@162.14.75.110 'pm2 restart hotel-scraper'` |
| 清除缓存 | `curl -X POST http://162.14.75.110:3001/api/cache/flush` |
| 健康检查 | `curl http://162.14.75.110:3001/api/health` |
| 测试爬虫 | `curl "http://162.14.75.110:3001/api/hotels/prices?hotelName=酒店名&city=城市&address=地址"` |

# 目录结构

```
D:/AI项目/
├── hotel-compare/                # 酒店比价小程序（uni-app 前端 + 爬虫后端）
│   ├── src/                      # 前端源码
│   │   ├── components/           # Vue 组件
│   │   ├── pages/                # 页面 (index/detail/search/recommend)
│   │   ├── stores/               # Pinia stores (hotel, location, preference)
│   │   └── utils/                # 工具 (amap, hotel-adapter, ranking, request)
│   └── hotel-scraper-server/     # 后端爬虫
│       └── scrapers/             # 四平台爬虫 (meituan/xiecheng/qunar/feizhu)
├── rag-project/                  # RAG 知识库问答系统
│   ├── src/                      # 核心模块 (embed, retrieve, rerank, chunk...)
│   ├── eval/                     # 评估脚本 (adapter, eval_retrieval...)
│   ├── data/                     # 原始文档
│   └── chroma_db/                # ChromaDB 向量库
├── IFTFS/                        # 外贸智能跟单系统
│   ├── src/
│   │   ├── admin/                # Web 管理面板
│   │   ├── routes/               # API 路由
│   │   ├── services/             # AI 服务层
│   │   └── utils/                # 数据库等工具
│   └── scripts/                  # 工具脚本
└── template-claude.md            # 项目约束模板
```

# 微信 iLink 远程管控规则（V4.0）

## 1. 模式隔离

- **本地模式（默认）**：所有交互、进度、弹窗仅 PC 端可见，禁止向微信推送任何消息
- **远程模式**（微信发「开启远程」激活）：进度推送、高危审批转发、结果回传、告警通知
- 模式状态文件：`~/.claude/state/mode_state.json`

## 2. 远程操作权限分级

| 级别 | 操作类型 | 审批 |
|------|----------|------|
| 免审批 | 读文件、搜索、Bash 常规命令、非敏感文件 Edit | 无 |
| 高危拦截 | Write/Edit 敏感文件(.env/密钥)、rm -rf、git push -f、chmod 777、DROP TABLE 等 | PreToolUse Hook → 微信审批 |

## 3. 上下文防溢出

- 上下文占用 ≥ 40% 时自动 compact
- 保留：当前任务目标 + 最近 3 轮关键改动
- 测试日志/终端报错落地至 `./task_logs/`

## 4. 异常兜底

- 断网/API 异常：自动保存快照至 `./task_snapshot/`
- 审批超时 15 分钟：自动拒绝 + 回滚
- 所有推送内容自动脱敏（API Key → sk-***）

## 5. 多项目隔离

- VS Code 前台项目 = 唯一远程可操控项目
- 微信发送「切换到 xxx」可切换活跃项目
- 后台项目会话冻结，拦截远程指令

## 6. 微信指令速查

| 指令 | 效果 |
|------|------|
| `查看远程状态` | 模式/项目/上下文/审批队列 |
| `开启远程` / `关闭远程` | 切换模式 |
| `切换到 xxx` | 切换活跃项目 |
| `提权` / `永久提权` / `锁定` | SDK 会话权限管理 |
| `同意` / `拒绝` | 审批回复（也可写问题，自动拒绝+回答） |
| `compact` | 清理上下文 |
