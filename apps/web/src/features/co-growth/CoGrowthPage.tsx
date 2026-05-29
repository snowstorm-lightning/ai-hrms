import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  ApiOutlined,
  ArrowLeftOutlined,
  AuditOutlined,
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  FireOutlined,
  ForkOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import {
  aiLiteracyLevelLabels,
  learningModeLabels,
} from "./demoData";
import {
  generateDeterministicCoachSuggestion,
  getCoGrowthDemoState,
  getRecommendedMissions,
  getRecommendedPrincipleCards,
  isCoGrowthDemoMode,
} from "./demoAdapter";
import type { CoachSuggestion, LearningMission, LearningMode, MissionStatus, RiskLevel, WorkflowNode } from "./types";
import "./coGrowth.css";

const quickPrompts = [
  "生成本周 AI 学习计划",
  "用 5 分钟解释 RAG 原理",
  "把当前工作任务改造成 AI 实战副本",
  "检查我的学习负荷是否过高",
  "根据我的学习偏好调整课程",
  "帮我复盘一次 AI 使用过程",
  "生成 Agent 工作流实验",
];

const reflectionQuestions = [
  "AI 帮你节省了什么时间？",
  "AI 输出中哪些地方不可靠？",
  "你补充了哪些上下文？",
  "你如何验证结果？",
  "这次任务是否可以沉淀成可复用工作流？",
  "下次你会如何改进 prompt / 工具调用 / 人工检查？",
];

const reliabilityChecklist = [
  "是否提供足够上下文",
  "是否要求引用或证据",
  "是否检查事实",
  "是否涉及隐私",
  "是否需要人工确认",
  "是否保留证据",
];

const missionStatusStorageKey = "ai_hrms_cogrowth_mission_statuses";

function loadMissionStatuses(): Record<string, MissionStatus> {
  try {
    const raw = localStorage.getItem(missionStatusStorageKey);
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, MissionStatus>;
  } catch {
    return {};
  }
}

const missionStatusLabels: Record<MissionStatus, string> = {
  recommended: "推荐",
  accepted: "已接受",
  in_progress: "进行中",
  reflected: "已复盘",
  completed: "已完成",
  deferred: "已延后",
};

const riskColor: Record<RiskLevel, string> = {
  low: "blue",
  medium: "orange",
  high: "red",
};

const modeOptions = [
  { label: "视觉图解", value: "visual" },
  { label: "动手实验", value: "hands_on" },
  { label: "问答陪练", value: "qa" },
  { label: "案例推演", value: "case" },
  { label: "文档阅读", value: "reading" },
  { label: "项目实战", value: "project" },
];

function RiskTag({ risk }: { risk: RiskLevel }) {
  const label = risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "低风险";
  return <Tag color={riskColor[risk]}>{label}</Tag>;
}

function statusColor(status: MissionStatus) {
  if (status === "completed" || status === "reflected") return "green";
  if (status === "in_progress" || status === "accepted") return "blue";
  if (status === "deferred") return "orange";
  return "default";
}

function nodeIcon(type: WorkflowNode["type"]) {
  if (type === "retrieval") return <BookOutlined />;
  if (type === "generation") return <ThunderboltOutlined />;
  if (type === "check") return <SafetyCertificateOutlined />;
  if (type === "human") return <CheckCircleOutlined />;
  if (type === "audit") return <AuditOutlined />;
  return <ApiOutlined />;
}

function missionWithStatus(mission: LearningMission, status?: MissionStatus): LearningMission {
  return status ? { ...mission, status } : mission;
}

