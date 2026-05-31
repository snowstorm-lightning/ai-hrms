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
  ContextItem,
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
  username: "demo",
  enableState: 1,
  createdAt: "2026-05-28T00:00:00+08:00",
  roles: ["group_admin", "group_hr", "employee"],
};

let demoUsers: User[] = [
  demoUser,
  { id: "demo-user-hr", mobile: "13900000001", username: "许安宁 集团 HR", enableState: 1, createdAt: "2026-05-25T09:00:00+08:00", roles: ["group_hr"] },
  { id: "demo-user-mentor", mobile: "13900000002", username: "周雨桐 导师", enableState: 1, createdAt: "2026-05-25T09:10:00+08:00", roles: ["org_manager"] },
  { id: "demo-user-employee", mobile: "13900000003", username: "林晨 新人", enableState: 1, createdAt: "2026-05-25T09:20:00+08:00", roles: ["employee"] },
  { id: "demo-user-manager", mobile: "13900000004", username: "顾明远 业务管理者", enableState: 1, createdAt: "2026-05-25T09:30:00+08:00", roles: ["org_manager"] },
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
  "demo-user-mentor": [{ id: "binding-demo-mentor", roleCode: "org_manager", roleName: "组织管理者", scopeType: "org_unit", scopeId: "org-006", scopeName: "增长策略部", includeDescendants: true }],
  "demo-user-employee": [{ id: "binding-demo-employee", roleCode: "employee", roleName: "员工", scopeType: "org_unit", scopeId: "org-002", scopeName: "AI 平台工程部", includeDescendants: false }],
  "demo-user-manager": [{ id: "binding-demo-manager", roleCode: "org_manager", roleName: "组织管理者", scopeType: "org_unit", scopeId: "org-004", scopeName: "协同产品研发部", includeDescendants: true }],
};

