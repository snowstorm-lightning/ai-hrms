export interface ApiEnvelope<T> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
}

export interface Page<T> {
  total: number;
  rows: T[];
}

export interface User {
  id: string;
  mobile: string;
  username: string;
  enableState: number;
  createdAt: string;
  roles?: string[];
}

export interface Capability {
  code: string;
  description: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
}

export interface RoleBinding {
  id?: string;
  userId?: string;
  roleId?: string;
  roleCode: string;
  roleName?: string;
  scopeType: "global" | "legal_entity" | "org_unit";
  scopeId?: string | null;
  scopeName?: string;
  includeDescendants: boolean;
  createdAt?: string;
}

export interface LegalEntity {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  legalName: string;
  unifiedSocialCreditCode: string;
  legalRepresentative: string;
  companyPhone: string;
  email: string;
  area: string;
  address: string;
  status: string;
  createdAt: string;
}

export interface OrgUnit {
  id: string;
  parentId?: string | null;
  legalEntityId?: string | null;
  code: string;
  name: string;
  type: string;
  managerName: string;
  status: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  legalEntityId?: string | null;
  legalEntityName?: string | null;
  orgUnitId?: string | null;
  orgUnitName?: string | null;
  positionTitle: string;
  isPrimary: boolean;
  startDate: string;
  endDate?: string | null;
  allocationRatio?: number | null;
  employmentType: string;
}

export interface Employee {
  id: string;
  userId?: string | null;
  employeeNo: string;
  name: string;
  mobile: string;
  status: string;
  sex: string;
  dateOfBirth: string;
  highestDegreeOfEducation: string;
  nationalArea: string;
  passportNo: string;
  idNumber: string;
  nativePlace: string;
  nation: string;
  englishName: string;
  maritalStatus: string;
  birthday: string;
  zodiac: string;
  age: string;
  constellation: string;
  bloodType: string;
  domicile: string;
  politicalOutlook: string;
  qq: string;
  wechat: string;
  placeOfResidence: string;
  postalAddress: string;
  personalMailbox: string;
  emergencyContact: string;
  emergencyContactNumber: string;
  bankCardNumber: string;
  openingBank: string;
  graduateSchool: string;
  major: string;
  homeCompany: string;
  title: string;
  resume: string;
  isThereAnyCompetitionRestriction: string;
  remarks: string;
  primaryAssignment?: Assignment | null;
  assignments?: Assignment[];
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  mobile: string;
  orgUnitName: string;
  attendanceStatus: number;
  attendanceInTime?: string | null;
  attendanceOutTime?: string | null;
  day: string;
  remarks: string;
}

export interface MessageItem {
  id: string;
  title: string;
  category: string;
  content: string;
  author: string;
  orgUnitName: string;
  scopeType: "global" | "legal_entity" | "org_unit";
  scopeId?: string | null;
  star: number;
  view: number;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorUserId?: string | null;
  eventType: string;
  objectType: string;
  objectId: string;
  scopeType: string;
  scopeId?: string | null;
  requestId: string;
  source: string;
  riskLevel: string;
  oldValueSummary: Record<string, unknown>;
  newValueSummary: Record<string, unknown>;
  createdAt: string;
}

export interface RAGSource {
  id: string;
  sourceType: "upload" | "directory" | "url" | "connector";
  name: string;
  uri: string;
  status: string;
  createdByUserId?: string | null;
  createdAt: string;
}

export interface RAGDocumentScope {
  id?: string;
  documentId?: string;
  scopeType: "global" | "legal_entity" | "org_unit" | "role" | "employee";
  scopeId?: string | null;
  roleCode?: string | null;
  employeeId?: string | null;
  includeDescendants: boolean;
}

export interface RAGDocument {
  id: string;
  sourceId?: string | null;
  title: string;
  version: string;
  status: "draft" | "published" | string;
  trustLevel: string;
  sensitivity: string;
  content?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  publishedAt?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  scopes?: RAGDocumentScope[];
}

