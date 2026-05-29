# AI-HRMS 3 分钟演示脚本

## 准备

```bash
VITE_DEMO_MODE=true npm run web:dev
```

打开 `http://127.0.0.1:5173/login`，点击“一键进入 AI-HRMS Demo”。

真实模式可额外启动 Python agent boundary，并配置 DeepSeek chat 与 pgvector embedding provider；演示脚本仍建议先用 deterministic demo 录屏，保证评审路径稳定。

## 0:00-0:20 定位

AI-HRMS 是人机共生的人力资源智能操作系统，不是传统 HRMS 加聊天框。AI 负责检索、解释、建议、生成计划和预览动作；人负责判断、确认、复盘和纠偏；系统负责权限、证据、审计和边界。

## 0:20-0:50 Dashboard

在 Command Dashboard 展示统一入口：组织数据、AI 指挥、知识治理、学习成长、Agent 运行和审计证据。讲清 Human-Agent workflow：Goal → Context → Agent Plan → Tool Preview → Human Review → Audit。

## 0:50-1:20 AI Command Center

选择“生成新人 30 天成长计划”或“检查高风险建议”，点击生成。展示结构化输出：Answer、Evidence/Citation、riskLevel、confidence、Suggested Actions、Tool Preview、humanReviewRequired 和 Audit Preview。强调高风险场景没有“自动执行”。

## 1:20-1:45 Knowledge Hub

进入 Knowledge Hub，搜索新人计划。展示资料来源、trustLevel、sensitivity、status、scope 和 citation preview。说明敏感或草稿资料不能直接用于正式 AI 回答。

## 1:45-2:15 Co-Growth OS

进入 Co-Growth OS。说明它是 AI-HRMS 的成长引擎：员工学习 AI 原理，接受真实工作 mission，记录 AI Work Journal，复盘人工修改和验证方式，沉淀 Growth Evidence Portfolio。

## 2:15-2:35 Agent Run Center

展示 Agent run cards：runType、status、riskLevel、provider/model、delegated context、tool preview、human confirmation status 和 audit status。点击“预览工具调用”，说明高风险 run 等待人工确认。

## 2:35-2:55 Audit Center

展示 Trust, Audit & Evidence Layer：AI 建议事件、Agent 工具预览、Knowledge citation、Co-Growth evidence、human review、高风险 blocked event 和可补偿标记。

## 2:55-3:00 总结

AI-HRMS 不是替代 HR，而是让人和智能体在可治理边界内共同工作和成长。
