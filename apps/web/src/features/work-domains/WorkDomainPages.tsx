import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import type { AIProviderStatus, AuditEvent, Employee, EmployeeCheckin, HRRecord, HRRecordInput, HRWorkflow, HRWorkItem, LeaveBalance, OrgUnit, WorkflowAction, WorkbenchOverview } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { AttendancePage } from "../employees/AttendancePage";
import { employeeOpsTabForResource, growthTabForResource, recruitmentTabForResource, workItemRoute } from "./hrNavigation";

type HRRecordEditor = HRRecordInput & { id?: string };

type PayloadField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "date" | "time" | "select" | "switch";
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

const resourceLabels: Record<string, string> = {
  "leave-applications": "请假申请",
  "attendance-requests": "补卡/外勤",
  "shift-assignments": "排班",
  "expense-claims": "报销",
  "salary-slips": "工资单",
  "job-requisitions": "招聘需求",
  "job-openings": "职位",
  "job-applicants": "候选人",
  interviews: "面试",
  "job-offers": "Offer",
  "training-events": "培训",
  "performance-goals": "目标",
  "appraisal-cycles": "绩效周期",
  appraisals: "绩效评估",
};

const moduleLabels: Record<string, string> = {
  employee_ops: "员工事务",
  recruitment_lifecycle: "招聘与生命周期",
  growth_performance: "成长与绩效",
};

const sampleInputs: Record<string, HRRecordInput> = {
  "leave-applications": { title: "临时请假申请", status: "submitted", riskLevel: "medium", humanReviewRequired: true, payload: { leaveType: "annual", days: 1 } },
  "attendance-requests": { title: "补卡/外勤申请", status: "submitted", riskLevel: "medium", humanReviewRequired: true, payload: { requestType: "correction", reason: "外勤后补录" } },
  "shift-assignments": { title: "弹性班次分配", status: "active", riskLevel: "low", humanReviewRequired: false, payload: { shift: "flex", startTime: "10:00", endTime: "19:00" } },
  "expense-claims": { title: "业务差旅报销", status: "submitted", riskLevel: "medium", humanReviewRequired: true, payload: { amount: 320, currency: "CNY" } },
  "salary-slips": { title: "月度工资单草稿", status: "draft", riskLevel: "high", humanReviewRequired: true, payload: { period: "2026-05", boundary: "payroll_preview_only" } },
  "job-requisitions": { title: "新增招聘需求", status: "submitted", riskLevel: "medium", humanReviewRequired: true, payload: { openings: 1 } },
  "job-openings": { title: "职位发布草案", status: "open", riskLevel: "medium", humanReviewRequired: true, payload: { channel: "public" } },
  "job-applicants": { title: "候选人记录", status: "active", riskLevel: "high", humanReviewRequired: true, payload: { stage: "screening", fairnessBoundary: true } },
  interviews: { title: "候选人面试", status: "scheduled", riskLevel: "high", humanReviewRequired: true, payload: { scoreBoundary: "human_only" } },
  "job-offers": { title: "Offer 草案", status: "draft", riskLevel: "high", humanReviewRequired: true, payload: { compensationReviewRequired: true } },
  "training-events": { title: "AI 工作流培训", status: "planned", riskLevel: "medium", humanReviewRequired: false, payload: { evidenceRequired: true } },
  "performance-goals": { title: "Q2 绩效目标", status: "active", riskLevel: "medium", humanReviewRequired: false, payload: { progress: 0 } },
  "appraisal-cycles": { title: "绩效周期草案", status: "draft", riskLevel: "high", humanReviewRequired: true, payload: { formulaReviewRequired: true } },
  appraisals: { title: "绩效评估提交", status: "submitted", riskLevel: "high", humanReviewRequired: true, payload: { finalDecision: "human_only" } },
};

const payloadFieldsByResource: Record<string, PayloadField[]> = {
  "leave-applications": [
    { name: "leaveType", label: "请假类型", type: "select", options: [{ value: "annual", label: "年假" }, { value: "sick", label: "病假" }, { value: "personal", label: "事假" }, { value: "compensatory", label: "调休" }] },
    { name: "fromDate", label: "开始日期", type: "date" },
    { name: "toDate", label: "结束日期", type: "date" },
    { name: "days", label: "天数", type: "number", min: 0.5 },
  ],
  "attendance-requests": [
    { name: "requestType", label: "申请类型", type: "select", options: [{ value: "correction", label: "补卡" }, { value: "missing_checkout", label: "补签退" }, { value: "field_work", label: "外勤" }] },
    { name: "reason", label: "原因", type: "textarea" },
  ],
  "shift-assignments": [
    { name: "shift", label: "班次", type: "select", options: [{ value: "flex", label: "弹性班" }, { value: "day", label: "白班" }, { value: "night", label: "夜班" }] },
    { name: "startTime", label: "开始时间", type: "time" },
    { name: "endTime", label: "结束时间", type: "time" },
  ],
  "expense-claims": [
    { name: "amount", label: "金额", type: "number", min: 0 },
    { name: "currency", label: "币种", type: "select", options: [{ value: "CNY", label: "人民币" }, { value: "USD", label: "美元" }] },
    { name: "expenseType", label: "费用类型", type: "select", options: [{ value: "transport", label: "交通" }, { value: "travel", label: "差旅" }, { value: "meal", label: "餐饮" }] },
  ],
  "salary-slips": [
    { name: "period", label: "薪资期间", placeholder: "2026-05" },
    { name: "boundary", label: "边界说明" },
  ],
  "job-requisitions": [
    { name: "openings", label: "HC 数", type: "number", min: 1, required: true },
    { name: "budget", label: "预算范围", placeholder: "如 35k-45k/月" },
    { name: "expectedOnboardingDate", label: "期望入职时间", type: "date" },
    { name: "businessNeed", label: "业务必要性", type: "textarea", placeholder: "说明为什么需要新增该招聘需求" },
  ],
  "job-openings": [
    { name: "channel", label: "发布渠道", type: "select", options: [{ value: "public", label: "公开渠道" }, { value: "internal_referral", label: "内部推荐" }, { value: "social", label: "社交渠道" }] },
    { name: "salaryRange", label: "薪资范围", placeholder: "如 35k-45k" },
    { name: "closingDate", label: "关闭日期", type: "date" },
  ],
  "job-applicants": [
    { name: "stage", label: "候选人阶段", type: "select", options: [{ value: "screening", label: "简历筛选" }, { value: "interview", label: "面试" }, { value: "offer", label: "Offer" }, { value: "rejected", label: "已拒绝" }] },
    { name: "source", label: "来源" },
    { name: "fairnessBoundary", label: "公平性复核", type: "switch" },
  ],
  interviews: [
    { name: "interviewTime", label: "面试日期", type: "date" },
    { name: "interviewer", label: "面试官" },
    { name: "scoreBoundary", label: "评分边界" },
  ],
  "job-offers": [
    { name: "salaryRange", label: "薪酬范围" },
    { name: "onboardingDate", label: "入职日期", type: "date" },
    { name: "compensationReviewRequired", label: "薪酬复核", type: "switch" },
  ],
  "training-events": [
    { name: "audience", label: "参与范围" },
    { name: "startDate", label: "开始日期", type: "date" },
    { name: "evidenceRequired", label: "需要证据", type: "switch" },
  ],
  "performance-goals": [
    { name: "progress", label: "进度", type: "number", min: 0, max: 100 },
    { name: "evidence", label: "证据说明", type: "textarea" },
  ],
  "appraisal-cycles": [
    { name: "period", label: "周期", placeholder: "2026 H1" },
    { name: "formulaReviewRequired", label: "公式复核", type: "switch" },
  ],
  appraisals: [
    { name: "selfScore", label: "自评分", type: "number", min: 0, max: 5 },
    { name: "feedbackScore", label: "反馈分", type: "number", min: 0, max: 5 },
    { name: "finalDecision", label: "最终结论边界", type: "select", options: [{ value: "human_only", label: "仅人工确认" }] },
  ],
};

const editorNotes: Record<string, string> = {
  "job-requisitions": "新增招聘需求不会直接批准 HC；保存后进入 submitted 状态，并保留人工复核边界。",
  "job-openings": "职位发布只保存岗位草案和渠道信息，不自动对外发布或筛选候选人。",
  "job-applicants": "候选人记录只保存阶段和来源，不自动进行录用、淘汰或评分裁决。",
  interviews: "面试记录只整理安排和证据，评分与录用结论必须人工确认。",
  "job-offers": "Offer 草案涉及薪酬与录用影响，必须由 HR 和薪酬负责人确认。",
};

