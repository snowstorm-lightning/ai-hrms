import {
  ApartmentOutlined,
  ArrowRightOutlined,
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Input, Progress, Row, Segmented, Space, Statistic, Tag, Timeline, Typography } from "antd";
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { AgentRun, AuditEvent, Employee, LegalEntity, LearningRecommendation, OrgUnit, RAGDocument } from "../../api/types";
import { CollaborationRubric, CollaborationWorkflow, RiskTag, TrustMetaBar } from "../../components/AiTrust";
import { PageLoading } from "../../components/PageLoading";
import { InlineError } from "../../components/AsyncState";

type Persona = "HR" | "员工" | "导师" | "管理者";

const SignalColumn = lazy(async () => {
  const module = await import("@ant-design/charts");
  return { default: module.Column as ComponentType<Record<string, unknown>> };
});

const demoTour = [
  { title: "Command Dashboard", path: "/app/dashboard", summary: "统一入口：组织数据、AI 指挥、知识、成长、Agent 和审计。" },
  { title: "AI Command Center", path: "/app/ai-command", summary: "生成结构化 HR 建议，展示 riskLevel、confidence、evidence。" },
  { title: "Knowledge Hub", path: "/app/knowledge", summary: "查看 RAG 资料的来源、可信等级、敏感级别和引用。" },
  { title: "Co-Growth OS", path: "/co-growth", summary: "员工学习 AI 原理，把模拟工作转成 mission 并复盘。" },
  { title: "Agent Run Center", path: "/app/agents", summary: "预览 Agent run、工具调用和人工确认状态。" },
  { title: "Audit & Evidence", path: "/app/audit", summary: "追踪 AI 建议、人工确认、证据和高风险阻断。" },
];

const systemLayers = [
  { icon: <ApartmentOutlined />, title: "Organization Data Layer", text: "员工、组织、法人、角色、考勤和消息。", risk: "low" },
  { icon: <DatabaseOutlined />, title: "Knowledge & Learning Layer", text: "受控知识库、RAG 引用、课程和 Co-Growth。", risk: "medium" },
  { icon: <RobotOutlined />, title: "Agent Collaboration Layer", text: "AI 指挥中心、Agent run、Visual Copilot 和 Workflow Lab。", risk: "medium" },
  { icon: <SafetyCertificateOutlined />, title: "Governance & Trust Layer", text: "riskLevel、confidence、evidence、citation、humanReview 和 audit。", risk: "high" },
  { icon: <ThunderboltOutlined />, title: "Human-AI Co-evolution Layer", text: "人提出目标，AI 生成建议，Agent 预览动作，人确认并复盘。", risk: "low" },
];

const highlightEntries = [
  { title: "AI 指挥中心", path: "/app/ai-command", icon: <RobotOutlined />, text: "问组织、查知识、生成计划、预览动作。" },
  { title: "Governed Knowledge Hub", path: "/app/knowledge", icon: <DatabaseOutlined />, text: "引用、范围、敏感级别和资料可信度。" },
  { title: "Co-Growth OS", path: "/co-growth", icon: <ExperimentOutlined />, text: "AI-HRMS 的人机共生成长引擎。" },
  { title: "Agent Run Center", path: "/app/agents", icon: <TeamOutlined />, text: "Agent run、tool preview、人工确认和审计状态。" },
  { title: "Audit & Evidence Layer", path: "/app/audit", icon: <AuditOutlined />, text: "把建议、工具调用、人工确认和证据串起来。" },
  { title: "Visual Copilot Showcase", path: "/app/knowledge", icon: <EyeOutlined />, text: "圈选页面对象，生成解释和可审计的动作预览。" },
];

