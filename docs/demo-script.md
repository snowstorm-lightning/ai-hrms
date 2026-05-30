# AI-HRMS 3 分钟演示脚本

## 准备

```bash
VITE_DEMO_MODE=true npm run web:dev
```

打开 `http://127.0.0.1:5173/login`，点击“一键进入 AI-HRMS Demo”。

真实模式可额外启动 Python agent boundary，并配置 DeepSeek chat、OpenAI-compatible embedding provider 和 PostgreSQL/pgvector vector storage；演示脚本仍建议先用 deterministic demo 录屏，保证评审路径稳定。

边界口径：AI-HRMS 是产品；“企鹅互联网科技有限公司”只是虚构样本组织和业务数据，用来承载演示流程，不是腾讯、也不代表任何真实公司的 HR 数据。

## 0:00-0:20 定位

AI-HRMS 是人机共生的人力资源智能操作系统，不是传统 HRMS 加聊天框。AI 负责检索、解释、建议、生成计划和预览动作；人负责判断、确认、复盘和纠偏；系统负责权限、证据、审计和边界。

## 0:20-0:50 Dashboard

在 Command Dashboard 展示统一入口：组织数据、AI 指挥、知识治理、学习成长、Agent 运行和审计证据。讲清 Human-Agent workflow：Goal → Context → Agent Plan → Tool Preview → Human Review → Audit。

如果页面出现公司名，口播为“这里用虚构样本组织承载产品演示”，不要讲成真实企业案例。

## 0:50-1:20 AI Command Center

选择“生成新人 30 天成长计划”或“检查高风险建议”，点击生成。展示结构化输出：Answer、Evidence/Citation、riskLevel、confidence、Suggested Actions、Tool Preview、humanReviewRequired 和 Audit Preview。强调高风险场景没有“自动执行”。

## 1:20-1:45 Knowledge Hub

进入 Knowledge Hub，搜索新人计划。展示资料来源、trustLevel、sensitivity、status、scope 和 citation preview。说明敏感或草稿资料不能直接用于正式 AI 回答。

补一句：RAG 使用 PostgreSQL/pgvector 作为可部署向量底座，demo mode 中的引用是 deterministic mock 数据；真实模式需要正确配置 embedding provider、维度和 scope/sensitivity 过滤。

## 1:45-2:15 Co-Growth OS

进入 Co-Growth OS。说明它是 AI-HRMS 的成长引擎：员工学习 AI 原理，接受模拟工作 mission，记录 AI Work Journal，复盘人工修改和验证方式，沉淀 Growth Evidence Portfolio。

## 2:15-2:35 Agent Run Center

展示 Agent run cards：runType、status、riskLevel、provider/model、delegated context、tool preview、human confirmation status 和 audit status。点击“预览工具调用”，说明高风险 run 等待人工确认。

如展示 Visual Copilot，说明当前 DeepSeek 边界是 text-only：只解释 DOM 提示、路由上下文和已校验业务对象，不上传截图给 DeepSeek，也不声明图像理解能力。

## 2:35-2:55 Audit Center

展示 Trust, Audit & Evidence Layer：AI 建议事件、Agent 工具预览、Knowledge citation、Co-Growth evidence、human review、高风险 blocked event 和可补偿标记。

## 2:55-3:00 总结

AI-HRMS 不是替代 HR，而是让人和智能体在可治理边界内共同工作和成长。