function riskColor(risk: string) {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "green";
}

function riskLabel(risk: string) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  if (risk === "low") return "低风险";
  return risk;
}

function providerLabel(provider: string | undefined) {
  if (!provider) return "未返回";
  if (provider === "fake") return "演示适配器";
  if (provider === "boundary") return "边界模式";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "qwen3") return "Qwen3";
  return provider;
}

function checkinLogTypeLabel(logType: string) {
  if (logType === "IN") return "上班签到";
  if (logType === "OUT") return "下班签退";
  return logType || "打卡";
}

function checkinSourceLabel(source?: string) {
  if (source === "web") return "网页打卡";
  if (source === "mobile") return "移动端打卡";
  if (source === "device") return "考勤机";
  return source || "未标注来源";
}

function workActionLabel(action: string) {
  const labels: Record<string, string> = {
    human_review: "人工复核",
    approve: "审批通过",
    reject: "退回",
    review: "复核",
    audit: "审计",
    submit: "提交",
  };
  return labels[action] ?? action;
}

function workActionReason(action: string, riskLevel?: string) {
  if (action === "human_review") return riskLevel === "high" ? "风险较高，需要人工复核后再继续。" : "需要人工确认业务边界。";
  if (action === "approve") return "资料齐全时可批准，系统会记录审批人和时间。";
  if (action === "reject") return "信息不足或不符合规则时退回，并填写处理说明。";
  if (action === "submit") return "先提交申请，再进入人工复核或审批队列。";
  if (action === "audit") return "进入审计回看，确认依据和处理轨迹。";
  return "请先查看证据和业务信息，再选择处理动作。";
}

function formatScope(scopeType?: string, scopeId?: string | null) {
  if (!scopeType || scopeType === "global") return "全局范围";
  const labels: Record<string, string> = {
    legal_entity: "法人范围",
    org_unit: "组织范围",
  };
  return `${labels[scopeType] ?? scopeType}${scopeId ? ` · ${scopeId}` : ""}`;
}

function valueLabel(value: unknown): string {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined || value === "") return "-";
  const raw = String(value);
  const labels: Record<string, string> = {
    annual: "年假",
    sick: "病假",
    personal: "事假",
    compensatory: "调休",
    correction: "补卡",
    missing_checkout: "补签退",
    field_work: "外勤",
    flex: "弹性班",
    day: "白班",
    night: "夜班",
    transport: "交通",
    travel: "差旅",
    meal: "餐饮",
    public: "公开渠道",
    internal_referral: "内部推荐",
    social: "社交渠道",
    screening: "简历筛选",
    interview: "面试",
    offer: "Offer",
    rejected: "已拒绝",
    payroll_preview_only: "仅工资单预览",
    human_only: "仅人工确认",
    CNY: "人民币",
    USD: "美元",
    IN: "签到",
    OUT: "签退",
  };
  return labels[raw] ?? raw;
}

function payloadFieldLabel(resource: string, key: string) {
  return payloadFieldsByResource[resource]?.find((field) => field.name === key)?.label ?? key;
}

function statusColor(status: string) {
  if (["approved", "completed", "closed"].includes(status)) return "green";
  if (["draft", "planned", "scheduled"].includes(status)) return "blue";
  if (["rejected", "blocked"].includes(status)) return "red";
  return "gold";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "进行中",
    approved: "已批准",
    cancelled: "已取消",
    closed: "已关闭",
    completed: "已完成",
    draft: "草稿",
    in_review: "复核中",
    open: "已开放",
    pending: "待处理",
    planned: "已计划",
    rejected: "已驳回",
    scheduled: "已安排",
    submitted: "已提交",
    waiting_human_review: "待人工复核",
  };
  return labels[status] ?? status;
}

function DomainStats({ overview, module }: { overview?: WorkbenchOverview | null; module?: string }) {
  const modules = module ? overview?.modules.filter((item) => item.module === module) ?? [] : overview?.modules ?? [];
  const total = modules.reduce((sum, item) => sum + item.total, 0);
  const pending = modules.reduce((sum, item) => sum + item.pending, 0);
  const highRisk = modules.reduce((sum, item) => sum + item.highRisk, 0);
  return (
    <div className="domain-metric-grid" data-vc-kind="domain-metrics">
      <Card><Statistic title="业务记录" value={total} /></Card>
      <Card><Statistic title="待处理" value={pending} /></Card>
      <Card><Statistic title="高风险/人审" value={highRisk} /></Card>
      <Card><Statistic title="期间" value={overview?.period ?? "2026-05"} /></Card>
    </div>
  );
}

function useWorkbenchOverview() {
  const [overview, setOverview] = useState<WorkbenchOverview | null>(null);
  useEffect(() => {
    let mounted = true;
    api.workbenchOverview().then((result) => {
      if (mounted) setOverview(result);
    }).catch(() => {
      if (mounted) setOverview(null);
    });
    return () => { mounted = false; };
  }, []);
  return overview;
}

function payloadPreview(record: HRRecord) {
  const keys = Object.keys(record.payload ?? {});
  if (!keys.length) return "无扩展字段";
  return keys.slice(0, 4).map((key) => `${payloadFieldLabel(record.resource, key)}：${valueLabel(record.payload[key])}`).join(" · ");
}

