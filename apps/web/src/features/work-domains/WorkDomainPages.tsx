import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import type { AIProviderStatus, AuditEvent, HRRecord, HRRecordInput, HRWorkItem, WorkbenchOverview } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { AttendancePage } from "../employees/AttendancePage";

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
  "training-events": "Training",
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

function riskColor(risk: string) {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "green";
}

function statusColor(status: string) {
  if (["approved", "completed", "closed"].includes(status)) return "green";
  if (["draft", "planned", "scheduled"].includes(status)) return "blue";
  if (["rejected", "blocked"].includes(status)) return "red";
  return "gold";
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
  return keys.slice(0, 4).map((key) => `${key}=${String(record.payload[key])}`).join(" · ");
}

function HRResourcePanel({ resource, description }: { resource: string; description: string }) {
  const [items, setItems] = useState<HRRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HRRecord | null>(null);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.hrRecords(resource, 1, 20);
      setItems(result.rows ?? []);
      setTotal(result.total);
    } catch (err) {
      setError(getErrorMessage(err, `${resourceLabels[resource]}加载失败`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [resource]);

  const createSample = async () => {
    setSaving(true);
    setError("");
    try {
      await api.createHRRecord(resource, sampleInputs[resource] ?? { title: resourceLabels[resource] ?? resource });
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "创建演示记录失败"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (record: HRRecord, status: string) => {
    setSaving(true);
    setError("");
    try {
      const saved = await api.updateHRRecord(resource, record.id, {
        title: record.title,
        employeeId: record.employeeId,
        orgUnitId: record.orgUnitId,
        scopeType: record.scopeType,
        scopeId: record.scopeId,
        riskLevel: record.riskLevel,
        humanReviewRequired: record.humanReviewRequired,
        status,
        payload: record.payload,
      });
      setSelected(saved);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "状态更新失败"));
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
        <Button icon={<PlusOutlined />} type="primary" loading={saving} onClick={createSample} data-vc-action={`hr.${resource}.create`}>
          新增
        </Button>
      </div>
      <InlineError message={error} onRetry={reload} />
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        dataSource={items}
        pagination={{ total, pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: <EmptyBlock description={`暂无${resourceLabels[resource] ?? "记录"}`} /> }}
        onRow={(record) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": record.recordType,
          "data-vc-object-id": record.id,
          "data-vc-label": record.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "标题", dataIndex: "title", render: (text: string, record: HRRecord) => <Button type="link" onClick={() => setSelected(record)}>{text}</Button> },
          { title: "人员/组织", render: (_: unknown, record: HRRecord) => record.employeeName || record.orgUnitName || "global" },
          { title: "状态", dataIndex: "status", render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag> },
          { title: "风险", dataIndex: "riskLevel", render: (risk: string, record: HRRecord) => <Space><Tag color={riskColor(risk)}>{risk}</Tag>{record.humanReviewRequired ? <Tag color="red">human review</Tag> : null}</Space> },
          { title: "摘要", render: (_: unknown, record: HRRecord) => <Typography.Text type="secondary">{payloadPreview(record)}</Typography.Text> },
          { title: "更新时间", dataIndex: "updatedAt", render: (value: string) => new Date(value).toLocaleString() },
        ]}
      />
      <Drawer
        title={selected?.title}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="large"
      >
        {selected ? (
          <Space orientation="vertical" size="middle" className="drawer-stack">
            {selected.humanReviewRequired || selected.riskLevel === "high" ? (
              <Alert
                showIcon
                type="warning"
                title="Human review boundary"
                description="该记录只支持预览、状态更新和审计留痕；招聘、绩效、薪资等人事影响结果必须由 HR 人工确认。"
              />
            ) : null}
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="资源">{resourceLabels[selected.resource] ?? selected.resource}</Descriptions.Item>
              <Descriptions.Item label="模块">{moduleLabels[selected.module] ?? selected.module}</Descriptions.Item>
              <Descriptions.Item label="员工">{selected.employeeName || "-"}</Descriptions.Item>
              <Descriptions.Item label="组织">{selected.orgUnitName || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColor(selected.status)}>{selected.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="风险"><Tag color={riskColor(selected.riskLevel)}>{selected.riskLevel}</Tag></Descriptions.Item>
              <Descriptions.Item label="Scope">{selected.scopeType}{selected.scopeId ? `/${selected.scopeId}` : ""}</Descriptions.Item>
            </Descriptions>
            <pre className="json-preview">{JSON.stringify(selected.payload, null, 2)}</pre>
            <Space wrap>
              <Button loading={saving} onClick={() => updateStatus(selected, selected.status === "approved" ? "submitted" : "approved")} data-vc-action={`hr.${resource}.approve`}>
                标记审批
              </Button>
              <Button loading={saving} onClick={() => updateStatus(selected, "waiting_human_review")} data-vc-action={`hr.${resource}.human-review`}>
                请求人工复核
              </Button>
            </Space>
          </Space>
        ) : null}
      </Drawer>
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
              AI {providerStatus?.chatProvider ?? "boundary"} / RAG {providerStatus?.embeddingProvider ?? "unknown"}
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
            { icon: <BankOutlined />, title: "法人 Scope", description: "维护法人边界、状态和集团层级。", path: "/app/legal-entities", count: counts.legal },
            { icon: <ApartmentOutlined />, title: "组织 Scope", description: "维护组织树、负责人和授权范围。", path: "/app/org-units", count: counts.org },
            { icon: <IdcardOutlined />, title: "员工数据层", description: "维护员工档案、任职和主组织。", path: "/app/employees", count: counts.employee },
            { icon: <UserOutlined />, title: "账号与角色", description: "管理登录账号、角色和 scope 绑定。", path: "/app/users", count: counts.user },
          ]} /> },
          { key: "boundary", label: "Scope 边界", children: <Alert showIcon type="info" title="Scope is the data boundary" description="组织与员工页为所有 HRMS 工作域提供 scope、任职和角色基础；Agent、RAG、审计会沿用这些边界。" /> },
        ]}
      />
    </DomainFrame>
  );
}

