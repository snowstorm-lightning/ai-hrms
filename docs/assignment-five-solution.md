# AI-HRMS｜人机共生的人力资源智能操作系统

## 问题诊断

传统 HRMS 主要记录员工、组织、考勤、课程和消息，是事后数据后台。AI Native 组织需要人和智能体共同完成 HR 工作：AI 可以检索制度、解释材料、生成计划、预览动作和触发 Agent run；人负责判断、确认、复盘和纠偏。HR AI 风险高，不能只追求自动化，必须展示证据、权限、范围、审计和人工确认。员工也需要持续学习 AI 原理，把 AI 安全嵌入模拟工作，Co-Growth OS 因此成为 AI-HRMS 的成长引擎。

## 方案设计

AI-HRMS 由五层组成：组织数据层、知识与学习层、智能体协作层、成长层、治理与信任层。Dashboard 是统一入口；AI Command Center 生成带 riskLevel、confidence、evidence、citation、toolPreview 和 humanReviewRequired 的建议；Knowledge Hub 管理可信资料、敏感级别、scope 和引用；Agent Run Center 展示 runType、delegated context、工具预览和人工确认；Audit Center 记录 AI 建议、工具调用、知识引用、Co-Growth 证据和高风险阻断。Co-Growth OS 不是整个系统，而是成长层亮点，帮助员工学习 AI 原理、完成工作 mission、复盘协作并沉淀证据。

产品与数据边界：AI-HRMS 是产品；“企鹅互联网科技有限公司”只是虚构样本组织和业务数据，用来让组织、员工、政策和审计路径可演示，不是腾讯，也不是任何真实公司的 HR 数据。

## AI 工具选型理由

React + Ant Design 适合企业级 UI 和复杂状态展示；Go 负责授权、scope、审计和业务 API；PostgreSQL/pgvector 作为系统数据与 RAG 向量底座；Python agent boundary 对接 DeepSeek OpenAI-compatible Chat Completions，并支持 OpenAI-compatible embedding provider。Demo 使用 deterministic mock AI，不调用外部 LLM，保护隐私并保证演示稳定。

## 关键配置

设置 `VITE_DEMO_MODE=true` 可运行纯前端 deterministic Demo。真实模式设置 `AGENT_BASE_URL`、`AI_HRMS_AGENT_SERVICE_TOKEN`、`AI_CHAT_PROVIDER=deepseek`、`DEEPSEEK_API_KEY`、`AI_EMBEDDING_PROVIDER`、`OPENAI_COMPATIBLE_EMBEDDING_*` 和正确的 `RAG_EMBEDDING_DIMENSIONS`，由 Python agent 调用模型，Go 继续控制权限、scope 和审计。

Visual Copilot 在当前 DeepSeek 配置下是 text-only 边界：只使用 DOM hints、路由上下文和已校验业务对象解释页面选择，不向 DeepSeek 上传截图，也不声称具备 OCR 或像素级图像理解。

## 效果评估

3 分钟路径可从登录进入 Dashboard，依次展示 AI 指挥、知识治理、Co-Growth、Agent run 和审计证据链。系统体现人机协作、引用证据、AI 学习成长、治理边界和 human-in-the-loop。讲解时必须把公司名、员工、制度和 citation 说成虚构样本组织数据，避免被理解为腾讯或任何真实企业数据。

## 风险与边界

系统不做自动化晋升、淘汰、降薪、绩效或录用裁决。高风险建议只能生成预览、请求人工确认和写入审计，最终判断由人负责。
