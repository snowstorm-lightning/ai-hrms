import type {
  ApiEnvelope,
  AIChatResponse,
  AIProviderStatus,
  AgentRun,
  AgentToolPreviewResponse,
  AgentWorkflowDemoResult,
  Attendance,
  AuditEvent,
  Capability,
  CommentItem,
  Employee,
  LearningCourse,
  LearningEnrollment,
  LearningLesson,
  LearningRecommendation,
  LegalEntity,
  MessageItem,
  OrgUnit,
  Page,
  RAGDocument,
  RAGIngestJob,
  RAGSearchResult,
  RAGSource,
  Role,
  RoleBinding,
  User,
  VisualContextRequest,
  VisualCopilotEvent,
  VisualCopilotResponse,
} from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";
const tokenKey = "ai_hrms_token";
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
let memoryToken = "";

const demoUser = {
  id: "demo-user-ai-hrms",
  mobile: "123",
  username: "AI-HRMS Demo",
  enableState: 1,
  createdAt: "2026-05-28T00:00:00+08:00",
  roles: ["group_admin", "group_hr", "employee"],
};

let demoUsers: User[] = [
  demoUser,
  { id: "demo-user-hr", mobile: "13900000001", username: "陈向南 HRBP", enableState: 1, createdAt: "2026-05-25T09:00:00+08:00", roles: ["group_hr"] },
  { id: "demo-user-mentor", mobile: "13900000002", username: "邵一鸣 导师", enableState: 1, createdAt: "2026-05-25T09:10:00+08:00", roles: ["org_manager"] },
  { id: "demo-user-employee", mobile: "13900000003", username: "林晨 员工", enableState: 1, createdAt: "2026-05-25T09:20:00+08:00", roles: ["employee"] },
];

const demoRoles: Role[] = [
  { id: "role-group-admin", code: "group_admin", name: "集团管理员" },
  { id: "role-group-hr", code: "group_hr", name: "集团 HR" },
  { id: "role-org-manager", code: "org_manager", name: "组织管理者" },
  { id: "role-employee", code: "employee", name: "员工" },
];

const demoCapabilities: Capability[] = [
  { code: "rag.search", description: "Search scoped knowledge" },
  { code: "agent.execute_read", description: "Preview read-only agent runs" },
  { code: "agent.execute_write", description: "Execute approved agent actions" },
  { code: "audit.read", description: "Read audit events" },
  { code: "visual_copilot.use", description: "Use visual copilot" },
];

const demoRoleBindings: Record<string, RoleBinding[]> = {
  "demo-user-ai-hrms": [{ id: "binding-demo-admin", roleCode: "group_admin", roleName: "集团管理员", scopeType: "global", includeDescendants: true }],
  "demo-user-hr": [{ id: "binding-demo-hr", roleCode: "group_hr", roleName: "集团 HR", scopeType: "global", includeDescendants: true }],
  "demo-user-mentor": [{ id: "binding-demo-mentor", roleCode: "org_manager", roleName: "组织管理者", scopeType: "org_unit", scopeId: "org-001", scopeName: "平台研发", includeDescendants: true }],
  "demo-user-employee": [{ id: "binding-demo-employee", roleCode: "employee", roleName: "员工", scopeType: "org_unit", scopeId: "org-001", scopeName: "平台研发", includeDescendants: false }],
};

let demoLegalEntities: LegalEntity[] = [
  { id: "entity-001", code: "GROUP", name: "共进科技集团", legalName: "共进科技集团有限公司", unifiedSocialCreditCode: "91310000DEMO0001", legalRepresentative: "林澄", companyPhone: "021-00000000", email: "hr@example.com", area: "上海", address: "上海市浦东新区 AI Avenue 1 号", status: "active", createdAt: "2026-05-01" },
];