export function EmployeeOpsPage() {
  return (
    <DomainFrame
      title="员工事务"
      description="考勤、请假、补卡/外勤、排班、报销、工资单进入同一个事务大页，子模块用 tab 和详情抽屉承载。"
      module="employee_ops"
      alert={<Alert className="domain-alert" showIcon type="warning" title="薪资和异常考勤不会自动裁决" description="AI 只展示异常上下文、RAG 证据和建议动作；正式审批、薪资发放和员工影响动作必须人工确认。" />}
    >
      <Tabs
        items={[
          { key: "quick", label: "Quick Links", children: <QuickLinkGrid items={[
            { icon: <ClockCircleOutlined />, title: "考勤态势", description: "实时考勤、异常和 AI 分析预览。", path: "/app/attendance" },
            { icon: <CheckCircleOutlined />, title: "My Requests", description: "请假、补卡、报销等个人请求。", path: "/app/employee-ops" },
            { icon: <TeamOutlined />, title: "Team Requests", description: "团队待审批和人工复核队列。", path: "/app/dashboard" },
          ]} /> },
          { key: "attendance", label: "考勤态势", children: <AttendancePage /> },
          { key: "leave", label: "请假", children: <HRResourcePanel resource="leave-applications" description="请假申请、额度消耗和审批状态。" /> },
          { key: "requests", label: "补卡/外勤", children: <HRResourcePanel resource="attendance-requests" description="补卡、外勤和异常考勤解释上下文。" /> },
          { key: "shifts", label: "排班", children: <HRResourcePanel resource="shift-assignments" description="班次、排班范围和员工事务关联上下文。" /> },
          { key: "expenses", label: "报销", children: <HRResourcePanel resource="expense-claims" description="报销申请、金额摘要和审批状态。" /> },
          { key: "salary", label: "工资单", children: <HRResourcePanel resource="salary-slips" description="工资单草稿、风险边界和人工复核状态。" /> },
        ]}
      />
    </DomainFrame>
  );
}

export function RecruitmentLifecyclePage() {
  return (
    <DomainFrame
      title="招聘与生命周期"
      description="招聘需求、职位、候选人、面试、Offer 和入离职事件集中展示；一期实现真实表与 CRUD，不自动做录用裁决。"
      module="recruitment_lifecycle"
      alert={<Alert className="domain-alert" showIcon type="warning" title="招聘公平性边界" description="候选人筛选、面试评分和 Offer 建议属于高风险人事影响场景，AI 只能辅助整理证据并请求人工复核。" />}
    >
      <Tabs
        items={[
          { key: "requisitions", label: "招聘需求", children: <HRResourcePanel resource="job-requisitions" description="HC、预算、期望入职时间和审批状态。" /> },
          { key: "openings", label: "职位", children: <HRResourcePanel resource="job-openings" description="职位发布、渠道、薪资范围和关闭日期。" /> },
          { key: "applicants", label: "候选人", children: <HRResourcePanel resource="job-applicants" description="候选人阶段、来源和公平性审计边界。" /> },
          { key: "interviews", label: "面试", children: <HRResourcePanel resource="interviews" description="面试安排、评分草稿和人工复核。" /> },
          { key: "offers", label: "Offer", children: <HRResourcePanel resource="job-offers" description="Offer 草稿、薪酬确认和入职日期。" /> },
        ]}
      />
    </DomainFrame>
  );
}