export function CoGrowthPage() {
  const demo = getCoGrowthDemoState();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [selectedMode, setSelectedMode] = useState<LearningMode>(demo.currentEmployee.preferredLearningMode);
  const [instruction, setInstruction] = useState("帮我把本周工作任务转化成一个不超过 30 分钟的 AI 学习实战任务");
  const [coachResult, setCoachResult] = useState<CoachSuggestion>(demo.coachSuggestions[0]);
  const [selectedMissionId, setSelectedMissionId] = useState(demo.missions[0].id);
  const [missionStatuses, setMissionStatuses] = useState<Record<string, MissionStatus>>(loadMissionStatuses);

  useEffect(() => {
    try {
      localStorage.setItem(missionStatusStorageKey, JSON.stringify(missionStatuses));
    } catch {
      // Demo persistence is best-effort; the page remains usable without storage.
    }
  }, [missionStatuses]);

  const recommendedMissions = useMemo(
    () => getRecommendedMissions(selectedMode, demo.currentEmployee.currentWorkload).map((mission) => missionWithStatus(mission, missionStatuses[mission.id])),
    [demo.currentEmployee.currentWorkload, missionStatuses, selectedMode],
  );
  const recommendedCards = useMemo(() => getRecommendedPrincipleCards(selectedMode), [selectedMode]);
  const selectedMission = recommendedMissions.find((mission) => mission.id === selectedMissionId) ?? recommendedMissions[0];
  const evidenceItems = useMemo(
    () => [
      ...demo.currentEmployee.evidence,
      ...demo.workJournal.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.reflection,
        source: "AI Work Journal",
        createdAt: "2026-05-28",
        riskLevel: "low" as RiskLevel,
        confidence: 89,
        type: "reflection" as const,
      })),
    ],
    [demo.currentEmployee.evidence, demo.workJournal],
  );

  const scheduledMinutes = demo.currentEmployee.activeMissions
    .map((id) => demo.missions.find((mission) => mission.id === id)?.estimatedMinutes ?? 0)
    .reduce((sum, minutes) => sum + minutes, 0);
  const workloadPercent = demo.currentEmployee.currentWorkload === "high" ? 86 : demo.currentEmployee.currentWorkload === "medium" ? 62 : 38;

  const runCoach = (prompt = instruction) => {
    setInstruction(prompt);
    setCoachResult(generateDeterministicCoachSuggestion(prompt, demo.currentEmployee.currentWorkload));
  };

  return (
    <main className="co-growth-page" data-vc-page="co-growth" data-vc-object-type="learning-growth-system">
      <header className="co-growth-topbar">
        <button className="co-growth-brand" onClick={() => navigate("/co-growth")} type="button">
          <ExperimentOutlined />
          <span>AI-HRMS / Co-Growth OS</span>
        </button>
        <div className="co-growth-top-actions">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/app/dashboard")}>
            AI-HRMS Command Dashboard
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            退出
          </Button>
        </div>
      </header>

      <section className="co-growth-console" data-vc-kind="co-growth-command-center">
        <div className="co-growth-command-panel">
          <Badge color="#16a34a" text={isCoGrowthDemoMode ? "受控演示环境" : "API mode：保持原有后端边界"} />
          <Typography.Title level={1}>Co-Growth OS｜AI-HRMS 人机共生成长引擎</Typography.Title>
          <Typography.Paragraph>
            Co-Growth OS 是 AI-HRMS 的成长引擎，帮助员工学习 AI 原理、把 AI 嵌入真实工作、复盘人机协作过程，并沉淀为可审计的成长证据。
          </Typography.Paragraph>
          <Input.Search
            data-vc-field="co_growth.ai_instruction"
            size="large"
            value={instruction}
            placeholder="把本周工作任务转化成一个 30 分钟内的 AI 学习任务"
            enterButton="生成"
            onChange={(event) => setInstruction(event.target.value)}
            onSearch={runCoach}
          />
          <div className="co-growth-prompts" data-vc-kind="quick-prompts">
            {quickPrompts.map((prompt) => (
              <Button key={prompt} size="small" onClick={() => runCoach(prompt)} data-vc-action="co_growth.quick_prompt">
                {prompt}
              </Button>
            ))}
          </div>
        </div>

        <aside className="coach-panel" data-vc-kind="ai-coach-panel">
          <div className="coach-panel-header">
            <RobotBadge />
            <div>
              <Typography.Title level={4}>AI Coach</Typography.Title>
              <Typography.Text type="secondary">{user?.username ?? demo.currentEmployee.name} · {learningModeLabels[selectedMode]}</Typography.Text>
            </div>
          </div>
          <Alert
            showIcon
            type={coachResult.riskLevel === "high" ? "warning" : "success"}
            title={coachResult.title}
            description={coachResult.summary}
          />
          <div className="coach-facts">
            <Tag color={riskColor[coachResult.riskLevel]}>riskLevel={coachResult.riskLevel}</Tag>
            <Tag>confidence={coachResult.confidence}%</Tag>
            <Tag>{coachResult.estimatedMinutes} 分钟</Tag>
            <Tag>impact={coachResult.impactOnWork}</Tag>
            <Tag color={coachResult.humanReviewRequired ? "red" : "green"}>
              humanReviewRequired={String(coachResult.humanReviewRequired)}
            </Tag>
          </div>
          <div className="coach-compact-list">
            {coachResult.suggestedActions.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
          </div>
        </aside>
      </section>

      <section className="co-growth-metrics" data-vc-kind="weekly-learning-summary">
        <Statistic title="本周学习预算" value={demo.currentEmployee.weeklyLearningBudgetMinutes} suffix="分钟" />
        <Statistic title="已安排" value={scheduledMinutes} suffix="分钟" />
        <Statistic title="成长证据" value={evidenceItems.length} />
        <Statistic title="活跃 mission" value={demo.currentEmployee.activeMissions.length} />
        <div className="co-growth-profile-summary">
          <Tag color="purple">{aiLiteracyLevelLabels[demo.currentEmployee.aiLiteracyLevel]}</Tag>
          <Typography.Text>{demo.currentEmployee.role} · {demo.currentEmployee.department} · {demo.currentEmployee.recommendedPace}</Typography.Text>
        </div>
      </section>

      <section className="co-growth-workspace">
        <Tabs
          size="large"
          items={[
            {
              key: "overview",
              label: "能力画像",
              children: (
                <div className="co-growth-tab-panel">
                  <section className="co-growth-band" data-vc-kind="ai-literacy-map">
                    <div className="section-heading">
                      <div>
                        <Typography.Title level={3}>AI Literacy Map</Typography.Title>
                        <Typography.Text type="secondary">使用成长阶段、学习信号和证据充分度描述能力，不做人事评价。</Typography.Text>
                      </div>
                      <Tag color="geekblue">Learn AI</Tag>
                    </div>
                    <div className="literacy-map">
                      {demo.literacyMap.map((item) => (
                        <article className="literacy-card" key={item.id} data-vc-kind="literacy-dimension" data-vc-object-id={item.id}>
                          <div className="literacy-card-top">
                            <Typography.Text strong>{item.title}</Typography.Text>
                            <Tag>{item.evidenceCount} 条证据</Tag>
                          </div>
                          <Progress percent={item.currentLevel} strokeColor={{ from: "#0ea5e9", to: "#22c55e" }} />
                          <Typography.Text className="growth-stage">{item.growthStage}</Typography.Text>
                          <Typography.Paragraph type="secondary">{item.nextStep}</Typography.Paragraph>
                          <Space wrap>
                            <Tag color="cyan">{item.courseCard}</Tag>
                            <Button size="small" onClick={() => setSelectedMissionId(item.missionId)}>查看 mission</Button>
                          </Space>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="co-growth-split">
                    <Card className="co-growth-card" data-vc-kind="work-learning-balance">
                      <div className="section-heading compact">
                        <div>
                          <Typography.Title level={4}>Work-Learning Balance</Typography.Title>
                          <Typography.Text type="secondary">学习节奏服从工作交付。</Typography.Text>
                        </div>
                        <FieldTimeOutlined />
                      </div>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={9}>
                          <div className="balance-meter">
                            <Progress type="dashboard" percent={workloadPercent} strokeColor={workloadPercent > 80 ? "#f97316" : "#0ea5e9"} />
                            <Typography.Text strong>工作负荷：{demo.currentEmployee.currentWorkload === "high" ? "高" : demo.currentEmployee.currentWorkload === "medium" ? "中" : "低"}</Typography.Text>
                          </div>
                        </Col>
                        <Col xs={24} md={15}>
                          <div className="simple-list">
                            <div className="simple-list-item">预算：{demo.currentEmployee.weeklyLearningBudgetMinutes} 分钟</div>
                            <div className="simple-list-item">已安排：{scheduledMinutes} 分钟</div>
                            <div className="simple-list-item">建议：{demo.currentEmployee.recommendedPace}</div>
                          </div>
                        </Col>
                      </Row>
                    </Card>

                    <Card className="co-growth-card" data-vc-kind="personalized-learning-profile">
                      <div className="section-heading compact">
                        <div>
                          <Typography.Title level={4}>Personalized Learning Profile</Typography.Title>
                          <Typography.Text type="secondary">切换偏好后，mission 和原理卡推荐同步变化。</Typography.Text>
                        </div>
                        <BulbOutlined />
                      </div>
                      <Segmented
                        block
                        value={selectedMode}
                        options={modeOptions}
                        onChange={(value) => setSelectedMode(value as LearningMode)}
                        data-vc-field="co_growth.learning_mode"
                      />
                      <Alert className="profile-alert" showIcon type="info" title="学习信号只用于成长辅导和组织趋势分析。" />
                    </Card>
                  </section>
                </div>
              ),
            },
            {
              key: "missions",
              label: "Mission",
              children: (
                <div className="co-growth-tab-panel">
                  <section className="co-growth-band" data-vc-kind="learning-mission-board">
                    <div className="section-heading">
                      <div>
                        <Typography.Title level={3}>Learning Mission Board</Typography.Title>
                        <Typography.Text type="secondary">把真实工作任务改造成小步可复盘的 AI 学习实战。</Typography.Text>
                      </div>
                      <Tag color="green">Work with AI</Tag>
                    </div>
                    <div className="mission-grid">
                      {recommendedMissions.map((mission) => (
                        <article
                          className={mission.id === selectedMission.id ? "mission-card selected" : "mission-card"}
                          key={mission.id}
                          data-vc-kind="learning-mission"
                          data-vc-object-id={mission.id}
                          onClick={() => setSelectedMissionId(mission.id)}
                        >
                          <div className="mission-card-header">
                            <Typography.Text strong>{mission.title}</Typography.Text>
                            <Tag color={statusColor(mission.status)}>{missionStatusLabels[mission.status]}</Tag>
                          </div>
                          <Space wrap>
                            <Tag>{mission.estimatedMinutes} 分钟</Tag>
                            <RiskTag risk={mission.riskLevel} />
                            <Tag>{mission.confidence}% 置信度</Tag>
                          </Space>
                          <Typography.Paragraph type="secondary">{mission.learningGoal}</Typography.Paragraph>
                          <div className="mission-meta">
                            <span>工作产出：{mission.workOutput}</span>
                            <span>证据来源：{mission.evidenceSource}</span>
                          </div>
                          <div className="mission-actions">
                            <Button
                              size="small"
                              type="primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMissionStatuses((current) => ({ ...current, [mission.id]: "in_progress" }));
                              }}
                            >
                              开始任务
                            </Button>
                            <Button
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMissionStatuses((current) => ({ ...current, [mission.id]: "reflected" }));
                                runCoach(`帮我复盘一次 AI 使用过程：${mission.title}`);
                              }}
                            >
                              生成复盘
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <Alert
                      className="human-confirmation"
                      type={selectedMission.riskLevel === "high" ? "warning" : "info"}
                      showIcon
                      title="需要人工确认的点"
                      description={selectedMission.humanConfirmationPoints.join(" / ")}
                    />
                  </section>

                  <section className="co-growth-band" data-vc-kind="ai-principle-cards">
                    <div className="section-heading">
                      <div>
                        <Typography.Title level={3}>AI Principle Cards</Typography.Title>
                        <Typography.Text type="secondary">理解原理、限制和验证方式。</Typography.Text>
                      </div>
                      <Tag color="volcano">Learn AI</Tag>
                    </div>
                    <Tabs
                      items={recommendedCards.slice(0, 6).map((card) => ({
                        key: card.id,
                        label: card.title.length > 14 ? `${card.title.slice(0, 14)}...` : card.title,
                        children: (
                          <div className="principle-card" data-vc-kind="principle-card" data-vc-object-id={card.id}>
                            <Typography.Title level={4}>{card.title}</Typography.Title>
                            <Row gutter={[16, 16]}>
                              <Col xs={24} md={12}><InfoBlock title="5 分钟解释" text={card.fiveMinuteExplanation} /></Col>
                              <Col xs={24} md={12}><InfoBlock title="10 分钟实验" text={card.tenMinuteExperiment} /></Col>
                              <Col xs={24} md={12}><InfoBlock title="工作应用任务" text={card.workApplicationTask} /></Col>
                              <Col xs={24} md={12}><InfoBlock title="复盘问题" text={card.reflectionQuestion} /></Col>
                            </Row>
                          </div>
                        ),
                      }))}
                    />
                  </section>
                </div>
              ),
            },
            {
              key: "workflow",
              label: "Workflow Lab",
              children: (
                <div className="co-growth-tab-panel">
                  <AgentWorkflowLab nodes={demo.workflowNodes} />
                  <section className="co-growth-split">
                    <Card className="co-growth-card" data-vc-kind="prompt-workflow-versioning">
                      <Typography.Title level={4}>Prompt / Workflow Versioning</Typography.Title>
                      <Timeline
                        items={demo.promptVersions.map((version) => ({
                          color: version.reliabilityGain > 80 ? "green" : "blue",
                          content: (
                            <div>
                              <Typography.Text strong>{version.version} · 可靠性 {version.reliabilityGain}%</Typography.Text>
                              <pre>{version.prompt}</pre>
                              <Typography.Text type="secondary">{version.improvement}</Typography.Text>
                            </div>
                          ),
                        }))}
                      />
                    </Card>
                    <Card className="co-growth-card" data-vc-kind="reflection-loop">
                      <div className="section-heading compact">
                        <div>
                          <Typography.Title level={4}>Reflection Loop</Typography.Title>
                          <Typography.Text type="secondary">AI 辅助复盘，人保留最终判断。</Typography.Text>
                        </div>
                        <FireOutlined />
                      </div>
                      <div className="simple-list">
                        {reflectionQuestions.map((item) => (
                          <div className="simple-list-item" key={item}>
                            <CheckCircleOutlined className="list-icon" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </Card>
                  </section>
                </div>
              ),
            },
            {
              key: "governance",
              label: "治理与趋势",
              children: (
                <div className="co-growth-tab-panel">
                  <section className="co-growth-band" data-vc-kind="team-capability-heatmap">
                    <div className="section-heading">
                      <div>
                        <Typography.Title level={3}>Team Capability Heatmap</Typography.Title>
                        <Typography.Text type="secondary">给 HR / 管理者看的聚合趋势，不是个人惩罚名单。</Typography.Text>
                      </div>
                      <Tag color="cyan">Grow with AI</Tag>
                    </div>
                    <Row gutter={[16, 16]}>
                      {demo.teamInsights.map((insight) => (
                        <Col xs={24} md={12} lg={6} key={insight.title}>
                          <div className="team-insight">
                            <RiskTag risk={insight.riskLevel} />
                            <Typography.Title level={4}>{insight.value}</Typography.Title>
                            <Typography.Text strong>{insight.title}</Typography.Text>
                            <Typography.Paragraph type="secondary">{insight.summary}</Typography.Paragraph>
                          </div>
                        </Col>
                      ))}
                    </Row>
                    <div className="heatmap-grid">
                      {demo.teamHeatmap.map((row) => (
                        <article className="heatmap-row" key={row.capability}>
                          <div>
                            <Typography.Text strong>{row.capability}</Typography.Text>
                            <Typography.Text type="secondary">{row.weakestSignal}</Typography.Text>
                          </div>
                          {(["beginner", "user", "collaborator", "evaluator", "orchestrator"] as const).map((level) => (
                            <Tooltip key={level} title={`${aiLiteracyLevelLabels[level]}：${row[level]} 人`}>
                              <span className={`heat-cell heat-${level}`} style={{ opacity: 0.28 + row[level] * 0.12 }}>
                                {row[level]}
                              </span>
                            </Tooltip>
                          ))}
                          <Typography.Text>{row.recommendedIntervention}</Typography.Text>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="co-growth-split">
                    <Card className="co-growth-card" data-vc-kind="growth-evidence-portfolio">
                      <Typography.Title level={4}>Growth Evidence Portfolio</Typography.Title>
                      <Timeline
                        items={evidenceItems.map((item) => ({
                          color: item.riskLevel === "high" ? "red" : item.riskLevel === "medium" ? "orange" : "green",
                          content: (
                            <div data-vc-kind="growth-evidence" data-vc-object-id={item.id}>
                              <Typography.Text strong>{item.title}</Typography.Text>
                              <p>{item.description}</p>
                              <Space wrap>
                                <Tag>{item.source}</Tag>
                                <Tag>{item.confidence}%</Tag>
                                <RiskTag risk={item.riskLevel} />
                              </Space>
                            </div>
                          ),
                        }))}
                      />
                    </Card>
                    <Card className="co-growth-card" data-vc-kind="governance-sandbox">
                      <Typography.Title level={4}>AI Governance Sandbox</Typography.Title>
                      <div className="governance-list">
                        {demo.governanceScenarios.map((scenario) => (
                          <article className="governance-item" key={scenario.id}>
                            <Space wrap><SafetyCertificateOutlined />{scenario.title}<Tag color="red">{scenario.riskType}</Tag></Space>
                            <p>风险信号：{scenario.warningSignal}</p>
                            <p>健康回应：{scenario.healthyResponse}</p>
                            <Tag color="orange">humanReviewRequired=true</Tag>
                          </article>
                        ))}
                      </div>
                    </Card>
                  </section>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section className="co-growth-reliability-strip">
        {reliabilityChecklist.map((item) => (
          <label key={item}>
            <input type="checkbox" defaultChecked={item !== "是否涉及隐私"} />
            {item}
          </label>
        ))}
      </section>
    </main>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="info-block">
      <Typography.Text strong>{title}</Typography.Text>
      <Typography.Paragraph>{text}</Typography.Paragraph>
    </div>
  );
}

function RobotBadge() {
  return (
    <span className="robot-badge">
      <ExperimentOutlined />
    </span>
  );
}

function AgentWorkflowLab({ nodes }: { nodes: WorkflowNode[] }) {
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0].id);
  const selected = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];

  const pseudoCode = `from langgraph.graph import StateGraph

workflow = StateGraph(LearningState)
workflow.add_node("read_profile", read_learning_profile)
workflow.add_node("read_workload", read_weekly_workload)
workflow.add_node("retrieve_cards", retrieve_ai_principle_cards)
workflow.add_node("generate_mission", generate_low_load_mission)
workflow.add_node("check_impact", check_work_learning_balance)
workflow.add_node("human_review", require_human_confirmation)
workflow.add_node("write_evidence", write_growth_evidence_and_audit)

workflow.add_conditional_edges(
  "check_impact",
  route_by_workload_and_risk,
  {"micro": "generate_mission", "review": "human_review", "ok": "write_evidence"}
)`;

  return (
    <section className="workflow-lab co-growth-band" data-vc-kind="agent-workflow-lab">
      <div className="section-heading">
        <div>
          <Typography.Title level={3}>Agent Workflow Lab</Typography.Title>
          <Typography.Text type="secondary">从 prompt 迁移到可迭代、可协作、可审计的 workflow。</Typography.Text>
        </div>
        <Tag color="purple">Advanced</Tag>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={7}>
          <div className="workflow-node-list">
            {nodes.map((node) => (
              <button
                key={node.id}
                className={node.id === selectedNodeId ? "workflow-node active" : "workflow-node"}
                onClick={() => setSelectedNodeId(node.id)}
                data-vc-kind="workflow-node"
                data-vc-object-id={node.id}
                type="button"
              >
                {nodeIcon(node.type)}
                <span>{node.label}</span>
                <RiskTag risk={node.riskLevel} />
              </button>
            ))}
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div className="workflow-canvas">
            {nodes.map((node, index) => (
              <div className="workflow-step" key={node.id}>
                <span>{index + 1}</span>
                <div>
                  <Typography.Text strong>{node.label}</Typography.Text>
                  <Typography.Text type="secondary">{node.description}</Typography.Text>
                </div>
                {index < nodes.length - 1 ? <ForkOutlined className="workflow-arrow" /> : null}
              </div>
            ))}
          </div>
        </Col>
        <Col xs={24} md={7}>
          <div className="workflow-detail">
            <Typography.Title level={4}>{selected.label}</Typography.Title>
            <RiskTag risk={selected.riskLevel} />
            <p>{selected.description}</p>
            <InfoBlock title="State / Input" text={selected.input} />
            <InfoBlock title="Output" text={selected.output} />
            <InfoBlock title="Tool / Boundary" text={selected.tool ?? "无外部工具调用，保持前端 deterministic mock"} />
          </div>
        </Col>
      </Row>
      <pre className="workflow-code">{pseudoCode}</pre>
    </section>
  );
}