function renderPayloadDetails(record: HRRecord) {
  const entries = Object.entries(record.payload ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!entries.length) return <EmptyBlock description="暂无业务字段" />;
  return (
    <Descriptions column={1} bordered size="small" className="payload-description">
      {entries.map(([key, value]) => (
        <Descriptions.Item label={payloadFieldLabel(record.resource, key)} key={key}>
          {valueLabel(value)}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

function cloneInput(input: HRRecordInput): HRRecordEditor {
  return { ...input, payload: { ...(input.payload ?? {}) } };
}

function newRecordEditor(resource: string): HRRecordEditor {
  return cloneInput(sampleInputs[resource] ?? {
    title: resourceLabels[resource] ?? resource,
    status: "draft",
    riskLevel: "medium",
    humanReviewRequired: true,
    payload: {},
  });
}

function recordEditor(record: HRRecord): HRRecordEditor {
  return {
    id: record.id,
    title: record.title,
    employeeId: record.employeeId ?? null,
    orgUnitId: record.orgUnitId ?? null,
    scopeType: record.scopeType,
    scopeId: record.scopeId ?? null,
    status: record.status,
    riskLevel: record.riskLevel,
    humanReviewRequired: record.humanReviewRequired,
    payload: { ...(record.payload ?? {}) },
  };
}

function compactPayload(payload?: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  Object.entries(payload ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    next[key] = value;
  });
  return next;
}

function normalizeEditorValues(resource: string, values: HRRecordEditor): HRRecordInput {
  const defaults = sampleInputs[resource] ?? {};
  const scopeType = values.scopeType || defaults.scopeType || "global";
  return {
    title: values.title?.trim() || defaults.title || resourceLabels[resource] || resource,
    employeeId: values.employeeId || null,
    orgUnitId: values.orgUnitId || null,
    scopeType,
    scopeId: scopeType === "global" ? null : values.scopeId || null,
    status: values.status || defaults.status || "draft",
    riskLevel: values.riskLevel || defaults.riskLevel || "medium",
    humanReviewRequired: values.humanReviewRequired ?? defaults.humanReviewRequired ?? true,
    payload: compactPayload(values.payload),
  };
}

function renderPayloadInput(field: PayloadField) {
  if (field.type === "number") return <InputNumber min={field.min} max={field.max} style={{ width: "100%" }} />;
  if (field.type === "textarea") return <Input.TextArea rows={3} placeholder={field.placeholder} />;
  if (field.type === "date") return <Input type="date" />;
  if (field.type === "time") return <Input type="time" />;
  if (field.type === "select") return <Select allowClear options={field.options ?? []} />;
  if (field.type === "switch") return <Switch />;
  return <Input placeholder={field.placeholder} />;
}

function workflowActionButtonType(action: WorkflowAction): "primary" | "default" {
  return action.variant === "primary" ? "primary" : "default";
}

function WorkflowActions({
  workflow,
  loading,
  actionLoading,
  onAction,
}: {
  workflow: HRWorkflow | null;
  loading: boolean;
  actionLoading: boolean;
  onAction: (action: string, comment?: string) => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
  const [comment, setComment] = useState("");
  const actions = workflow?.actions ?? [];
  const openTasks = workflow?.approvalTasks.filter((task) => task.status === "open") ?? [];
  const events = workflow?.events ?? [];

  const runAction = async (action: WorkflowAction) => {
    if (action.requiresComment) {
      setPendingAction(action);
      setComment("");
      return;
    }
    await onAction(action.action);
  };

  return (
    <div className="workflow-action-panel" data-vc-kind="workflow-actions">
      <div className="workflow-action-header">
        <div>
          <Typography.Text strong>下一步处理</Typography.Text>
          <Typography.Paragraph type="secondary">
            {actions.length ? "选择一个审批动作推进当前记录；处理人、时间和说明都会进入审计。" : "当前记录没有可执行动作。"}
          </Typography.Paragraph>
        </div>
        {loading ? <Tag color="blue">加载中</Tag> : null}
      </div>
      <Space wrap>
        {actions.map((action) => (
          <Button
            key={action.action}
            type={workflowActionButtonType(action)}
            danger={action.variant === "danger"}
            disabled={!action.enabled}
            loading={actionLoading}
            title={action.reason}
            onClick={() => void runAction(action)}
            data-vc-action={`workflow.${workflow?.record.resource}.${action.action}`}
          >
            {action.label}
          </Button>
        ))}
      </Space>
      {actions.length ? (
        <div className="workflow-action-reasons">
          {actions.map((action) => (
            <div className="workflow-action-reason" key={`${action.action}-reason`}>
              <Tag color={action.enabled ? "blue" : "default"}>{action.label}后变为{statusLabel(action.nextStatus)}</Tag>
              <Typography.Text type="secondary">{action.reason || workActionReason(action.action, workflow?.record.riskLevel)}</Typography.Text>
            </div>
          ))}
        </div>
      ) : null}
      {openTasks.length ? (
        <div className="workflow-task-strip">
          {openTasks.map((task) => (
            <Tag color={riskColor(task.riskLevel)} key={task.id}>待处理：{workActionLabel(task.action)} · {task.assignedToName || "未分派"}</Tag>
          ))}
        </div>
      ) : null}
      {events.length ? (
        <Timeline
          className="workflow-event-timeline"
          items={events.slice(0, 4).map((event) => ({
            color: event.toStatus === "approved" ? "green" : event.toStatus === "rejected" ? "red" : "blue",
            content: (
              <span>
                <Typography.Text strong>{workActionLabel(event.action)}</Typography.Text>
                <Typography.Text type="secondary"> {statusLabel(event.fromStatus)}变为{statusLabel(event.toStatus)} · {new Date(event.createdAt).toLocaleString()}</Typography.Text>
                {event.comment ? <Typography.Paragraph className="workflow-event-comment">{event.comment}</Typography.Paragraph> : null}
              </span>
            ),
          }))}
        />
      ) : null}
      <Modal
        title={pendingAction ? `${pendingAction.label}说明` : "处理说明"}
        open={Boolean(pendingAction)}
        onCancel={() => setPendingAction(null)}
        onOk={() => {
          if (!pendingAction) return;
          void onAction(pendingAction.action, comment).then(() => setPendingAction(null));
        }}
        okButtonProps={{ danger: pendingAction?.variant === "danger", loading: actionLoading }}
        okText="确认"
        cancelText="取消"
      >
        <Input.TextArea
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="填写驳回、取消或人工处理说明"
        />
      </Modal>
    </div>
  );
}

function HRRecordMobileCards({
  records,
  loading,
  emptyText,
  onOpen,
  total,
  page,
  pageSize,
  onPageChange,
}: {
  records: HRRecord[];
  loading: boolean;
  emptyText: string;
  onOpen: (record: HRRecord) => void;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number, nextPageSize: number) => void;
}) {
  return (
    <div className="hr-mobile-record-list" data-vc-kind="hr-mobile-record-list">
      {loading ? <Card loading className="hr-mobile-record-card" /> : null}
      {!loading && !records.length ? <EmptyBlock description={emptyText} /> : null}
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          className="hr-mobile-record-card"
          onClick={() => onOpen(record)}
          data-vc-kind="hr-mobile-record"
          data-vc-object-type={record.recordType}
          data-vc-object-id={record.id}
          data-vc-label={record.title}
        >
          <span className="hr-mobile-card-title">{record.title}</span>
          <span className="hr-mobile-card-meta">{record.employeeName || record.orgUnitName || "全局范围"}</span>
          <span className="hr-mobile-card-tags">
            <Tag color={statusColor(record.status)}>{statusLabel(record.status)}</Tag>
            <Tag color={riskColor(record.riskLevel)}>{riskLabel(record.riskLevel)}</Tag>
            {record.humanReviewRequired ? <Tag color="red">人工复核</Tag> : null}
          </span>
          <Typography.Text type="secondary">{payloadPreview(record)}</Typography.Text>
        </button>
      ))}
      {total > pageSize ? (
        <Pagination
          className="hr-mobile-pagination"
          size="small"
          current={page}
          total={total}
          pageSize={pageSize}
          showSizeChanger={false}
          onChange={(nextPage, nextPageSize) => onPageChange(nextPage, nextPageSize)}
        />
      ) : null}
    </div>
  );
}

function HRResourcePanel({
  resource,
  description,
  focusId,
  createMode,
  defaultEmployeeId,
  returnLabel,
  onClearFocus,
  onReturn,
}: {
  resource: string;
  description: string;
  focusId?: string | null;
  createMode?: boolean;
  defaultEmployeeId?: string | null;
  returnLabel?: string;
  onClearFocus?: () => void;
  onReturn?: () => void;
}) {
  const [items, setItems] = useState<HRRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HRRecord | null>(null);
  const [workflow, setWorkflow] = useState<HRWorkflow | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState<HRRecordEditor | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form] = Form.useForm<HRRecordEditor>();
  const payloadFields = payloadFieldsByResource[resource] ?? [];
  const orgUnitOptions = useMemo(() => orgUnits.map((item) => ({ value: item.id, label: item.name })), [orgUnits]);
  const employeeOptions = useMemo(() => employees.map((item) => ({ value: item.id, label: `${item.name} / ${item.employeeNo}` })), [employees]);

  const reload = async (nextPage = page, nextPageSize = pageSize) => {
    setPage(nextPage);
    setPageSize(nextPageSize);
    setLoading(true);
    setError("");
    try {
      const result = await api.hrRecords(resource, nextPage, nextPageSize);
      setItems(result.rows ?? []);
      setTotal(result.total);
    } catch (err) {
      setError(getErrorMessage(err, `${resourceLabels[resource]}加载失败`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(1, pageSize); }, [resource]);

  useEffect(() => {
    if (!focusId || loading) return;
    if (selected?.id === focusId) return;
    const record = items.find((item) => item.id === focusId);
    if (record && selected?.id !== record.id) {
      setSelected(record);
      return;
    }
    let mounted = true;
    setWorkflowLoading(true);
    setError("");
    api.hrWorkflow(resource, focusId)
      .then((result) => {
        if (!mounted) return;
        setWorkflow(result);
        setSelected(result.record);
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err, "目标记录不在当前可见范围，或已经被删除"));
      })
      .finally(() => {
        if (mounted) setWorkflowLoading(false);
      });
    return () => { mounted = false; };
  }, [focusId, items, loading, resource, selected?.id]);

  useEffect(() => {
    if (!selected) {
      setWorkflow(null);
      return;
    }
    if (workflow?.record.id === selected.id && workflow.record.resource === resource) return;
    let mounted = true;
    setWorkflow(null);
    setWorkflowLoading(true);
    api.hrWorkflow(resource, selected.id)
      .then((result) => {
        if (!mounted) return;
        setWorkflow(result);
        setSelected(result.record);
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err, "审批流程加载失败"));
      })
      .finally(() => {
        if (mounted) setWorkflowLoading(false);
      });
    return () => { mounted = false; };
  }, [resource, selected?.id]);

  useEffect(() => {
    if (!editing) {
      form.resetFields();
      return;
    }
    form.setFieldsValue(editing);
  }, [editing, form]);

  useEffect(() => {
    if (!editing) return;
    let mounted = true;
    Promise.all([api.orgUnits(), api.employees(1, 100)])
      .then(([units, employeePage]) => {
        if (!mounted) return;
        setOrgUnits(units);
        setEmployees(employeePage.rows ?? []);
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err, "编辑选项加载失败"));
      });
    return () => { mounted = false; };
  }, [editing]);

  const openEditor = (record?: HRRecord, defaults?: Partial<HRRecordEditor>) => {
    if (record) {
      setEditing(recordEditor(record));
      return;
    }
    const next = newRecordEditor(resource);
    setEditing({
      ...next,
      ...defaults,
      payload: { ...(next.payload ?? {}), ...(defaults?.payload ?? {}) },
    });
  };

  const closeEditor = () => {
    setEditing(null);
    form.resetFields();
    if (createMode) onClearFocus?.();
  };

  useEffect(() => {
    if (!createMode) return;
    setSelected(null);
    setWorkflow(null);
    openEditor(undefined, { employeeId: defaultEmployeeId || undefined });
  }, [createMode, defaultEmployeeId, resource]);

  const saveRecord = async (values: HRRecordEditor) => {
    setSaving(true);
    setError("");
    try {
      const editingId = editing?.id;
      const input = normalizeEditorValues(resource, values);
      const saved = editingId
        ? await api.updateHRRecord(resource, editingId, input)
        : await api.createHRRecord(resource, input);
      setSelected(saved);
      closeEditor();
      await reload(editingId ? page : 1, pageSize);
      message.success(editingId ? "记录已更新，下一步处理区已刷新" : "记录已创建，已打开详情查看下一步");
    } catch (err) {
      setError(getErrorMessage(err, "记录保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const applyWorkflowAction = async (record: HRRecord, action: string, comment?: string) => {
    setActionLoading(true);
    setError("");
    try {
      const result = await api.applyHRWorkflowAction(resource, record.id, { action, comment });
      setSelected(result.record);
      setWorkflow(result.workflow);
      await reload(page, pageSize);
      message.success("审批动作已记录");
    } catch (err) {
      setError(getErrorMessage(err, "审批动作失败"));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRecord = async (record: HRRecord) => {
    setSaving(true);
    setError("");
    try {
      await api.deleteHRRecord(resource, record.id);
      setSelected(null);
      await reload(page, pageSize);
      message.success("记录已删除");
    } catch (err) {
      setError(getErrorMessage(err, "删除记录失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="domain-resource-panel" data-vc-kind="hr-resource-panel" data-vc-resource={resource}>
      <div className="domain-section-heading">
        <div>
          <Typography.Title level={4}>{resourceLabels[resource] ?? resource}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()} data-vc-action={`hr.${resource}.create`}>
          新增
        </Button>
      </div>
      <InlineError message={error} onRetry={() => reload()} />
      <HRRecordMobileCards
        records={items}
        loading={loading}
        emptyText={`暂无${resourceLabels[resource] ?? "记录"}`}
        onOpen={setSelected}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(nextPage, nextPageSize) => void reload(nextPage, nextPageSize)}
      />
      <Table
        className="hr-desktop-record-table"
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={items}
        pagination={{
          total,
          current: page,
          pageSize,
          showSizeChanger: total > 20,
          hideOnSinglePage: true,
          onChange: (nextPage, nextPageSize) => void reload(nextPage, nextPageSize),
        }}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: <EmptyBlock description={`暂无${resourceLabels[resource] ?? "记录"}`} /> }}
        onRow={(record) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": record.recordType,
          "data-vc-object-id": record.id,
          "data-vc-label": record.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "标题", dataIndex: "title", render: (text: string, record: HRRecord) => <Button type="link" onClick={() => setSelected(record)}>{text}</Button> },
          { title: "人员/组织", render: (_: unknown, record: HRRecord) => record.employeeName || record.orgUnitName || "全局范围" },
          { title: "状态", dataIndex: "status", render: (status: string) => <Tag color={statusColor(status)}>{statusLabel(status)}</Tag> },
          { title: "风险", dataIndex: "riskLevel", render: (risk: string, record: HRRecord) => <Space><Tag color={riskColor(risk)}>{riskLabel(risk)}</Tag>{record.humanReviewRequired ? <Tag color="red">人工复核</Tag> : null}</Space> },
          { title: "摘要", render: (_: unknown, record: HRRecord) => <Typography.Text type="secondary">{payloadPreview(record)}</Typography.Text> },
          { title: "更新时间", dataIndex: "updatedAt", render: (value: string) => new Date(value).toLocaleString() },
          { title: "操作", render: (_: unknown, record: HRRecord) => <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(record)} data-vc-action={`hr.${resource}.edit`}>编辑</Button> },
        ]}
      />
      <Drawer
        title={selected?.title}
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          onClearFocus?.();
        }}
        size="min(736px, 100vw)"
      >
        {selected ? (
          <Space orientation="vertical" size="middle" className="drawer-stack">
            {returnLabel && onReturn ? (
              <Button icon={<ArrowLeftOutlined />} onClick={onReturn}>
                {returnLabel}
              </Button>
            ) : null}
            {selected.humanReviewRequired || selected.riskLevel === "high" ? (
              <Alert
                showIcon
                type="warning"
                title="人工复核边界"
                description="该记录只支持预览、状态更新和审计留痕；招聘、绩效、薪资等人事影响结果必须由 HR 人工确认。"
              />
            ) : null}
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="资源">{resourceLabels[selected.resource] ?? selected.resource}</Descriptions.Item>
              <Descriptions.Item label="模块">{moduleLabels[selected.module] ?? selected.module}</Descriptions.Item>
              <Descriptions.Item label="员工">{selected.employeeName || "-"}</Descriptions.Item>
              <Descriptions.Item label="组织">{selected.orgUnitName || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor(selected.status)}>{statusLabel(selected.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label="风险"><Tag color={riskColor(selected.riskLevel)}>{riskLabel(selected.riskLevel)}</Tag></Descriptions.Item>
              <Descriptions.Item label="可见范围">{formatScope(selected.scopeType, selected.scopeId)}</Descriptions.Item>
            </Descriptions>
            <WorkflowActions
              workflow={workflow}
              loading={workflowLoading}
              actionLoading={actionLoading}
              onAction={(action, comment) => applyWorkflowAction(selected, action, comment)}
            />
            <div className="payload-section">
              <Typography.Title level={5}>业务信息</Typography.Title>
              {renderPayloadDetails(selected)}
              <details className="technical-details">
                <summary>技术详情</summary>
                <pre className="json-preview">{JSON.stringify(selected.payload, null, 2)}</pre>
              </details>
            </div>
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={() => openEditor(selected)} data-vc-action={`hr.${resource}.edit`}>
                编辑
              </Button>
              <Popconfirm
                title="删除这条记录？"
                description="删除后将从当前列表移除，并保留审计事件。"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true, loading: saving }}
                onConfirm={() => deleteRecord(selected)}
              >
                <Button danger icon={<DeleteOutlined />} loading={saving} data-vc-action={`hr.${resource}.delete`}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </Space>
        ) : null}
      </Drawer>
      <Modal
        title={editing?.id ? `编辑${resourceLabels[resource] ?? "记录"}` : `新增${resourceLabels[resource] ?? "记录"}`}
        open={!!editing}
        onCancel={closeEditor}
        onOk={() => form.submit()}
        confirmLoading={saving}
        forceRender
        width={760}
        modalRender={(node) => (
          <div
            data-vc-kind="hr-record-editor"
            data-vc-resource={resource}
            data-vc-object-type={editing?.id ? resource : undefined}
            data-vc-object-id={editing?.id}
            data-vc-label={editing?.title ?? `新增${resourceLabels[resource] ?? "记录"}`}
          >
            {node}
          </div>
        )}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveRecord}
          data-vc-kind="hr-record-form"
          data-vc-resource={resource}
        >
          {editorNotes[resource] ? (
            <Alert className="domain-alert" showIcon type="info" title={editorNotes[resource]} />
          ) : null}
          <Form.Item name="scopeType" hidden><Input /></Form.Item>
          <Form.Item name="scopeId" hidden><Input /></Form.Item>
          <Form.Item name="status" hidden><Input /></Form.Item>
          <Form.Item name="riskLevel" hidden><Input /></Form.Item>
          <Form.Item name="humanReviewRequired" hidden valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input data-vc-field={`hr.${resource}.title`} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="orgUnitId" label="关联组织">
                <Select allowClear showSearch optionFilterProp="label" loading={!!editing && !orgUnits.length} options={orgUnitOptions} data-vc-field={`hr.${resource}.org_unit`} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="employeeId" label="关联员工">
                <Select allowClear showSearch optionFilterProp="label" loading={!!editing && !employees.length} options={employeeOptions} data-vc-field={`hr.${resource}.employee`} />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            className="domain-alert"
            showIcon
            type={editing?.id ? "warning" : "success"}
            title={editing?.id ? "流程状态由详情页的下一步处理推进" : "保存后进入审批流程"}
            description={(
              <Space wrap>
                <Tag color={statusColor(editing?.status ?? "draft")}>状态：{statusLabel(editing?.status ?? "draft")}</Tag>
                <Tag color={riskColor(editing?.riskLevel ?? "medium")}>风险：{riskLabel(editing?.riskLevel ?? "medium")}</Tag>
                {editing?.humanReviewRequired ? <Tag color="red">需要人工复核</Tag> : <Tag color="green">低风险预览</Tag>}
              </Space>
            )}
          />
          {payloadFields.length ? (
            <>
              <Typography.Title level={5}>业务字段</Typography.Title>
              <Row gutter={12}>
                {payloadFields.map((field) => (
                  <Col xs={24} md={field.type === "textarea" ? 24 : 12} key={field.name}>
                    <Form.Item
                      name={["payload", field.name]}
                      label={field.label}
                      valuePropName={field.type === "switch" ? "checked" : "value"}
                      rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : undefined}
                    >
                      {renderPayloadInput(field)}
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </>
          ) : null}
        </Form>
      </Modal>
    </section>
  );
}