export interface RAGIngestJob {
  id: string;
  sourceId?: string | null;
  documentId?: string | null;
  jobType: "ingest" | "rebuild_embeddings" | string;
  status: string;
  provider: string;
  title?: string;
  content?: string;
  scopes?: RAGDocumentScope[];
  summary: string;
  error: string;
  createdByUserId?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface RAGCitation {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  trustLevel?: string;
  sensitivity?: string;
  score?: number;
  pageRef?: string;
  locationRef?: string;
}

export interface HarnessDecision {
  intent: string;
  executionMode: string;
  riskLevel: string;
  useLlm: boolean;
  useAgent: boolean;
  useMultiAgent: boolean;
  humanReviewRequired: boolean;
  reason: string;
  routedBy: string[];
}

export interface ToolPreview {
  toolName: string;
  purpose: string;
  executionMode: string;
  riskLevel: string;
  decision?: string;
  requiredCapability?: string;
  accepted: boolean;
  previewOnly: boolean;
  reversible: boolean;
  writes: string[];
  arguments?: Record<string, unknown>;
  reason: string;
}

export interface TrustPacket {
  riskLevel: string;
  confidence: number;
  humanReviewRequired: boolean;
  evidenceCount: number;
  citations?: RAGCitation[];
  toolPreview?: ToolPreview;
  auditStatus: string;
  reversible: boolean;
  policyChecks: string[];
}

export interface ContextItem {
  type: string;
  id?: string;
  label: string;
  summary: string;
  source: string;
  riskLevel?: string;
  provenance: string;
  metadata?: Record<string, unknown>;
}

export interface ContextPacket {
  route?: string;
  intent: string;
  subject: string;
  items: ContextItem[];
  sourceCount: Record<string, number>;
  staleness: string;
  boundary: string;
  metadata?: Record<string, unknown>;
}

export interface RAGSearchResult {
  answer: string;
  citations: RAGCitation[];
  refusalReason?: string;
  provider?: string;
  model?: string;
  confidence?: number;
  riskLevel?: string;
  humanReviewRequired?: boolean;
  auditStatus?: string;
  trustPacket?: TrustPacket;
}

export interface AIChatResponse {
  message: string;
  citations: RAGCitation[];
  provider?: string;
  model?: string;
  confidence?: number;
  riskLevel?: string;
  humanReviewRequired?: boolean;
  auditStatus?: string;
  executionDecision?: HarnessDecision;
  contextPacket?: ContextPacket;
  trustPacket?: TrustPacket;
}

export interface AIProviderStatus {
  agentBoundaryConfigured: boolean;
  chatProvider: string;
  chatModel: string;
  deepseekKeyConfigured: boolean;
  embeddingProvider: string;
  embeddingModel?: string;
  embeddingDimensions: number | string;
  embeddingKeyConfigured: boolean;
}

export interface LearningCourse {
  id: string;
  title: string;
  description: string;
  status: string;
  scopeType: string;
  scopeId?: string | null;
  createdAt: string;
  lessonCount: number;
}

export interface LearningLesson {
  id: string;
  courseId: string;
  title: string;
  content: string;
  sortOrder: number;
  ragDocumentId?: string | null;
}

export interface LearningEnrollment {
  id: string;
  employeeId: string;
  employeeName: string;
  courseId: string;
  courseTitle: string;
  status: string;
  dueDate?: string | null;
  createdAt: string;
}

export interface LearningRecommendation {
  id: string;
  employeeId?: string | null;
  recommendationType: string;
  title: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  runType: string;
  status: string;
  actorUserId?: string | null;
  provider: string;
  model: string;
  riskLevel: string;
  summary: string;
  createdAt: string;
}

export interface AgentToolPreviewResponse {
  accepted: boolean;
  message: string;
  requiredRisk: string;
  resultPreview: Record<string, unknown>;
  toolPreview?: ToolPreview;
  executionDecision?: HarnessDecision;
  trustPacket?: TrustPacket;
}

export interface AgentWorkflowDemoResult {
  goal: string;
  context: string[];
  risk_level: string;
  human_review_required: boolean;
  audit_status: string;
  steps: Array<{ name: string; status: string }>;
}

export interface BusinessRef {
  type: "employee" | "user" | "legal_entity" | "org_unit" | "attendance" | "message" | "learning" | "rag_document" | "agent_run" | "audit_event" | "agent_tool_call" | string;
  id: string;
  label?: string;
}

export interface ScreenRegion {
  id: string;
  mode: "element" | "rect" | "freehand" | "arrow";
  rect: { x: number; y: number; width: number; height: number; dpr: number };
  selector?: string;
  businessRefs: BusinessRef[];
}

export interface VisualContextRequest {
  route: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  screenshot?: { mime: "image/png"; dataBase64: string; redacted: boolean };
  dom: Array<Record<string, unknown>>;
  regions: ScreenRegion[];
  instruction: string;
}

export interface VisualCopilotEvent {
  id: string;
  actorUserId?: string | null;
  route: string;
  instruction: string;
  regions: ScreenRegion[];
  businessRefs: BusinessRef[];
  intent: string;
  confidence: number;
  status: string;
  createdAt: string;
}

export interface VisualCopilotResponse {
  event: VisualCopilotEvent;
  executionDecision?: HarnessDecision;
  contextPacket?: ContextPacket;
  trustPacket?: TrustPacket;
  result: {
    title?: string;
    preview: string;
    explanation?: string;
    selectedSummary?: string;
    trustBoundary?: string;
    riskLevel?: string;
    confidence?: number;
    imageMode?: string;
    executionDecision?: HarnessDecision;
    contextPacket?: ContextPacket;
    trustPacket?: TrustPacket;
    actions: Array<Record<string, unknown>>;
  };
}

export interface CommentItem {
  id: string;
  messageId: string;
  content: string;
  username: string;
  createdAt: string;
}
