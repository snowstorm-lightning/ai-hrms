import {
  ApartmentOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileSearchOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Input, Progress, Row, Segmented, Space, Statistic, Table, Tag, Timeline, Typography } from "antd";
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { AgentRun, AuditEvent, Employee, HRWorkItem, LegalEntity, LearningRecommendation, OrgUnit, RAGDocument } from "../../api/types";
import { CollaborationRubric, CollaborationWorkflow, RiskTag, TrustMetaBar } from "../../components/AiTrust";
import { PageLoading } from "../../components/PageLoading";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { TaskPath } from "../../components/TaskFlow";
import { useI18n } from "../../i18n";
import { workItemRoute } from "../work-domains/hrNavigation";

type Persona = "hr" | "employee" | "mentor" | "manager";

const SignalColumn = lazy(async () => {
  const module = await import("@ant-design/charts");
  return { default: module.Column as ComponentType<Record<string, unknown>> };
});

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [workItems, setWorkItems] = useState<HRWorkItem[]>([]);
  const [persona, setPersona] = useState<Persona>("hr");
  const [command, setCommand] = useState("为新人生成 30 天成长计划，并标注证据、风险和人工确认点");
  const [commandPreview, setCommandPreview] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [entities, units, employeePage] = await Promise.all([
        api.legalEntities(),
        api.orgUnits(),
        api.employees(1, 8),
      ]);
      const [docPage, runPage, auditPage, recommendationPage, workItemPage] = await Promise.all([
        safe(api.ragDocuments(1, 20), { total: 0, rows: [] }),
        safe(api.agentRuns(1, 20), { total: 0, rows: [] }),
        safe(api.auditEvents(1, 50), { total: 0, rows: [] }),
        safe(api.learningRecommendations(1, 20), { total: 0, rows: [] }),
        safe(api.workbenchWorkItems(1, 12), { total: 0, rows: [] }),
      ]);
      setLegalEntities(entities);
      setOrgUnits(units);
      setEmployees(employeePage.rows ?? []);
      setRagDocuments(docPage.rows ?? []);
      setAgentRuns(runPage.rows ?? []);
      setAuditEvents(auditPage.rows ?? []);
      setRecommendations(recommendationPage.rows ?? []);
      setWorkItems(workItemPage.rows ?? []);
    } catch {
      setError(t("dashboard.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [t]);

  const demoTour = useMemo(() => language === "en-US" ? [
    { title: "Command Dashboard", path: "/app/dashboard", summary: "Unified entry for org data, AI command, knowledge, growth, agents, and audit." },
    { title: "AI Command Center", path: "/app/ai-command", summary: "Generate structured HR suggestions with risk, confidence, and evidence." },
    { title: "Document Library", path: "/app/docs", summary: "Read governed references and run precise RAG citation answers." },
    { title: "Co-Growth Engine", path: "/co-growth", summary: "Turn simulated work into AI learning missions and reflection evidence." },
    { title: "Agent Run Center", path: "/app/agents", summary: "Preview agent runs, tool calls, and human confirmation states." },
    { title: "Trust & Audit", path: "/app/audit", summary: "Trace suggestions, confirmations, evidence, and high-risk blocks." },
  ] : [
    { title: "指挥看板", path: "/app/dashboard", summary: "统一入口：组织数据、AI 指挥、知识、成长、Agent 和审计。" },
    { title: "AI 指挥中心", path: "/app/ai-command", summary: "生成结构化 HR 建议，展示风险、置信度和证据。" },
    { title: "文档库", path: "/app/docs", summary: "阅读受治理资料，并用 RAG 生成精准引用回答。" },
    { title: "共生成长引擎", path: "/co-growth", summary: "员工学习 AI 原理，把模拟工作转成 mission 并复盘。" },
    { title: "Agent 运行中心", path: "/app/agents", summary: "预览 Agent run、工具调用和人工确认状态。" },
    { title: "信任与审计", path: "/app/audit", summary: "追踪 AI 建议、人工确认、证据和高风险阻断。" },
  ], [language]);

  const reviewerScenarios = useMemo(() => language === "en-US" ? [
    { title: "30-day onboarding plan", path: "/app/ai-command", tag: "AI Command", text: "Generate a plan with citations, risk, tool preview, and human review." },
    { title: "Attendance exception review", path: "/app/attendance", tag: "Agent Preview", text: "Drill into attendance signals and run read-only Agent analysis." },
    { title: "RAG citation answer", path: "/app/docs", tag: "Knowledge", text: "Ask a policy question and inspect scope, trust, sensitivity, and citations." },
    { title: "Agent run audit trail", path: "/app/agents", tag: "Audit", text: "Preview tool calls, request human confirmation, and trace audit status." },
  ] : [
    { title: "新人 30 天成长计划", path: "/app/ai-command", tag: "AI 指挥", text: "生成带引用、风险、工具预览和人工复核的治理型建议。" },
    { title: "考勤异常复核", path: "/app/attendance", tag: "Agent 预览", text: "下钻考勤信号，运行只读 Agent 分析，不做人事裁决。" },
    { title: "RAG 引用问答", path: "/app/docs", tag: "知识治理", text: "查看 scope、可信等级、敏感级别、citation 和资料详情。" },
    { title: "Agent 运行审计", path: "/app/agents", tag: "审计闭环", text: "预览工具调用、请求人工确认，并追踪审计状态。" },
  ], [language]);

  const evidenceChain = useMemo(() => language === "en-US" ? [
    "governed document",
    "RAG citation",
    "AI answer",
    "tool preview",
    "human review",
    "audit event",
  ] : [
    "治理资料",
    "RAG 引用",
    "AI 建议",
    "工具预览",
    "人工复核",
    "审计事件",
  ], [language]);

  const systemLayers = useMemo(() => language === "en-US" ? [
    { icon: <ApartmentOutlined />, title: "Organization Data Layer", text: "Employees, org units, legal entities, roles, attendance, and messages.", risk: "low" },
    { icon: <DatabaseOutlined />, title: "Knowledge & Learning Layer", text: "Governed knowledge, RAG citations, courses, and Co-Growth.", risk: "medium" },
    { icon: <RobotOutlined />, title: "Agent Collaboration Layer", text: "AI Command, agent runs, Visual Copilot, and workflow preview.", risk: "medium" },
    { icon: <SafetyCertificateOutlined />, title: "Governance & Trust Layer", text: "Risk, confidence, evidence, citation, human review, and audit.", risk: "high" },
    { icon: <ThunderboltOutlined />, title: "Human-AI Co-evolution Layer", text: "People set goals, AI drafts, agents preview actions, people confirm and reflect.", risk: "low" },
  ] : [
    { icon: <ApartmentOutlined />, title: "组织数据层", text: "员工、组织、法人、角色、考勤和消息。", risk: "low" },
    { icon: <DatabaseOutlined />, title: "知识与学习层", text: "受控知识库、RAG 引用、课程和共生成长。", risk: "medium" },
    { icon: <RobotOutlined />, title: "智能体协作层", text: "AI 指挥中心、Agent 运行、Visual Copilot 和工作流预览。", risk: "medium" },
    { icon: <SafetyCertificateOutlined />, title: "治理与信任层", text: "风险、置信度、证据、引用、人工复核和审计。", risk: "high" },
    { icon: <ThunderboltOutlined />, title: "人机共进层", text: "人提出目标，AI 生成建议，Agent 预览动作，人确认并复盘。", risk: "low" },
  ], [language]);

  const highlightEntries = useMemo(() => language === "en-US" ? [
    { title: "AI Command Center", path: "/app/ai-command", icon: <RobotOutlined />, text: "Ask, search, generate plans, and preview actions." },
    { title: "Document Library", path: "/app/docs", icon: <FileSearchOutlined />, text: "Read references and ask citation-backed questions." },
    { title: "Co-Growth Engine", path: "/co-growth", icon: <ExperimentOutlined />, text: "AI-HRMS growth engine for human-agent learning." },
    { title: "Agent Run Center", path: "/app/agents", icon: <TeamOutlined />, text: "Agent runs, tool previews, confirmation, and audit status." },
    { title: "Trust & Audit Layer", path: "/app/audit", icon: <AuditOutlined />, text: "Connect suggestions, tool calls, review, and evidence." },
    { title: "Visual Copilot", path: "/app/docs", icon: <EyeOutlined />, text: "Text-only: chat or selected page business objects, no screenshots." },
  ] : [
    { title: "AI 指挥中心", path: "/app/ai-command", icon: <RobotOutlined />, text: "问组织、查知识、生成计划、预览动作。" },
    { title: "文档库", path: "/app/docs", icon: <FileSearchOutlined />, text: "阅读资料，并用 RAG 精准回答引用问题。" },
    { title: "共生成长引擎", path: "/co-growth", icon: <ExperimentOutlined />, text: "AI-HRMS 的人机共生成长引擎。" },
    { title: "Agent 运行中心", path: "/app/agents", icon: <TeamOutlined />, text: "Agent 运行、工具预览、人工确认和审计状态。" },
    { title: "信任与审计层", path: "/app/audit", icon: <AuditOutlined />, text: "把建议、工具调用、人工确认和证据串起来。" },
    { title: "Visual Copilot", path: "/app/docs", icon: <EyeOutlined />, text: "text-only：普通问答走 RAG，圈选只携带 layout hints，不上传截图。" },
  ], [language]);

  const personaValue = useMemo<Record<Persona, string[]>>(() => language === "en-US" ? ({
    hr: ["Review organization trends and high-risk confirmations", "Use evidence for policy explanations and learning plans", "Audit AI suggestions instead of executing them directly"],
    employee: ["Receive AI learning missions tied to simulated work", "Record prompts, AI output, human edits, and validation", "Collect growth evidence into a portfolio"],
    mentor: ["Review reflection and high-risk learning suggestions", "Provide confirmation and correction", "Keep mentoring actions in the evidence chain"],
    manager: ["Review team capability trends, not personal ranking", "Understand agent scope and risk", "Confirm whether collaboration can become workflow"],
  }) : ({
    hr: ["查看组织趋势和高风险待确认事项", "用证据支持制度解释与学习计划", "把 AI 建议写入审计而不是直接执行"],
    employee: ["获得与模拟工作绑定的 AI 学习 mission", "记录 prompt、AI 输出、人工修改和验证", "把成长证据沉淀到 portfolio"],
    mentor: ["复核员工复盘和高风险学习建议", "给出人工确认与纠偏意见", "把带教动作纳入证据链"],
    manager: ["查看团队能力趋势而不是个人排名", "理解 Agent 运行的范围和风险", "确认 AI 协作过程是否可复用为 workflow"],
  }), [language]);

  const personaOptions = language === "en-US"
    ? [{ label: "HR", value: "hr" }, { label: "Employee", value: "employee" }, { label: "Mentor", value: "mentor" }, { label: "Manager", value: "manager" }]
    : [{ label: "HR", value: "hr" }, { label: "员工", value: "employee" }, { label: "导师", value: "mentor" }, { label: "管理者", value: "manager" }];

  const highRiskCount = useMemo(
    () => auditEvents.filter((event) => event.riskLevel === "high").length + agentRuns.filter((run) => run.riskLevel === "high").length,
    [agentRuns, auditEvents],
  );

  const stateCards = [
    { title: "员工与组织", value: employees.length + orgUnits.length + legalEntities.length, suffix: "项", icon: <ApartmentOutlined />, tone: "blue" },
    { title: "知识库与引用", value: ragDocuments.length, suffix: "份", icon: <DatabaseOutlined />, tone: "purple" },
    { title: "学习成长", value: recommendations.length, suffix: "条建议", icon: <BookOutlined />, tone: "green" },
    { title: "Agent 运行", value: agentRuns.length, suffix: "次", icon: <RobotOutlined />, tone: "cyan" },
    { title: "高风险待确认", value: highRiskCount, suffix: "项", icon: <SafetyCertificateOutlined />, tone: "red" },
    { title: "审计事件", value: auditEvents.length, suffix: "条", icon: <AuditOutlined />, tone: "orange" },
  ];

  const operatingSignalChart = useMemo(() => ({
    data: [
      { type: "Knowledge", value: ragDocuments.length },
      { type: "Learning", value: recommendations.length },
      { type: "Agent", value: agentRuns.length },
      { type: "Audit", value: auditEvents.length },
    ],
    xField: "type",
    yField: "value",
    height: 170,
    colorField: "type",
    legend: false,
    axis: { y: { tickCount: 3 } },
    style: { radiusTopLeft: 4, radiusTopRight: 4 },
  }), [agentRuns.length, auditEvents.length, ragDocuments.length, recommendations.length]);

  const runCommandPreview = async () => {
    if (commandLoading) return;
    if (!demoMode) {
      setCommandPreview(t("dashboard.realModePreview"));
      navigate("/app/ai-command");
      return;
    }
    if (/统计|数量|状态|列表|查|查询|引用|资料/.test(command) && !/计划|workflow|Agent|调度|生成/.test(command)) {
      setCommandPreview(t("dashboard.programPreview"));
      return;
    }
    setCommandLoading(true);
    try {
      const run = await api.createAgentRun({ runType: "onboarding_planner", prompt: command, riskLevel: command.includes("面试") ? "high" : "medium" });
      setCommandPreview(t("dashboard.previewCreated", { runType: run.runType, summary: run.summary }));
      await reload();
    } catch {
      setCommandPreview(t("dashboard.previewFailed"));
    } finally {
      setCommandLoading(false);
    }
  };

  return (
    <div className="ai-dashboard" data-vc-page="dashboard">
      <section className="ai-dashboard-hero" data-vc-kind="ai-hrms-command-dashboard" data-vc-label="AI-HRMS Command Dashboard hero">
        <div className="hero-copy">
          <Tag color="blue">{t("dashboard.heroTag")}</Tag>
          <Typography.Title level={1}>{t("dashboard.title")}</Typography.Title>
          <Typography.Paragraph>
            {t("dashboard.description")}
          </Typography.Paragraph>
          <Input.Search
            size="large"
            value={command}
            enterButton={demoMode ? t("dashboard.demoCommandButton") : t("dashboard.realCommandButton")}
            loading={commandLoading}
            disabled={commandLoading}
            onChange={(event) => setCommand(event.target.value)}
            onSearch={runCommandPreview}
            placeholder={t("dashboard.commandPlaceholder")}
            aria-label="AI-HRMS command preview"
            data-vc-field="dashboard.ai_command"
          />
          {commandPreview ? (
            <Alert className="dashboard-command-preview" showIcon type="success" title={commandPreview} />
          ) : null}
          <CollaborationWorkflow />
        </div>
        <aside className="hero-trust-panel" data-vc-kind="trust-layer-snapshot" data-vc-label="Trust Layer Snapshot">
          <Typography.Title level={4}>{t("dashboard.trustTitle")}</Typography.Title>
          <TrustMetaBar riskLevel={highRiskCount ? "high" : "medium"} confidence={87} evidenceCount={ragDocuments.length + auditEvents.length} humanReviewRequired={highRiskCount > 0} toolPreview auditStatus="active" />
          <Alert
            showIcon
            type="warning"
            title={t("dashboard.highRiskTitle")}
            description={t("dashboard.highRiskDescription")}
          />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate("/app/ai-command")}>
            {t("dashboard.aiCommandCta")}
          </Button>
        </aside>
      </section>

      {loading ? <PageLoading /> : null}
      <InlineError message={error} onRetry={reload} />

      {!loading ? (
        <>
          <TaskPath
            title={language === "en-US" ? "Recommended operating path" : "推荐操作路径"}
            steps={[
              {
                title: language === "en-US" ? "Pick a scenario" : "选择业务场景",
                detail: language === "en-US" ? "Start from command, knowledge, Co-Growth, Agent, or audit." : "从指挥、知识、成长、Agent 或审计进入。",
                status: "current",
              },
              {
                title: language === "en-US" ? "Generate preview" : "生成预览",
                detail: language === "en-US" ? "AI produces suggestions, citations, or tool previews." : "AI 只产出建议、引用或工具预览。",
                status: "next",
              },
              {
                title: language === "en-US" ? "Check evidence" : "核验证据",
                detail: language === "en-US" ? "Review citations, risk, scope, and audit trail." : "看引用、风险、scope 和审计链。",
                status: "next",
              },
              {
                title: language === "en-US" ? "Human decision" : "人工判断",
                detail: language === "en-US" ? "High-risk actions remain blocked before confirmation." : "高风险动作停在确认前，不自动执行。",
                status: highRiskCount ? "blocked" : "next",
              },
            ]}
          />
          <section className="status-grid" data-vc-kind="system-status-cards">
            {stateCards.map((card) => (
              <Card key={card.title} className={`status-card tone-${card.tone}`}>
                <Space align="start">
                  <span className="status-icon">{card.icon}</span>
                  <Statistic title={card.title} value={card.value} suffix={card.suffix} />
                </Space>
              </Card>
            ))}
          </section>

          <Row gutter={[16, 16]} className="section-card reviewer-path-section" data-vc-kind="assignment-five-reviewer-path">
            <Col xs={24} xl={15}>
              <Card
                title={language === "en-US" ? "Assignment Five Review Path" : "作业五评审路径"}
                extra={<Tag color="blue">{language === "en-US" ? "live demo path" : "产品演示入口"}</Tag>}
              >
                <div className="reviewer-scenario-grid">
                  {reviewerScenarios.map((scenario, index) => (
                    <button
                      type="button"
                      className="reviewer-scenario-card"
                      key={scenario.title}
                      onClick={() => navigate(scenario.path)}
                      data-vc-kind="reviewer-scenario"
                      data-vc-label={scenario.title}
                    >
                      <span className="reviewer-scenario-index">{index + 1}</span>
                      <span className="reviewer-scenario-copy">
                        <Typography.Text strong>{scenario.title}</Typography.Text>
                        <Typography.Text type="secondary">{scenario.text}</Typography.Text>
                      </span>
                      <Tag>{scenario.tag}</Tag>
                    </button>
                  ))}
                </div>
              </Card>
            </Col>
            <Col xs={24} xl={9}>
              <Card title={language === "en-US" ? "Evidence Chain" : "引用与证据链"} data-vc-kind="assignment-evidence-chain">
                <div className="evidence-chain-rail" aria-label={language === "en-US" ? "Evidence chain" : "引用与证据链"}>
                  {evidenceChain.map((item, index) => (
                    <div className="evidence-chain-node" key={item}>
                      <span className="evidence-chain-index">{index + 1}</span>
                      <Typography.Text strong>{item}</Typography.Text>
                    </div>
                  ))}
                </div>
                <Alert
                  showIcon
                  type="info"
                  className="evidence-chain-note"
                  title={language === "en-US" ? "Review rule" : "评审口径"}
                  description={language === "en-US"
                    ? "AI-HRMS is the product; the company dataset is fictional and high-risk HR actions stay preview-only."
                    : "AI-HRMS 是产品；公司数据是虚构样本，高风险 HR 动作只预览并进入人工复核。"}
                />
              </Card>
            </Col>
          </Row>

          <Card className="section-card" title="My Actions Required" data-vc-kind="my-actions-required">
            <Table
              className="hr-desktop-record-table"
              rowKey={(record) => `${record.resource}-${record.id}`}
              size="middle"
              dataSource={workItems}
              scroll={{ x: 760 }}
              pagination={false}
              locale={{ emptyText: "暂无待处理事项" }}
              columns={[
                { title: "事项", dataIndex: "title" },
                { title: "模块", dataIndex: "module", render: (module: string) => module === "employee_ops" ? "员工事务" : module === "recruitment_lifecycle" ? "招聘与生命周期" : module === "growth_performance" ? "成长与绩效" : module },
                { title: "对象", render: (_: unknown, item: HRWorkItem) => item.employeeName || item.orgUnitName || item.recordType },
                { title: "状态", dataIndex: "status", render: (status: string) => <Tag>{status}</Tag> },
                { title: "风险", render: (_: unknown, item: HRWorkItem) => <Space><RiskTag risk={item.riskLevel} />{item.humanReviewRequired ? <Tag color="red">human review</Tag> : null}</Space> },
                { title: "操作", render: (_: unknown, item: HRWorkItem) => <Button size="small" onClick={() => navigate(workItemRoute(item))}>处理</Button> },
              ]}
            />
            <div className="hr-mobile-record-list" data-vc-kind="dashboard-action-mobile-list">
              {!workItems.length ? <EmptyBlock description="暂无待处理事项" /> : null}
              {workItems.map((item) => (
                <article className="hr-mobile-record-card" key={`${item.resource}-${item.id}`} data-vc-kind="dashboard-action-card" data-vc-object-type={item.recordType} data-vc-object-id={item.id}>
                  <span className="hr-mobile-card-title">{item.title}</span>
                  <span className="hr-mobile-card-meta">
                    {item.module === "employee_ops" ? "员工事务" : item.module === "recruitment_lifecycle" ? "招聘与生命周期" : item.module === "growth_performance" ? "成长与绩效" : item.module}
                    {" · "}
                    {item.employeeName || item.orgUnitName || item.recordType}
                  </span>
                  <span className="hr-mobile-card-tags">
                    <Tag>{item.status}</Tag>
                    <RiskTag risk={item.riskLevel} />
                    {item.humanReviewRequired ? <Tag color="red">human review</Tag> : null}
                  </span>
                  <Button size="small" type="primary" onClick={() => navigate(workItemRoute(item))}>处理</Button>
                </article>
              ))}
            </div>
          </Card>

          <Row gutter={[16, 16]} className="section-card">
            <Col xs={24} lg={14}>
              <Card title={language === "en-US" ? "AI-HRMS Demo Tour" : "AI-HRMS 演示路径"} data-vc-kind="demo-tour">
                <Timeline
                  items={demoTour.map((step, index) => ({
                    icon: <CheckCircleOutlined />,
                    content: (
                      <div className="tour-step">
                        <div>
                          <Typography.Text strong>{index + 1}. {step.title}</Typography.Text>
                          <Typography.Paragraph type="secondary">{step.summary}</Typography.Paragraph>
                        </div>
                        <Button size="small" icon={<ArrowRightOutlined />} onClick={() => navigate(step.path)}>
                          {language === "en-US" ? "Open" : "打开"}
                        </Button>
                      </div>
                    ),
                  }))}
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title={language === "en-US" ? "Human-Agent Collaboration Rubric" : "人机协作评分维度"} data-vc-kind="collaboration-health">
                <Typography.Paragraph type="secondary">
                  {language === "en-US" ? "This evaluates whether collaboration is trustworthy, not personal performance." : "这里评价协作过程是否可信，不评价员工个人表现。"}
                </Typography.Paragraph>
                <CollaborationRubric compact />
              </Card>
            </Col>
          </Row>

          <section className="system-layer-grid" data-vc-kind="ai-hrms-system-layers">
            {systemLayers.map((layer) => (
              <article className="system-layer-card" key={layer.title}>
                <span className="system-layer-icon">{layer.icon}</span>
                <Typography.Text strong>{layer.title}</Typography.Text>
                <Typography.Paragraph type="secondary">{layer.text}</Typography.Paragraph>
                <RiskTag risk={layer.risk} />
              </article>
            ))}
          </section>

          <Row gutter={[16, 16]} className="section-card">
            <Col xs={24} lg={10}>
              <Card title={language === "en-US" ? "Persona View" : "角色视角"} data-vc-kind="persona-switch">
                <Segmented
                  block
                  value={persona}
                  onChange={(value) => setPersona(value as Persona)}
                  options={personaOptions}
                />
                <div className="persona-value-list">
                  {personaValue[persona].map((item) => (
                    <div key={item}>
                      <UserSwitchOutlined />
                      <Typography.Text>{item}</Typography.Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card title={language === "en-US" ? "AI-HRMS Key Entrypoints" : "AI-HRMS 核心入口"} data-vc-kind="highlight-entry-grid">
                <div className="highlight-grid">
                  {highlightEntries.map((entry) => (
                    <button key={entry.title} className="highlight-entry" onClick={() => navigate(entry.path)} type="button">
                      {entry.icon}
                      <span>{entry.title}</span>
                      <small>{entry.text}</small>
                    </button>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} className="section-card">
            <Col xs={24} md={8}>
              <Card title="组织趋势">
                <Progress percent={74} aria-label="组织趋势覆盖率" />
                <Typography.Text type="secondary">AI 建议覆盖 onboarding、知识治理和成长 mission，未进入人事裁决。</Typography.Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="AI-HRMS Operating Signals">
                <Suspense fallback={<div className="dashboard-chart-loading" />}>
                  <SignalColumn {...operatingSignalChart} />
                </Suspense>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Visual Copilot Showcase">
                <Typography.Paragraph type="secondary">
                  点击右下角靶心按钮，圈选任意知识资料、Agent run 或审计事件，Demo 会生成本地解释和动作预览。
                </Typography.Paragraph>
                <Tag color="purple">selection → context → preview → audit</Tag>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Human-in-the-loop 边界">
                <Alert
                  showIcon
                  type="warning"
                  title="不做自动化晋升、淘汰、降薪或录用裁决"
                  description="AI 可以检索、解释、建议和预览；人负责判断、确认、复盘和纠偏。"
                />
              </Card>
            </Col>
          </Row>
        </>
      ) : null}
    </div>
  );
}
