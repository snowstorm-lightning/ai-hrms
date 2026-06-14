import type {
  ApiEnvelope,
  AIChatResponse,
  AIProviderStatus,
  AgentRun,
  AgentToolPreviewResponse,
  AgentWorkflowDemoResult,
  Attendance,
  AttendanceAgentAnalysis,
  AttendanceOverview,
  AuditEvent,
  ApprovalTask,
  Capability,
  CommentItem,
  ContextItem,
  EmployeeCheckin,
  EmployeeCheckinInput,
  Employee,
  HRWorkflow,
  HRRecord,
  HRRecordInput,
  HRWorkItem,
  LeaveBalance,
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
  WorkflowEvent,
  WorkflowActionResult,
  WorkbenchOverview,
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
  { code: "employee.read", description: "Read scoped employee records" },
  { code: "employee.write", description: "Manage scoped employee records" },
  { code: "attendance.manage", description: "Manage attendance and correction requests" },
  { code: "leave.approve", description: "Approve leave requests and write leave ledger entries" },
  { code: "recruitment.manage", description: "Manage recruitment workflow actions" },
  { code: "performance.review", description: "Review performance workflow actions" },
  { code: "payroll.read_sensitive", description: "Read protected payroll previews" },
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
  { id: "entity-001", code: "GROUP", name: "云衡互联网科技有限公司", legalName: "云衡互联网科技有限公司", unifiedSocialCreditCode: "91440300YUNHENG001", legalRepresentative: "许海川", companyPhone: "0755-86000000", email: "people@yunheng.example", area: "深圳", address: "深圳市南山区海湾科技园 1 号", status: "active", createdAt: "2026-05-01" },
  { id: "entity-002", code: "SUB-A", name: "云衡企业服务", legalName: "云衡企业服务有限公司", unifiedSocialCreditCode: "91440300YUNHENG002", legalRepresentative: "罗启明", companyPhone: "0755-86000002", email: "enterprise-hr@yunheng.example", area: "深圳", address: "深圳市南山区企业服务路 8 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
  { id: "entity-003", code: "SUB-B", name: "云衡协同产品", legalName: "云衡协同产品有限公司", unifiedSocialCreditCode: "91440300YUNHENG003", legalRepresentative: "顾明远", companyPhone: "028-86000003", email: "yunheng-collab-hr@yunheng.example", area: "成都", address: "成都市高新区协同产品大道 12 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
  { id: "entity-004", code: "YUNHENG-RISK", name: "云衡风控科技", legalName: "云衡风控科技有限公司", unifiedSocialCreditCode: "91440300YUNHENG004", legalRepresentative: "沈知衡", companyPhone: "020-86000004", email: "risk-hr@yunheng.example", area: "广州", address: "广州市天河区风险治理路 6 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
  { id: "entity-005", code: "YUNHENG-GROWTH", name: "云衡增长科技", legalName: "云衡增长科技有限公司", unifiedSocialCreditCode: "91440300YUNHENG005", legalRepresentative: "周雨桐", companyPhone: "0571-86000005", email: "growth-ops@yunheng.example", area: "杭州", address: "杭州市余杭区增长街 9 号", status: "active", createdAt: "2026-05-01", parentId: "entity-001" },
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
  { id: "emp-001", employeeNo: "PG001", name: "许安宁", mobile: "13800000001", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "深圳", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "中国人民大学", major: "组织发展", homeCompany: "云衡互联网科技有限公司", title: "集团 HR", resume: "", isThereAnyCompetitionRestriction: "", remarks: "云衡科技虚构样本 样本：集团 HR 和 Demo 主讲角色", primaryAssignment: { id: "assign-001", legalEntityId: "entity-001", legalEntityName: "云衡互联网科技有限公司", orgUnitId: "org-001", orgUnitName: "集团人力资源部", positionTitle: "集团 HR", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-002", employeeNo: "PG002", name: "陈向南", mobile: "13800000002", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "深圳", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "华南理工大学", major: "人力资源", homeCompany: "云衡企业服务", title: "企业服务 HRBP", resume: "", isThereAnyCompetitionRestriction: "", remarks: "云衡科技虚构样本 样本：企业服务 HRBP", primaryAssignment: { id: "assign-002", legalEntityId: "entity-002", legalEntityName: "云衡企业服务", orgUnitId: "org-005", orgUnitName: "企业服务交付与客户成功部", positionTitle: "企业服务 HRBP", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-003", employeeNo: "PG003", name: "林晨", mobile: "13800000003", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "本科", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "深圳", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "同济大学", major: "软件工程", homeCompany: "云衡互联网科技有限公司", title: "AI 平台研发工程师", resume: "", isThereAnyCompetitionRestriction: "", remarks: "云衡科技虚构样本 样本：新人研发，参与 Co-Growth mission", primaryAssignment: { id: "assign-003", legalEntityId: "entity-001", legalEntityName: "云衡互联网科技有限公司", orgUnitId: "org-002", orgUnitName: "AI 平台工程部", positionTitle: "AI 平台研发工程师", isPrimary: true, startDate: "2026-05-01", employmentType: "full_time" } },
  { id: "emp-004", employeeNo: "PG004", name: "周雨桐", mobile: "13800000004", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "杭州", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "浙江大学", major: "计算机科学", homeCompany: "云衡增长科技", title: "算法导师", resume: "", isThereAnyCompetitionRestriction: "", remarks: "云衡科技虚构样本 样本：导师，复核新人 AI Work Journal", primaryAssignment: { id: "assign-004", legalEntityId: "entity-005", legalEntityName: "云衡增长科技", orgUnitId: "org-006", orgUnitName: "增长策略部", positionTitle: "增长算法导师", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-005", employeeNo: "PG005", name: "顾明远", mobile: "13800000005", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "硕士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "成都", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "电子科技大学", major: "协同产品工程", homeCompany: "云衡协同产品", title: "业务管理者", resume: "", isThereAnyCompetitionRestriction: "", remarks: "云衡科技虚构样本 样本：关注组织能力和 Agent 风险", primaryAssignment: { id: "assign-005", legalEntityId: "entity-003", legalEntityName: "云衡协同产品", orgUnitId: "org-004", orgUnitName: "协同产品研发部", positionTitle: "协同产品研发管理者", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
  { id: "emp-006", employeeNo: "PG006", name: "沈知衡", mobile: "13800000006", status: "active", sex: "未知", dateOfBirth: "", highestDegreeOfEducation: "博士", nationalArea: "", passportNo: "", idNumber: "", nativePlace: "", nation: "", englishName: "", maritalStatus: "", birthday: "", zodiac: "", age: "", constellation: "", bloodType: "", domicile: "", politicalOutlook: "", qq: "", wechat: "", placeOfResidence: "广州", postalAddress: "", personalMailbox: "", emergencyContact: "", emergencyContactNumber: "", bankCardNumber: "", openingBank: "", graduateSchool: "中山大学", major: "信息安全", homeCompany: "云衡风控科技", title: "AI 安全与审计负责人", resume: "", isThereAnyCompetitionRestriction: "", remarks: "云衡科技虚构样本 样本：负责知识治理和风险边界", primaryAssignment: { id: "assign-006", legalEntityId: "entity-004", legalEntityName: "云衡风控科技", orgUnitId: "org-007", orgUnitName: "风险策略部", positionTitle: "AI 安全与审计负责人", isPrimary: true, startDate: "2026-04-01", employmentType: "full_time" } },
];

let demoAttendance: Attendance[] = [
  { id: "att-001", employeeId: "emp-003", employeeName: "林晨", mobile: "13800000003", orgUnitName: "AI 平台工程部", attendanceStatus: 1, attendanceInTime: "2026-05-29T09:02:00+08:00", attendanceOutTime: null, day: "2026-05-29", remarks: "AI 平台新人完成 Co-Growth mission 签到" },
  { id: "att-002", employeeId: "emp-002", employeeName: "陈向南", mobile: "13800000002", orgUnitName: "企业服务交付与客户成功部", attendanceStatus: 3, attendanceInTime: "2026-05-29T09:18:00+08:00", attendanceOutTime: "2026-05-29T18:15:00+08:00", day: "2026-05-29", remarks: "企业服务交付周会延迟" },
  { id: "att-003", employeeId: "emp-005", employeeName: "顾明远", mobile: "13800000005", orgUnitName: "协同产品研发部", attendanceStatus: 4, attendanceInTime: "2026-05-29T08:55:00+08:00", attendanceOutTime: "2026-05-29T17:10:00+08:00", day: "2026-05-29", remarks: "提前离场参加客户复盘，待 HRBP 核对外勤记录" },
  { id: "att-004", employeeId: "emp-004", employeeName: "周雨桐", mobile: "13800000004", orgUnitName: "增长策略部", attendanceStatus: 8, attendanceInTime: null, attendanceOutTime: null, day: "2026-05-29", remarks: "事假已提交，待流程归档" },
  { id: "att-005", employeeId: "emp-006", employeeName: "沈知衡", mobile: "13800000006", orgUnitName: "风险策略部", attendanceStatus: 6, attendanceInTime: null, attendanceOutTime: null, day: "2026-05-29", remarks: "出差参加 AI 安全评审" },
];

let demoEmployeeCheckins: EmployeeCheckin[] = [
  { id: "checkin-001", employeeId: "emp-003", employeeName: "林晨", orgUnitName: "AI 平台工程部", logType: "IN", logTime: "2026-05-29T09:02:00+08:00", source: "web", attendanceRecordId: "att-001", createdAt: "2026-05-29T09:02:00+08:00" },
  { id: "checkin-002", employeeId: "emp-002", employeeName: "陈向南", orgUnitName: "企业服务交付与客户成功部", logType: "IN", logTime: "2026-05-29T09:18:00+08:00", source: "web", attendanceRecordId: "att-002", createdAt: "2026-05-29T09:18:00+08:00" },
  { id: "checkin-003", employeeId: "emp-002", employeeName: "陈向南", orgUnitName: "企业服务交付与客户成功部", logType: "OUT", logTime: "2026-05-29T18:15:00+08:00", source: "web", attendanceRecordId: "att-002", createdAt: "2026-05-29T18:15:00+08:00" },
];

function demoLatestAttendanceDay() {
  return demoAttendance.reduce((latest, item) => item.day > latest ? item.day : latest, demoAttendance[0]?.day ?? new Date().toISOString().slice(0, 10));
}

function demoAttendanceStatusLabel(status: number) {
  const labels: Record<number, string> = {
    1: "正常",
    2: "旷工",
    3: "迟到",
    4: "早退",
    5: "外出",
    6: "出差",
    7: "年假",
    8: "事假",
    9: "病假",
    22: "补签",
  };
  return labels[status] ?? "未签到";
}

function demoAttendanceRiskLevel(abnormal: number, expected: number) {
  if (!abnormal || !expected) return "low";
  const ratio = abnormal / expected;
  if (abnormal >= 5 || ratio >= 0.2) return "high";
  return "medium";
}

function buildDemoAttendanceOverview(day?: string): AttendanceOverview {
  const selectedDay = day || demoLatestAttendanceDay();
  const generatedAt = new Date().toISOString();
  const summary = {
    expected: 0,
    checkedIn: 0,
    notCheckedIn: 0,
    leave: 0,
    late: 0,
    earlyLeave: 0,
    fieldOrTrip: 0,
    abnormal: 0,
    attendanceRate: 0,
    riskLevel: "low",
  };
  const orgs = new Map<string, AttendanceOverview["orgUnits"][number]>();
  const abnormalEmployees = new Set<string>();
  const orgAbnormal = new Map<string, Set<string>>();
  const exceptions: AttendanceOverview["exceptions"] = [];
  const recentRecords: Attendance[] = [];

  const addException = (employee: Employee, record: Attendance | undefined, exceptionType: string, severity: string, reason: string) => {
    const orgUnitName = employee.primaryAssignment?.orgUnitName ?? record?.orgUnitName ?? "未分配";
    exceptions.push({
      id: `${record?.id ?? `missing-${employee.id}`}-${exceptionType}`,
      employeeId: employee.id,
      employeeName: employee.name,
      mobile: employee.mobile,
      orgUnitName,
      day: selectedDay,
      attendanceStatus: record?.attendanceStatus ?? 0,
      statusLabel: demoAttendanceStatusLabel(record?.attendanceStatus ?? 0),
      exceptionType,
      severity,
      reason,
      attendanceInTime: record?.attendanceInTime,
      attendanceOutTime: record?.attendanceOutTime,
      remarks: record?.remarks ?? "",
    });
    abnormalEmployees.add(employee.id);
    orgAbnormal.get(orgUnitName)?.add(employee.id);
  };

  demoEmployees.filter((employee) => employee.status === "active").forEach((employee) => {
    const orgUnitName = employee.primaryAssignment?.orgUnitName ?? "未分配";
    const org = orgs.get(orgUnitName) ?? {
      orgUnitName,
      expected: 0,
      checkedIn: 0,
      notCheckedIn: 0,
      leave: 0,
      late: 0,
      earlyLeave: 0,
      fieldOrTrip: 0,
      abnormal: 0,
      attendanceRate: 0,
      riskLevel: "low",
    };
    orgs.set(orgUnitName, org);
    orgAbnormal.set(orgUnitName, orgAbnormal.get(orgUnitName) ?? new Set<string>());
    summary.expected += 1;
    org.expected += 1;

    const record = demoAttendance
      .filter((item) => item.employeeId === employee.id && item.day === selectedDay)
      .sort((left, right) => String(right.attendanceInTime ?? "").localeCompare(String(left.attendanceInTime ?? "")))[0];

    if (record) recentRecords.push(record);
    if (record?.attendanceInTime) {
      summary.checkedIn += 1;
      org.checkedIn += 1;
    }
    if (!record || record.attendanceStatus === 2) {
      summary.notCheckedIn += 1;
      org.notCheckedIn += 1;
      addException(employee, record, "absence", "high", "未发现当天有效签到记录，需确认是否请假、外勤或补卡。");
    } else if ([7, 8, 9].includes(record.attendanceStatus)) {
      summary.leave += 1;
      org.leave += 1;
    } else if ([5, 6].includes(record.attendanceStatus)) {
      summary.fieldOrTrip += 1;
      org.fieldOrTrip += 1;
    }
    if (record?.attendanceStatus === 3) {
      summary.late += 1;
      org.late += 1;
      addException(employee, record, "late", "medium", "迟到信号需要结合排班、交通和请假记录人工复核。");
    }
    if (record?.attendanceStatus === 4) {
      summary.earlyLeave += 1;
      org.earlyLeave += 1;
      addException(employee, record, "early_leave", "medium", "早退信号需要结合排班、外勤和请假记录人工复核。");
    }
    if (record?.attendanceInTime && !record.attendanceOutTime && selectedDay < new Date().toISOString().slice(0, 10) && ![2, 5, 6, 7, 8, 9].includes(record.attendanceStatus)) {
      addException(employee, record, "missing_checkout", "medium", "已有签到但未发现签退，需确认是否忘记签退或记录同步延迟。");
    }
  });

  summary.abnormal = abnormalEmployees.size;
  summary.attendanceRate = summary.expected ? (summary.checkedIn * 100) / summary.expected : 0;
  summary.riskLevel = demoAttendanceRiskLevel(summary.abnormal, summary.expected);

  const orgUnits = Array.from(orgs.values()).map((org) => {
    const abnormal = orgAbnormal.get(org.orgUnitName)?.size ?? 0;
    return {
      ...org,
      abnormal,
      attendanceRate: org.expected ? (org.checkedIn * 100) / org.expected : 0,
      riskLevel: demoAttendanceRiskLevel(abnormal, org.expected),
    };
  }).sort((left, right) => right.abnormal - left.abnormal || left.orgUnitName.localeCompare(right.orgUnitName));

  exceptions.sort((left, right) => {
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return (rank[right.severity] ?? 0) - (rank[left.severity] ?? 0) || left.orgUnitName.localeCompare(right.orgUnitName);
  });
  recentRecords.sort((left, right) => String(right.attendanceInTime ?? "").localeCompare(String(left.attendanceInTime ?? "")));

  return { day: selectedDay, generatedAt, summary, orgUnits, exceptions, recentRecords };
}

function buildDemoAttendanceAgentAnalysis(values: { day?: string; focus?: string; orgUnitName?: string }): AttendanceAgentAnalysis {
  const overview = buildDemoAttendanceOverview(values.day);
  const riskLevel = overview.summary.riskLevel === "high" ? "high" : "medium";
  const run: AgentRun = {
    id: `agent-run-attendance-${Date.now()}`,
    runType: "attendance_realtime_analyst",
    status: riskLevel === "high" ? "waiting_human_review" : "previewed_requires_review",
    provider: "fake",
    model: "deterministic-v1",
    riskLevel,
    summary: "考勤实时态势 Agent 分析预览，基于 scoped 聚合快照，不执行人事裁决。",
    createdAt: new Date().toISOString(),
  };
  demoAgentRunState = [run, ...demoAgentRunState];
  appendDemoAudit({
    eventType: "attendance.agent_analysis.preview",
    objectType: "attendance",
    objectId: overview.day,
    riskLevel,
    newValueSummary: { day: overview.day, abnormal: overview.summary.abnormal, attendanceRate: overview.summary.attendanceRate, toolPreview: "attendance_realtime_overview", humanReviewRequired: true },
    source: "agent",
  });
  const toolPreview = {
    toolName: "attendance_realtime_overview",
    purpose: "只读检索结构化员工或考勤数据",
    executionMode: "deterministic",
    riskLevel: "low",
    decision: "preview_allowed",
    requiredCapability: "employee.read",
    accepted: true,
    previewOnly: false,
    reversible: true,
    writes: [],
    arguments: { day: overview.day, focus: values.focus ?? "overview", orgUnitName: values.orgUnitName ?? "" },
    reason: "确定性工具：由 Go 白名单 handler 校验参数、权限和 scope。",
  };
  const topOrg = overview.orgUnits.find((org) => org.abnormal > 0);
  return {
    run,
    toolPreview,
    executionDecision: {
      intent: "attendance_realtime_analysis",
      executionMode: "single_agent",
      riskLevel,
      useLlm: false,
      useAgent: true,
      useMultiAgent: false,
      humanReviewRequired: true,
      reason: "考勤态势分析使用当前可见范围的聚合快照和只读动作草稿生成，不自动形成旷工、绩效或处分结论。",
      routedBy: ["attendance.overview", "tool.registry", "agent.preview_first", "human_review.required"],
    },
    trustPacket: {
      riskLevel,
      confidence: overview.summary.abnormal ? 0.86 : 0.9,
      humanReviewRequired: true,
      evidenceCount: 0,
      toolPreview,
      auditStatus: "attendance_analysis_previewed",
      reversible: true,
      policyChecks: ["rbac.scope.checked", "high_impact_hr_boundary.checked", "tool_schema.preview_first", "audit.event.required"],
    },
    insights: [
      `今日应到 ${overview.summary.expected} 人，已签到 ${overview.summary.checkedIn} 人，到岗率 ${overview.summary.attendanceRate.toFixed(1)}%。`,
      `请假 ${overview.summary.leave} 人、外出/出差 ${overview.summary.fieldOrTrip} 人、迟到 ${overview.summary.late} 人、早退 ${overview.summary.earlyLeave} 人。`,
      overview.summary.abnormal
        ? `发现 ${overview.summary.abnormal} 名员工存在异常信号${topOrg ? `，异常最集中的组织是 ${topOrg.orgUnitName}` : ""}。`
        : "当前没有需要立即升级的异常信号，仍建议保留当天审计快照。",
    ],
    recommendedActions: overview.summary.abnormal
      ? ["优先核对未签到和缺签退人员是否已有请假、外勤或系统同步记录。", "对迟到/早退只生成提醒和复核清单，不自动判定旷工或绩效影响。", "将需要跟进的异常交给 HR 或部门负责人确认，并保留人工确认结果。"]
      : ["保留今日考勤快照和审计记录。", "下班后复查是否出现缺签退或补签记录。", "如需发布日报，先由 HR 确认口径。AI 不自动做人事裁决。"],
    auditPreview: ["attendance.overview.read", "agent.run.create", "agent.tool.preview", "attendance.agent_analysis.preview", "human.review.required"],
    overview,
  };
}

let demoMessages: MessageItem[] = [
  {
    id: "msg-001",
    title: "本周 AI 学习 mission 开放试用",
    category: "announcement",
    content: "云衡互联网科技有限公司（虚构样本组织）的 AI-HRMS 成长引擎样本任务已开放。欢迎先从 RAG 原理卡和工作内嵌 mission 开始体验。",
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
  { id: "rag-source-003", sourceType: "upload", name: "AI-HRMS 产品与 Copilot 文档库", uri: "demo://ai-hrms-product-docs", status: "active", createdAt: "2026-06-04" },
];

function demoProductRAGDocument(id: string, title: string, trustLevel: string, content: string, publishedAt: string): RAGDocument {
  return {
    id,
    sourceId: "rag-source-003",
    title,
    version: "v1",
    status: "published",
    trustLevel,
    sensitivity: "normal",
    content,
    publishedAt,
    createdAt: publishedAt.slice(0, 10),
    scopes: [{ documentId: id, scopeType: "global", includeDescendants: true }],
  };
}

function demoDetailedDocumentContent(title: string, summary: string): string {
  const cleanSummary = summary.trim() || "该资料用于补充 AI-HRMS 文档库阅读、引用和治理边界。";
  if (/^#\s+/m.test(cleanSummary) && /^##\s+/m.test(cleanSummary)) {
    return cleanSummary;
  }
  const shortTitle = title.replace(/^AI-HRMS\s*/, "").replace(/^云衡科技\s*/, "");
  const domain = shortTitle.includes("考勤")
    ? "考勤、人事运营和异常复核"
    : shortTitle.includes("Agent")
      ? "智能任务运行、动作草稿和人工确认"
      : shortTitle.includes("RAG") || shortTitle.includes("文档") || shortTitle.includes("Citation")
        ? "知识检索、引用定位和资料治理"
        : shortTitle.includes("员工") || shortTitle.includes("新人") || shortTitle.includes("入职")
          ? "员工生命周期、入职协同和成长复盘"
          : shortTitle.includes("Copilot") || shortTitle.includes("Layout")
            ? "页面理解、圈选问答和可视化辅助"
            : "HR 业务流程、AI 协作和审计留痕";
  return [
    `# ${title}`,
    cleanSummary,
    "## 适用场景",
    `本资料适用于 ${domain} 相关问题的阅读、检索和解释。用户需要了解制度依据、页面行为、操作路径或风险边界时，应优先阅读本页正文，再通过资料问答获取带来源的回答。`,
    "适用对象包括 HR 运营、组织管理员、业务管理者、知识治理人员、智能任务审核人和需要理解 AI-HRMS 工作方式的普通员工。若用户只需要一句操作提示，可以查看目录卡片摘要；若涉及流程、权限、风险或审计，必须进入完整文档页。",
    "## 关键原则",
    `1. 先确认当前任务是否落在“${shortTitle}”覆盖范围内，再判断是否需要检索其他资料。`,
    "2. 涉及员工、组织、权限、考勤、学习、消息或审计数据时，只能使用当前用户可见范围内的信息。",
    "3. AI 输出应区分事实、推断和建议。事实来自业务数据或已发布资料；推断需要标注置信度；建议需要保留人工复核边界。",
    "4. 高风险人事场景只允许生成预览、清单、解释或草稿，不允许直接给出录用、淘汰、调薪、处分、解雇等自动裁决。",
    "## 操作流程",
    "1. 在文档库目录中按来源、可信等级或标题筛选资料，确认资料状态为 published，敏感级别和可见范围符合当前任务。",
    "2. 进入文档详情页阅读概览、适用场景、关键原则和操作流程；需要引用时使用页面顶部或文档库首页的资料问答。",
    "3. 系统检索资料时会执行可见范围校验，只返回当前用户可访问的片段；未命中可信资料时，应拒绝编造依据。",
    "4. 如果回答需要生成业务变更，系统必须先展示动作草稿、风险等级、所需权限、是否写入、是否可撤回和是否需要人工确认。",
    "5. 人工确认后才能执行写入；仅阅读、检索和摘要不应产生任何业务处理结果。",
    "## 资料引用要求",
    "正式回答必须展示引用或证据摘要，至少包含资料标题、引用片段、可信等级、敏感级别、可见范围校验结果和检索审计状态。读者在详情页看到的是完整资料视图，正式回答仍以知识检索命中的片段为准。",
    "当资料为 restricted 或涉及高影响 HR 事项时，回答需要明确提示人工复核；当资料为 draft、过期或不可见时，不得作为正式依据引用。",
    "## 审计与留痕",
    "阅读详情页本身不写业务数据；资料问答、动作草稿、人工确认、资料发布、索引刷新和高风险阻断都应写入审计事件。审计摘要应包含请求、操作者、可见范围、引用资料、风险级别、置信度和最终状态。",
    "## 常见问题",
    "问：为什么目录页只显示摘要？答：目录页用于快速筛选资料，完整正文、治理元数据和引用边界在详情页集中阅读。",
    "问：能否直接复制详情页内容作为正式回答？答：不建议。正式回答应通过知识检索、可见范围校验和引用记录生成，详情页用于人工阅读和理解上下文。",
    "问：资料内容看起来不足怎么办？答：在知识治理页补充正文、设置可见范围并刷新检索索引；文档库会读取最新发布版本。",
  ].join("\n\n");
}

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
  {
    id: "rag-doc-006",
    sourceId: "rag-source-003",
    title: "Visual Copilot 问答模式与截图模式边界",
    version: "v1",
    status: "published",
    trustLevel: "official",
    sensitivity: "normal",
    content: "Visual Copilot 分为普通问答和截图/圈选问。普通问答只发送用户问题，走 AI Chat、RAG 检索和审计；截图/圈选问会额外发送选区、DOM 摘要和 layout snapshot。当前系统不上传未脱敏截图给外部模型，也不声称具备像素级图片识别能力。",
    publishedAt: "2026-06-04T09:00:00+08:00",
    createdAt: "2026-06-04",
    scopes: [{ documentId: "rag-doc-006", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-007",
    sourceId: "rag-source-003",
    title: "Layout Snapshot 采集规范",
    version: "v1",
    status: "published",
    trustLevel: "official",
    sensitivity: "normal",
    content: "当用户询问页面区域、相对位置、视觉布局或截图中的某块内容时，前端需要在固定容器宽度、字体、字号、line-height、缩放比例和设备像素比条件下提取 layout snapshot。Snapshot 保存 container 宽高、文本片段、相对坐标、颜色、背景色、字号、字重和字体族；RAG 理解内容时只需要标题层级、段落顺序和表格结构。",
    publishedAt: "2026-06-04T09:10:00+08:00",
    createdAt: "2026-06-04",
    scopes: [{ documentId: "rag-doc-007", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-008",
    sourceId: "rag-source-003",
    title: "RAG 精准回答与函数调用策略",
    version: "v1",
    status: "published",
    trustLevel: "official",
    sensitivity: "normal",
    content: "涉及具体依据、引用位置、制度条款、知识资料或业务对象详情的问题，必须优先通过知识检索和上下文解析。回答需要展示引用资料、可信等级、敏感级别、可见范围、置信度和审计状态。确定性模板只能用于无引用兜底、风险边界提示和动作草稿，不应替代可检索资料。",
    publishedAt: "2026-06-04T09:20:00+08:00",
    createdAt: "2026-06-04",
    scopes: [{ documentId: "rag-doc-008", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-009",
    sourceId: "rag-source-003",
    title: "AI-HRMS 文档库使用说明",
    version: "v1",
    status: "published",
    trustLevel: "reviewed",
    sensitivity: "normal",
    content: "文档库是面向阅读和引用定位的受治理资料页面。知识治理页负责发布、敏感级别、可见范围和检索索引刷新；文档库负责阅读资料、筛选来源、查看治理元数据，并通过资料问答生成带引用的回答。",
    publishedAt: "2026-06-04T09:30:00+08:00",
    createdAt: "2026-06-04",
    scopes: [{ documentId: "rag-doc-009", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-010",
    sourceId: "rag-source-003",
    title: "界面语言与设置扩展规范",
    version: "v1",
    status: "published",
    trustLevel: "reviewed",
    sensitivity: "normal",
    content: "AI-HRMS 的界面语言通过应用设置管理。新增语言时需要扩展 locale 字典、Ant Design locale 映射和必要的业务文案命名空间。用户偏好保存在本地设置中，后续可替换为后端用户偏好存储。",
    publishedAt: "2026-06-04T09:40:00+08:00",
    createdAt: "2026-06-04",
    scopes: [{ documentId: "rag-doc-010", scopeType: "global", includeDescendants: true }],
  },
  {
    id: "rag-doc-011",
    sourceId: "rag-source-003",
    title: "管理员指南与可见性规则",
    version: "v1",
    status: "published",
    trustLevel: "official",
    sensitivity: "normal",
    content: "帮助页中的管理员指南只对管理员角色可见。该区域包含账号维护、角色绑定、法人边界、组织边界、知识资料发布和高风险审计检查入口。用户看不到该区域时，应先检查账号角色、可见范围和登录状态，并在角色调整后重新登录或刷新。",
    publishedAt: "2026-06-04T09:50:00+08:00",
    createdAt: "2026-06-04",
    scopes: [{ documentId: "rag-doc-011", scopeType: "global", includeDescendants: true }],
  },
];

demoRAGDocuments = demoRAGDocuments.concat([
  demoProductRAGDocument(
    "rag-doc-012",
    "AI-HRMS 产品身份与使用边界",
    "official",
    "AI-HRMS 是面向人力资源、组织数据、学习成长、知识治理、智能任务运行和审计的企业应用。普通问答可以解释产品能力、页面用途和操作路径；涉及制度依据、员工数据、组织数据或高风险人事建议时，需要基于权限、可见范围、已发布知识资料、只读业务上下文或经过确认的动作草稿。",
    "2026-06-05T09:00:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-013",
    "AI-HRMS 页面导航地图",
    "reviewed",
    "AI-HRMS 登录后默认进入 /app/dashboard 指挥看板。常用入口包括 /app/ai-command AI 指挥中心、/app/agents 智能任务运行中心、/app/knowledge 知识治理、/app/docs 文档库、/app/audit 信任与审计、/app/settings 设置和 /app/help 帮助。",
    "2026-06-05T09:05:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-014",
    "设置语言侧边栏与 Copilot 默认项",
    "reviewed",
    "设置页用于管理界面语言、界面密度、演示横幅、侧边栏宽度、Visual Copilot 默认模式和证据面板默认展开状态。语言切换来自本地应用设置，当前支持中文和英文；新增语言需要扩展 locale 字典、Ant Design locale 映射和业务文案命名空间。桌面端侧边栏可拖动调整宽度。",
    "2026-06-05T09:10:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-015",
    "Visual Copilot 普通问答与圈选问流程",
    "official",
    "普通问答只发送用户文字问题和必要业务上下文，适合询问产品功能、页面用途、制度解释和 RAG 引用。圈选问会额外携带用户选择区域、DOM 摘要、可见文本、相对坐标和 layout snapshot，适合询问页面上某块区域、控件、表格列或卡片数据来源。",
    "2026-06-05T09:15:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-016",
    "RAG 文档发布检索与引用链",
    "official",
    "知识资料只有已发布且通过当前可见范围校验后才能进入正式检索。知识治理页负责创建来源、发布资料、设置可信等级、敏感级别和可见范围，并刷新检索索引；文档库负责阅读资料和触发带引用的资料问答。没有命中可引用资料时应拒绝编造依据。",
    "2026-06-05T09:20:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-017",
    "智能任务动作草稿协议",
    "official",
    "智能任务在执行前必须生成动作草稿，展示动作名称、用途、参数摘要、读取或写入范围、目标可见范围、风险级别、可逆性、所需权限、预计审计事件和是否需要人工确认。写入员工、角色、组织、法人、考勤、消息或学习记录的动作必须先等待确认。",
    "2026-06-05T09:25:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-018",
    "人工确认与审计留痕规范",
    "official",
    "涉及写入、权限变更、员工资料修改、组织或法人调整、资料发布、智能任务执行和高风险建议时，系统需要保留人工确认与审计记录。审计记录应包含操作者、时间、请求摘要、旧值摘要、新值摘要、风险等级、引用或证据、动作草稿、确认结果和阻断原因。",
    "2026-06-05T09:30:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-019",
    "高风险人事决策边界",
    "official",
    "AI-HRMS 可以辅助整理事实、生成检查清单、解释制度、提示风险和准备需要人工审阅的草稿，但不得自动做出录用、淘汰、调薪、降薪、绩效评级、纪律处分、解雇、医疗、签证、仲裁或其他高影响人事裁决。",
    "2026-06-05T09:35:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-020",
    "管理员权限与可见性模型",
    "reviewed",
    "管理员可以看到管理员指南、账号维护、角色绑定、法人边界、组织边界、资料发布和高风险审计入口。用户看不到某块功能时，优先检查当前账号角色、权限、可见范围、登录状态和前端菜单可见性；角色刚调整后需要刷新或重新登录。",
    "2026-06-05T09:40:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-021",
    "组织与法人 Scope 使用说明",
    "reviewed",
    "AI-HRMS 使用全局、法人、组织、角色和员工可见范围控制知识资料、业务数据、角色授权和审计范围。可见范围校验应默认收紧：没有明确授权时不返回数据，不用全局资料替代受限资料。",
    "2026-06-05T09:45:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-022",
    "员工数据隐私与最小化原则",
    "official",
    "员工数据包括身份信息、联系方式、任职记录、考勤、绩效、薪酬、学习记录、消息、审计记录和可能推断个人状态的信息。系统回答和工具调用应遵循最小必要原则，只返回当前任务需要且用户有权查看的字段；向外部模型或日志发送前应脱敏或摘要化。",
    "2026-06-05T09:50:00+08:00",
  ),
]);

demoRAGDocuments = demoRAGDocuments.concat([
  demoProductRAGDocument(
    "rag-doc-023",
    "AI-HRMS 页面级操作指南合集",
    "reviewed",
    "指挥看板用于查看风险、证据和建议概览；AI 指挥中心用于生成受控 HR 工作草稿；知识治理用于创建来源、发布资料、设置可见范围并刷新检索索引；文档库用于阅读资料、筛选来源和带引用问答；智能任务运行中心用于查看任务状态、动作草稿和人工确认；信任与审计用于检索审计事件；设置页用于语言、界面密度、侧边栏宽度和助手默认项。",
    "2026-06-05T10:00:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-024",
    "RAG 发布 SOP 与失败排查",
    "official",
    "发布知识资料的标准步骤是：创建或选择来源，录入标题、版本、正文和有效期，设置可信等级、敏感级别、可见范围，保存为草稿，复核后切换为已发布，刷新检索索引，并在文档库用一个真实问题验证引用。资料问不到时依次检查发布状态、可见范围、敏感级别、生效时间、导入任务、索引状态和查询质量。",
    "2026-06-05T10:05:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-025",
    "Citation 字段与引用定位说明",
    "reviewed",
    "引用是资料回答的证据定位。资料 ID 指向资料，片段 ID 指向切片，标题是资料标题，摘录是引用片段，可信等级表示资料可信度，敏感级别表示访问边界，匹配分表示检索相关性，页码和位置可用于章节、段落或表格定位。",
    "2026-06-05T10:10:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-026",
    "Visual Copilot 页面字段字典",
    "reviewed",
    "圈选助手解释页面字段时优先使用页面标签、业务对象标记、路由和页面线索。按钮通常表示可执行命令；卡片通常表示业务对象摘要；表格行通常对应员工、组织、法人、资料、智能任务或审计事件；标签常用于风险、置信度、敏感级别、可信等级、审计状态、动作草稿和人工确认。",
    "2026-06-05T10:15:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-027",
    "角色 Capability 对照与权限申请",
    "reviewed",
    "管理员拥有账号、角色、可见范围、资料发布、审计和高风险治理入口；集团 HR 可处理集团 HR 数据和制度资料；法人 HR 面向法人边界内的人事数据；组织管理者只看授权组织及其下级；员工只看个人相关记录和公开资料。申请权限时应说明业务目的、需要的可见范围、持续时间和审批人。",
    "2026-06-05T10:20:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-028",
    "智能任务状态与动作字段字典",
    "official",
    "智能任务常见状态包括已预览、等待人工确认、运行中、已完成、失败、已阻断和已取消。用户问某个任务时，应先解释当前状态和是否等待人工确认，再说明证据、动作草稿和下一步，不应把预览当成已执行结果。",
    "2026-06-05T10:25:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-029",
    "审计事件类型与筛选导出说明",
    "official",
    "审计事件用于追踪 AI 回答、知识引用、动作草稿、人工确认和业务写入。常见事件包括 AI 回答、资料引用、圈选预览、智能任务预览、人工确认请求、人工确认通过、高风险阻断、员工更新、角色变更和资料发布。",
    "2026-06-05T10:30:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-030",
    "Embedding 与 Provider 状态排查",
    "reviewed",
    "知识检索质量依赖服务状态、索引策略和检索融合。排查顺序是服务状态、接口密钥或本地演示适配器、索引维度、导入任务、片段数量、文档长度、查询质量和低分命中。索引维度变更后需要刷新所有受影响索引。",
    "2026-06-05T10:35:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-031",
    "员工字段分级与脱敏模板",
    "official",
    "低敏字段包括姓名、组织、岗位、任职状态和公开工作职责；中敏字段包括考勤摘要、学习记录、任职变更和内部消息摘要；高敏字段包括手机号、身份证件、家庭地址、薪酬、绩效明细、医疗信息、纪律处分和劳动争议。外发给模型时应优先使用摘要。",
    "2026-06-05T10:40:00+08:00",
  ),
  demoProductRAGDocument(
    "rag-doc-032",
    "新人 30 天成长计划模板",
    "reviewed",
    "新人 30 天成长计划应以学习和协作为目标。第 1 周完成账号开通、制度、信息安全、协作工具和团队介绍；第 2 周理解岗位职责、业务链路、RAG/Agent/审计基础；第 3 周完成低风险实践任务并记录证据；第 4 周由导师复盘成果、风险、待补知识和下月目标。",
    "2026-06-05T10:45:00+08:00",
  ),
]);

demoRAGDocuments = demoRAGDocuments.map((document) => ({
  ...document,
  content: demoDetailedDocumentContent(document.title, document.content ?? ""),
}));

let demoLearningCourses: LearningCourse[] = [
  { id: "course-ai-principles", title: "AI 原理理解", description: "从 token、上下文、幻觉到 RAG 可靠性。", status: "published", scopeType: "global", createdAt: "2026-05-28", lessonCount: 6 },
  { id: "course-workflow", title: "从 Prompt 到 Workflow", description: "学习 state、node、edge、工具调用和人工确认。", status: "published", scopeType: "global", createdAt: "2026-05-28", lessonCount: 5 },
];

const demoAgentRuns: AgentRun[] = [
  { id: "agent-run-001", runType: "co_growth_coach", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "low", summary: "生成本周 AI 学习 mission，并保留 evidence。", createdAt: "2026-05-28T09:00:00+08:00" },
  { id: "agent-run-002", runType: "ai_literacy_path", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "low", summary: "根据学习画像推荐 AI 原理卡和 30 分钟 mission。", createdAt: "2026-05-28T09:08:00+08:00" },
  { id: "agent-run-003", runType: "work_learning_balance", status: "previewed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "检查工作负荷，建议把深度实验降级为微学习。", createdAt: "2026-05-28T09:16:00+08:00" },
  { id: "agent-run-004", runType: "agent_workflow_lab", status: "previewed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "预览个性化学习任务推荐 Agent 节点链路。", createdAt: "2026-05-28T09:24:00+08:00" },
  { id: "agent-run-005", runType: "knowledge_governance", status: "completed", provider: "fake", model: "deterministic-v1", riskLevel: "medium", summary: "扫描知识资料可信等级和敏感范围。", createdAt: "2026-05-28T09:32:00+08:00" },
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

const demoHRResourceMeta: Record<string, { module: string; recordType: string; defaultTitle: string; defaultStatus: string; defaultRisk: string; defaultHumanReview: boolean }> = {
  "leave-applications": { module: "employee_ops", recordType: "Leave Application", defaultTitle: "请假申请", defaultStatus: "submitted", defaultRisk: "medium", defaultHumanReview: true },
  "attendance-requests": { module: "employee_ops", recordType: "Attendance Request", defaultTitle: "补卡/外勤申请", defaultStatus: "submitted", defaultRisk: "medium", defaultHumanReview: true },
  "shift-assignments": { module: "employee_ops", recordType: "Shift Assignment", defaultTitle: "排班分配", defaultStatus: "active", defaultRisk: "low", defaultHumanReview: false },
  "expense-claims": { module: "employee_ops", recordType: "Expense Claim", defaultTitle: "报销申请", defaultStatus: "submitted", defaultRisk: "medium", defaultHumanReview: true },
  "salary-slips": { module: "employee_ops", recordType: "Salary Slip", defaultTitle: "工资单", defaultStatus: "draft", defaultRisk: "high", defaultHumanReview: true },
  "job-requisitions": { module: "recruitment_lifecycle", recordType: "Job Requisition", defaultTitle: "招聘需求", defaultStatus: "submitted", defaultRisk: "medium", defaultHumanReview: true },
  "job-openings": { module: "recruitment_lifecycle", recordType: "Job Opening", defaultTitle: "职位发布", defaultStatus: "open", defaultRisk: "medium", defaultHumanReview: true },
  "job-applicants": { module: "recruitment_lifecycle", recordType: "Job Applicant", defaultTitle: "候选人", defaultStatus: "active", defaultRisk: "high", defaultHumanReview: true },
  "interviews": { module: "recruitment_lifecycle", recordType: "Interview", defaultTitle: "面试", defaultStatus: "scheduled", defaultRisk: "high", defaultHumanReview: true },
  "job-offers": { module: "recruitment_lifecycle", recordType: "Job Offer", defaultTitle: "Offer", defaultStatus: "draft", defaultRisk: "high", defaultHumanReview: true },
  "training-events": { module: "growth_performance", recordType: "Training Event", defaultTitle: "培训活动", defaultStatus: "planned", defaultRisk: "medium", defaultHumanReview: false },
  "performance-goals": { module: "growth_performance", recordType: "Performance Goal", defaultTitle: "绩效目标", defaultStatus: "active", defaultRisk: "medium", defaultHumanReview: false },
  "appraisal-cycles": { module: "growth_performance", recordType: "Appraisal Cycle", defaultTitle: "绩效周期", defaultStatus: "draft", defaultRisk: "high", defaultHumanReview: true },
  appraisals: { module: "growth_performance", recordType: "Appraisal", defaultTitle: "绩效评估", defaultStatus: "submitted", defaultRisk: "high", defaultHumanReview: true },
};

function demoEmployeeName(id?: string | null) {
  return demoEmployees.find((employee) => employee.id === id)?.name ?? "";
}

function demoOrgUnitName(id?: string | null, employeeId?: string | null) {
  const orgUnit = demoOrgUnits.find((unit) => unit.id === id);
  if (orgUnit) return orgUnit.name;
  const employee = demoEmployees.find((item) => item.id === employeeId);
  return employee?.primaryAssignment?.orgUnitName ?? "";
}

function makeDemoHRRecord(resource: string, index: number, values: Partial<HRRecord>): HRRecord {
  const meta = demoHRResourceMeta[resource];
  const createdAt = values.createdAt ?? `2026-05-${String(28 + (index % 4)).padStart(2, "0")}T09:${String(index * 7).padStart(2, "0")}:00+08:00`;
  return {
    id: values.id ?? `${resource}-${String(index).padStart(3, "0")}`,
    resource,
    module: values.module ?? meta.module,
    recordType: values.recordType ?? meta.recordType,
    title: values.title ?? meta.defaultTitle,
    employeeId: values.employeeId ?? null,
    employeeName: values.employeeName ?? demoEmployeeName(values.employeeId),
    orgUnitId: values.orgUnitId ?? null,
    orgUnitName: values.orgUnitName ?? demoOrgUnitName(values.orgUnitId, values.employeeId),
    scopeType: values.scopeType ?? "global",
    scopeId: values.scopeId ?? null,
    status: values.status ?? meta.defaultStatus,
    riskLevel: values.riskLevel ?? meta.defaultRisk,
    humanReviewRequired: values.humanReviewRequired ?? meta.defaultHumanReview,
    payload: values.payload ?? {},
    createdAt,
    updatedAt: values.updatedAt ?? createdAt,
  };
}

let demoHRRecords: Record<string, HRRecord[]> = {
  "leave-applications": [
    makeDemoHRRecord("leave-applications", 1, { title: "林晨 年假申请", employeeId: "emp-003", orgUnitId: "org-002", status: "submitted", payload: { leaveType: "annual", fromDate: "2026-05-30", toDate: "2026-05-31", days: 2 } }),
    makeDemoHRRecord("leave-applications", 2, { title: "周雨桐 调休申请", employeeId: "emp-004", orgUnitId: "org-006", status: "approved", riskLevel: "low", humanReviewRequired: false, payload: { leaveType: "compensatory", days: 1 } }),
  ],
  "attendance-requests": [
    makeDemoHRRecord("attendance-requests", 3, { title: "补卡申请：忘记签退", employeeId: "emp-003", orgUnitId: "org-002", status: "submitted", payload: { requestType: "missing_checkout", reason: "外出会议后忘记签退" } }),
  ],
  "shift-assignments": [
    makeDemoHRRecord("shift-assignments", 4, { title: "AI 平台工程部弹性班", orgUnitId: "org-002", status: "active", payload: { shift: "flex", startTime: "10:00", endTime: "19:00" } }),
  ],
  "expense-claims": [
    makeDemoHRRecord("expense-claims", 5, { title: "客户拜访交通报销", employeeId: "emp-004", orgUnitId: "org-006", status: "submitted", payload: { amount: 486, currency: "CNY", expenseType: "transport" } }),
  ],
  "salary-slips": [
    makeDemoHRRecord("salary-slips", 6, { title: "2026-05 工资单预览", employeeId: "emp-003", orgUnitId: "org-002", status: "draft", payload: { period: "2026-05", netPay: 23800 } }),
  ],
  "job-requisitions": [
    makeDemoHRRecord("job-requisitions", 7, { title: "AI Workflow 工程师 HC", orgUnitId: "org-002", status: "submitted", payload: { openings: 2, expectedOnboardingDate: "2026-07-01" } }),
  ],
  "job-openings": [
    makeDemoHRRecord("job-openings", 8, { title: "高级 HRIS 产品经理", orgUnitId: "org-004", status: "open", payload: { channel: "internal_referral", salaryRange: "35k-45k" } }),
  ],
  "job-applicants": [
    makeDemoHRRecord("job-applicants", 9, { title: "候选人：A-1024", orgUnitId: "org-004", status: "active", payload: { stage: "screening", fairnessBoundary: true } }),
  ],
  interviews: [
    makeDemoHRRecord("interviews", 10, { title: "产品经理二面", orgUnitId: "org-004", status: "scheduled", payload: { scheduledAt: "2026-06-03T14:00:00+08:00", interviewer: "许安宁" } }),
  ],
  "job-offers": [
    makeDemoHRRecord("job-offers", 11, { title: "Offer 草案：HRIS 产品经理", orgUnitId: "org-004", status: "draft", payload: { expectedJoiningDate: "2026-07-15", compensationReviewRequired: true } }),
  ],
  "training-events": [
    makeDemoHRRecord("training-events", 12, { title: "RAG 可靠性工作坊", orgUnitId: "org-006", status: "planned", payload: { startsAt: "2026-06-10T10:00:00+08:00" } }),
  ],
  "performance-goals": [
    makeDemoHRRecord("performance-goals", 13, { title: "Q2 AI 工具链交付目标", employeeId: "emp-003", orgUnitId: "org-002", status: "active", payload: { progress: 42, evidenceRequired: true } }),
  ],
  "appraisal-cycles": [
    makeDemoHRRecord("appraisal-cycles", 14, { title: "2026 H1 绩效周期", orgUnitId: "org-001", status: "draft", payload: { periodStart: "2026-01-01", periodEnd: "2026-06-30" } }),
  ],
  appraisals: [
    makeDemoHRRecord("appraisals", 15, { title: "林晨 H1 绩效评估", employeeId: "emp-003", orgUnitId: "org-002", status: "submitted", payload: { selfScore: 4.2, feedbackScore: 4.0, humanReviewBoundary: true } }),
  ],
};

function demoWorkbenchOverview(): WorkbenchOverview {
  const moduleLabels: Record<string, string> = {
    employee_ops: "员工事务",
    recruitment_lifecycle: "招聘与生命周期",
    growth_performance: "成长与绩效",
  };
  const modules = new Map<string, WorkbenchOverview["modules"][number]>();
  Object.values(demoHRRecords).flat().forEach((record) => {
    const module = modules.get(record.module) ?? {
      module: record.module,
      label: moduleLabels[record.module] ?? record.module,
      total: 0,
      pending: 0,
      highRisk: 0,
      statusCount: {},
    };
    module.total += 1;
    module.statusCount[record.status] = (module.statusCount[record.status] ?? 0) + 1;
    if (record.humanReviewRequired || ["submitted", "pending", "draft", "scheduled", "planned", "open", "active", "in_review"].includes(record.status)) {
      module.pending += 1;
    }
    if (record.riskLevel === "high" || record.humanReviewRequired) {
      module.highRisk += 1;
    }
    modules.set(record.module, module);
  });
  const moduleRows = Array.from(modules.values());
  return {
    generatedAt: new Date().toISOString(),
    period: "2026-05",
    scopeLabel: "global",
    total: moduleRows.reduce((sum, item) => sum + item.total, 0),
    pending: moduleRows.reduce((sum, item) => sum + item.pending, 0),
    highRisk: moduleRows.reduce((sum, item) => sum + item.highRisk, 0),
    modules: moduleRows,
  };
}

function demoWorkbenchItems(page: number, size: number): Page<HRWorkItem> {
  const rows = Object.values(demoHRRecords)
    .flat()
    .filter((record) => record.humanReviewRequired || ["submitted", "pending", "draft", "scheduled", "planned", "open", "active", "in_review"].includes(record.status))
    .map((record) => ({
      id: record.id,
      resource: record.resource,
      module: record.module,
      recordType: record.recordType,
      title: record.title,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      orgUnitId: record.orgUnitId,
      orgUnitName: record.orgUnitName,
      status: record.status,
      riskLevel: record.riskLevel,
      humanReviewRequired: record.humanReviewRequired,
      action: record.humanReviewRequired ? "human_review" : "review",
      createdAt: record.createdAt,
    }))
    .sort((left, right) => (right.riskLevel === "high" ? 1 : 0) - (left.riskLevel === "high" ? 1 : 0) || right.createdAt.localeCompare(left.createdAt));
  return demoPaged(rows, page, size);
}

type DemoWorkflowTransition = {
  action: string;
  label: string;
  fromStatuses: string[];
  nextStatus: string;
  variant: "primary" | "default" | "danger";
  requiresComment?: boolean;
};

const demoWorkflowTransitions: DemoWorkflowTransition[] = [
  { action: "submit", label: "提交", fromStatuses: ["draft"], nextStatus: "submitted", variant: "primary" },
  { action: "start_review", label: "开始复核", fromStatuses: ["submitted", "pending", "waiting_human_review", "open", "scheduled", "planned", "active"], nextStatus: "in_review", variant: "default" },
  { action: "approve", label: "批准", fromStatuses: ["submitted", "pending", "waiting_human_review", "open", "scheduled", "planned", "active", "in_review"], nextStatus: "approved", variant: "primary" },
  { action: "reject", label: "驳回", fromStatuses: ["submitted", "pending", "waiting_human_review", "open", "scheduled", "planned", "active", "in_review"], nextStatus: "rejected", variant: "danger", requiresComment: true },
  { action: "cancel", label: "取消已批准", fromStatuses: ["approved"], nextStatus: "cancelled", variant: "default", requiresComment: true },
];

let demoWorkflowEvents: Record<string, WorkflowEvent[]> = {};
let demoApprovalTasks: Record<string, ApprovalTask[]> = {};

function workflowKey(resource: string, id: string) {
  return `${resource}:${id}`;
}

function demoFindHRRecord(resource: string, id: string) {
  return (demoHRRecords[resource] ?? []).find((record) => record.id === id);
}

function demoWorkflowTransitionFor(action: string, status: string) {
  return demoWorkflowTransitions.find((transition) => transition.action === action && transition.fromStatuses.includes(status));
}

function demoWorkflowActions(record: HRRecord) {
  return demoWorkflowTransitions
    .filter((transition) => transition.fromStatuses.includes(record.status))
    .map((transition) => ({
      action: transition.action,
      label: transition.label,
      nextStatus: transition.nextStatus,
      variant: transition.variant,
      requiresComment: Boolean(transition.requiresComment),
      enabled: true,
    }));
}

function demoEnsureApprovalTask(record: HRRecord, comment = "") {
  const key = workflowKey(record.resource, record.id);
  if (!record.humanReviewRequired && !["submitted", "pending", "waiting_human_review", "in_review"].includes(record.status)) {
    return;
  }
  const tasks = demoApprovalTasks[key] ?? [];
  const open = tasks.find((task) => task.status === "open");
  if (open) {
    demoApprovalTasks[key] = tasks.map((task) => task.id === open.id ? {
      ...task,
      title: record.title,
      riskLevel: record.riskLevel,
      comment: comment || task.comment,
      updatedAt: new Date().toISOString(),
    } : task);
    return;
  }
  const now = new Date().toISOString();
  demoApprovalTasks[key] = [{
    id: `approval-${record.id}-${Date.now()}`,
    resource: record.resource,
    recordId: record.id,
    recordType: record.recordType,
    title: record.title,
    status: "open",
    action: "review",
    assignedToUserId: null,
    assignedToName: "",
    requestedByName: demoUser.username,
    scopeType: record.scopeType,
    scopeId: record.scopeId,
    riskLevel: record.riskLevel,
    comment,
    createdAt: now,
    updatedAt: now,
  }, ...tasks];
}

function demoCloseApprovalTasks(record: HRRecord, status: string, action: string, comment: string) {
  const key = workflowKey(record.resource, record.id);
  demoApprovalTasks[key] = (demoApprovalTasks[key] ?? []).map((task) => task.status === "open" ? {
    ...task,
    status,
    action,
    assignedToUserId: demoUser.id,
    assignedToName: demoUser.username,
    comment,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : task);
}

function demoHRWorkflow(resource: string, id: string): HRWorkflow {
  const record = demoFindHRRecord(resource, id);
  if (!record) {
    throw new Error("HR record not found");
  }
  demoEnsureApprovalTask(record);
  const key = workflowKey(resource, id);
  return {
    record,
    actions: demoWorkflowActions(record),
    events: demoWorkflowEvents[key] ?? [],
    approvalTasks: demoApprovalTasks[key] ?? [],
  };
}

function demoApplyAttendanceWorkflow(record: HRRecord) {
  const employee = demoEmployees.find((item) => item.id === record.employeeId);
  if (!employee) return;
  const requestType = String(record.payload.requestType ?? "correction");
  const day = String(record.payload.fromDate ?? new Date().toISOString().slice(0, 10));
  const existing = demoAttendance.find((item) => item.employeeId === employee.id && item.day === day);
  const status = requestType === "field_work" ? 5 : requestType === "business_trip" ? 6 : 22;
  const remarks = `${String(record.payload.reason ?? "员工申请")}；审批通过后写入考勤汇总，仅供人工复核`;
  if (existing) {
    demoAttendance = demoAttendance.map((item) => item.id === existing.id ? { ...item, attendanceStatus: status, remarks } : item);
    return;
  }
  demoAttendance = [{
    id: `att-${Date.now()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    mobile: employee.mobile,
    orgUnitName: employee.primaryAssignment?.orgUnitName ?? "",
    attendanceStatus: status,
    attendanceInTime: null,
    attendanceOutTime: null,
    day,
    remarks,
  }, ...demoAttendance];
}

function demoApplyHRWorkflowAction(resource: string, id: string, values: { action: string; comment?: string }): WorkflowActionResult {
  const record = demoFindHRRecord(resource, id);
  if (!record) {
    throw new Error("HR record not found");
  }
  const action = values.action.trim();
  const comment = (values.comment ?? "").trim();
  const transition = demoWorkflowTransitionFor(action, record.status);
  if (!transition) {
    throw new Error("当前状态不支持该审批动作");
  }
  if (transition.requiresComment && !comment) {
    throw new Error("该动作需要填写处理说明");
  }
  const fromStatus = record.status;
  const now = new Date().toISOString();
  const nextHumanReview = ["approved", "rejected", "cancelled"].includes(transition.nextStatus)
    ? false
    : ["submitted", "in_review"].includes(transition.nextStatus)
      ? true
      : record.humanReviewRequired;
  demoHRRecords[resource] = (demoHRRecords[resource] ?? []).map((item) => item.id === id ? {
    ...item,
    status: transition.nextStatus,
    humanReviewRequired: nextHumanReview,
    updatedAt: now,
  } : item);
  const updated = demoFindHRRecord(resource, id);
  if (!updated) {
    throw new Error("HR record not found");
  }
  const event: WorkflowEvent = {
    id: `workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    resource,
    recordId: id,
    actorUserId: demoUser.id,
    actorName: demoUser.username,
    action,
    fromStatus,
    toStatus: transition.nextStatus,
    comment,
    createdAt: now,
  };
  const key = workflowKey(resource, id);
  demoWorkflowEvents[key] = [event, ...(demoWorkflowEvents[key] ?? [])];
  if (["submitted", "in_review"].includes(transition.nextStatus)) {
    demoEnsureApprovalTask(updated, comment);
  }
  if (["approved", "rejected", "cancelled"].includes(transition.nextStatus)) {
    demoCloseApprovalTasks(updated, transition.nextStatus, action, comment);
  }
  if (resource === "attendance-requests" && transition.nextStatus === "approved") {
    demoApplyAttendanceWorkflow(updated);
  }
  appendDemoAudit({
    eventType: `hr.${resource}.workflow.${action}`,
    objectType: updated.recordType,
    objectId: updated.id,
    riskLevel: updated.riskLevel,
    oldValueSummary: { status: fromStatus },
    newValueSummary: { status: updated.status, comment: comment || undefined },
  });
  return { record: updated, workflow: demoHRWorkflow(resource, id), event };
}

function demoLeaveBalances(employeeId?: string): LeaveBalance[] {
  const employees = employeeId ? demoEmployees.filter((employee) => employee.id === employeeId) : demoEmployees.slice(0, 4);
  return employees.flatMap((employee) => {
    const leaveTypes = [
      { leaveTypeId: "leave-type-annual", leaveTypeCode: "annual", leaveTypeName: "年假", allocatedDays: 12 },
      { leaveTypeId: "leave-type-sick", leaveTypeCode: "sick", leaveTypeName: "病假", allocatedDays: 5 },
      { leaveTypeId: "leave-type-compensatory", leaveTypeCode: "compensatory", leaveTypeName: "调休", allocatedDays: 2 },
    ];
    return leaveTypes.map((type) => {
      const usedDays = (demoHRRecords["leave-applications"] ?? [])
        .filter((record) => record.employeeId === employee.id && record.status === "approved" && String(record.payload.leaveType ?? "annual") === type.leaveTypeCode)
        .reduce((sum, record) => sum + Number(record.payload.days ?? 0), 0);
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        leaveTypeId: type.leaveTypeId,
        leaveTypeCode: type.leaveTypeCode,
        leaveTypeName: type.leaveTypeName,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        allocatedDays: type.allocatedDays,
        ledgerDeltaDays: -usedDays,
        usedDays,
        balanceDays: type.allocatedDays - usedDays,
      };
    });
  });
}

function demoListEmployeeCheckins(page: number, size: number, employeeId?: string): Page<EmployeeCheckin> {
  const rows = demoEmployeeCheckins
    .filter((item) => !employeeId || item.employeeId === employeeId)
    .sort((left, right) => right.logTime.localeCompare(left.logTime));
  return demoPaged(rows, page, size);
}

function demoCreateEmployeeCheckin(values: EmployeeCheckinInput): EmployeeCheckin {
  const employee = demoEmployees.find((item) => item.id === values.employeeId);
  if (!employee) {
    throw new Error("员工不存在或不可见");
  }
  const logType = values.logType === "OUT" ? "OUT" : "IN";
  const logTime = values.logTime ?? new Date().toISOString();
  const day = logTime.slice(0, 10);
  const existing = demoAttendance.find((item) => item.employeeId === employee.id && item.day === day);
  let attendanceId = existing?.id;
  if (existing) {
    demoAttendance = demoAttendance.map((item) => item.id === existing.id ? {
      ...item,
      attendanceStatus: 1,
      attendanceInTime: logType === "IN" ? (item.attendanceInTime ?? logTime) : item.attendanceInTime,
      attendanceOutTime: logType === "OUT" ? logTime : item.attendanceOutTime,
      remarks: "员工自助打卡",
    } : item);
  } else {
    attendanceId = `att-${Date.now()}`;
    demoAttendance = [{
      id: attendanceId,
      employeeId: employee.id,
      employeeName: employee.name,
      mobile: employee.mobile,
      orgUnitName: employee.primaryAssignment?.orgUnitName ?? "",
      attendanceStatus: 1,
      attendanceInTime: logType === "IN" ? logTime : null,
      attendanceOutTime: logType === "OUT" ? logTime : null,
      day,
      remarks: "员工自助打卡",
    }, ...demoAttendance];
  }
  const checkin: EmployeeCheckin = {
    id: `checkin-${Date.now()}`,
    employeeId: employee.id,
    employeeName: employee.name,
    orgUnitName: employee.primaryAssignment?.orgUnitName ?? "",
    logType,
    logTime,
    latitude: values.latitude ?? null,
    longitude: values.longitude ?? null,
    source: values.source ?? "web",
    attendanceRecordId: attendanceId,
    createdAt: new Date().toISOString(),
  };
  demoEmployeeCheckins = [checkin, ...demoEmployeeCheckins];
  appendDemoAudit({
    eventType: "hr.employee_checkin.created",
    objectType: "Employee Checkin",
    objectId: checkin.id,
    riskLevel: "low",
    newValueSummary: { employeeId: employee.id, logType },
  });
  return checkin;
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
      ? `已识别 ${values.regions.length} 个圈选区域，命中页面模块：${domItems.map((item) => item.label).join("、")}。`
      : `已识别 ${values.regions.length} 个圈选区域，正在根据选区可见内容和当前页面上下文生成解释。`;
  const selectionText = stringValue(values.layout?.selectionText);
  const semanticHint = stringValue(values.layout?.semanticHint);
  const requested = values.instruction.trim() || "解释选区";
  const riskLevel = intent === "action_execute_blocked" ? "high" : refs.length ? "medium" : "low";
  const executionDecision = {
    intent: intent === "action_execute_blocked" ? "action_execute_blocked" : "visual_selection_explain",
    executionMode: intent === "action_execute_blocked" ? "action_preview" : "llm_explain",
    riskLevel,
    useLlm: intent !== "action_execute_blocked",
    useAgent: false,
    useMultiAgent: false,
    humanReviewRequired: riskLevel !== "low",
    reason: intent === "action_execute_blocked"
      ? "写操作和高风险请求先进入动作草稿与人工确认。"
      : "主回答采用大模型式自然语言解释；证据、风险和审计块由固定规则清洗和结构化呈现。",
    routedBy: intent === "action_execute_blocked"
      ? ["visual.context.resolver", "tool.preview.required", "audit.required"]
      : ["visual.context.resolver", "visual.llm.default", "visual.answer.quality_gate", "audit.required"],
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
    sourceCount: { business_ref: refs.length, region: values.regions.length, dom_node: values.dom.length, layout_item: values.layout?.items?.length ?? 0 },
    staleness: "live_page_snapshot",
    boundary: "主回答面向业务解释；详情区保留选区、证据、风险、置信度和审计信息。",
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
        : demoVisualNaturalAnswer(requested, routeLabel, refs, domItems, values.route, selectionText, semanticHint),
      selectedSummary,
      trustBoundary: "主回答以受控上下文生成；详情区展示引用、风险、置信度和审计信息，便于复核。",
      riskLevel,
      confidence: trustPacket.confidence,
      imageMode: values.screenshot ? "selection-context" : "text-context",
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
  if (route.includes("knowledge")) return "知识治理";
  if (route.includes("agents")) return "智能任务运行中心";
  if (route.includes("audit")) return "Audit & Evidence";
  if (route.includes("learning")) return "Learning Layer";
  if (route.includes("co-growth")) return "Co-Growth OS";
  return route || "当前页面";
}

function demoVisualNaturalAnswer(
  requested: string,
  routeLabel: string,
  refs: VisualContextRequest["regions"][number]["businessRefs"],
  domItems: ContextItem[],
  route: string,
  selectionText = "",
  semanticHint = "",
) {
  const question = normalizeDemoQuestion(requested);
  const selectedText = [selectionText, ...domItems.map((item) => `${item.label} ${item.summary}`)].join(" ");
  const selectedLower = selectedText.toLowerCase();
  if (refs.length) {
    const labels = refs.slice(0, 4).map((ref) => compactDemoVisualText(ref.label || `${ref.type}:${ref.id}`, 34));
    const peopleCount = refs.filter((ref) => ref.type === "employee" || ref.type === "user").length;
    const docCount = refs.filter((ref) => ref.type === "rag_document").length;
    const agentCount = refs.filter((ref) => ref.type === "agent_run").length;
    if (peopleCount) {
      return `这块选中的是人员或账号相关对象：${labels.join("、")}。\n\n你可以把它理解为“人”的上下文入口，适合查看任职、组织归属、学习任务、协作记录和需要人工复核的事项。涉及面试、绩效、薪酬、晋升这类高影响结论时，我会帮你整理证据和复核点，不会直接替 HR 做最终判断。`;
    }
    if (docCount) {
      return `这块选中的是知识资料：${labels.join("、")}。\n\n它的重点不只是“文档标题”，还包括可信等级、敏感级别、可见范围和能否作为 RAG 引用。你可以继续问“这份资料能支持哪个回答”“它为什么不可见”“需要怎么发布或重建引用”。`;
    }
    if (agentCount) {
      return `这块选中的是智能任务运行记录：${labels.join("、")}。\n\n它适合用来追踪一次智能任务的状态、动作草稿、人工确认和审计结果。你可以继续追问某次任务为什么停在预览、用了哪些证据，或者下一步应该由谁确认。`;
    }
    return `这块区域关联到 ${refs.length} 个业务对象：${labels.join("、")}。\n\n在 AI-HRMS 里，它们不是孤立的页面元素，而是可以被权限、知识引用、Agent 预览和审计链串起来的工作对象。你可以继续问它们的业务含义、依据来源、风险等级，或下一步该进入哪个处理页面。`;
  }

  if (semanticHint === "main_navigation" || isDemoNavigationSelection(selectedText)) {
    return "这块是 AI-HRMS 的左侧主导航，用来在不同 HR 工作域之间切换。\n\n当前高亮的是“招聘与生命周期”，说明你正在招聘工作台；左侧还可以进入指挥看板、组织与员工、员工事务、成长与绩效、知识与 Agent、信任与审计和设置。它的作用不是展示某一条业务记录，而是帮助评审或 HR 快速切换到对应场景。";
  }
  if (semanticHint === "recruitment_lifecycle_flow" || /招聘需求|职位发布|候选人|面试|Offer/i.test(selectedText) || (route.includes("recruitment-lifecycle") && selectedLower.includes("hc"))) {
    return "这块是招聘生命周期的流程导航，用来把一次招聘从“要不要招”串到“如何发岗、怎么看候选人、怎么组织面试、Offer 如何复核”。\n\n前两个节点偏业务确认：HC、预算、岗位范围和渠道；后面三个节点会直接影响候选人，所以系统会更强调公平性、证据留痕和人工确认。你可以按下面的标签页继续查看招聘需求、职位、候选人和面试记录。";
  }
  if (route.includes("dashboard")) {
    return "这块属于 AI-HRMS 的指挥看板，用来把组织数据、AI 建议、待复核事项和审计证据放在同一个入口里。\n\n如果你是评审或 HR，建议先从这里进入 AI 指挥中心、文档库、考勤态势、共生成长、智能任务和审计，能最快看到这套系统如何把 HRMS 从台账升级成智能操作系统。";
  }
  if (route.includes("docs") || route.includes("knowledge")) {
    return "这块是知识治理和文档问答区域，重点是让 AI 回答有来源、有范围、有可信等级。\n\n你可以继续问某份资料能否作为引用、为什么某条制度没有命中、哪些内容需要发布、重建索引或调整可见范围。";
  }
  if (route.includes("agents")) {
    return "这块是智能任务的运行与复核区域，适合看一次任务准备做什么、用了哪些输入、是否需要人工确认，以及最终有没有进入审计链。\n\n如果你担心 AI 自动执行，重点看动作草稿和人工确认状态。";
  }
  if (route.includes("audit")) {
    return "这块是审计证据区域，用来回看 AI 回答、知识引用、动作草稿、人工确认和业务写入之间的关系。\n\n它的价值在于复盘：出了问题可以知道谁发起、依据是什么、风险怎么判断、动作有没有被确认。";
  }
  if (route.includes("co-growth") || route.includes("learning")) {
    return "这块是 Co-Growth 和学习证据相关区域，用来把 AI 学习、工作任务、导师复盘和成长记录连接起来。\n\n它不只是课程列表，更像把新人真实工作转化为可复盘的 AI 实战任务。";
  }
  if (domItems[0]) {
    return `这块是 ${routeLabel} 页面中的「${compactDemoVisualText(domItems[0].label, 36)}」区域。\n\n从可见内容看，它更像一个业务模块或操作入口。你可以继续问“这块应该怎么用”“这里的风险是什么”“下一步点哪里”，我会结合页面上下文给出更具体的解释。`;
  }
  if (question.includes("解释") || question.includes("说明")) {
    return `这块位于 ${routeLabel}，但没有圈到明确的业务对象。\n\n建议你稍微缩小选区，尽量框住一张卡片、一行表格、一个按钮或一个字段；这样我可以结合对象名称、状态、风险和证据链给出更准确的解释。`;
  }
  return `我看到了你在 ${routeLabel} 上圈选的区域，但当前选区没有足够明确的业务对象。\n\n你可以把问题写得更具体一些，比如“这块有什么用”“为什么我看不到这个按钮”“这条记录下一步怎么处理”。`;
}

function isDemoNavigationSelection(text: string) {
  const compact = text.replace(/\s+/g, "");
  return compact.includes("AI-HRMS")
    && compact.includes("指挥看板")
    && compact.includes("组织与员工")
    && compact.includes("设置");
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
      return `法人实体「${compactDemoVisualText(label, 40)}」用于确定合同主体、地区责任、权限边界和审计归属；解释不会推断真实公司外部信息。`;
    case "org_unit":
      return `组织单元「${compactDemoVisualText(label, 40)}」用于限定员工、知识资料、智能任务和审计事件的组织范围。`;
    case "employee":
    case "user":
      return demoEmployeeVisualSummary(ref, label);
    case "rag_document":
      return `知识资料「${compactDemoVisualText(label, 40)}」需要结合可信等级、敏感级别、可见范围和引用片段才能用于 AI 回答。`;
    case "agent_run":
      return `智能任务「${compactDemoVisualText(label, 40)}」适合检查状态、动作草稿、人工确认和审计记录，不代表动作已经执行。`;
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
  return "模拟互联网科技公司下的业务或职能法人，用于权限边界、合同边界和审计归属";
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

function normalizeDemoQuestion(value: string) {
  return value.toLowerCase().replace(/[?？。.!！]/g, "").replace(/\s+/g, " ").trim();
}

function demoQuestionIncludes(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function demoCitationSnippet(content?: string) {
  const line = (content ?? "")
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .find((item) => !item.startsWith("#"));
  if (!line) return "资料引用预览";
  return line.length > 180 ? `${line.slice(0, 180)}...` : line;
}

function demoDocumentCitation(documentId: string, score: number): AIChatResponse["citations"][number] {
  const document = demoRAGDocuments.find((item) => item.id === documentId);
  return {
    documentId,
    chunkId: `demo-chat-${documentId}`,
    title: document?.title ?? "AI-HRMS 知识库资料",
    snippet: demoCitationSnippet(document?.content),
    trustLevel: document?.trustLevel,
    sensitivity: document?.sensitivity,
    score,
  };
}

function buildDemoAIChatResponse(message: string): AIChatResponse {
  const normalized = normalizeDemoQuestion(message);
  const highRiskMessage = isHighImpactHRText(message);
  const identityQuestion = ["你是谁", "你是什么", "这是什么", "这是什么系统", "who are you", "what are you", "what is this"].includes(normalized) ||
    demoQuestionIncludes(normalized, ["ai-hrms 是什么", "visual copilot 是什么", "介绍一下你自己", "介绍下你自己"]);
  let intent = "knowledge_question";
  let riskLevel = highRiskMessage ? "high" : "low";
  let executionMode = "retrieval_only";
  let citations: AIChatResponse["citations"] = [demoDocumentCitation("rag-doc-012", 0.9)];
  let answer = "可以。AI-HRMS 会优先基于已发布且当前可见的知识库资料回答，并在详情里保留引用、风险、置信度和审计信息。";

  if (identityQuestion) {
    intent = "product_identity";
    answer = "我是 AI-HRMS 里的圈选助手，用来帮助你理解当前人力资源操作系统里的页面、制度资料、知识引用、智能任务运行和审计边界。\n\n你可以直接问我页面怎么用、某条制度依据在哪里；如果要解释某个卡片、表格行或按钮，请切换到“截图/圈选问”并圈选那块区域。";
    citations = [demoDocumentCitation("rag-doc-012", 0.94), demoDocumentCitation("rag-doc-015", 0.88)];
  } else if (demoQuestionIncludes(normalized, ["这个页面怎么用", "当前页面怎么用", "页面怎么用", "有哪些页面", "导航", "入口"])) {
    intent = "page_usage";
    answer = "这个系统的常用入口是：指挥看板看整体风险和证据，AI 指挥中心发起受控任务，知识治理发布和治理资料，文档库做带引用的问答，智能任务运行中心查看动作草稿与执行记录，信任与审计查看证据链，设置页调整语言、侧边栏和助手默认项。";
    citations = [demoDocumentCitation("rag-doc-023", 0.93), demoDocumentCitation("rag-doc-013", 0.86)];
  } else if (demoQuestionIncludes(normalized, ["语言", "英文", "中文", "设置", "侧边栏", "sidebar", "copilot 默认"])) {
    intent = "settings_help";
    answer = "到设置页可以切换中文/英文、调整界面密度和演示提示、设置侧边栏宽度、选择 Visual Copilot 默认模式，并决定证据面板是否默认展开。桌面端侧边栏支持拖动改宽度，语言能力通过 locale 字典扩展，后续新增语言不需要改每个页面。";
    citations = [demoDocumentCitation("rag-doc-014", 0.92), demoDocumentCitation("rag-doc-010", 0.78)];
  } else if (demoQuestionIncludes(normalized, ["普通问答", "圈选", "截图", "截图/圈选", "layout", "选区"])) {
    intent = "visual_copilot_mode";
    answer = "普通问答适合问产品功能、制度解释、资料依据和一般操作路径，只发送文字问题。截图/圈选问会额外带上选区、DOM 摘要、可见文本、相对坐标和 layout snapshot，更适合问“这块区域是什么”“为什么看不到这个按钮”“这列表格列是什么意思”。当前模式不做未脱敏原图识别。";
    citations = [demoDocumentCitation("rag-doc-015", 0.94), demoDocumentCitation("rag-doc-026", 0.88), demoDocumentCitation("rag-doc-007", 0.82)];
  } else if (demoQuestionIncludes(normalized, ["rag", "引用", "依据", "发布资料", "文档库", "知识库", "资料在哪里", "刷新索引", "重建 embedding"])) {
    intent = "rag_help";
    answer = "知识资料要先在知识治理页创建来源、发布文档、设置可信等级、敏感级别和可见范围，并刷新检索索引。用户问制度依据或引用位置时，文档库和普通问答会只使用已发布且当前可见的资料；没有命中引用时应明确说未找到，而不是编造依据。";
    citations = [demoDocumentCitation("rag-doc-024", 0.94), demoDocumentCitation("rag-doc-025", 0.88), demoDocumentCitation("rag-doc-030", 0.8)];
  } else if (demoQuestionIncludes(normalized, ["人工确认", "humanreview", "toolpreview", "工具预览", "审计", "audit"])) {
    intent = "audit_and_preview";
    riskLevel = demoQuestionIncludes(normalized, ["写入", "执行", "修改", "删除"]) ? "medium" : "low";
    executionMode = riskLevel === "medium" ? "tool_preview" : "retrieval_only";
    answer = "需要写入、权限变更、员工资料修改、组织或法人调整、资料发布、智能任务执行或高风险建议时，系统先生成动作草稿，说明动作名、参数摘要、读写范围、风险、可见范围和是否可逆，再由人确认并写入审计。只读解释可以直接返回，但仍会保留引用和审计状态。";
    citations = [demoDocumentCitation("rag-doc-017", 0.9), demoDocumentCitation("rag-doc-028", 0.88), demoDocumentCitation("rag-doc-029", 0.86)];
  } else if (highRiskMessage) {
    intent = "high_impact_hr_boundary";
    executionMode = "human_review_required";
    riskLevel = "high";
    answer = "这类问题涉及高影响人事决策。AI-HRMS 可以帮你整理事实、生成检查清单、解释制度和准备人工审阅草稿，但不能自动给出录用、淘汰、调薪、绩效评级、处分或解雇结论。最终判断必须由有权限的 HR、业务负责人或法务基于可审计证据确认。";
    citations = [demoDocumentCitation("rag-doc-019", 0.95), demoDocumentCitation("rag-doc-003", 0.72), demoDocumentCitation("rag-doc-004", 0.7)];
  } else if (demoQuestionIncludes(normalized, ["管理员指南", "看不到", "没有权限", "不可见", "group_admin", "管理员"])) {
    intent = "admin_visibility";
    answer = "管理员指南只对管理员可见。看不到时先检查当前账号角色、权限、可见范围、登录状态和菜单可见性；如果刚调整过角色，刷新或重新登录后再看。普通员工、导师、仅有 HR 或组织管理权限的账号不会看到完整管理员入口。";
    citations = [demoDocumentCitation("rag-doc-020", 0.92), demoDocumentCitation("rag-doc-027", 0.88), demoDocumentCitation("rag-doc-011", 0.82)];
  } else if (demoQuestionIncludes(normalized, ["scope", "法人", "组织", "数据范围", "权限范围"])) {
    intent = "scope_help";
    answer = "AI-HRMS 用全局、法人、组织、角色和员工可见范围控制资料、业务数据、角色授权和审计范围。法人边界更适合公司主体和合同边界，组织边界更适合部门、团队和下级组织。没有明确授权时系统默认收紧，不返回受限数据，也不用全局资料替代受限资料。";
    citations = [demoDocumentCitation("rag-doc-021", 0.93), demoDocumentCitation("rag-doc-020", 0.78)];
  } else if (demoQuestionIncludes(normalized, ["隐私", "敏感", "个人信息", "员工数据", "脱敏", "外部模型"])) {
    intent = "privacy_minimization";
    answer = "员工数据要按最小必要原则使用：只返回当前任务需要且你有权查看的字段。身份、联系方式、任职、考勤、绩效、薪酬、学习、消息和审计记录都可能是敏感上下文，发送给外部模型或写入日志前应脱敏或摘要化。";
    citations = [demoDocumentCitation("rag-doc-031", 0.94), demoDocumentCitation("rag-doc-022", 0.86), demoDocumentCitation("rag-doc-004", 0.78)];
  } else if (demoQuestionIncludes(normalized, ["30 天", "30天", "成长计划", "新人计划", "入职计划"])) {
    intent = "onboarding_plan";
    executionMode = "llm_explain";
    riskLevel = "medium";
    answer = "可以生成新人 30 天成长计划，但应限定为学习、协作和导师复盘草稿：第 1 周完成制度、信息安全和协作课程；第 2 周熟悉团队目标和工具链；第 3 周完成一个低风险实践任务；第 4 周由导师复盘证据、风险和下一步成长目标。涉及评价、淘汰或薪酬的结论必须人工确认。";
    citations = [demoDocumentCitation("rag-doc-032", 0.94), demoDocumentCitation("rag-doc-002", 0.86), demoDocumentCitation("rag-doc-019", 0.82)];
  }

  const humanReviewRequired = riskLevel === "high";
  const executionDecision = {
    intent,
    executionMode,
    riskLevel,
    useLlm: executionMode === "llm_explain",
    useAgent: false,
    useMultiAgent: false,
    humanReviewRequired,
    reason: humanReviewRequired
      ? "命中高影响 HR 边界，Demo 只允许生成解释或人工审阅草稿。"
      : "Demo 优先使用已发布知识库资料和程序化路由生成回答。",
    routedBy: ["demo.execution_router", "demo.knowledge_pack", "risk.policy"],
  };
  const contextPacket = {
    intent,
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
    boundary: "Demo 使用本地知识包模拟 RAG；真实模式由 Go Context Resolver、Postgres RAG、审计和可选 LLM 共同生成。",
  };
  const trustPacket = {
    riskLevel,
    confidence: citations[0]?.score ?? 0.82,
    humanReviewRequired,
    evidenceCount: citations.length,
    citations,
    auditStatus: humanReviewRequired ? "blocked_and_logged" : "demo_answer_logged",
    reversible: !humanReviewRequired,
    policyChecks: ["citation.required", "scope.checked", "audit.required"],
  };
  appendDemoAudit({
    eventType: humanReviewRequired ? "high_risk.action.blocked" : "ai.chat.demo_answer",
    objectType: "ai_chat",
    objectId: `chat-${Date.now()}`,
    riskLevel,
    newValueSummary: {
      promptPreview: redactDemoText(message),
      citations: citations.map((citation) => citation.documentId),
      humanReviewRequired,
      intent,
    },
  });
  return {
    message: answer,
    citations,
    confidence: trustPacket.confidence,
    riskLevel,
    humanReviewRequired,
    auditStatus: trustPacket.auditStatus,
    provider: "demo-rag",
    model: executionDecision.useLlm ? "knowledge-pack-llm-preview" : "knowledge-pack-v1",
    executionDecision,
    contextPacket,
    trustPacket,
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
  attendanceOverview: (day?: string) => demoMode
    ? Promise.resolve(buildDemoAttendanceOverview(day))
    : request<AttendanceOverview>(`/attendance/overview${day ? `?day=${encodeURIComponent(day)}` : ""}`),
  attendanceAgentAnalysis: (values: { day?: string; focus?: string; orgUnitName?: string }) => demoMode
    ? Promise.resolve(buildDemoAttendanceAgentAnalysis(values))
    : request<AttendanceAgentAnalysis>("/attendance/agent-analysis", { method: "POST", body: JSON.stringify(values) }),
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
        orgUnitName: "云衡科技虚构样本",
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
  workbenchOverview: () => demoMode ? Promise.resolve(demoWorkbenchOverview()) : request<WorkbenchOverview>("/workbench/overview"),
  workbenchWorkItems: (page = 1, size = 10) => demoMode ? Promise.resolve(demoWorkbenchItems(page, size)) : request<Page<HRWorkItem>>(`/workbench/work-items?page=${page}&size=${size}`),
  leaveBalances: (employeeId?: string) => demoMode
    ? Promise.resolve(demoLeaveBalances(employeeId))
    : request<LeaveBalance[]>(`/hr/leave-balances${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ""}`),
  employeeCheckins: (page = 1, size = 10, employeeId?: string) => demoMode
    ? Promise.resolve(demoListEmployeeCheckins(page, size, employeeId))
    : request<Page<EmployeeCheckin>>(`/hr/checkins?page=${page}&size=${size}${employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : ""}`),
  createEmployeeCheckin: (values: EmployeeCheckinInput) => demoMode
    ? Promise.resolve(demoCreateEmployeeCheckin(values))
    : request<EmployeeCheckin>("/hr/checkins", { method: "POST", body: JSON.stringify(values) }),
  hrRecords: (resource: string, page = 1, size = 10) =>
    demoMode ? Promise.resolve(demoPaged(demoHRRecords[resource] ?? [], page, size)) : request<Page<HRRecord>>(`/hr/${resource}?page=${page}&size=${size}`),
  hrWorkflow: (resource: string, id: string) => demoMode
    ? Promise.resolve(demoHRWorkflow(resource, id))
    : request<HRWorkflow>(`/hr/${resource}/${id}/workflow`),
  applyHRWorkflowAction: (resource: string, id: string, values: { action: string; comment?: string }) => demoMode
    ? Promise.resolve(demoApplyHRWorkflowAction(resource, id, values))
    : request<WorkflowActionResult>(`/hr/${resource}/${id}/workflow/actions`, { method: "POST", body: JSON.stringify(values) }),
  createHRRecord: (resource: string, values: HRRecordInput) => {
    if (demoMode) {
      const meta = demoHRResourceMeta[resource];
      const record = makeDemoHRRecord(resource, Date.now() % 1000, {
        ...values,
        id: `${resource}-${Date.now()}`,
        module: meta.module,
        recordType: meta.recordType,
        humanReviewRequired: values.humanReviewRequired ?? meta.defaultHumanReview,
        riskLevel: values.riskLevel ?? meta.defaultRisk,
        status: values.status ?? meta.defaultStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      demoHRRecords[resource] = [record, ...(demoHRRecords[resource] ?? [])];
      appendDemoAudit({
        eventType: `hr.${resource}.created`,
        objectType: record.recordType,
        objectId: record.id,
        riskLevel: record.riskLevel,
        newValueSummary: { title: record.title, status: record.status, humanReviewRequired: record.humanReviewRequired },
      });
      demoEnsureApprovalTask(record);
      return Promise.resolve(record);
    }
    return request<HRRecord>(`/hr/${resource}`, { method: "POST", body: JSON.stringify(values) });
  },
  updateHRRecord: (resource: string, id: string, values: HRRecordInput) => {
    if (demoMode) {
      const records = demoHRRecords[resource] ?? [];
      demoHRRecords[resource] = records.map((record) => record.id === id ? {
        ...record,
        ...values,
        employeeName: demoEmployeeName(Object.hasOwn(values, "employeeId") ? values.employeeId : record.employeeId),
        orgUnitName: demoOrgUnitName(
          Object.hasOwn(values, "orgUnitId") ? values.orgUnitId : record.orgUnitId,
          Object.hasOwn(values, "employeeId") ? values.employeeId : record.employeeId,
        ),
        payload: values.payload ?? record.payload,
        updatedAt: new Date().toISOString(),
      } : record);
      const saved = demoHRRecords[resource].find((record) => record.id === id);
      if (!saved) {
        return Promise.reject(new Error("HR record not found"));
      }
      appendDemoAudit({
        eventType: `hr.${resource}.updated`,
        objectType: saved.recordType,
        objectId: saved.id,
        riskLevel: saved.riskLevel,
        newValueSummary: { title: saved.title, status: saved.status, humanReviewRequired: saved.humanReviewRequired },
      });
      return Promise.resolve(saved);
    }
    return request<HRRecord>(`/hr/${resource}/${id}`, { method: "PUT", body: JSON.stringify(values) });
  },
  deleteHRRecord: (resource: string, id: string) => {
    if (demoMode) {
      const records = demoHRRecords[resource] ?? [];
      const record = records.find((item) => item.id === id);
      if (!record) {
        return Promise.reject(new Error("HR record not found"));
      }
      demoHRRecords[resource] = records.filter((item) => item.id !== id);
      appendDemoAudit({
        eventType: `hr.${resource}.deleted`,
        objectType: record.recordType,
        objectId: record.id,
        riskLevel: record.riskLevel,
        oldValueSummary: { title: record.title, status: record.status, humanReviewRequired: record.humanReviewRequired },
        newValueSummary: { deleted: true },
      });
      return Promise.resolve({ deleted: true });
    }
    return request<{ deleted: boolean }>(`/hr/${resource}/${id}`, { method: "DELETE" });
  },
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
  ragDocument: (id: string) => {
    if (demoMode) {
      const document = demoRAGDocuments.find((item) => item.id === id);
      return document ? Promise.resolve(document) : Promise.reject(new Error("文档不存在或不可见"));
    }
    return request<RAGDocument>(`/rag/documents/${encodeURIComponent(id)}`);
  },
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
        summary: "演示资料导入完成，已生成本地检索索引。",
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
        summary: `已刷新 ${document?.title ?? "选中资料"} 的本地检索索引。`,
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
        snippet: demoCitationSnippet(document.content),
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
  aiChat: (message: string) => demoMode
    ? Promise.resolve(buildDemoAIChatResponse(message))
    : request<AIChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ message }) }),
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
        summary: values.prompt || "智能任务预览",
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
      const accepted = ["list_employees", "list_attendance", "attendance_realtime_overview", "rag_search", "learning_recommend"].includes(values.toolName);
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
