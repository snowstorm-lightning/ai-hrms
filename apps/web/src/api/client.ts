import type {
  ApiEnvelope,
  AIChatResponse,
  AgentRun,
  AgentToolPreviewResponse,
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

const demoUser = {
  id: "demo-user-co-growth",
  mobile: "123",
  username: "Co-Growth Demo",
  enableState: 1,
  createdAt: "2026-05-28T00:00:00+08:00",
  roles: ["group_admin", "group_hr", "employee"],
};

const demoLegalEntities = [
  { id: "entity-001", code: "GROUP", name: "共进科技集团", legalName: "共进科技集团有限公司", unifiedSocialCreditCode: "91310000DEMO0001", legalRepresentative: "林澄", companyPhone: "021-00000000", email: "hr@example.com", area: "上海", address: "上海市浦东新区 AI Avenue 1 号", status: "active", createdAt: "2026-05-01" },
];

const demoOrgUnits = [
  { id: "org-001", code: "RD", name: "平台研发", type: "department", managerName: "邵一鸣", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
  { id: "org-002", code: "HR", name: "人力资源", type: "department", managerName: "陈向南", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
  { id: "org-003", code: "GT", name: "增长团队", type: "department", managerName: "周雨桐", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
];

const demoEmployees = [
  { id: "emp-001", employeeNo: "CG001", name: "林晨", mobile: "13800000001", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "上海", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "同济大学", major: "软件工程", homeCompany: "共进科技集团", title: "研发实习生", resume: "", isThereAnyCompetitionRestriction: "", remarks: "Co-Growth Demo 样本", primaryAssignment: { id: "assign-001", legalEntityId: "entity-001", legalEntityName: "共进科技集团", orgUnitId: "org-001", orgUnitName: "平台研发", positionTitle: "研发实习生", isPrimary: true, startDate: "2026-05-01", employmentType: "intern" } },
  { id: "emp-002", employeeNo: "CG002", name: "周雨桐", mobile: "13800000002", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "杭州", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "浙江大学", major: "工业设计", homeCompany: "共进科技集团", title: "产品助理", resume: "", isThereAnyCompetitionRestriction: "", remarks: "Co-Growth Demo 样本", primaryAssignment: { id: "assign-002", legalEntityId: "entity-001", legalEntityName: "共进科技集团", orgUnitId: "org-003", orgUnitName: "增长团队", positionTitle: "产品助理", isPrimary: true, startDate: "2026-05-01", employmentType: "full_time" } },
  { id: "emp-003", employeeNo: "CG003", name: "陈向南", mobile: "13800000003", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "上海", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "华东师范大学", major: "人力资源", homeCompany: "共进科技集团", title: "HRBP", resume: "", isThereAnyCompetitionRestriction: "", remarks: "Co-Growth Demo 样本", primaryAssignment: { id: "assign-003", legalEntityId: "entity-001", legalEntityName: "共进科技集团", orgUnitId: "org-002", orgUnitName: "人力资源", positionTitle: "HRBP", isPrimary: true, startDate: "2026-05-01", employmentType: "full_time" } },
] as Employee[];

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

export function getToken() {
  return localStorage.getItem(tokenKey);
}

export function setToken(token: string) {
  localStorage.setItem(tokenKey, token);
}

export function clearToken() {
  localStorage.removeItem(tokenKey);
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
  legalEntities: () => demoMode ? Promise.resolve(demoLegalEntities as LegalEntity[]) : request<LegalEntity[]>("/legal-entities"),
  createLegalEntity: (values: Partial<LegalEntity>) =>
    request<LegalEntity>("/legal-entities", { method: "POST", body: JSON.stringify(values) }),
  updateLegalEntity: (id: string, values: Partial<LegalEntity>) =>
    request<LegalEntity>(`/legal-entities/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  orgUnits: () => demoMode ? Promise.resolve(demoOrgUnits as OrgUnit[]) : request<OrgUnit[]>("/org-units"),
  createOrgUnit: (values: Partial<OrgUnit>) =>
    request<OrgUnit>("/org-units", { method: "POST", body: JSON.stringify(values) }),
  updateOrgUnit: (id: string, values: Partial<OrgUnit>) =>
    request<OrgUnit>(`/org-units/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  roles: () => request<Role[]>("/roles"),
  capabilities: () => request<Capability[]>("/capabilities"),
  users: (page = 1, size = 10) => request<Page<User>>(`/users?page=${page}&size=${size}`),
  createUser: (values: { mobile: string; username: string; password?: string }) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(values) }),
  updateUser: (id: string, values: Partial<User>) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  userRoleBindings: (id: string) => request<RoleBinding[]>(`/users/${id}/role-bindings`),
  updateUserRoleBindings: (id: string, bindings: RoleBinding[]) =>
    request<RoleBinding[]>(`/users/${id}/role-bindings`, { method: "PUT", body: JSON.stringify({ bindings }) }),
  employees: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPaged(demoEmployees, page, size)) : request<Page<Employee>>(`/employees?page=${page}&size=${size}`),
  employee: (id: string) => demoMode ? Promise.resolve(demoEmployees.find((employee) => employee.id === id) ?? demoEmployees[0]) : request<Employee>(`/employees/${id}`),
  employeeAssignments: (id: string) => demoMode ? Promise.resolve(demoAssignments(id)) : request<Employee["assignments"]>(`/employees/${id}/assignments`),
  updateEmployeeAssignments: (id: string, assignments: NonNullable<Employee["assignments"]>) =>
    request<NonNullable<Employee["assignments"]>>(`/employees/${id}/assignments`, {
      method: "PUT",
      body: JSON.stringify({ assignments }),
    }),
  createEmployee: (values: Partial<Employee>) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify(values) }),
  updateEmployee: (id: string, values: Partial<Employee>) =>
    request<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  exportEmployees: () => download("/employees/export", "employees.csv"),
  attendance: (page = 1, size = 10) => request<Page<Attendance>>(`/attendance?page=${page}&size=${size}`),
  checkin: (employeeId: string, attendanceStatus = 1) =>
    request<Attendance>("/attendance", { method: "POST", body: JSON.stringify({ employeeId, attendanceStatus }) }),
  checkout: (id: string) => request<Attendance>(`/attendance/${id}/checkout`, { method: "PUT" }),
  exportAttendance: () => download("/attendance/export", "attendance.csv"),
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
  auditEvents: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPage([
    { id: "audit-001", eventType: "co_growth.coach.preview", objectType: "co_growth_suggestion", objectId: "coach-001", scopeType: "global", requestId: "demo-req-001", source: "web", riskLevel: "low", oldValueSummary: {}, newValueSummary: { evidence: ["context-quality"], confidence: 90, humanReviewRequired: false }, createdAt: "2026-05-28T09:00:00+08:00" },
    { id: "audit-002", eventType: "co_growth.workflow.preview", objectType: "co_growth_workflow", objectId: "agent-workflow-lab", scopeType: "global", requestId: "demo-req-002", source: "web", riskLevel: "medium", oldValueSummary: {}, newValueSummary: { nodes: 7, toolPreview: true, auditRequired: true }, createdAt: "2026-05-28T09:10:00+08:00" },
    { id: "audit-003", eventType: "ai.governance.human_review_required", objectType: "learning_mission", objectId: "mission-interview-bias", scopeType: "global", requestId: "demo-req-003", source: "web", riskLevel: "high", oldValueSummary: {}, newValueSummary: { reason: "fairness boundary", humanReviewRequired: true }, createdAt: "2026-05-28T09:20:00+08:00" },
  ] as AuditEvent[])) : request<Page<AuditEvent>>(`/audit/events?page=${page}&size=${size}`),
  ragSources: () => demoMode ? Promise.resolve([{ id: "rag-source-001", sourceType: "upload", name: "Co-Growth 学习资料", uri: "demo://co-growth", status: "active", createdAt: "2026-05-28" }] as RAGSource[]) : request<RAGSource[]>("/rag/sources"),
  createRAGSource: (values: Partial<RAGSource>) =>
    request<RAGSource>("/rag/sources", { method: "POST", body: JSON.stringify(values) }),
  ragDocuments: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPage([{ id: "rag-doc-001", sourceId: "rag-source-001", title: "AI 原理与工作流学习手册", version: "v1", status: "published", trustLevel: "official", sensitivity: "normal", createdAt: "2026-05-28" }] as RAGDocument[])) : request<Page<RAGDocument>>(`/rag/documents?page=${page}&size=${size}`),
  createRAGDocument: (values: Partial<RAGDocument>) =>
    request<RAGDocument>("/rag/documents", { method: "POST", body: JSON.stringify(values) }),
  createRAGIngestJob: (values: {
    sourceId?: string | null;
    documentId?: string | null;
    jobType?: string;
    title?: string;
    content?: string;
  }) =>
    request<unknown>("/rag/ingest-jobs", { method: "POST", body: JSON.stringify(values) }),
  ragSearch: (query: string, limit = 5) =>
    demoMode ? Promise.resolve({
      answer: `基于 Co-Growth demo 知识库，"${query}" 应先展示引用，再给出可验证建议。`,
      citations: [{ documentId: "rag-doc-001", chunkId: `demo-${limit}`, title: "AI 原理与工作流学习手册", snippet: "AI 建议必须暴露 evidence、riskLevel、confidence 和人工确认边界。" }],
    }) : request<RAGSearchResult>("/rag/search", { method: "POST", body: JSON.stringify({ query, limit }) }),
  aiChat: (message: string) => demoMode ? Promise.resolve({
    message: `Demo AI：已将“${message}”转化为可解释建议。请先确认上下文，再检查证据、风险和人工确认点。`,
    citations: [{ documentId: "rag-doc-001", chunkId: "ai-demo-001", title: "Co-Growth OS 设计说明", snippet: "学习信号用于成长辅导，不用于自动化人事裁决。" }],
  }) : request<AIChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ message }) }),
  learningCourses: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPage([
    { id: "course-ai-principles", title: "AI 原理理解", description: "从 token、上下文、幻觉到 RAG 可靠性。", status: "published", scopeType: "global", createdAt: "2026-05-28", lessonCount: 6 },
    { id: "course-workflow", title: "从 Prompt 到 Workflow", description: "学习 state、node、edge、工具调用和人工确认。", status: "published", scopeType: "global", createdAt: "2026-05-28", lessonCount: 5 },
  ] as LearningCourse[])) : request<Page<LearningCourse>>(`/learning/courses?page=${page}&size=${size}`),
  createLearningCourse: (values: Partial<LearningCourse>) =>
    request<LearningCourse>("/learning/courses", { method: "POST", body: JSON.stringify(values) }),
  learningLessons: (courseId: string) => request<LearningLesson[]>(`/learning/courses/${courseId}/lessons`),
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
  agentRuns: (page = 1, size = 10) => demoMode ? Promise.resolve(demoPage([
    { id: "agent-run-001", runType: "co_growth_coach", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "low", summary: "生成本周 AI 学习 mission，并保留 evidence。", createdAt: "2026-05-28" },
    { id: "agent-run-002", runType: "agent_workflow_lab", status: "previewed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "预览个性化学习任务推荐 Agent 节点链路。", createdAt: "2026-05-28" },
  ] as AgentRun[])) : request<Page<AgentRun>>(`/agent/runs?page=${page}&size=${size}`),
  createAgentRun: (values: { runType: string; prompt: string; riskLevel: string }) =>
    demoMode ? Promise.resolve({ id: `agent-run-${Date.now()}`, runType: values.runType, status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: values.riskLevel, summary: values.prompt || "Demo Agent run", createdAt: new Date().toISOString() }) : request<AgentRun>("/agent/runs", { method: "POST", body: JSON.stringify(values) }),
  previewAgentTool: (values: { runId?: string; toolName: string; arguments: Record<string, unknown> }) =>
    request<AgentToolPreviewResponse>("/agent/tools/preview", { method: "POST", body: JSON.stringify(values) }),
  visualContext: (values: VisualContextRequest) =>
    request<VisualCopilotResponse>("/visual-copilot/context", { method: "POST", body: JSON.stringify(values) }),
  visualSuggestions: (values: VisualContextRequest) =>
    request<VisualCopilotResponse>("/visual-copilot/suggestions", { method: "POST", body: JSON.stringify(values) }),
  visualActionPreview: (values: VisualContextRequest) =>
    request<VisualCopilotResponse>("/visual-copilot/actions/preview", { method: "POST", body: JSON.stringify(values) }),
  visualActionExecute: (values: VisualContextRequest) =>
    request<VisualCopilotResponse>("/visual-copilot/actions/execute", { method: "POST", body: JSON.stringify(values) }),
  visualEvents: (page = 1, size = 10) =>
    request<Page<VisualCopilotEvent>>(`/visual-copilot/events?page=${page}&size=${size}`),
};