function QuickLinkGrid({ items }: { items: Array<{ icon: ReactNode; title: string; description: string; path: string; count?: number }> }) {
  const navigate = useNavigate();
  return (
    <div className="domain-quick-grid" data-vc-kind="quick-links">
      {items.map((item) => (
        <button key={item.path} type="button" className="quick-link-card" onClick={() => navigate(item.path)} data-vc-kind="quick-link" data-vc-label={item.title}>
          <span className="quick-link-icon">{item.icon}</span>
          <span className="quick-link-copy">
            <Typography.Text strong>{item.title}</Typography.Text>
            <Typography.Text type="secondary">{item.description}</Typography.Text>
          </span>
          {typeof item.count === "number" ? <Tag>{item.count}</Tag> : null}
        </button>
      ))}
    </div>
  );
}

function WorkbenchCueStrip({ items }: { items: Array<{ icon: ReactNode; title: string; description: string; tag: string }> }) {
  return (
    <div className="domain-cue-strip" data-vc-kind="domain-workbench-cues">
      {items.map((item) => (
        <article className="domain-cue-card" key={item.title}>
          <span className="domain-cue-icon">{item.icon}</span>
          <span className="domain-cue-copy">
            <Typography.Text strong>{item.title}</Typography.Text>
            <Typography.Text type="secondary">{item.description}</Typography.Text>
          </span>
          <Tag>{item.tag}</Tag>
        </article>
      ))}
    </div>
  );
}

