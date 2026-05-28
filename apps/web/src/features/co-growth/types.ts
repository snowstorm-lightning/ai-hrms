export type RiskLevel = "low" | "medium" | "high";
export type WorkloadLevel = "low" | "medium" | "high";
export type ImpactOnWork = "positive" | "neutral" | "low" | "medium" | "high";
export type MissionStatus = "recommended" | "accepted" | "in_progress" | "reflected" | "completed" | "deferred";
export type LearningMode = "visual" | "hands_on" | "qa" | "case" | "reading" | "project";
export type AILiteracyLevel = "beginner" | "user" | "collaborator" | "evaluator" | "orchestrator";

export interface GrowthEvidence {
  id: string;
  type: "principle_card" | "mission" | "reflection" | "prompt_version" | "workflow" | "work_output" | "risk_judgment" | "template";
  title: string;
  description: string;
  source: string;
  createdAt: string;
  confidence: number;
  relatedMissionId?: string;
  riskLevel: RiskLevel;
}

export interface CoachSuggestion {
  title: string;
  summary: string;
  riskLevel: RiskLevel;
  confidence: number;
  estimatedMinutes: number;
  impactOnWork: ImpactOnWork;
  humanReviewRequired: boolean;
  evidenceRefs: string[];
  suggestedActions: string[];
}

export interface LearningMission {
  id: string;
  title: string;
  status: MissionStatus;
  estimatedMinutes: number;
  impactOnWork: ImpactOnWork;
  learningGoal: string;
  workOutput: string;
  riskLevel: RiskLevel;
  confidence: number;
  evidenceSource: string;
  humanConfirmationPoints: string[];
  preferredModes: LearningMode[];
  principleCardIds: string[];
}

export interface PrincipleCard {
  id: string;
  title: string;
  fiveMinuteExplanation: string;
  tenMinuteExperiment: string;
  workApplicationTask: string;
  reflectionQuestion: string;
  recommendedModes: LearningMode[];
  relatedMissionId: string;
  evidenceRecordMethod: string;
}

export interface AILiteracyDimension {
  id: string;
  title: string;
  growthStage: string;
  currentLevel: number;
  nextStep: string;
  evidenceCount: number;
  recentWorkApplication: string;
  coachAdvice: string;
  riskReminder: string;
  courseCard: string;
  missionId: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: "state" | "retrieval" | "generation" | "check" | "human" | "audit";
  description: string;
  input: string;
  output: string;
  riskLevel: RiskLevel;
  tool?: string;
}

export interface PromptVersion {
  version: string;
  prompt: string;
  improvement: string;
  reliabilityGain: number;
}

export interface WorkJournalEntry {
  id: string;
  title: string;
  prompt: string;
  context: string;
  aiOutput: string;
  humanEdit: string;
  verification: string;
  reflection: string;
  evidenceId: string;
}

export interface TeamHeatmapCapability {
  capability: string;
  beginner: number;
  user: number;
  collaborator: number;
  evaluator: number;
  orchestrator: number;
  weakestSignal: string;
  recommendedIntervention: string;
}

export interface TeamInsight {
  title: string;
  value: string;
  summary: string;
  riskLevel: RiskLevel;
}

export interface GovernanceScenario {
  id: string;
  title: string;
  riskType: string;
  prompt: string;
  warningSignal: string;
  healthyResponse: string;
  humanReviewRequired: boolean;
}

export interface EmployeeLearningSample {
  id: string;
  name: string;
  role: string;
  department: string;
  aiLiteracyLevel: AILiteracyLevel;
  preferredLearningMode: LearningMode;
  weeklyLearningBudgetMinutes: number;
  currentWorkload: WorkloadLevel;
  recommendedPace: string;
  activeMissions: string[];
  completedMissions: string[];
  reflectionNotes: string[];
  evidence: GrowthEvidence[];
  risks: string[];
  coachSuggestions: CoachSuggestion[];
  principleCards: string[];
  workflowExperiments: string[];
  growthPortfolioItems: string[];
}

export interface CoGrowthDemoState {
  currentEmployee: EmployeeLearningSample;
  employees: EmployeeLearningSample[];
  literacyMap: AILiteracyDimension[];
  missions: LearningMission[];
  principleCards: PrincipleCard[];
  coachSuggestions: CoachSuggestion[];
  workflowNodes: WorkflowNode[];
  promptVersions: PromptVersion[];
  workJournal: WorkJournalEntry[];
  teamHeatmap: TeamHeatmapCapability[];
  teamInsights: TeamInsight[];
  governanceScenarios: GovernanceScenario[];
}