let demoOrgUnits: OrgUnit[] = [
  { id: "org-001", code: "RD", name: "平台研发", type: "department", managerName: "邵一鸣", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
  { id: "org-002", code: "HR", name: "人力资源", type: "department", managerName: "陈向南", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
  { id: "org-003", code: "GT", name: "增长团队", type: "department", managerName: "周雨桐", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
];

let demoEmployees: Employee[] = [
  { id: "emp-001", employeeNo: "CG001", name: "林晨", mobile: "13800000001", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "上海", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "同济大学", major: "软件工程", homeCompany: "共进科技集团", title: "研发实习生", resume: "", isThereAnyCompetitionRestriction: "", remarks: "Co-Growth Demo 样本", primaryAssignment: { id: "assign-001", legalEntityId: "entity-001", legalEntityName: "共进科技集团", orgUnitId: "org-001", orgUnitName: "平台研发", positionTitle: "研发实习生", isPrimary: true, startDate: "2026-05-01", employmentType: "intern" } },
  { id: "emp-002", employeeNo: "CG002", name: "周雨桐", mobile: "13800000002", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "杭州", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "浙江大学", major: "工业设计", homeCompany: "共进科技集团", title: "产品助理", resume: "", isThereAnyCompetitionRestriction: "", remarks: "Co-Growth Demo 样本", primaryAssignment: { id: "assign-002", legalEntityId: "entity-001", legalEntityName: "共进科技集团", orgUnitId: "org-003", orgUnitName: "增长团队", positionTitle: "产品助理", isPrimary: true, startDate: "2026-05-01", employmentType: "full_time" } },
  { id: "emp-003", employeeNo: "CG003", name: "陈向南", mobile: "13800000003", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "上海", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "华东师范大学", major: "人力资源", homeCompany: "共进科技集团", title: "HRBP", resume: "", isThereAnyCompetitionRestriction: "", remarks: "Co-Growth Demo 样本", primaryAssignment: { id: "assign-003", legalEntityId: "entity-001", legalEntityName: "共进科技集团", orgUnitId: "org-002", orgUnitName: "人力资源", positionTitle: "HRBP", isPrimary: true, startDate: "2026-05-01", employmentType: "full_time" } },
];

let demoAttendance: Attendance[] = [
  { id: "att-001", employeeId: "emp-001", employeeName: "林晨", mobile: "13800000001", orgUnitName: "平台研发", attendanceStatus: 1, attendanceInTime: "2026-05-29T09:02:00+08:00", attendanceOutTime: null, day: "2026-05-29", remarks: "Demo check-in" },
  { id: "att-002", employeeId: "emp-003", employeeName: "陈向南", mobile: "13800000003", orgUnitName: "人力资源", attendanceStatus: 3, attendanceInTime: "2026-05-29T09:18:00+08:00", attendanceOutTime: "2026-05-29T18:15:00+08:00", day: "2026-05-29", remarks: "早会延迟" },
];

let demoMessages: MessageItem[] = [
  {
    id: "msg-001",
    title: "本周 AI 学习 mission 开放试用",
    category: "announcement",
    content: "共进学习舱已开放 Demo。欢迎先从 RAG 原理卡和工作内嵌 mission 开始体验。",
    author: "陈向南",
    orgUnitName: "人力资源",
    scopeType: "global",
    star: 7,
    view: 128,
    createdAt: "2026-05-28T10:00:00+08:00",
  },
  {
    id: "msg-002",
    title: "请在使用 AI 建议前保留人工确认点",
    category: "governance",
    content: "涉及候选人、隐私、公平性或客户承诺的场景，AI 只做辅助建议，最终判断必须由人确认。",
    author: "林晨",
    orgUnitName: "平台研发",
    scopeType: "global",
    star: 4,
    view: 86,
    createdAt: "2026-05-28T11:20:00+08:00",
  },
];

const demoComments: Record<string, CommentItem[]> = {
  "msg-001": [
    { id: "comment-001", messageId: "msg-001", username: "周雨桐", content: "我先试了案例推演模式，mission 推荐会跟着偏好变化。", createdAt: "2026-05-28T10:30:00+08:00" },
  ],
  "msg-002": [
    { id: "comment-002", messageId: "msg-002", username: "陈向南", content: "高风险场景请保留 evidence、riskLevel 和 humanReviewRequired。", createdAt: "2026-05-28T11:40:00+08:00" },
  ],
};

let demoRAGSources: RAGSource[] = [
  { id: "rag-source-001", sourceType: "upload", name: "AI-HRMS 治理知识包", uri: "demo://ai-hrms-governance", status: "active", createdAt: "2026-05-28" },
  { id: "rag-source-002", sourceType: "connector", name: "HR 制度库", uri: "demo://hr-policy", status: "active", createdAt: "2026-05-27" },
];

let demoRAGDocuments: RAGDocument[] = [
  {
    id: "rag-doc-001",
    sourceId: "rag-source-001",
    title: "AI 原理与工作流学习手册",
    version: "v1",
    status: "published",
    trustLevel: "official",
    sensitivity: "normal",
    content: "AI 建议必须展示 evidence、riskLevel、confidence 和人工确认边界。",
    publishedAt: "2026-05-28T09:00:00+08:00",
    createdAt: "2026-05-28",
    scopes: [{ documentId: "rag-doc-001", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-002",
    sourceId: "rag-source-002",
    title: "新员工入职指南",
    version: "v3",
    status: "published",
    trustLevel: "official",
    sensitivity: "normal",
    content: "新员工 7 天内完成制度、信息安全和组织协作课程，30 天内由导师完成一次复盘。",
    publishedAt: "2026-05-26T09:00:00+08:00",
    createdAt: "2026-05-26",
    scopes: [{ documentId: "rag-doc-002", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-003",
    sourceId: "rag-source-002",
    title: "面试公平性检查指引",
    version: "v2",
    status: "published",
    trustLevel: "reviewed",
    sensitivity: "restricted",
    content: "AI 只能辅助生成结构化面试问题和公平性检查点，不得输出录用或淘汰结论。",
    publishedAt: "2026-05-24T09:00:00+08:00",
    createdAt: "2026-05-24",
    scopes: [{ documentId: "rag-doc-003", scopeType: "role", roleCode: "group_hr", includeDescendants: false }],
  },
  {
    id: "rag-doc-004",
    sourceId: "rag-source-001",
    title: "AI 使用安全规范",
    version: "v1",
    status: "published",
    trustLevel: "official",
    sensitivity: "internal",
    content: "不要把个人敏感信息、受保护特征或未授权数据放入 AI prompt。",
    publishedAt: "2026-05-25T09:00:00+08:00",
    createdAt: "2026-05-25",
    scopes: [{ documentId: "rag-doc-004", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-005",
    sourceId: "rag-source-001",
    title: "Agent 工具调用审计规范",
    version: "v1",
    status: "draft",
    trustLevel: "internal",
    sensitivity: "internal",
    content: "工具调用需要记录 preview、arguments、accepted、humanReviewRequired 和 auditStatus。",
    createdAt: "2026-05-23",
    scopes: [{ documentId: "rag-doc-005", scopeType: "global", includeDescendants: true }],
  },
];

let demoLearningCourses: LearningCourse[] = [
  { id: "course-ai-principles", title: "AI 原理理解", description: "从 token、上下文、幻觉到 RAG 可靠性。", status: "published", scopeType: "global", createdAt: "2026-05-28", lessonCount: 6 },
  { id: "course-workflow", title: "从 Prompt 到 Workflow", description: "学习 state、node、edge、工具调用和人工确认。", status: "published", scopeType: "global", createdAt: "2026-05-28", lessonCount: 5 },
];

const demoAgentRuns: AgentRun[] = [
  { id: "agent-run-001", runType: "co_growth_coach", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "low", summary: "生成本周 AI 学习 mission，并保留 evidence。", createdAt: "2026-05-28T09:00:00+08:00" },
  { id: "agent-run-002", runType: "ai_literacy_path", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "low", summary: "根据学习画像推荐 AI 原理卡和 30 分钟 mission。", createdAt: "2026-05-28T09:08:00+08:00" },
  { id: "agent-run-003", runType: "work_learning_balance", status: "previewed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "检查工作负荷，建议把深度实验降级为微学习。", createdAt: "2026-05-28T09:16:00+08:00" },
  { id: "agent-run-004", runType: "agent_workflow_lab", status: "previewed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "预览个性化学习任务推荐 Agent 节点链路。", createdAt: "2026-05-28T09:24:00+08:00" },
  { id: "agent-run-005", runType: "knowledge_governance", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "扫描 RAG 资料可信等级和敏感范围。", createdAt: "2026-05-28T09:32:00+08:00" },
  { id: "agent-run-006", runType: "onboarding_planner", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "low", summary: "生成新人 30 天成长计划，引用入职指南。", createdAt: "2026-05-28T09:40:00+08:00" },
  { id: "agent-run-007", runType: "audit_risk_scanner", status: "waiting_human_review", provider: "fake", model: "deterministic-v1", riskLevel: "high", summary: "发现面试公平性场景，等待 HR 人工确认。", createdAt: "2026-05-28T09:48:00+08:00" },
  { id: "agent-run-008", runType: "visual_copilot", status: "previewed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "基于页面选区解释知识资料与审计事件关系。", createdAt: "2026-05-28T09:56:00+08:00" },
];

let demoAgentRunState: AgentRun[] = [...demoAgentRuns];

let demoAuditEvents: AuditEvent[] = [
  { id: "audit-001", eventType: "ai.command.recommendation.preview", objectType: "ai_recommendation", objectId: "cmd-onboarding-30d", scopeType: "global", requestId: "demo-req-001", source: "web", riskLevel: "medium", oldValueSummary: {}, newValueSummary: { confidence: 86, citations: ["rag-doc-002"], humanReviewRequired: false, auditStatus: "previewed" }, createdAt: "2026-05-28T10:00:00+08:00" },
  { id: "audit-002", eventType: "agent.tool.preview", objectType: "agent_tool_call", objectId: "tool-learning-recommend", scopeType: "global", requestId: "demo-req-002", source: "agent", riskLevel: "medium", oldValueSummary: {}, newValueSummary: { toolName: "learning_recommend", accepted: true, reversible: true }, createdAt: "2026-05-28T10:06:00+08:00" },
  { id: "audit-003", eventType: "human.review.requested", objectType: "learning_mission", objectId: "mission-interview-bias", scopeType: "global", requestId: "demo-req-003", source: "web", riskLevel: "high", oldValueSummary: {}, newValueSummary: { reason: "fairness boundary", humanReviewRequired: true, blocked: true }, createdAt: "2026-05-28T10:12:00+08:00" },
  { id: "audit-004", eventType: "rag.citation.used", objectType: "rag_document", objectId: "rag-doc-002", scopeType: "global", requestId: "demo-req-004", source: "rag", riskLevel: "low", oldValueSummary: {}, newValueSummary: { title: "新员工入职指南", trustLevel: "official", sensitivity: "normal" }, createdAt: "2026-05-28T10:18:00+08:00" },
  { id: "audit-005", eventType: "co_growth.evidence.recorded", objectType: "co_growth_evidence", objectId: "ev-current-001", scopeType: "global", requestId: "demo-req-005", source: "web", riskLevel: "low", oldValueSummary: {}, newValueSummary: { reflection: true, promptVersion: "v3", confidence: 89 }, createdAt: "2026-05-28T10:24:00+08:00" },
  { id: "audit-006", eventType: "high_risk.action.blocked", objectType: "agent_run", objectId: "agent-run-007", scopeType: "global", requestId: "demo-req-006", source: "agent", riskLevel: "high", oldValueSummary: {}, newValueSummary: { action: "people_decision", allowed: false, humanReviewRequired: true }, createdAt: "2026-05-28T10:30:00+08:00" },
  { id: "audit-007", eventType: "human.review.approved_preview", objectType: "agent_run", objectId: "agent-run-004", scopeType: "global", requestId: "demo-req-007", source: "web", riskLevel: "medium", oldValueSummary: {}, newValueSummary: { reviewer: "mentor", auditStatus: "approved_preview", reversible: true }, createdAt: "2026-05-28T10:36:00+08:00" },
];

function appendDemoAudit(event: Omit<AuditEvent, "id" | "createdAt" | "scopeType" | "requestId" | "source" | "oldValueSummary"> & {
  scopeType?: string;
  requestId?: string;
  source?: string;
  oldValueSummary?: Record<string, unknown>;
}) {
  const auditEvent: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    scopeType: event.scopeType ?? "global",
    requestId: event.requestId ?? `demo-req-${Date.now()}`,
    source: event.source ?? "web",
    oldValueSummary: event.oldValueSummary ?? {},
    ...event,
  };
  demoAuditEvents = [auditEvent, ...demoAuditEvents];
  return auditEvent;
}

function demoPage<T>(rows: T[]): Page<T> {
  return { total: rows.length, rows };
}

function demoPaged<T>(rows: T[], page: number, size: number): Page<T> {
  return { total: rows.length, rows: rows.slice((page - 1) * size, page * size) };
}

function demoAssignments(id: string): NonNullable<Employee["assignments"]> {
  const employee = demoEmployees.find((item) => item.id === id);
  return employee?.assignments ?? (employee?.primaryAssignment ? [employee.primaryAssignment] : []);
}

function demoVisualResponse(values: VisualContextRequest, intent: string): VisualCopilotResponse {
  const refs = values.regions.flatMap((region) => region.businessRefs);
  appendDemoAudit({
    eventType: intent === "action_execute_blocked" ? "high_risk.action.blocked" : "visual_copilot.preview",
    objectType: "visual_copilot_event",
    objectId: `visual-${Date.now()}`,
    riskLevel: intent === "action_execute_blocked" ? "high" : "medium",
    newValueSummary: { route: values.route, refs: refs.length, instruction: values.instruction, intent },
    source: "visual_copilot",
  });
  return {
    event: {
      id: `visual-event-${Date.now()}`,
      route: values.route,
      instruction: values.instruction,
      regions: values.regions,
      businessRefs: refs,
      intent,
      confidence: refs.length ? 0.88 : 0.76,
      status: intent === "action_execute_blocked" ? "blocked_demo_preview" : "previewed",
      createdAt: new Date().toISOString(),
    },
    result: {
      preview: intent === "action_execute_blocked"
        ? "Demo Visual Copilot：高风险或写操作不会自动执行。系统只生成预览，并要求人工确认后由 Go 重新校验权限和记录审计。"
        : "Demo Visual Copilot：已基于选区生成解释。可查看关联对象、证据、风险等级和建议的下一步人工确认。",
      actions: [
        { type: "explain", label: "解释选区", riskLevel: "low" },
        { type: "open_evidence", label: "查看证据链", riskLevel: "medium" },
        { type: "request_review", label: "请求人工确认", riskLevel: "high", blocked: true },
      ],
    },
  };
}

export function getToken() {
  try {
    return localStorage.getItem(tokenKey) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string) {
  memoryToken = token;
  try {
    localStorage.setItem(tokenKey, token);
  } catch {
    // Keep the in-memory token for private browsing or blocked storage.
  }
}

export function clearToken() {
  memoryToken = "";
  try {
    localStorage.removeItem(tokenKey);
  } catch {
    // Storage may be blocked; clearing memory is enough for this session.
  }
}

export function getErrorMessage(error: unknown, fallback = "操作失败") {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const payload = response.headers.get("content-type")?.includes("application/json")
    ? ((await response.json().catch(() => null)) as ApiEnvelope<T> | null)
    : null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || response.statusText || "请求失败");
  }
  return payload.data as T;
}

async function download(path: string, filename: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${baseUrl}${path}`, { headers });
  if (!response.ok) {
    throw new Error(response.statusText || "下载失败");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export const api = {
  async login(values: { mobile: string; password: string }) {
    if (demoMode) {
      void values;
      return { token: "demo-token-co-growth", user: demoUser };
    }
    return request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
  },
  profile: () => demoMode ? Promise.resolve(demoUser) : request<User>("/profile"),
  legalEntities: () => demoMode ? Promise.resolve(demoLegalEntities) : request<LegalEntity[]>("/legal-entities"),
  createLegalEntity: (values: Partial<LegalEntity>) => {
    if (demoMode) {
      const entity: LegalEntity = {
        id: `entity-${Date.now()}`,
        code: values.code ?? "DEMO",
        name: values.name ?? "Demo 法人实体",
        legalName: values.legalName ?? values.name ?? "Demo 法人实体有限公司",
        unifiedSocialCreditCode: values.unifiedSocialCreditCode ?? "91310000DEMO",
        legalRepresentative: values.legalRepresentative ?? "Demo",
        companyPhone: values.companyPhone ?? "",
        email: values.email ?? "",
        area: values.area ?? "",
        address: values.address ?? "",
        status: values.status ?? "active",
        createdAt: new Date().toISOString(),
      };
      demoLegalEntities = [entity, ...demoLegalEntities];
      return Promise.resolve(entity);
    }
    return request<LegalEntity>("/legal-entities", { method: "POST", body: JSON.stringify(values) });
  },
  updateLegalEntity: (id: string, values: Partial<LegalEntity>) => {
    if (demoMode) {
      demoLegalEntities = demoLegalEntities.map((entity) => entity.id === id ? { ...entity, ...values } : entity);
      return Promise.resolve(demoLegalEntities.find((entity) => entity.id === id) ?? demoLegalEntities[0]);
    }
    return request<LegalEntity>(`/legal-entities/${id}`, { method: "PUT", body: JSON.stringify(values) });
  },
  orgUnits: () => demoMode ? Promise.resolve(demoOrgUnits) : request<OrgUnit[]>("/org-units"),
  createOrgUnit: (values: Partial<OrgUnit>) => {
    if (demoMode) {
      const unit: OrgUnit = {
        id: `org-${Date.now()}`,
        code: values.code ?? "DEMO",
        name: values.name ?? "Demo 组织单元",
        type: values.type ?? "department",
        managerName: values.managerName ?? "Demo",
        status: values.status ?? "active",
        createdAt: new Date().toISOString(),
        parentId: values.parentId ?? null,
        legalEntityId: values.legalEntityId ?? null,
      };
      demoOrgUnits = [unit, ...demoOrgUnits];
      return Promise.resolve(unit);
    }
    return request<OrgUnit>("/org-units", { method: "POST", body: JSON.stringify(values) });
  },
  updateOrgUnit: (id: string, values: Partial<OrgUnit>) => {
    if (demoMode) {
      demoOrgUnits = demoOrgUnits.map((unit) => unit.id === id ? { ...unit, ...values } : unit);
      return Promise.resolve(demoOrgUnits.find((unit) => unit.id === id) ?? demoOrgUnits[0]);
    }
    return request<OrgUnit>(`/org-units/${id}`, { method: "PUT", body: JSON.stringify(values) });
  },
  roles: () => demoMode ? Promise.resolve(demoRoles) : request<Role[]>("/roles"),
  capabilities: () => demoMode ? Promise.resolve(demoCapabilities) : request<Capability[]>("/capabilities"),
  users: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoUsers, page, size)) : request<Page<User>>(`/users?page=${page}&size=${size}`),
  createUser: (values: { mobile: string; username: string; password?: string }) => {
    if (demoMode) {
      const user: User = { id: `demo-user-${Date.now()}`, mobile: values.mobile, username: values.username, enableState: 1, createdAt: new Date().toISOString(), roles: ["employee"] };
      demoUsers = [user, ...demoUsers];
      demoRoleBindings[user.id] = [{ roleCode: "employee", roleName: "员工", scopeType: "org_unit", scopeId: "org-001", includeDescendants: false }];
      return Promise.resolve(user);
    }
    return request<User>("/users", { method: "POST", body: JSON.stringify(values) });
  },
  updateUser: (id: string, values: Partial<User>) => {
    if (demoMode) {
      demoUsers = demoUsers.map((user) => user.id === id ? { ...user, ...values } : user);
      return Promise.resolve(demoUsers.find((user) => user.id === id) ?? demoUsers[0]);
    }
    return request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(values) });
  },
  userRoleBindings: (id: string) => demoMode ? Promise.resolve(demoRoleBindings[id] ?? []) : request<RoleBinding[]>(`/users/${id}/role-bindings`),
  updateUserRoleBindings: (id: string, bindings: RoleBinding[]) => {
    if (demoMode) {
      demoRoleBindings[id] = bindings;
      demoUsers = demoUsers.map((user) => user.id === id ? { ...user, roles: bindings.map((binding) => binding.roleCode) } : user);
      return Promise.resolve(bindings);
    }
    return request<RoleBinding[]>(`/users/${id}/role-bindings`, { method: "PUT", body: JSON.stringify({ bindings }) });
  },
  employees: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoEmployees, page, size)) : request<Page<Employee>>(`/employees?page=${page}&size=${size}`),
  employee: (id: string) => demoMode ? Promise.resolve(demoEmployees.find((employee) => employee.id === id) ?? demoEmployees[0]) : request<Employee>(`/employees/${id}`),
  employeeAssignments: (id: string) => demoMode ? Promise.resolve(demoAssignments(id)) : request<Employee["assignments"]>(`/employees/${id}/assignments`),
  updateEmployeeAssignments: (id: string, assignments: NonNullable<Employee["assignments"]>) =>
    demoMode ? Promise.resolve((() => {
      const normalized = assignments.map((assignment, index) => {
        const legalEntity = demoLegalEntities.find((entity) => entity.id === assignment.legalEntityId);
        const orgUnit = demoOrgUnits.find((unit) => unit.id === assignment.orgUnitId);
        return {
          ...assignment,
          id: assignment.id ?? `assign-${id}-${index}`,
          legalEntityName: legalEntity?.name ?? assignment.legalEntityName ?? null,
          orgUnitName: orgUnit?.name ?? assignment.orgUnitName ?? null,
          isPrimary: assignment.isPrimary || (!assignments.some((item) => item.isPrimary) && index === 0),
          employmentType: assignment.employmentType ?? "full_time",
        };
      });
      demoEmployees = demoEmployees.map((employee) => employee.id === id ? {
        ...employee,
        assignments: normalized,
        primaryAssignment: normalized.find((assignment) => assignment.isPrimary) ?? normalized[0] ?? employee.primaryAssignment,
      } : employee);
      appendDemoAudit({
        eventType: "employee.assignment.demo_save",
        objectType: "employee",
        objectId: id,
        riskLevel: "medium",
        newValueSummary: { assignments: normalized.length, primaryAssignment: normalized.find((assignment) => assignment.isPrimary)?.id },
      });
      return normalized;
    })()) : request<NonNullable<Employee["assignments"]>>(`/employees/${id}/assignments`, {
      method: "PUT",
      body: JSON.stringify({ assignments }),
    }),
  createEmployee: (values: Partial<Employee>) => {
    if (demoMode) {
      const employee: Employee = {
        ...demoEmployees[0],
        ...values,
        id: `emp-${Date.now()}`,
        employeeNo: values.employeeNo ?? `DEMO${demoEmployees.length + 1}`,
        name: values.name ?? "Demo 员工",
        mobile: values.mobile ?? "",
      };
      demoEmployees = [employee, ...demoEmployees];
      return Promise.resolve(employee);
    }
    return request<Employee>("/employees", { method: "POST", body: JSON.stringify(values) });
  },
  updateEmployee: (id: string, values: Partial<Employee>) => {
    if (demoMode) {
      demoEmployees = demoEmployees.map((employee) => employee.id === id ? { ...employee, ...values } : employee);
      return Promise.resolve(demoEmployees.find((employee) => employee.id === id) ?? demoEmployees[0]);
    }
    return request<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(values) });
  },
  exportEmployees: () => {
    if (demoMode) {
      downloadText("employees-demo.csv", [
        ["employeeNo", "name", "mobile", "orgUnit", "title"].map(csvCell).join(","),
        ...demoEmployees.map((employee) => [employee.employeeNo, employee.name, employee.mobile, employee.primaryAssignment?.orgUnitName, employee.title].map(csvCell).join(",")),
      ].join("\n"));
      return Promise.resolve();
    }
    return download("/employees/export", "employees.csv");
  },
  attendance: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoAttendance, page, size)) : request<Page<Attendance>>(`/attendance?page=${page}&size=${size}`),
  checkin: (employeeId: string, attendanceStatus = 1) => {
    if (demoMode) {
      const employee = demoEmployees.find((item) => item.id === employeeId) ?? demoEmployees[0];
      const attendance: Attendance = {
        id: `att-${Date.now()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        mobile: employee.mobile,
        orgUnitName: employee.primaryAssignment?.orgUnitName ?? "未分配",
        attendanceStatus,
        attendanceInTime: new Date().toISOString(),
        attendanceOutTime: null,
        day: new Date().toISOString().slice(0, 10),
        remarks: "Demo check-in",
      };
      demoAttendance = [attendance, ...demoAttendance];
      return Promise.resolve(attendance);
    }
    return request<Attendance>("/attendance", { method: "POST", body: JSON.stringify({ employeeId, attendanceStatus }) });
  },
  checkout: (id: string) => {
    if (demoMode) {
      demoAttendance = demoAttendance.map((item) => item.id === id ? { ...item, attendanceOutTime: new Date().toISOString() } : item);
      return Promise.resolve(demoAttendance.find((item) => item.id === id) ?? demoAttendance[0]);
    }
    return request<Attendance>(`/attendance/${id}/checkout`, { method: "PUT" });
  },
  exportAttendance: () => {
    if (demoMode) {
      downloadText("attendance-demo.csv", [
        ["employeeName", "day", "status", "inTime", "outTime"].map(csvCell).join(","),
        ...demoAttendance.map((item) => [item.employeeName, item.day, item.attendanceStatus, item.attendanceInTime, item.attendanceOutTime].map(csvCell).join(",")),
      ].join("\n"));
      return Promise.resolve();
    }
    return download("/attendance/export", "attendance.csv");
  },
  messages: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoMessages, page, size)) : request<Page<MessageItem>>(`/messages?page=${page}&size=${size}`),
  createMessage: (values: Pick<MessageItem, "title" | "category" | "content">) => {
    if (demoMode) {
      const message: MessageItem = {
        id: `msg-${Date.now()}`,
        ...values,
        author: demoUser.username,
        orgUnitName: "共进 Demo",
        scopeType: "global",
        star: 0,
        view: 0,
        createdAt: new Date().toISOString(),
      };
      demoMessages = [message, ...demoMessages];
      return Promise.resolve(message);
    }
    return request<MessageItem>("/messages", { method: "POST", body: JSON.stringify(values) });
  },
  comments: (messageId: string) => demoMode ? Promise.resolve(demoComments[messageId] ?? []) : request<CommentItem[]>(`/messages/${messageId}/comments`),
  createComment: (messageId: string, content: string) => {
    if (demoMode) {
      const comment: CommentItem = {
        id: `comment-${Date.now()}`,
        messageId,
        content,
        username: demoUser.username,
        createdAt: new Date().toISOString(),
      };
      demoComments[messageId] = [...(demoComments[messageId] ?? []), comment];
      return Promise.resolve(comment);
    }
    return request<CommentItem>(`/messages/${messageId}/comments`, { method: "POST", body: JSON.stringify({ content }) });
  },
  auditEvents: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoAuditEvents, page, size)) : request<Page<AuditEvent>>(`/audit/events?page=${page}&size=${size}`),
  ragSources: () => demoMode ? Promise.resolve(demoRAGSources) : request<RAGSource[]>("/rag/sources"),
  createRAGSource: (values: Partial<RAGSource>) => {
    if (demoMode) {
      const source: RAGSource = {
        id: `rag-source-${Date.now()}`,
        sourceType: values.sourceType ?? "upload",
        name: values.name ?? "Demo 知识来源",
        uri: values.uri ?? "demo://new-source",
        status: values.status ?? "active",
        createdAt: new Date().toISOString(),
      };
      demoRAGSources = [source, ...demoRAGSources];
      return Promise.resolve(source);
    }
    return request<RAGSource>("/rag/sources", { method: "POST", body: JSON.stringify(values) });
  },
  ragDocuments: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoRAGDocuments, page, size)) : request<Page<RAGDocument>>(`/rag/documents?page=${page}&size=${size}`),
  createRAGDocument: (values: Partial<RAGDocument>) => {
    if (demoMode) {
      const document: RAGDocument = {
        id: `rag-doc-${Date.now()}`,
        sourceId: values.sourceId ?? "rag-source-001",
        title: values.title ?? "Demo 知识资料",
        version: values.version ?? "v1",
        status: values.status ?? "draft",
        trustLevel: values.trustLevel ?? "internal",
        sensitivity: values.sensitivity ?? "normal",
        content: values.content ?? "",
        createdAt: new Date().toISOString(),
        scopes: values.scopes ?? [{ scopeType: "global", includeDescendants: true }],
      };
      demoRAGDocuments = [document, ...demoRAGDocuments];
      return Promise.resolve(document);
    }
    return request<RAGDocument>("/rag/documents", { method: "POST", body: JSON.stringify(values) });
  },
  createRAGIngestJob: (values: {
    sourceId?: string | null;
    documentId?: string | null;
    jobType?: string;
    title?: string;
    content?: string;
  }) => {
    if (demoMode) {
      const now = new Date().toISOString();
      let documentId = values.documentId ?? null;
      if (!documentId && values.title && values.content) {
        documentId = `rag-doc-${Date.now()}`;
        demoRAGDocuments = [{
          id: documentId,
          sourceId: values.sourceId ?? "rag-source-001",
          title: values.title,
          version: "v1",
          status: "published",
          trustLevel: "reviewed",
          sensitivity: "normal",
          content: values.content,
          createdAt: now,
          scopes: [{ scopeType: "global", includeDescendants: true }],
        }, ...demoRAGDocuments];
      }
      const job: RAGIngestJob = {
        id: `ingest-${Date.now()}`,
        sourceId: values.sourceId ?? null,
        documentId,
        jobType: values.jobType ?? "ingest",
        status: "completed",
        provider: "fake",
        title: values.title,
        content: values.content,
        summary: "Demo ingestion completed with deterministic fake embeddings.",
        error: "",
        createdAt: now,
        completedAt: now,
      };
      return Promise.resolve(job);
    }
    return request<RAGIngestJob>("/rag/ingest-jobs", { method: "POST", body: JSON.stringify(values) });
  },
  getRAGIngestJob: (id: string) => demoMode ? Promise.resolve({
    id,
    jobType: "ingest",
    status: "completed",
    provider: "fake",
    summary: "Demo ingestion completed.",
    error: "",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  } as RAGIngestJob) : request<RAGIngestJob>(`/rag/ingest-jobs/${id}`),
  ragSearch: (query: string, limit = 5) =>
    demoMode ? Promise.resolve((() => {
      const highRiskQuery = /面试|录用|淘汰|降薪|绩效|公平/.test(query);
      const citations = highRiskQuery
        ? [
            { documentId: "rag-doc-004", chunkId: `demo-${limit}-safety`, title: "AI 使用安全规范", snippet: "不要把个人敏感信息、受保护特征或未授权数据放入 AI prompt。" },
          ]
        : [
            { documentId: "rag-doc-002", chunkId: `demo-${limit}-onboarding`, title: "新员工入职指南", snippet: "新员工 7 天内完成制度、信息安全和组织协作课程，30 天内由导师复盘。" },
            { documentId: "rag-doc-004", chunkId: `demo-${limit}-safety`, title: "AI 使用安全规范", snippet: "不要把个人敏感信息、受保护特征或未授权数据放入 AI prompt。" },
          ];
      appendDemoAudit({
        eventType: "rag.citation.used",
        objectType: "rag_search",
        objectId: `query-${Date.now()}`,
        riskLevel: highRiskQuery ? "high" : "low",
        newValueSummary: { query, citations: citations.map((citation) => citation.documentId), restrictedPolicyMatched: highRiskQuery },
        source: "rag",
      });
      return {
        answer: highRiskQuery
          ? `命中高风险 HR 场景。AI-HRMS 只使用安全规范生成风险提示；受限的公平性资料不直接进入回答，需 HR 人工复核后查看。`
          : `基于 AI-HRMS 受控知识层，"${query}" 可以回答，但必须同时展示引用、资料可信等级、敏感级别和人工确认边界。`,
        citations,
      };
    })()) : request<RAGSearchResult>("/rag/search", { method: "POST", body: JSON.stringify({ query, limit }) }),
  aiChat: (message: string) => demoMode ? Promise.resolve((() => {
    const highRiskMessage = /面试|录用|淘汰|降薪|绩效|公平/.test(message);
    const citations = highRiskMessage
      ? [{ documentId: "rag-doc-004", chunkId: "ai-demo-safety", title: "AI 使用安全规范", snippet: "高风险 HR 建议必须保留人工确认，不得自动产生人事裁决。" }]
      : [{ documentId: "rag-doc-002", chunkId: "ai-demo-onboarding", title: "新员工入职指南", snippet: "入职计划需要包含制度、信息安全、组织协作和导师复盘。" }];
    appendDemoAudit({
      eventType: "ai.command.recommendation.preview",
      objectType: "ai_recommendation",
      objectId: `cmd-${Date.now()}`,
      riskLevel: highRiskMessage ? "high" : "medium",
      newValueSummary: {
        prompt: message,
        citations: citations.map((citation) => citation.documentId),
        humanReviewRequired: true,
        restrictedPolicyMatched: highRiskMessage,
      },
    });
    return {
      message: highRiskMessage
        ? `Demo AI：该请求涉及高风险 HR 场景。系统只生成风险检查框架和证据要求，不输出录用、淘汰、降薪或绩效结论。`
        : `Demo AI：已将“${message}”转化为可解释 HR 工作计划。请确认业务目标、授权范围、evidence、riskLevel、confidence、toolPreview 与 humanReviewRequired。`,
      citations,
    };
  })()) : request<AIChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ message }) }),
  providerStatus: () => demoMode ? Promise.resolve({
    agentBoundaryConfigured: false,
    chatProvider: "fake",
    chatModel: "deterministic-v1",
    deepseekKeyConfigured: false,
    embeddingProvider: "fake",
    embeddingModel: "deterministic-v1",
    embeddingDimensions: 8,
    embeddingKeyConfigured: false,
  } as AIProviderStatus) : request<AIProviderStatus>("/ai/provider-status"),
  learningCourses: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoLearningCourses, page, size)) : request<Page<LearningCourse>>(`/learning/courses?page=${page}&size=${size}`),
  createLearningCourse: (values: Partial<LearningCourse>) => {
    if (demoMode) {
      const course: LearningCourse = {
        id: `course-${Date.now()}`,
        title: values.title ?? "Demo 课程",
        description: values.description ?? "",
        status: values.status ?? "draft",
        scopeType: values.scopeType ?? "global",
        createdAt: new Date().toISOString(),
        lessonCount: values.lessonCount ?? 0,
      };
      demoLearningCourses = [course, ...demoLearningCourses];
      return Promise.resolve(course);
    }
    return request<LearningCourse>("/learning/courses", { method: "POST", body: JSON.stringify(values) });
  },
  learningLessons: (courseId: string) => demoMode ? Promise.resolve([
    { id: `lesson-${courseId}-1`, courseId, title: "上下文与证据", content: "学习如何为 AI 建议补充上下文、引用和验证方式。", sortOrder: 1, ragDocumentId: "rag-doc-001" },
    { id: `lesson-${courseId}-2`, courseId, title: "人工确认边界", content: "高风险 HR 场景只允许 AI 生成预览，最终判断由人完成。", sortOrder: 2, ragDocumentId: "rag-doc-003" },
  ]) : request<LearningLesson[]>(`/learning/courses/${courseId}/lessons`),
  learningEnrollments: (page = 1, size = 10) =>
    demoMode ? Promise.resolve(demoPage([
      { id: "enroll-001", employeeId: "emp-001", employeeName: "林晨", courseId: "course-ai-principles", courseTitle: "AI 原理理解", status: "in_progress", createdAt: "2026-05-28" },
      { id: "enroll-002", employeeId: "emp-003", employeeName: "陈向南", courseId: "course-workflow", courseTitle: "从 Prompt 到 Workflow", status: "completed", createdAt: "2026-05-28" },
    ] as LearningEnrollment[])) : request<Page<LearningEnrollment>>(`/learning/enrollments?page=${page}&size=${size}`),
  learningRecommendations: (page = 1, size = 10) =>
    demoMode ? Promise.resolve(demoPage([
      { id: "rec-001", recommendationType: "co_growth_mission", title: "用 RAG 思路整理部门知识库问答", reason: "结合真实知识库任务学习 AI 可靠性。", status: "recommended", createdAt: "2026-05-28" },
      { id: "rec-002", recommendationType: "reflection", title: "复盘一次 AI 输出中的不可靠推理", reason: "补齐批判性判断证据。", status: "recommended", createdAt: "2026-05-28" },
    ] as LearningRecommendation[])) : request<Page<LearningRecommendation>>(`/learning/recommendations?page=${page}&size=${size}`),
  agentRuns: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoAgentRunState, page, size)) : request<Page<AgentRun>>(`/agent/runs?page=${page}&size=${size}`),
  createAgentRun: (values: { runType: string; prompt: string; riskLevel: string }) =>
    demoMode ? Promise.resolve((() => {
      const run: AgentRun = {
        id: `agent-run-${Date.now()}`,
        runType: values.runType,
        status: values.riskLevel === "high" ? "waiting_human_review" : "previewed",
        provider: "fake",
        model: "deterministic-v1",
        riskLevel: values.riskLevel,
        summary: values.prompt || "Demo Agent run",
        createdAt: new Date().toISOString(),
      };
      demoAgentRunState = [run, ...demoAgentRunState];
      appendDemoAudit({
        eventType: values.riskLevel === "high" ? "human.review.requested" : "agent.run.previewed",
        objectType: "agent_run",
        objectId: run.id,
        riskLevel: values.riskLevel,
        newValueSummary: {
          runType: run.runType,
          prompt: values.prompt,
          status: run.status,
          toolPreview: true,
          humanReviewRequired: values.riskLevel !== "low",
        },
        source: "agent",
      });
      if (values.riskLevel === "high") {
        appendDemoAudit({
          eventType: "high_risk.action.blocked",
          objectType: "agent_run",
          objectId: run.id,
          riskLevel: "high",
          newValueSummary: { reason: "high risk people-impacting action", blocked: true, humanReviewRequired: true },
          source: "agent",
        });
      }
      return run;
    })()) : request<AgentRun>("/agent/runs", { method: "POST", body: JSON.stringify(values) }),
  previewAgentTool: (values: { runId?: string; toolName: string; arguments: Record<string, unknown> }) =>
    demoMode ? Promise.resolve((() => {
      const accepted = ["list_employees", "rag_search", "learning_recommend"].includes(values.toolName);
      appendDemoAudit({
        eventType: accepted ? "agent.tool.preview" : "high_risk.action.blocked",
        objectType: "agent_tool_call",
        objectId: values.runId ?? values.toolName,
        riskLevel: accepted ? "medium" : "high",
        newValueSummary: {
          toolName: values.toolName,
          accepted,
          arguments: values.arguments,
          humanReviewRequired: !accepted,
        },
        source: "agent",
      });
      return {
        accepted,
        message: accepted
          ? "Demo preview：只读工具可进入预览，执行前仍记录审计。"
          : "Demo preview：该工具可能产生写操作或人事影响，必须请求人工确认。",
        requiredRisk: accepted ? "low" : "high",
        resultPreview: { toolName: values.toolName, arguments: values.arguments, auditStatus: accepted ? "previewed" : "blocked_waiting_review" },
      };
    })()) : request<AgentToolPreviewResponse>("/agent/tools/preview", { method: "POST", body: JSON.stringify(values) }),
  langGraphWorkflowDemo: (values: { goal: string; context?: string[] }) => {
    const highRisk = /录用|淘汰|降薪|晋升|hire|fire|salary|promotion/i.test(values.goal);
    return demoMode ? Promise.resolve({
      goal: values.goal,
      context: values.context ?? ["Scoped RAG citations only"],
      risk_level: highRisk ? "high" : "medium",
      human_review_required: true,
      audit_status: highRisk ? "blocked_pending_human_review" : "preview_logged",
      steps: [
        { name: "goal", status: "received" },
        { name: "risk_classification", status: highRisk ? "high" : "medium" },
        { name: "context_collection", status: "scoped" },
        { name: "tool_preview", status: "preview_only" },
        { name: "human_review", status: highRisk ? "blocked_pending_human_review" : "preview_logged" },
      ],
    } as AgentWorkflowDemoResult) : request<AgentWorkflowDemoResult>("/agent/workflows/langgraph/demo", { method: "POST", body: JSON.stringify(values) });
  },
  visualContext: (values: VisualContextRequest) =>
    demoMode ? Promise.resolve(demoVisualResponse(values, "context")) : request<VisualCopilotResponse>("/visual-copilot/context", { method: "POST", body: JSON.stringify(values) }),
  visualSuggestions: (values: VisualContextRequest) =>
    demoMode ? Promise.resolve(demoVisualResponse(values, "suggestion")) : request<VisualCopilotResponse>("/visual-copilot/suggestions", { method: "POST", body: JSON.stringify(values) }),
  visualActionPreview: (values: VisualContextRequest) =>
    demoMode ? Promise.resolve(demoVisualResponse(values, "action_preview")) : request<VisualCopilotResponse>("/visual-copilot/actions/preview", { method: "POST", body: JSON.stringify(values) }),
  visualActionExecute: (values: VisualContextRequest) =>
    demoMode ? Promise.resolve(demoVisualResponse(values, "action_execute_blocked")) : request<VisualCopilotResponse>("/visual-copilot/actions/execute", { method: "POST", body: JSON.stringify(values) }),
  visualEvents: (page = 1, size = 10) =>
    demoMode ? Promise.resolve(demoPage([demoVisualResponse({ route: "/app/dashboard", viewport: { width: 1440, height: 900, scrollX: 0, scrollY: 0 }, dom: [], regions: [], instruction: "解释这个审计事件" }, "event").event])) : request<Page<VisualCopilotEvent>>(`/visual-copilot/events?page=${page}&size=${size}`),
};