function LifecycleStrip({ steps }: { steps: Array<{ title: string; description: string; risk: string }> }) {
  return (
    <div className="domain-lifecycle-strip" data-vc-kind="hr-lifecycle-strip">
      {steps.map((step, index) => (
        <article className="domain-lifecycle-step" key={step.title}>
          <span className="domain-lifecycle-index">{index + 1}</span>
          <Typography.Text strong>{step.title}</Typography.Text>
          <Typography.Text type="secondary">{step.description}</Typography.Text>
          <Tag color={riskColor(step.risk)}>{riskLabel(step.risk)}</Tag>
        </article>
      ))}
    </div>
  );
}

function DomainFrame({ title, description, module, children, alert }: { title: string; description: string; module?: string; children: ReactNode; alert?: ReactNode }) {
  const overview = useWorkbenchOverview();
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  useEffect(() => {
    let mounted = true;
    api.providerStatus()
      .then((status) => { if (mounted) setProviderStatus(status); })
      .catch(() => { if (mounted) setProviderStatus(null); });
    return () => { mounted = false; };
  }, []);
  return (
    <main className="work-domain-page" data-vc-page={title}>
      <PageTitle
        title={title}
        description={description}
        meta={(
          <Space size={8} wrap>
            {demoMode ? <Tag color="blue">演示环境</Tag> : null}
            <Tag color={providerStatus?.chatProvider === "deepseek" ? "geekblue" : "default"}>
              智能服务：{providerLabel(providerStatus?.chatProvider ?? "boundary")} / 知识检索：{providerLabel(providerStatus?.embeddingProvider)}
            </Tag>
          </Space>
        )}
      />
      <DomainStats overview={overview} module={module} />
      {alert}
      {children}
    </main>
  );
}