let demoLegalEntities: LegalEntity[] = [
  { id: "entity-001", code: "GROUP", name: "企鹅互联网科技有限公司", legalName: "企鹅互联网科技有限公司", unifiedSocialCreditCode: "91440300PENGUIN001", legalRepresentative: "许海川", companyPhone: "0755-86000000", email: "people@penguin.example", area: "深圳", address: "深圳市南山区海湾科技园 1 号", status: "active", createdAt: "2026-05-01" },
  { id: "entity-002", code: "SUB-A", name: "企鹅企业服务", legalName: "企鹅企业服务有限公司", unifiedSocialCreditCode: "91440300PENGUIN002", legalRepresentative: "罗启明", companyPhone: "0755-86000002", email: "enterprise-hr@penguin.example", area: "深圳", address: "深圳市南山区企业服务路 8 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
  { id: "entity-003", code: "SUB-B", name: "企鹅协同产品", legalName: "企鹅协同产品有限公司", unifiedSocialCreditCode: "91440300PENGUIN003", legalRepresentative: "顾明远", companyPhone: "028-86000003", email: "penguin-collab-hr@penguin.example", area: "成都", address: "成都市高新区协同产品大道 12 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
  { id: "entity-004", code: "PENGUIN-RISK", name: "企鹅风控科技", legalName: "企鹅风控科技有限公司", unifiedSocialCreditCode: "91440300PENGUIN004", legalRepresentative: "沈知衡", companyPhone: "020-86000004", email: "risk-hr@penguin.example", area: "广州", address: "广州市天河区风险治理路 6 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
  { id: "entity-005", code: "PENGUIN-GROWTH", name: "企鹅增长科技", legalName: "企鹅增长科技有限公司", unifiedSocialCreditCode: "91440300PENGUIN005", legalRepresentative: "周雨桐", companyPhone: "0571-86000005", email: "growth-ops@penguin.example", area: "杭州", address: "杭州市余杭区增长街 9 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
];

let demoOrgUnits: OrgUnit[] = [
  { id: "org-001", code: "GROUP-HR", name: "集团人力资源部", type: "shared", managerName: "许安宁", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
  { id: "org-002", code: "AI-PLATFORM", name: "AI 平台工程部", type: "department", managerName: "顾明远", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001" },
  { id: "org-003", code: "AI-GOV", name: "AI 安全与治理委员会", type: "committee", managerName: "沈知衡", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-001", parentId: "org-002" },
  { id: "org-004", code: "COLLAB-RD", name: "协同产品研发部", type: "department", managerName: "顾明远", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-003" },
  { id: "org-005", code: "ENTERPRISE-CS", name: "企业服务交付与客户成功部", type: "department", managerName: "陈向南", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-002" },
  { id: "org-006", code: "GROWTH-STRATEGY", name: "增长策略部", type: "department", managerName: "周雨桐", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-005" },
  { id: "org-007", code: "RISK-GOV", name: "风险策略部", type: "department", managerName: "沈知衡", status: "active", createdAt: "2026-05-01", legalEntityId: "entity-004" },
];

let demoEmployees: Employee[] = [
  { id: "emp-001", employeeNo: "PG001", name: "许安宁", mobile: "13800000001", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "深圳", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "中国人民大学", major: "组织发展", homeCompany: "企鹅互联网科技有限公司", title: "集团 HR", resume: "", isThereAnyCompetitionRestriction: "", remarks: "企鹅科技虚构样本 样本：集团 HR 和 Demo 主讲角色", primaryAssignment: { id: "assign-001", legalEntityId: "entity-001", legalEntityName: "企鹅互联网科技有限公司", orgUnitId: "org-001", orgUnitName: "集团人力资源部", positionTitle: "集团 HR", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-002", employeeNo: "PG002", name: "陈向南", mobile: "13800000002", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "深圳", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "华南理工大学", major: "人力资源", homeCompany: "企鹅企业服务", title: "企业服务 HRBP", resume: "", isThereAnyCompetitionRestriction: "", remarks: "企鹅科技虚构样本 样本：企业服务 HRBP", primaryAssignment: { id: "assign-002", legalEntityId: "entity-002", legalEntityName: "企鹅企业服务", orgUnitId: "org-005", orgUnitName: "企业服务交付与客户成功部", positionTitle: "企业服务 HRBP", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-003", employeeNo: "PG003", name: "林晨", mobile: "13800000003", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "深圳", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "同济大学", major: "软件工程", homeCompany: "企鹅互联网科技有限公司", title: "AI 平台研发工程师", resume: "", isThereAnyCompetitionRestriction: "", remarks: "企鹅科技虚构样本 样本：新人研发，参与 Co-Growth mission", primaryAssignment: { id: "assign-003", legalEntityId: "entity-001", legalEntityName: "企鹅互联网科技有限公司", orgUnitId: "org-002", orgUnitName: "AI 平台工程部", positionTitle: "AI 平台研发工程师", isPrimary: true, startDate: "2026-05-01", employmentType: "full_time" } },
  { id: "emp-004", employeeNo: "PG004", name: "周雨桐", mobile: "13800000004", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "杭州", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "浙江大学", major: "计算机科学", homeCompany: "企鹅增长科技", title: "算法导师", resume: "", isThereAnyCompetitionRestriction: "", remarks: "企鹅科技虚构样本 样本：导师，复核新人 AI Work Journal", primaryAssignment: { id: "assign-004", legalEntityId: "entity-005", legalEntityName: "企鹅增长科技", orgUnitId: "org-006", orgUnitName: "增长策略部", positionTitle: "增长算法导师", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-005", employeeNo: "PG005", name: "顾明远", mobile: "13800000005", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "成都", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "电子科技大学", major: "协同产品工程", homeCompany: "企鹅协同产品", title: "业务管理者", resume: "", isThereAnyCompetitionRestriction: "", remarks: "企鹅科技虚构样本 样本：关注组织能力和 Agent 风险", primaryAssignment: { id: "assign-005", legalEntityId: "entity-003", legalEntityName: "企鹅协同产品", orgUnitId: "org-004", orgUnitName: "协同产品研发部", positionTitle: "协同产品研发管理者", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-006", employeeNo: "PG006", name: "沈知衡", mobile: "13800000006", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "博士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "广州", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "中山大学", major: "信息安全", homeCompany: "企鹅风控科技", title: "AI 安全与审计负责人", resume: "", isThereAnyCompetitionRestriction: "", remarks: "企鹅科技虚构样本 样本：负责知识治理和风险边界", primaryAssignment: { id: "assign-006", legalEntityId: "entity-004", legalEntityName: "企鹅风控科技", orgUnitId: "org-007", orgUnitName: "风险策略部", positionTitle: "AI 安全与审计负责人", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
];

let demoAttendance: Attendance[] = [
  { id: "att-001", employeeId: "emp-003", employeeName: "林晨", mobile: "13800000003", orgUnitName: "AI 平台工程部", attendanceStatus: 1, attendanceInTime: "2026-05-29T09:02:00+08:00", attendanceOutTime: null, day: "2026-05-29", remarks: "AI 平台新人完成 Co-Growth mission 签到" },
  { id: "att-002", employeeId: "emp-002", employeeName: "陈向南", mobile: "13800000002", orgUnitName: "企业服务交付与客户成功部", attendanceStatus: 3, attendanceInTime: "2026-05-29T09:18:00+08:00", attendanceOutTime: "2026-05-29T18:15:00+08:00", day: "2026-05-29", remarks: "企业服务交付周会延迟" },
];

let demoMessages: MessageItem[] = [
  {
    id: "msg-001",
    title: "本周 AI 学习 mission 开放试用",
    category: "announcement",
    content: "企鹅互联网科技有限公司（虚构样本组织）的 AI-HRMS 成长引擎样本任务已开放。欢迎先从 RAG 原理卡和工作内嵌 mission 开始体验。",
    author: "许安宁",
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
    { id: "comment-002", messageId: "msg-002", username: "许安宁", content: "高风险场景请保留 evidence、riskLevel 和 humanReviewRequired。", createdAt: "2026-05-28T11:40:00+08:00" },
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
  const routeLabel = visualRouteLabel(values.route);
  const selectedLabels = refs.map((ref) => ref.label || `${ref.type}:${ref.id}`).filter(Boolean);
  const domItems = refs.length ? [] : demoDomContextItems(values);
  const selectedSummary = selectedLabels.length
    ? `已识别 ${values.regions.length} 个圈选区域，关联业务对象：${selectedLabels.join("、")}。`
    : domItems.length
      ? `已识别 ${values.regions.length} 个圈选区域，命中页面模块：${domItems.map((item) => item.label).join("、")}。解释基于 DOM 摘要、路由和选区坐标，不读取截图像素。`
      : `已识别 ${values.regions.length} 个圈选区域，未命中具名业务对象或页面模块；系统只能基于页面路由和圈选坐标解释，不读取截图像素。`;
  const requested = values.instruction.trim() || "解释选区";
  const riskLevel = intent === "action_execute_blocked" ? "high" : refs.length ? "medium" : "low";
  const executionDecision = {
    intent: intent === "action_execute_blocked" ? "action_execute_blocked" : "visual_selection_explain",
    executionMode: intent === "action_execute_blocked" ? "action_preview" : "retrieval_only",
    riskLevel,
    useLlm: false,
    useAgent: false,
    useMultiAgent: false,
    humanReviewRequired: riskLevel !== "low",
    reason: "Demo harness 优先使用页面 DOM、业务对象引用和确定性上下文；不为简单解释调用大模型。",
    routedBy: ["visual.context.resolver", "program.first", "audit.required"],
  };
  const contextPacket = {
    route: values.route,
    intent: executionDecision.intent,
    subject: requested,
    items: refs.length
      ? refs.map((ref) => ({
        type: ref.type,
        id: ref.id,
        label: compactDemoVisualText(ref.label || `${ref.type}:${ref.id}`, 60),
        summary: demoVisualRefSummary(ref),
        source: "visual_selection.dom_ref",
        provenance: values.route,
      }))
      : domItems.length
        ? domItems
        : [{
        type: "screen_region",
        label: routeLabel,
        summary: `${routeLabel} 的页面区域。只能基于页面路由和圈选坐标解释，不能读取截图像素。`,
        source: "visual_selection.rect",
        provenance: values.route,
      }],
    sourceCount: { business_ref: refs.length, region: values.regions.length, dom_node: values.dom.length },
    staleness: "live_page_snapshot",
    boundary: "当前 Visual Copilot 不上传图片给 DeepSeek；图片解释能力未启用。",
  };
  const trustPacket = {
    riskLevel,
    confidence: refs.length ? 0.88 : 0.76,
    humanReviewRequired: riskLevel !== "low",
    evidenceCount: contextPacket.items.length,
    auditStatus: intent === "action_execute_blocked" ? "blocked_preview_logged" : "preview_logged",
    reversible: intent !== "action_execute_blocked",
    policyChecks: ["scope.checked", "no_image_analysis", "preview_first", "audit.required"],
  };
  appendDemoAudit({
    eventType: intent === "action_execute_blocked" ? "high_risk.action.blocked" : "visual_copilot.preview",
    objectType: "visual_copilot_event",
    objectId: `visual-${Date.now()}`,
    riskLevel,
    newValueSummary: { route: values.route, refs: refs.length, instructionPreview: redactDemoText(values.instruction), intent },
    source: "visual_copilot",
  });
  return {
    event: {
      id: `visual-event-${Date.now()}`,
      route: values.route,
      instruction: redactDemoText(values.instruction),
      regions: values.regions,
      businessRefs: refs,
      intent,
      confidence: trustPacket.confidence,
      status: intent === "action_execute_blocked" ? "blocked_demo_preview" : "previewed",
      createdAt: new Date().toISOString(),
    },
    executionDecision,
    contextPacket,
    trustPacket,
    result: {
      title: intent === "action_execute_blocked" ? "已生成高风险动作预览" : "选区上下文已解析",
      preview: intent === "action_execute_blocked"
        ? "Demo Visual Copilot：高风险或写操作不会自动执行。系统只生成预览，并要求人工确认后由 Go 重新校验权限和记录审计。"
        : `Demo Visual Copilot 已根据 ${routeLabel} 的圈选上下文生成解释。`,
      explanation: intent === "action_execute_blocked"
        ? "该请求可能改变业务状态，因此被降级为预览；需要人工确认、权限复核和审计记录后才能执行。"
        : `你的意图是“${requested}”。系统当前依据页面路由、圈选坐标、DOM 摘要和业务对象引用解释选区，而不是读取像素内容。${demoVisualFocusLine(refs, domItems)}`,
      selectedSummary,
      trustBoundary: "当前模式是 DOM + 业务对象上下文解释；未上传页面截图，也未调用视觉模型。图片/像素级解释需要接入支持 vision 的 OpenAI-compatible provider。",
      riskLevel,
      confidence: trustPacket.confidence,
      imageMode: values.screenshot ? "screenshot-hash-only" : "no-image-analysis",
      executionDecision,
      contextPacket,
      trustPacket,
      actions: [
        { type: "explain", label: "解释选区", riskLevel: "low" },
        { type: "open_evidence", label: "查看证据链", riskLevel: "medium" },
        { type: "request_review", label: "请求人工确认", riskLevel: "high", blocked: true },
      ],
    },
  };
}

function visualRouteLabel(route: string): string {
  if (route.includes("dashboard")) return "AI-HRMS Command Dashboard";
  if (route.includes("ai-command")) return "AI 指挥中心";
  if (route.includes("knowledge")) return "Knowledge Hub";
  if (route.includes("agents")) return "Agent Run Center";
  if (route.includes("audit")) return "Audit & Evidence";
  if (route.includes("learning")) return "Learning Layer";
  if (route.includes("co-growth")) return "Co-Growth OS";
  return route || "当前页面";
}

function demoVisualFocusLine(refs: VisualContextRequest["regions"][number]["businessRefs"], domItems: ContextItem[]) {
  if (refs.length) {
    const lines = refs.slice(0, 3).map((ref) => {
      const label = compactDemoVisualText(ref.label || `${ref.type}:${ref.id}`, 40);
      return `「${label}」：${demoVisualRefSummary(ref)}`;
    });
    return ` 本次命中 ${refs.length} 个已校验业务对象：${lines.join("；")}。`;
  }
  if (domItems[0]) {
    return ` 本次命中页面模块「${domItems[0].label}」：${domItems[0].summary}`;
  }
  return " 本次未命中具名业务对象；建议圈选具体表格行、卡片、字段或按钮，以获得数据库上下文解释。";
}

function demoVisualRefSummary(ref: VisualContextRequest["regions"][number]["businessRefs"][number]) {
  const label = ref.label || ref.id;
  switch (ref.type) {
    case "legal_entity":
      return `法人实体「${compactDemoVisualText(label, 40)}」用于确定合同主体、地区责任、权限 scope 和审计归属；解释不会推断真实公司外部信息。`;
    case "org_unit":
      return `组织单元「${compactDemoVisualText(label, 40)}」用于限定员工、知识资料、Agent run 和审计事件的组织范围。`;
    case "employee":
    case "user":
      return demoEmployeeVisualSummary(ref, label);
    case "rag_document":
      return `知识资料「${compactDemoVisualText(label, 40)}」需要结合 trustLevel、sensitivity、scope 和 citation 才能用于 AI 回答。`;
    case "agent_run":
      return `Agent run「${compactDemoVisualText(label, 40)}」适合检查状态、工具预览、人工确认和审计记录，不代表动作已经执行。`;
    case "audit_event":
      return `审计事件「${compactDemoVisualText(label, 40)}」用于回溯 AI 建议、工具调用、人审和证据链。`;
    case "learning":
      return `学习对象「${compactDemoVisualText(label, 40)}」属于 Co-Growth 成长证据，可用于解释 mission、复盘和能力沉淀。`;
    default:
      return `业务对象「${compactDemoVisualText(label, 40)}」已随选区提交，系统只在当前权限边界内解释。`;
  }
}

function demoEmployeeVisualSummary(ref: VisualContextRequest["regions"][number]["businessRefs"][number], fallbackLabel: string) {
  const employee = demoEmployees.find((item) => item.id === ref.id);
  if (!employee) {
    return `员工/账号对象「${compactDemoVisualText(fallbackLabel, 40)}」只能用于查看已授权上下文；系统不会自动给出录用、晋升、降薪、淘汰等高影响裁决。`;
  }
  const assignment = employee.primaryAssignment;
  const legalName = assignment?.legalEntityName || "未分配";
  const orgName = assignment?.orgUnitName || "未分配";
  const position = assignment?.positionTitle || employee.title || "未返回";
  const legalProfile = demoBusinessProfileForLegal(assignment?.legalEntityId, legalName);
  const orgProfile = demoBusinessProfileForOrg(assignment?.orgUnitId, orgName);
  return `员工「${employee.name}」岗位=${position}，主任职归属=${legalName} / ${orgName}；业务内容按归属推断为${orgProfile || legalProfile}。该解释不评价个人绩效或真实产出。`;
}

function demoBusinessProfileForLegal(id?: string | null, name = "") {
  const entity = demoLegalEntities.find((item) => item.id === id);
  const value = `${entity?.code || ""} ${entity?.name || name}`.toLowerCase();
  if (value.includes("enterprise") || value.includes("企业服务")) return "企业客户协作方案、交付实施、客户成功和培训支持";
  if (value.includes("collab") || value.includes("协同")) return "协同办公、产品研发和跨团队工作流平台";
  if (value.includes("risk") || value.includes("风控")) return "内容安全、风控策略、AI 治理和审计能力";
  if (value.includes("growth") || value.includes("增长")) return "增长算法、用户运营和数据驱动业务实验";
  if (value.includes("group") || value.includes("集团") || value.includes("互联网科技")) return "集团总部与 AI 平台底座，承载统一 HR、知识治理和 Agent 协作规范";
  return "模拟互联网科技公司下的业务或职能法人，用于权限 scope、合同边界和审计归属";
}

function demoBusinessProfileForOrg(id?: string | null, name = "") {
  const unit = demoOrgUnits.find((item) => item.id === id);
  const value = `${unit?.code || ""} ${unit?.name || name}`.toLowerCase();
  if (value.includes("group-hr") || value.includes("人力资源")) return "集团 HR 共享能力、组织制度、人才发展和人机协作治理";
  if (value.includes("ai-platform") || value.includes("平台工程")) return "AI 平台底座、Agent 工程能力、内部工具链和安全工程实践";
  if (value.includes("ai-gov") || value.includes("安全与治理")) return "AI 安全评审、风险策略、审计规范和人审流程";
  if (value.includes("collab") || value.includes("协同")) return "协同办公产品研发、跨团队流程和工作流平台";
  if (value.includes("enterprise") || value.includes("企业服务")) return "企业客户交付、客户成功、实施支持和培训服务";
  if (value.includes("growth") || value.includes("增长")) return "增长策略、用户运营、实验分析和数据驱动迭代";
  if (value.includes("risk") || value.includes("风险")) return "内容安全、风控策略、审计证据和 AI 治理能力";
  return demoBusinessProfileForLegal(unit?.legalEntityId, "");
}

function demoDomContextItems(values: VisualContextRequest): ContextItem[] {
  return values.dom
    .filter((node) => Boolean(node.visible) && demoNodeIntersectsRegions(node, values.regions))
    .slice(0, 4)
    .map((node) => {
      const kind = stringValue(node.kind) || stringValue(node.action) || stringValue(node.field) || "page_module";
      const label = compactDemoVisualText(stringValue(node.label) || kind, 48);
      const text = compactDemoVisualText(stringValue(node.text), 120);
      return {
        type: "dom_module",
        label,
        summary: text || `页面模块 kind=${kind}，位于当前圈选区域内。`,
        source: "visual_selection.dom_snapshot_unverified",
        provenance: values.route,
        metadata: { kind, tag: stringValue(node.tag), verifiedEvidence: false },
      };
    });
}

function compactDemoVisualText(value: string, limit: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!limit || text.length <= limit) return text;
  return `${text.slice(0, Math.max(limit - 3, 1))}...`;
}

function demoNodeIntersectsRegions(node: Record<string, unknown>, regions: VisualContextRequest["regions"]) {
  const rect = node.rect as Record<string, unknown> | undefined;
  if (!rect) return false;
  const x = numberValue(rect.x);
  const y = numberValue(rect.y);
  const width = numberValue(rect.width);
  const height = numberValue(rect.height);
  return regions.some((region) => {
    const target = region.rect;
    return x < target.x + target.width && x + width > target.x && y < target.y + target.height && y + height > target.y;
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function redactDemoText(value: string) {
  const text = value
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b1[3-9]\d{9}\b/g, "[mobile]")
    .replace(/\b\d{12,19}\b/g, "[number]")
    .replace(/\b\d{15}(\d{2}[0-9Xx])?\b/g, "[id]")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function redactDemoValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactDemoText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactDemoValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lower = key.toLowerCase();
      if (lower.includes("mobile") || lower.includes("phone") || lower.includes("email") ||
        lower.includes("id") || lower.includes("bank") || lower.includes("password") ||
        lower.includes("address")) {
        return [key, "[redacted]"];
      }
      return [key, redactDemoValue(item)];
    }));
  }
  return value;
}

function isHighImpactHRText(value: string) {
  return /面试|录用|淘汰|降薪|调薪|晋升|绩效|公平|裁员|末位|PIP|奖金|年终奖|调岗|离职|纪律处分|停职|年龄|性别|婚育|病史|hire|fire|salary|promotion|layoff|bonus|disciplinary|protected/i.test(value);
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
  deleteOrgUnit: (id: string) => {
    if (demoMode) {
      const referenced = demoOrgUnits.some((unit) => unit.parentId === id)
        || demoEmployees.some((employee) => employee.assignments?.some((assignment) => assignment.orgUnitId === id));
      if (referenced) {
        return Promise.reject(new Error("该组织单元仍被子组织或员工任职引用，请先迁移引用或改为 inactive"));
      }
      demoOrgUnits = demoOrgUnits.filter((unit) => unit.id !== id);
      return Promise.resolve({ deleted: true });
    }
    return request<{ deleted: boolean }>(`/org-units/${id}`, { method: "DELETE" });
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
        orgUnitName: "企鹅科技虚构样本",
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
    jobType?: "ingest" | "rebuild_embeddings" | string;
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
  rebuildRAGDocument: (id: string) => {
    if (demoMode) {
      const now = new Date().toISOString();
      const document = demoRAGDocuments.find((item) => item.id === id);
      const job: RAGIngestJob = {
        id: `rebuild-${Date.now()}`,
        sourceId: document?.sourceId ?? null,
        documentId: id,
        jobType: "rebuild_embeddings",
        status: "completed",
        provider: "demo-hybrid",
        summary: `Demo 已按 heading_sentence_context_v2_qwen3_2048 重建 ${document?.title ?? "选中资料"} 的 chunk 与本地向量索引。`,
        error: "",
        createdAt: now,
        completedAt: now,
      };
      appendDemoAudit({
        eventType: "rag.document.rebuild",
        objectType: "rag_document",
        objectId: id,
        riskLevel: "high",
        newValueSummary: {
          provider: "demo-hybrid",
          chunkStrategy: "heading_sentence_context_v2_qwen3_2048",
          documentTitle: document?.title,
          actionExecuted: true,
        },
        source: "rag",
      });
      return Promise.resolve(job);
    }
    return request<RAGIngestJob>(`/rag/documents/${id}/rebuild`, { method: "POST" });
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
      const highRiskQuery = isHighImpactHRText(query);
      const queryText = query.trim();
      const matchedDocuments = demoRAGDocuments
        .filter((document) => document.status === "published" && document.sensitivity !== "restricted")
        .filter((document) => !queryText || document.title.includes(queryText) || (document.content ?? "").includes(queryText) || queryText.split(/\s+/).some((token) => token && (document.title.includes(token) || (document.content ?? "").includes(token))))
        .slice(0, limit);
      const fallbackDocuments = highRiskQuery
        ? demoRAGDocuments.filter((document) => document.id === "rag-doc-004")
        : demoRAGDocuments.filter((document) => ["rag-doc-002", "rag-doc-004"].includes(document.id));
      const sourceDocuments = (matchedDocuments.length ? matchedDocuments : fallbackDocuments).slice(0, limit);
      const citations = sourceDocuments.map((document, index) => ({
        documentId: document.id,
        chunkId: `demo-${limit}-${document.id}-${index}`,
        title: document.title,
        snippet: document.content ?? "Demo citation preview",
        trustLevel: document.trustLevel,
        sensitivity: document.sensitivity,
        score: highRiskQuery ? 0.76 : 0.86 - index * 0.04,
      }));
      appendDemoAudit({
        eventType: "rag.citation.used",
        objectType: "rag_search",
        objectId: `query-${Date.now()}`,
        riskLevel: highRiskQuery ? "high" : "low",
        newValueSummary: { queryPreview: redactDemoText(query), citations: citations.map((citation) => citation.documentId), restrictedPolicyMatched: highRiskQuery },
        source: "rag",
      });
      return {
        answer: highRiskQuery
          ? `命中高风险 HR 场景。AI-HRMS 只使用安全规范生成风险提示；受限的公平性资料不直接进入回答，需 HR 人工复核后查看。`
          : `基于 AI-HRMS 受控知识层，"${query}" 可以回答，但必须同时展示引用、资料可信等级、敏感级别和人工确认边界。`,
        citations,
        provider: "demo-hybrid",
        model: "deterministic-lexical+mock-vector",
        confidence: citations[0]?.score ?? 0.72,
        riskLevel: highRiskQuery ? "high" : "medium",
        humanReviewRequired: highRiskQuery,
        auditStatus: "demo_retrieval_logged",
      };
    })()) : request<RAGSearchResult>("/rag/search", { method: "POST", body: JSON.stringify({ query, limit }) }),
  aiChat: (message: string) => demoMode ? Promise.resolve((() => {
    const highRiskMessage = isHighImpactHRText(message);
    const flexibleMessage = /解释|生成|总结|分析|建议|计划|拆/.test(message);
    const riskLevel = highRiskMessage ? "high" : flexibleMessage ? "medium" : "low";
    const citations = highRiskMessage
      ? [{ documentId: "rag-doc-004", chunkId: "ai-demo-safety", title: "AI 使用安全规范", snippet: "高风险 HR 建议必须保留人工确认，不得自动产生人事裁决。" }]
      : [{ documentId: "rag-doc-002", chunkId: "ai-demo-onboarding", title: "新员工入职指南", snippet: "入职计划需要包含制度、信息安全、组织协作和导师复盘。" }];
    const executionDecision = {
      intent: highRiskMessage ? "high_impact_hr_boundary" : flexibleMessage ? "explain_or_generate" : "lookup_or_status",
      executionMode: highRiskMessage ? "human_review_required" : flexibleMessage ? "llm_explain" : "retrieval_only",
      riskLevel,
      useLlm: flexibleMessage && !highRiskMessage,
      useAgent: false,
      useMultiAgent: false,
      humanReviewRequired: riskLevel !== "low",
      reason: highRiskMessage
        ? "命中高影响 HR 边界，Demo harness 阻断自动结论。"
        : flexibleMessage
          ? "需要自然语言解释或草案生成，允许使用 LLM 但执行仍由系统控制。"
          : "可由确定性检索和程序流程完成，不需要调用大模型。",
      routedBy: ["demo.execution_router", "risk.policy", "program.first"],
    };
    const contextPacket = {
      intent: executionDecision.intent,
      subject: message,
      items: citations.map((citation) => ({
        type: "rag_citation",
        id: `${citation.documentId}:${citation.chunkId}`,
        label: citation.title,
        summary: citation.snippet,
        source: "demo.rag",
        provenance: citation.documentId,
      })),
      sourceCount: { rag_citation: citations.length },
      staleness: "demo_seeded",
      boundary: "Demo 使用确定性 mock context；真实模式由 Go Context Resolver 组合 DB/RAG/audit。",
    };
    const trustPacket = {
      riskLevel,
      confidence: highRiskMessage ? 0.76 : 0.87,
      humanReviewRequired: riskLevel !== "low",
      evidenceCount: citations.length,
      citations,
      auditStatus: highRiskMessage ? "blocked_and_logged" : "agent_preview_logged",
      reversible: !highRiskMessage,
      policyChecks: ["citation.required", "high_impact_hr_boundary.checked", "audit.required"],
    };
    appendDemoAudit({
      eventType: "ai.command.recommendation.preview",
      objectType: "ai_recommendation",
      objectId: `cmd-${Date.now()}`,
      riskLevel,
      newValueSummary: {
        promptPreview: redactDemoText(message),
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
      confidence: trustPacket.confidence,
      riskLevel,
      humanReviewRequired: trustPacket.humanReviewRequired,
      auditStatus: trustPacket.auditStatus,
      provider: "demo",
      model: executionDecision.useLlm ? "deterministic-llm-mock" : "program",
      executionDecision,
      contextPacket,
      trustPacket,
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
      { id: "enroll-001", employeeId: "emp-003", employeeName: "林晨", courseId: "course-ai-principles", courseTitle: "AI 原理理解", status: "in_progress", createdAt: "2026-05-28" },
      { id: "enroll-002", employeeId: "emp-004", employeeName: "周雨桐", courseId: "course-workflow", courseTitle: "从 Prompt 到 Workflow", status: "completed", createdAt: "2026-05-28" },
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
          promptPreview: redactDemoText(values.prompt),
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
          arguments: redactDemoValue(values.arguments),
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
        resultPreview: { toolName: values.toolName, arguments: redactDemoValue(values.arguments), auditStatus: accepted ? "previewed" : "blocked_waiting_review" },
      };
    })()) : request<AgentToolPreviewResponse>("/agent/tools/preview", { method: "POST", body: JSON.stringify(values) }),
  langGraphWorkflowDemo: (values: { goal: string; context?: string[] }) => {
    const highRisk = isHighImpactHRText(values.goal);
    return demoMode ? Promise.resolve({
      goal: values.goal,
      context: values.context ?? ["Scoped RAG citations only"],
      risk_level: highRisk ? "high" : "medium",
      human_review_required: true,
      audit_status: highRisk ? "blocked_pending_human_review" : "preview_logged",
      demo_only: true,
      execution_mode: "preview_only",
      boundary: "LangGraph demo only: no HR data is written, no tool is executed, and human review is required before any real workflow run.",
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
