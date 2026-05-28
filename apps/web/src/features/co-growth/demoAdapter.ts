import { coGrowthDemoData, learningMissions, principleCards } from "./demoData";
import type { CoachSuggestion, CoGrowthDemoState, LearningMode, WorkloadLevel } from "./types";

export const isCoGrowthDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

const quickPromptRules: Array<{ keyword: string; suggestion: CoachSuggestion }> = [
  {
    keyword: "RAG",
    suggestion: {
      title: "用 5 分钟解释 RAG 原理",
      summary: "RAG 是先检索受控资料，再让模型基于引用生成答案。它提升可追溯性，但仍需要人工检查资料是否过期或引用是否支撑结论。",
      riskLevel: "low",
      confidence: 91,
      estimatedMinutes: 5,
      impactOnWork: "neutral",
      humanReviewRequired: false,
      evidenceRefs: ["rag-reliability", "ev-mission-rag-knowledge"],
      suggestedActions: ["读 RAG 原理卡", "用一条知识库问答做引用核验", "记录引用是否支撑关键结论"],
    },
  },
  {
    keyword: "负荷",
    suggestion: {
      title: "检查本周学习负荷",
      summary: "当前工作负荷中等，建议采用每日 10-15 分钟微学习，并把深度 Agent 实验放到低交付压力时段。",
      riskLevel: "medium",
      confidence: 86,
      estimatedMinutes: 10,
      impactOnWork: "positive",
      humanReviewRequired: false,
      evidenceRefs: ["workload-medium", "ev-mission-agent-workflow"],
      suggestedActions: ["保留 60 分钟周预算", "今天只做一个 15 分钟 mission", "周末再进入 Agent Workflow Lab"],
    },
  },
  {
    keyword: "Agent",
    suggestion: {
      title: "生成 Agent 工作流实验",
      summary: "建议用个性化学习任务推荐 Agent 作为实验：读取偏好、检查负荷、检索原理卡、生成 mission、人工确认、写入证据。",
      riskLevel: "medium",
      confidence: 88,
      estimatedMinutes: 30,
      impactOnWork: "low",
      humanReviewRequired: false,
      evidenceRefs: ["workflow-over-prompt", "agent-tool-audit"],
      suggestedActions: ["先画节点链路", "标注 state 和工具权限", "写出人工确认条件"],
    },
  },
];

export function getCoGrowthDemoState(): CoGrowthDemoState {
  return coGrowthDemoData;
}

export function generateDeterministicCoachSuggestion(prompt: string, workload: WorkloadLevel): CoachSuggestion {
  const matched = quickPromptRules.find((rule) => prompt.toLowerCase().includes(rule.keyword.toLowerCase()));
  if (matched) {
    return matched.suggestion;
  }

  if (workload === "high") {
    return {
      title: "将工作任务降级为 5-10 分钟微学习",
      summary: "当前工作负荷高，建议只把一个真实交付任务改造成轻量 AI 练习，延后深度实验，避免牺牲交付。",
      riskLevel: "medium",
      confidence: 87,
      estimatedMinutes: 8,
      impactOnWork: "positive",
      humanReviewRequired: false,
      evidenceRefs: ["workload-high", "context-quality"],
      suggestedActions: ["选择今天已经要做的任务", "补充上下文并生成草稿", "只复盘一个不可靠点"],
    };
  }

  return {
    title: "生成本周 AI 学习实战任务",
    summary: "把本周真实工作任务改造成一个不超过 30 分钟的 mission：先补上下文，再让 AI 产出草稿，最后人工验证并沉淀证据。",
    riskLevel: "low",
    confidence: 90,
    estimatedMinutes: 25,
    impactOnWork: "positive",
    humanReviewRequired: false,
    evidenceRefs: ["context-quality", "critical-judgment"],
    suggestedActions: ["选择一项真实工作", "写清验收标准", "完成后记录 AI 输出、人工修改和验证方式"],
  };
}

export function getRecommendedMissions(mode: LearningMode, workload: WorkloadLevel) {
  return learningMissions
    .filter((mission) => mission.preferredModes.includes(mode) || mission.status !== "completed")
    .map((mission) => {
      if (workload === "high" && mission.estimatedMinutes > 20) {
        return { ...mission, status: "deferred" as const, impactOnWork: "medium" as const };
      }
      if (workload === "low" && mission.id === "mission-agent-workflow") {
        return { ...mission, status: "accepted" as const };
      }
      return mission;
    })
    .sort((first, second) => Number(second.preferredModes.includes(mode)) - Number(first.preferredModes.includes(mode)));
}

export function getRecommendedPrincipleCards(mode: LearningMode) {
  return principleCards
    .filter((card) => card.recommendedModes.includes(mode) || card.id === "human-in-loop")
    .sort((first, second) => Number(second.recommendedModes.includes(mode)) - Number(first.recommendedModes.includes(mode)));
}