export function GrowthPerformancePage() {
  return (
    <DomainFrame
      title="成长与绩效"
      description="Training、Co-Growth、目标、绩效周期和反馈合并为成长绩效大页，用证据和人工复核承载人事影响边界。"
      module="growth_performance"
      alert={<Alert className="domain-alert" showIcon type="info" title="绩效只做证据化预览" description="绩效评分、校准和最终结论不得由 AI 自动裁决；系统保留目标、反馈、引用和审计轨迹。" />}
    >
      <Tabs
        items={[
          { key: "quick", label: "成长入口", children: <QuickLinkGrid items={[
            { icon: <BookOutlined />, title: "学习证据", description: "课程、学习任务和 RAG 资料绑定。", path: "/app/learning" },
            { icon: <SafetyCertificateOutlined />, title: "Co-Growth", description: "员工成长 mission 和证据复盘。", path: "/co-growth" },
          ]} /> },
          { key: "training", label: "Training", children: <HRResourcePanel resource="training-events" description="培训活动、参与范围和结果证据。" /> },
          { key: "goals", label: "目标", children: <HRResourcePanel resource="performance-goals" description="个人/团队目标、进度和证据要求。" /> },
          { key: "cycles", label: "绩效周期", children: <HRResourcePanel resource="appraisal-cycles" description="绩效周期、公式说明和校准边界。" /> },
          { key: "appraisals", label: "绩效评估", children: <HRResourcePanel resource="appraisals" description="自评、反馈和最终人工复核状态。" /> },
        ]}
      />
    </DomainFrame>
  );
}

export function KnowledgeAgentPage() {
  return (
    <DomainFrame title="知识与 Agent" description="AI 指挥、知识治理、文档库、Agent 运行和 Visual Copilot 统一作为知识与执行预览大页。">
      <QuickLinkGrid items={[
        { icon: <RobotOutlined />, title: "AI 指挥中心", description: "程序化查询、RAG 和 Agent 预览入口。", path: "/app/ai-command" },
        { icon: <DatabaseOutlined />, title: "知识治理", description: "资料来源、可信等级和敏感范围。", path: "/app/knowledge" },
        { icon: <FileSearchOutlined />, title: "文档库", description: "阅读文档正文、引用边界和 RAG 问答。", path: "/app/docs" },
        { icon: <TeamOutlined />, title: "Agent 运行控制", description: "Agent run、工具预览和人工确认。", path: "/app/agents" },
      ]} />
    </DomainFrame>
  );
}

export function TrustAuditPage() {
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
      description="人工复核、高风险阻断、工具预览、RAG 引用和审计事件在这里集中回溯。"
      alert={<Alert className="domain-alert" showIcon type="warning" title="所有人事影响动作必须留痕" description="本页优先展示待人工复核、高风险阻断和审计链路，支持跳回业务大页处理。" />}
    >
      <InlineError message={error} onRetry={reload} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="人工复核队列" extra={<Tag color="red">{highRiskCount}</Tag>} data-vc-kind="human-review-queue">
            <Table
              rowKey={(record) => `${record.resource}-${record.id}`}
              size="small"
              loading={loading}
              dataSource={workItems}
              pagination={false}
              locale={{ emptyText: <EmptyBlock description="暂无待复核事项" /> }}
              columns={[
                { title: "事项", dataIndex: "title" },
                { title: "模块", dataIndex: "module", render: (module: string) => moduleLabels[module] ?? module },
                { title: "风险", dataIndex: "riskLevel", render: (risk: string) => <Tag color={riskColor(risk)}>{risk}</Tag> },
                { title: "动作", dataIndex: "action" },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="审计事件" data-vc-kind="audit-event-list">
            <Table
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={events}
              pagination={false}
              locale={{ emptyText: <EmptyBlock description="暂无审计事件" /> }}
              columns={[
                { title: "事件", dataIndex: "eventType" },
                { title: "对象", render: (_: unknown, event: AuditEvent) => `${event.objectType}/${event.objectId}` },
                { title: "风险", dataIndex: "riskLevel", render: (risk: string) => <Tag color={riskColor(risk)}>{risk}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Space className="toolbar">
        <Button icon={<AuditOutlined />} onClick={() => window.location.assign("/app/audit")}>打开完整审计页</Button>
        <Button icon={<SearchOutlined />} onClick={reload}>刷新</Button>
      </Space>
    </DomainFrame>
  );
}