export function OrgPeoplePage() {
  const [counts, setCounts] = useState({ legal: 0, org: 0, employee: 0, user: 0 });
  useEffect(() => {
    let mounted = true;
    Promise.all([api.legalEntities(), api.orgUnits(), api.employees(1, 1), api.users(1, 1)])
      .then(([legal, org, employees, users]) => {
        if (mounted) setCounts({ legal: legal.length, org: org.length, employee: employees.total, user: users.total });
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  return (
    <DomainFrame title="组织与员工" description="法人、组织、员工、账号角色集中到一个组织数据大页，旧页面仍可作为子入口访问。">
      <Tabs
        items={[
          { key: "map", label: "组织入口", children: <QuickLinkGrid items={[
            { icon: <BankOutlined />, title: "法人边界", description: "维护法人边界、状态和集团层级。", path: "/app/legal-entities", count: counts.legal },
            { icon: <ApartmentOutlined />, title: "组织边界", description: "维护组织树、负责人和授权范围。", path: "/app/org-units", count: counts.org },
            { icon: <IdcardOutlined />, title: "员工数据层", description: "维护员工档案、任职和主组织。", path: "/app/employees", count: counts.employee },
            { icon: <UserOutlined />, title: "账号与角色", description: "管理登录账号、角色和可见范围绑定。", path: "/app/users", count: counts.user },
          ]} /> },
          { key: "boundary", label: "数据边界", children: <Alert showIcon type="info" title="数据边界决定谁能看、谁能处理" description="组织与员工页为所有 HRMS 工作域提供可见范围、任职和角色基础；智能任务、知识库和审计都会沿用这些边界。" /> },
        ]}
      />
    </DomainFrame>
  );
}

function EmployeeSelfServicePanel({ onCreateRequest }: { onCreateRequest: (resource: string, employeeId?: string) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [checkins, setCheckins] = useState<EmployeeCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.employees(1, 50)
      .then((page) => {
        if (!mounted) return;
        const rows = page.rows ?? [];
        setEmployees(rows);
        setSelectedEmployeeId((current) => current || rows.find((employee) => employee.id === "emp-003")?.id || rows[0]?.id || "");
      })
      .catch((err) => {
        if (mounted) setError(getErrorMessage(err, "员工列表加载失败"));
      });
    return () => { mounted = false; };
  }, []);

  const reloadSelf = async (employeeId = selectedEmployeeId) => {
    if (!employeeId) return;
    setLoading(true);
    setError("");
    try {
      const [balanceRows, checkinPage] = await Promise.all([
        api.leaveBalances(employeeId),
        api.employeeCheckins(1, 6, employeeId),
      ]);
      setBalances(balanceRows);
      setCheckins(checkinPage.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "个人事务加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reloadSelf(selectedEmployeeId); }, [selectedEmployeeId]);

  const createCheckin = async (logType: "IN" | "OUT") => {
    if (!selectedEmployeeId) return;
    setSaving(true);
    setError("");
    try {
      await api.createEmployeeCheckin({ employeeId: selectedEmployeeId, logType, source: "web" });
      await reloadSelf(selectedEmployeeId);
      message.success(logType === "IN" ? "上班签到已记录" : "下班签退已记录");
    } catch (err) {
      setError(getErrorMessage(err, "打卡失败"));
    } finally {
      setSaving(false);
    }
  };

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const annualBalance = balances.find((balance) => balance.leaveTypeCode === "annual");
  const latestCheckin = checkins[0];

  return (
    <section className="employee-self-service" data-vc-kind="employee-self-service">
      <InlineError message={error} onRetry={() => reloadSelf()} />
      <div className="employee-self-header">
        <div>
          <Typography.Title level={4}>个人考勤</Typography.Title>
          <Typography.Text type="secondary">{selectedEmployee?.primaryAssignment?.orgUnitName || "选择员工后查看打卡、余额和请求入口。"}</Typography.Text>
        </div>
        <Select
          className="employee-selector"
          value={selectedEmployeeId || undefined}
          onChange={setSelectedEmployeeId}
          options={employees.map((employee) => ({ value: employee.id, label: `${employee.name} / ${employee.employeeNo}` }))}
          loading={!employees.length}
          placeholder="选择员工"
        />
      </div>
      <div className="employee-action-grid">
        <Card className="employee-action-card" loading={loading}>
          <Space orientation="vertical" size="middle">
            <Typography.Text strong>今日打卡</Typography.Text>
            <Typography.Text type="secondary">{latestCheckin ? `${checkinLogTypeLabel(latestCheckin.logType)} · ${new Date(latestCheckin.logTime).toLocaleString()}` : "今日暂无打卡日志"}</Typography.Text>
            <Space wrap>
              <Button type="primary" icon={<LoginOutlined />} loading={saving} onClick={() => void createCheckin("IN")}>上班签到</Button>
              <Button icon={<LogoutOutlined />} loading={saving} onClick={() => void createCheckin("OUT")}>下班签退</Button>
            </Space>
          </Space>
        </Card>
        <Card className="employee-action-card" loading={loading}>
          <Space orientation="vertical" size="middle">
            <Typography.Text strong>快捷申请</Typography.Text>
            <Typography.Text type="secondary">申请提交后进入请求与审批队列。</Typography.Text>
            <Space wrap>
              <Button icon={<PlusOutlined />} onClick={() => onCreateRequest("leave-applications", selectedEmployeeId)}>请假</Button>
              <Button icon={<ClockCircleOutlined />} onClick={() => onCreateRequest("attendance-requests", selectedEmployeeId)}>补卡/外勤</Button>
              <Button icon={<FileDoneOutlined />} onClick={() => onCreateRequest("expense-claims", selectedEmployeeId)}>报销</Button>
            </Space>
          </Space>
        </Card>
        <Card className="employee-action-card" loading={loading}>
          <Statistic title="年假余额" value={annualBalance?.balanceDays ?? 0} suffix="天" />
        </Card>
        <Card className="employee-action-card" loading={loading}>
          <Statistic title="最近日志" value={checkins.length} suffix="条" />
        </Card>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="employee-ledger-panel">
            <Typography.Title level={5}>假勤余额</Typography.Title>
            <Table
              className="hr-desktop-record-table"
              rowKey={(record) => `${record.employeeId}-${record.leaveTypeCode}`}
              size="small"
              loading={loading}
              pagination={false}
              dataSource={balances}
              columns={[
                { title: "类型", dataIndex: "leaveTypeName" },
                { title: "已分配", dataIndex: "allocatedDays", render: (value: number) => `${value} 天` },
                { title: "已使用", dataIndex: "usedDays", render: (value: number) => `${value} 天` },
                { title: "余额", dataIndex: "balanceDays", render: (value: number) => <Tag color={value <= 1 ? "red" : "green"}>{value} 天</Tag> },
              ]}
            />
            <div className="hr-mobile-record-list">
              {!loading && !balances.length ? <EmptyBlock description="暂无假勤余额" /> : null}
              {balances.map((balance) => (
                <div className="hr-mobile-record-card" key={`${balance.employeeId}-${balance.leaveTypeCode}`}>
                  <span className="hr-mobile-card-title">{balance.leaveTypeName}</span>
                  <span className="hr-mobile-card-meta">已分配 {balance.allocatedDays} 天 · 已使用 {balance.usedDays} 天</span>
                  <Tag color={balance.balanceDays <= 1 ? "red" : "green"}>{balance.balanceDays} 天</Tag>
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="employee-ledger-panel">
            <Typography.Title level={5}>原始打卡日志</Typography.Title>
            <div className="employee-checkin-list">
              {checkins.map((checkin) => (
                <article className="employee-checkin-row" key={checkin.id}>
                  <Tag color={checkin.logType === "IN" ? "blue" : "purple"}>{checkinLogTypeLabel(checkin.logType)}</Tag>
                  <span>{new Date(checkin.logTime).toLocaleString()}</span>
                  <Typography.Text type="secondary">{checkinSourceLabel(checkin.source)}</Typography.Text>
                </article>
              ))}
              {!checkins.length ? <EmptyBlock description="暂无打卡日志" /> : null}
            </div>
          </div>
        </Col>
      </Row>
    </section>
  );
}

function RequestQueuePanel({ onOpenResource }: { onOpenResource: (resource: string, id?: string, options?: { from?: string }) => void }) {
  const [items, setItems] = useState<HRWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HRWorkItem | null>(null);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const page = await api.workbenchWorkItems(1, 30);
      setItems((page.rows ?? []).filter((item) => item.module === "employee_ops"));
    } catch (err) {
      setError(getErrorMessage(err, "请求队列加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const teamApprovals = items.filter((item) => item.humanReviewRequired || ["submitted", "pending", "in_review"].includes(item.status));
  const myRequests = items.filter((item) => item.employeeName);
  const sortedItems = useMemo(() => [...items].sort((a, b) => {
    const score = (item: HRWorkItem) => {
      let next = 0;
      if (item.riskLevel === "high") next += 30;
      if (item.humanReviewRequired) next += 20;
      if (["submitted", "pending", "in_review"].includes(item.status)) next += 10;
      return next;
    };
    const diff = score(b) - score(a);
    if (diff) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }), [items]);

  return (
    <section className="employee-request-queue" data-vc-kind="employee-request-queue">
      <InlineError message={error} onRetry={reload} />
      <div className="employee-action-grid">
        <Card loading={loading}><Statistic title="我的请求" value={myRequests.length} /></Card>
        <Card loading={loading}><Statistic title="团队待批" value={teamApprovals.length} /></Card>
        <Card loading={loading}><Statistic title="高风险/人审" value={items.filter((item) => item.riskLevel === "high" || item.humanReviewRequired).length} /></Card>
      </div>
      <div className="request-card-list">
        {sortedItems.map((item) => (
          <article className="request-card" key={`${item.resource}-${item.id}`} data-vc-kind="request-card" data-vc-object-type={item.recordType} data-vc-object-id={item.id}>
            <div>
              <Typography.Text strong>{item.title}</Typography.Text>
              <Typography.Paragraph type="secondary">{resourceLabels[item.resource] ?? item.resource} · {item.employeeName || item.orgUnitName || "全局范围"}</Typography.Paragraph>
            </div>
            <Space wrap>
              <Tag color={statusColor(item.status)}>{statusLabel(item.status)}</Tag>
              <Tag color={riskColor(item.riskLevel)}>{riskLabel(item.riskLevel)}</Tag>
              {item.humanReviewRequired ? <Tag color="red">人工复核</Tag> : null}
            </Space>
            <Typography.Text className="request-card-action" type="secondary">
              建议：{workActionLabel(item.action)}。{workActionReason(item.action, item.riskLevel)}
            </Typography.Text>
            <Space wrap>
              <Button size="small" onClick={() => setSelected(item)}>摘要</Button>
              <Button size="small" type="primary" icon={<ArrowRightOutlined />} onClick={() => onOpenResource(item.resource, item.id, { from: "approvals" })}>
                {workActionLabel(item.action)}
              </Button>
            </Space>
          </article>
        ))}
        {!items.length && !loading ? <EmptyBlock description="暂无员工事务请求" /> : null}
      </div>
      <Drawer
        title={selected?.title}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="min(520px, 100vw)"
      >
        {selected ? (
          <Space orientation="vertical" size="middle" className="drawer-stack">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="资源">{resourceLabels[selected.resource] ?? selected.resource}</Descriptions.Item>
              <Descriptions.Item label="人员/组织">{selected.employeeName || selected.orgUnitName || "全局范围"}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor(selected.status)}>{statusLabel(selected.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label="风险"><Tag color={riskColor(selected.riskLevel)}>{riskLabel(selected.riskLevel)}</Tag></Descriptions.Item>
              <Descriptions.Item label="建议动作">{workActionLabel(selected.action)}</Descriptions.Item>
            </Descriptions>
            <Alert showIcon type="info" title="下一步" description={`${workActionLabel(selected.action)}：${workActionReason(selected.action, selected.riskLevel)}`} />
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => {
              onOpenResource(selected.resource, selected.id, { from: "approvals" });
              setSelected(null);
            }}>
              去{resourceLabels[selected.resource] ?? selected.resource}详情处理
            </Button>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}

export function EmployeeOpsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeTabs = ["self", "approvals", "attendance", "leave", "attendance-requests", "shifts", "expenses", "salary"];
  const routeResource = searchParams.get("resource");
  const createMode = searchParams.get("mode") === "create";
  const defaultEmployeeId = searchParams.get("employeeId");
  const normalizeEmployeeTab = (tab: string | null) => {
    if (tab === "requests" || tab === "request") return "approvals";
    if (tab === "quick") return "self";
    return tab || "self";
  };
  const tabFromURL = () => {
    const tab = routeResource ? employeeOpsTabForResource(routeResource) : normalizeEmployeeTab(searchParams.get("tab"));
    return employeeTabs.includes(tab) ? tab : "self";
  };
  const [activeTab, setActiveTab] = useState(tabFromURL);
  const focusId = searchParams.get("id");

  useEffect(() => {
    const tab = tabFromURL();
    setActiveTab(tab);
    const rawTab = searchParams.get("tab");
    if (!routeResource && rawTab && rawTab !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  const changeTab = (key: string) => {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    next.delete("resource");
    next.delete("id");
    next.delete("mode");
    next.delete("employeeId");
    setSearchParams(next, { replace: true });
  };

  const openResource = (resource: string, id?: string, options?: { mode?: "create"; employeeId?: string; from?: string }) => {
    const tab = employeeOpsTabForResource(resource);
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.set("resource", resource);
    if (id) next.set("id", id);
    else next.delete("id");
    if (options?.mode) next.set("mode", options.mode);
    else next.delete("mode");
    if (options?.employeeId) next.set("employeeId", options.employeeId);
    else next.delete("employeeId");
    if (options?.from) next.set("from", options.from);
    else next.delete("from");
    setSearchParams(next, { replace: true });
  };

  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    next.delete("mode");
    next.delete("employeeId");
    next.delete("from");
    setSearchParams(next, { replace: true });
  };

  const isCreateFor = (resource: string) => createMode && routeResource === resource;
  const startCreateRequest = (resource: string, employeeId?: string) => {
    openResource(resource, undefined, { mode: "create", employeeId });
  };
  const returnToApprovals = () => changeTab("approvals");
  const returnLabel = searchParams.get("from") === "approvals" ? "返回请求与审批" : undefined;

  return (
    <DomainFrame
      title="员工事务"
      description="考勤、请假、补卡/外勤、排班、报销、工资单进入同一个事务大页，子模块用 tab 和详情抽屉承载。"
      module="employee_ops"
      alert={<Alert className="domain-alert" showIcon type="warning" title="薪资和异常考勤不会自动裁决" description="系统只展示异常上下文、资料依据和建议动作；正式审批、薪资发放和员工影响动作必须人工确认。" />}
    >
      <WorkbenchCueStrip
        items={[
          { icon: <UserOutlined />, title: "个人打卡", description: "原始签到/签退日志沉淀到考勤汇总。", tag: "员工自助" },
          { icon: <TeamOutlined />, title: "请求与审批", description: "请假、补卡、报销和工资单草稿集中流转。", tag: "审批流转" },
          { icon: <SafetyCertificateOutlined />, title: "薪资保护", description: "工资单只读预览，敏感操作保留人工确认。", tag: "受保护" },
        ]}
      />
      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: "self", label: "个人考勤", children: <EmployeeSelfServicePanel onCreateRequest={startCreateRequest} /> },
          { key: "approvals", label: "请求与审批", children: <RequestQueuePanel onOpenResource={openResource} /> },
          { key: "attendance", label: "HR 态势", children: <AttendancePage /> },
          { key: "leave", label: "请假", children: <HRResourcePanel resource="leave-applications" description="请假申请、额度消耗和审批状态。" focusId={activeTab === "leave" ? focusId : null} createMode={isCreateFor("leave-applications")} defaultEmployeeId={defaultEmployeeId} returnLabel={returnLabel} onReturn={returnToApprovals} onClearFocus={clearFocus} /> },
          { key: "attendance-requests", label: "补卡/外勤", children: <HRResourcePanel resource="attendance-requests" description="补卡、外勤和异常考勤解释上下文。" focusId={activeTab === "attendance-requests" ? focusId : null} createMode={isCreateFor("attendance-requests")} defaultEmployeeId={defaultEmployeeId} returnLabel={returnLabel} onReturn={returnToApprovals} onClearFocus={clearFocus} /> },
          { key: "shifts", label: "排班", children: <HRResourcePanel resource="shift-assignments" description="班次、排班范围和员工事务关联上下文。" focusId={activeTab === "shifts" ? focusId : null} returnLabel={returnLabel} onReturn={returnToApprovals} onClearFocus={clearFocus} /> },
          { key: "expenses", label: "报销", children: <HRResourcePanel resource="expense-claims" description="报销申请、金额摘要和审批状态。" focusId={activeTab === "expenses" ? focusId : null} createMode={isCreateFor("expense-claims")} defaultEmployeeId={defaultEmployeeId} returnLabel={returnLabel} onReturn={returnToApprovals} onClearFocus={clearFocus} /> },
          { key: "salary", label: "工资单", children: <HRResourcePanel resource="salary-slips" description="工资单草稿、风险边界和人工复核状态。" focusId={activeTab === "salary" ? focusId : null} returnLabel={returnLabel} onReturn={returnToApprovals} onClearFocus={clearFocus} /> },
        ]}
      />
    </DomainFrame>
  );
}

export function RecruitmentLifecyclePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const recruitmentTabs = ["requisitions", "openings", "applicants", "interviews", "offers"];
  const normalizeRecruitmentTab = (tab: string | null) => {
    if (tab === "requirements" || tab === "requirement") return "requisitions";
    if (tab === "candidates" || tab === "candidate") return "applicants";
    if (tab === "interview") return "interviews";
    if (tab === "offer") return "offers";
    return tab || "requisitions";
  };
  const tabFromURL = () => {
    const resource = searchParams.get("resource");
    const tab = resource ? recruitmentTabForResource(resource) : normalizeRecruitmentTab(searchParams.get("tab"));
    return recruitmentTabs.includes(tab) ? tab : "requisitions";
  };
  const [activeTab, setActiveTab] = useState(tabFromURL);
  const focusId = searchParams.get("id");

  useEffect(() => {
    const tab = tabFromURL();
    setActiveTab(tab);
    const rawTab = searchParams.get("tab");
    if (!searchParams.get("resource") && rawTab && rawTab !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  const changeTab = (key: string) => {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    next.delete("resource");
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  return (
    <DomainFrame
      title="招聘与生命周期"
      description="招聘需求、职位、候选人、面试、Offer 和入离职事件集中展示；一期实现真实表与 CRUD，不自动做录用裁决。"
      module="recruitment_lifecycle"
      alert={<Alert className="domain-alert" showIcon type="warning" title="招聘公平性边界" description="候选人筛选、面试评分和 Offer 建议属于高风险人事影响场景，AI 只能辅助整理证据并请求人工复核。" />}
    >
      <LifecycleStrip
        steps={[
          { title: "招聘需求", description: "确认 HC、预算和业务必要性。", risk: "medium" },
          { title: "职位发布", description: "沉淀岗位要求、渠道和范围。", risk: "medium" },
          { title: "候选人", description: "记录阶段、来源和公平性检查。", risk: "high" },
          { title: "面试", description: "只整理证据与反馈，不自动评分裁决。", risk: "high" },
          { title: "Offer", description: "生成草案并等待薪酬与 HR 人工确认。", risk: "high" },
        ]}
      />
      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: "requisitions", label: "招聘需求", children: <HRResourcePanel resource="job-requisitions" description="HC、预算、期望入职时间和审批状态。" focusId={activeTab === "requisitions" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "openings", label: "职位", children: <HRResourcePanel resource="job-openings" description="职位发布、渠道、薪资范围和关闭日期。" focusId={activeTab === "openings" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "applicants", label: "候选人", children: <HRResourcePanel resource="job-applicants" description="候选人阶段、来源和公平性审计边界。" focusId={activeTab === "applicants" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "interviews", label: "面试", children: <HRResourcePanel resource="interviews" description="面试安排、评分草稿和人工复核。" focusId={activeTab === "interviews" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "offers", label: "Offer", children: <HRResourcePanel resource="job-offers" description="Offer 草稿、薪酬确认和入职日期。" focusId={activeTab === "offers" ? focusId : null} onClearFocus={clearFocus} /> },
        ]}
      />
    </DomainFrame>
  );
}

export function GrowthPerformancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const growthTabs = ["quick", "training", "goals", "cycles", "appraisals"];
  const normalizeGrowthTab = (tab: string | null) => {
    if (tab === "co-growth" || tab === "mission" || tab === "missions") return "quick";
    if (tab === "goal") return "goals";
    if (tab === "cycle") return "cycles";
    if (tab === "appraisal") return "appraisals";
    return tab || "quick";
  };
  const tabFromURL = () => {
    const resource = searchParams.get("resource");
    const tab = resource ? growthTabForResource(resource) : normalizeGrowthTab(searchParams.get("tab"));
    return growthTabs.includes(tab) ? tab : "quick";
  };
  const [activeTab, setActiveTab] = useState(tabFromURL);
  const focusId = searchParams.get("id");

  useEffect(() => {
    const tab = tabFromURL();
    setActiveTab(tab);
    const rawTab = searchParams.get("tab");
    if (!searchParams.get("resource") && rawTab && rawTab !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  const changeTab = (key: string) => {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    next.delete("resource");
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  return (
      <DomainFrame
        title="成长与绩效"
      description="培训、共生成长、目标、绩效周期和反馈合并为成长绩效大页，用证据和人工复核承载人事影响边界。"
      module="growth_performance"
      alert={<Alert className="domain-alert" showIcon type="info" title="绩效只做证据化预览" description="绩效评分、校准和最终结论不得由 AI 自动裁决；系统保留目标、反馈、引用和审计轨迹。" />}
    >
      <WorkbenchCueStrip
        items={[
          { icon: <BookOutlined />, title: "培训证据", description: "培训活动与制度资料、学习结果和参与范围绑定。", tag: "学习证据" },
          { icon: <SafetyCertificateOutlined />, title: "共生成长", description: "AI 素养、任务、工作日志和成长证据沉淀。", tag: "人机协作" },
          { icon: <CheckCircleOutlined />, title: "目标与评估", description: "目标、反馈和绩效材料只做证据化预览。", tag: "人工判断" },
        ]}
      />
      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          { key: "quick", label: "成长入口", children: <QuickLinkGrid items={[
            { icon: <BookOutlined />, title: "学习证据", description: "课程、学习任务和知识资料绑定。", path: "/app/learning" },
            { icon: <SafetyCertificateOutlined />, title: "共生成长", description: "员工成长任务和证据复盘。", path: "/co-growth" },
          ]} /> },
          { key: "training", label: "培训", children: <HRResourcePanel resource="training-events" description="培训活动、参与范围和结果证据。" focusId={activeTab === "training" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "goals", label: "目标", children: <HRResourcePanel resource="performance-goals" description="个人/团队目标、进度和证据要求。" focusId={activeTab === "goals" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "cycles", label: "绩效周期", children: <HRResourcePanel resource="appraisal-cycles" description="绩效周期、公式说明和校准边界。" focusId={activeTab === "cycles" ? focusId : null} onClearFocus={clearFocus} /> },
          { key: "appraisals", label: "绩效评估", children: <HRResourcePanel resource="appraisals" description="自评、反馈和最终人工复核状态。" focusId={activeTab === "appraisals" ? focusId : null} onClearFocus={clearFocus} /> },
        ]}
      />
    </DomainFrame>
  );
}

export function KnowledgeAgentPage() {
  return (
    <DomainFrame title="知识与智能体" description="AI 指挥、知识治理、文档库、智能体运行和圈选助手统一作为知识与动作草稿大页。">
      <QuickLinkGrid items={[
        { icon: <RobotOutlined />, title: "AI 指挥中心", description: "组织查询、知识引用和智能任务预览入口。", path: "/app/ai-command" },
        { icon: <DatabaseOutlined />, title: "知识治理", description: "资料来源、可信等级和敏感范围。", path: "/app/knowledge" },
        { icon: <FileSearchOutlined />, title: "文档库", description: "阅读文档正文、引用边界和资料问答。", path: "/app/docs" },
        { icon: <TeamOutlined />, title: "智能体运行控制", description: "运行预览、动作草稿和人工确认。", path: "/app/agents" },
      ]} />
    </DomainFrame>
  );
}

export function TrustAuditPage() {
  const navigate = useNavigate();
  const [workItems, setWorkItems] = useState<HRWorkItem[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [items, audit] = await Promise.all([api.workbenchWorkItems(1, 20), api.auditEvents(1, 20)]);
      setWorkItems(items.rows ?? []);
      setEvents(audit.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "信任与审计加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const highRiskCount = useMemo(() => workItems.filter((item) => item.riskLevel === "high" || item.humanReviewRequired).length, [workItems]);

  return (
    <DomainFrame
      title="信任与审计"
      description="人工复核、高风险阻断、动作草稿、知识引用和审计事件在这里集中回溯。"
      alert={<Alert className="domain-alert" showIcon type="warning" title="所有人事影响动作必须留痕" description="本页优先展示待人工复核、高风险阻断和审计链路，支持跳回业务大页处理。" />}
    >
      <InlineError message={error} onRetry={reload} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="人工复核队列" extra={<Tag color="red">{highRiskCount}</Tag>} data-vc-kind="human-review-queue">
            <Table
              className="hr-desktop-record-table"
              rowKey={(record) => `${record.resource}-${record.id}`}
              size="small"
              loading={loading}
              dataSource={workItems}
              pagination={false}
              locale={{ emptyText: <EmptyBlock description="暂无待复核事项" /> }}
              columns={[
                { title: "事项", dataIndex: "title" },
                { title: "模块", dataIndex: "module", render: (module: string) => moduleLabels[module] ?? module },
                { title: "风险", dataIndex: "riskLevel", render: (risk: string) => <Tag color={riskColor(risk)}>{riskLabel(risk)}</Tag> },
                { title: "动作", dataIndex: "action", render: (action: string) => workActionLabel(action) },
                { title: "处理", render: (_: unknown, item: HRWorkItem) => <Button size="small" type="primary" onClick={() => navigate(workItemRoute(item))}>去处理</Button> },
              ]}
            />
            <div className="hr-mobile-record-list">
              {loading ? <Card loading className="hr-mobile-record-card" /> : null}
              {!loading && !workItems.length ? <EmptyBlock description="暂无待复核事项" /> : null}
              {workItems.map((item) => (
                <article className="hr-mobile-record-card" key={`${item.resource}-${item.id}`}>
                  <span className="hr-mobile-card-title">{item.title}</span>
                  <span className="hr-mobile-card-meta">{moduleLabels[item.module] ?? item.module} · {item.employeeName || item.orgUnitName || item.recordType}</span>
                  <span className="hr-mobile-card-tags">
                    <Tag color={statusColor(item.status)}>{statusLabel(item.status)}</Tag>
                    <Tag color={riskColor(item.riskLevel)}>{riskLabel(item.riskLevel)}</Tag>
                    {item.humanReviewRequired ? <Tag color="red">人工复核</Tag> : null}
                  </span>
                  <Typography.Text type="secondary">{workActionLabel(item.action)}</Typography.Text>
                  <Button size="small" type="primary" onClick={() => navigate(workItemRoute(item))}>去处理</Button>
                </article>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="审计事件" data-vc-kind="audit-event-list">
            <Table
              className="hr-desktop-record-table"
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={events}
              pagination={false}
              locale={{ emptyText: <EmptyBlock description="暂无审计事件" /> }}
              columns={[
                { title: "事件", dataIndex: "eventType" },
                { title: "对象", render: (_: unknown, event: AuditEvent) => `${event.objectType}/${event.objectId}` },
                { title: "风险", dataIndex: "riskLevel", render: (risk: string) => <Tag color={riskColor(risk)}>{riskLabel(risk)}</Tag> },
              ]}
            />
            <div className="hr-mobile-record-list">
              {loading ? <Card loading className="hr-mobile-record-card" /> : null}
              {!loading && !events.length ? <EmptyBlock description="暂无审计事件" /> : null}
              {events.map((event) => (
                <article className="hr-mobile-record-card" key={event.id}>
                  <span className="hr-mobile-card-title">{event.eventType}</span>
                  <span className="hr-mobile-card-meta">{event.objectType}/{event.objectId}</span>
                  <span className="hr-mobile-card-tags">
                    <Tag color={riskColor(event.riskLevel)}>{riskLabel(event.riskLevel)}</Tag>
                    <Tag>{new Date(event.createdAt).toLocaleString()}</Tag>
                  </span>
                </article>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
      <Space className="toolbar">
        <Button icon={<AuditOutlined />} onClick={() => navigate("/app/audit")}>打开完整审计页</Button>
        <Button icon={<SearchOutlined />} onClick={reload}>刷新</Button>
      </Space>
    </DomainFrame>
  );
}
