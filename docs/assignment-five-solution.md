# 作业五方案：Co-Growth OS｜共进学习舱

## 问题诊断

AI 培训不能停留在课程或按钮。真实问题是：员工会用 AI，却不理解模型原理、上下文、幻觉、RAG、Agent 工具调用和治理；学习又常被交付打断，难以形成证据闭环。

## 方案设计

Co-Growth OS 将“AI 原理、工作 mission、复盘、成长证据、AI Coach 和组织趋势”连接成闭环。核心不是评价员工，而是帮助员工理解 AI、在工作中安全使用 AI，并通过证据看见成长。AI Literacy Map 只用成长阶段、学习信号和证据充分度。

## AI 工具选型理由

Demo 采用 deterministic mock AI，不调用外部 LLM，便于公网演示和保护隐私。真实系统仍保持“前端调用 Go，Go 管授权、scope、审计，Python agent 只接收授权上下文”的边界。

## 技术实现

前端保持 React + TypeScript + Vite + Ant Design。新增独立 `/co-growth` 页面、demo adapter、12 名样本、AI Coach、mission、原理卡、workflow lab、团队热力图和证据线。Demo mode 无需 Go/PostgreSQL。

## 关键配置

设置 `VITE_DEMO_MODE=true`。构建命令为 `npm run web:build`，访问 `/co-growth`。

## 迭代记录

先确认产品边界和安全约束，再实现 demo 数据、页面、路由菜单、学习/AI/Agent/审计轻量增强，最后补文档和验证。

## 效果评估

Demo 展示 Learn AI、Work with AI、Reflect with AI、Grow with AI、Balance、Govern：偏好可调，推荐会变化，每条建议含 riskLevel、confidence、evidence、impactOnWork 和 humanReviewRequired。

## 风险与边界

系统不把学习信号用于人事裁决。Agent Workflow Lab 只面向具备编程基础者，因为它涉及 state、node、edge、工具权限和审计。高风险建议必须 human-in-the-loop。
