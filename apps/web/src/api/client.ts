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
    return request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
  },
  profile: () => request<User>("/profile"),
  legalEntities: () => request<LegalEntity[]>("/legal-entities"),
  createLegalEntity: (values: Partial<LegalEntity>) =>
    request<LegalEntity>("/legal-entities", { method: "POST", body: JSON.stringify(values) }),
  updateLegalEntity: (id: string, values: Partial<LegalEntity>) =>
    request<LegalEntity>(`/legal-entities/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  orgUnits: () => request<OrgUnit[]>("/org-units"),
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
  employees: (page = 1, size = 10) => request<Page<Employee>>(`/employees?page=${page}&size=${size}`),
  employee: (id: string) => request<Employee>(`/employees/${id}`),
  employeeAssignments: (id: string) => request<Employee["assignments"]>(`/employees/${id}/assignments`),
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
  messages: (page = 1, size = 10) => request<Page<MessageItem>>(`/messages?page=${page}&size=${size}`),
  createMessage: (values: Pick<MessageItem, "title" | "category" | "content">) =>
    request<MessageItem>("/messages", { method: "POST", body: JSON.stringify(values) }),
  comments: (messageId: string) => request<CommentItem[]>(`/messages/${messageId}/comments`),
  createComment: (messageId: string, content: string) =>
    request<CommentItem>(`/messages/${messageId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  auditEvents: (page = 1, size = 10) => request<Page<AuditEvent>>(`/audit/events?page=${page}&size=${size}`),
  ragSources: () => request<RAGSource[]>("/rag/sources"),
  createRAGSource: (values: Partial<RAGSource>) =>
    request<RAGSource>("/rag/sources", { method: "POST", body: JSON.stringify(values) }),
  ragDocuments: (page = 1, size = 10) => request<Page<RAGDocument>>(`/rag/documents?page=${page}&size=${size}`),
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
    request<RAGSearchResult>("/rag/search", { method: "POST", body: JSON.stringify({ query, limit }) }),
  aiChat: (message: string) => request<AIChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ message }) }),
  learningCourses: (page = 1, size = 10) => request<Page<LearningCourse>>(`/learning/courses?page=${page}&size=${size}`),
  createLearningCourse: (values: Partial<LearningCourse>) =>
    request<LearningCourse>("/learning/courses", { method: "POST", body: JSON.stringify(values) }),
  learningLessons: (courseId: string) => request<LearningLesson[]>(`/learning/courses/${courseId}/lessons`),
  learningEnrollments: (page = 1, size = 10) =>
    request<Page<LearningEnrollment>>(`/learning/enrollments?page=${page}&size=${size}`),
  learningRecommendations: (page = 1, size = 10) =>
    request<Page<LearningRecommendation>>(`/learning/recommendations?page=${page}&size=${size}`),
  agentRuns: (page = 1, size = 10) => request<Page<AgentRun>>(`/agent/runs?page=${page}&size=${size}`),
  createAgentRun: (values: { runType: string; prompt: string; riskLevel: string }) =>
    request<AgentRun>("/agent/runs", { method: "POST", body: JSON.stringify(values) }),
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