const personaValue: Record<Persona, string[]> = {
  HR: ["查看组织趋势和高风险待确认事项", "用证据支持制度解释与学习计划", "把 AI 建议写入审计而不是直接执行"],
  员工: ["获得与模拟工作绑定的 AI 学习 mission", "记录 prompt、AI 输出、人工修改和验证", "把成长证据沉淀到 portfolio"],
  导师: ["复核员工复盘和高风险学习建议", "给出人工确认与纠偏意见", "把带教动作纳入证据链"],
  管理者: ["查看团队能力趋势而不是个人排名", "理解 Agent run 的范围和风险", "确认 AI 协作过程是否可复用为 workflow"],
};

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [persona, setPersona] = useState<Persona>("HR");
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
      const [docPage, runPage, auditPage, recommendationPage] = await Promise.all([
        safe(api.ragDocuments(1, 20), { total: 0, rows: [] }),
        safe(api.agentRuns(1, 20), { total: 0, rows: [] }),
        safe(api.auditEvents(1, 50), { total: 0, rows: [] }),
        safe(api.learningRecommendations(1, 20), { total: 0, rows: [] }),
      ]);
      setLegalEntities(entities);
      setOrgUnits(units);
      setEmployees(employeePage.rows ?? []);
      setRagDocuments(docPage.rows ?? []);
      setAgentRuns(runPage.rows ?? []);
      setAuditEvents(auditPage.rows ?? []);
      setRecommendations(recommendationPage.rows ?? []);
    } catch {
      setError("Dashboard core HRMS data failed to load. Check API connectivity or enable VITE_DEMO_MODE=true.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

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
      setCommandPreview("真实模式下将进入 AI Command Center，由 Go 权限、scope、RAG 和审计边界处理建议生成。");
      navigate("/app/ai-command");
      return;
    }
    if (/统计|数量|状态|列表|查|查询|引用|资料/.test(command) && !/计划|workflow|Agent|调度|生成/.test(command)) {
      setCommandPreview("该问题由程序化查询或受控 RAG 检索处理，不创建 Agent run；需要自然语言生成或跨模块行动时再升级到 Agent。");
      return;
    }
    setCommandLoading(true);
    try {
      const run = await api.createAgentRun({ runType: "onboarding_planner", prompt: command, riskLevel: command.includes("面试") ? "high" : "medium" });
      setCommandPreview(`已生成 ${run.runType} 预览：${run.summary}。下一步请查看 AI Command Center 的证据、工具预览和审计草案。`);
      await reload();
    } catch {
      setCommandPreview("预览生成失败，请进入 AI Command Center 查看详细错误。");
    } finally {
      setCommandLoading(false);
    }
  };

  return (
    <div className="ai-dashboard" data-vc-page="dashboard">
      <section className="ai-dashboard-hero" data-vc-kind="ai-hrms-command-dashboard" data-vc-label="AI-HRMS Command Dashboard hero">
        <div className="hero-copy">
          <Tag color="blue">Human-Agent Symbiotic HR Operating System</Tag>
          <Typography.Title level={1}>AI-HRMS｜人机共生的人力资源智能操作系统</Typography.Title>
          <Typography.Paragraph>
            连接组织数据、知识库、学习成长、智能体运行和审计治理，让 HR 与 AI Agent 协作完成更可信的人力资源工作。
          </Typography.Paragraph>
          <Input.Search
            size="large"
            value={command}
            enterButton={demoMode ? "生成预览" : "进入 AI 指挥中心"}
            loading={commandLoading}
            disabled={commandLoading}
            onChange={(event) => setCommand(event.target.value)}
            onSearch={runCommandPreview}
            placeholder="问组织、查知识、生成计划、预览动作、调度 Agent"
            aria-label="AI-HRMS command preview"
            data-vc-field="dashboard.ai_command"
          />
          {commandPreview ? (
            <Alert className="dashboard-command-preview" showIcon type="success" title={commandPreview} />
          ) : null}
          <CollaborationWorkflow />
        </div>
        <aside className="hero-trust-panel" data-vc-kind="trust-layer-snapshot" data-vc-label="Trust Layer Snapshot">
          <Typography.Title level={4}>Trust Layer Snapshot</Typography.Title>
          <TrustMetaBar riskLevel={highRiskCount ? "high" : "medium"} confidence={87} evidenceCount={ragDocuments.length + auditEvents.length} humanReviewRequired={highRiskCount > 0} toolPreview auditStatus="active" />
          <Alert
            showIcon
            type="warning"
            title="高风险人事建议不会自动执行"
            description="系统只允许生成预览、请求人工确认、查看证据和写入审计。"
          />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate("/app/ai-command")}>
            进入 AI 指挥中心
          </Button>
        </aside>
      </section>

      {loading ? <PageLoading /> : null}
      <InlineError message={error} onRetry={reload} />

      {!loading ? (
        <>
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

          <Row gutter={[16, 16]} className="section-card">
            <Col xs={24} lg={14}>
              <Card title="AI-HRMS Demo Tour" data-vc-kind="demo-tour">
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
                          打开
                        </Button>
                      </div>
                    ),
                  }))}
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Human-Agent Collaboration Rubric" data-vc-kind="collaboration-health">
                <Typography.Paragraph type="secondary">
                  这里评价协作过程是否可信，不评价员工个人表现。
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
              <Card title="角色视角" data-vc-kind="persona-switch">
                <Segmented
                  block
                  value={persona}
                  onChange={(value) => setPersona(value as Persona)}
                  options={["HR", "员工", "导师", "管理者"]}
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
              <Card title="AI-HRMS 核心亮点入口" data-vc-kind="highlight-entry-grid">
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
