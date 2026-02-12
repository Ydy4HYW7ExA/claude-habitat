# Claude Habitat

AI 认知操作系统 — 基于 Claude Code SDK 的多智能体编排系统。

## 技术栈
- TypeScript (strict), ESM modules
- Node.js >= 18
- @anthropic-ai/claude-agent-sdk@0.2.39
- zod v4, nanoid, vitest

## 开发规范
- TDD: 先写测试，再写实现
- 所有代码必须通过 `npm test` 和 `npm run typecheck`
- 使用 vitest 进行测试
- 纯文件系统存储，零外部服务依赖
- DDD 六大限界上下文：Position, Memory, Workflow, Attention, Orchestration, AI
