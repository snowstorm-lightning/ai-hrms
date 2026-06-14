import { AuditOutlined, FileSearchOutlined, RobotOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Divider, Input, Select, Space, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import type { AgentRun, AIChatResponse, ContextPacket, HarnessDecision, RAGCitation, TrustPacket } from "../../api/types";
import { CitationList, ContextPacketPanel, ExecutionDecisionPanel, HumanReviewBanner, TrustMetaBar, TrustPacketBar } from "../../components/AiTrust";
import { InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { ActionResultGuide, TaskPath } from "../../components/TaskFlow";

type CommandResult = {
  answer: string;
  citations: RAGCitation[];
  run: AgentRun;
  riskLevel: string;
  confidence: number;
  humanReviewRequired: boolean;
  suggestedActions: string[];
  toolPreview: Array<{ tool: string; purpose: string; riskLevel: string; status: string }>;
  auditPreview: string[];
  executionDecision?: HarnessDecision;
  contextPacket?: ContextPacket;
  trustPacket?: TrustPacket;
};

const promptLibrary = [
  { label: "解释制度并给引用", value: "解释新员工 7 天内必须完成哪些事项，并给出引用来源。", riskLevel: "low" },
  { label: "生成新人 30 天成长计划", value: "为云衡互联网科技有限公司（虚构样本组织）的平台研发新人林晨生成新人 30 天成长计划，包含导师周雨桐复盘和 AI 学习任务。", riskLevel: "medium" },
  { label: "检查高风险建议", value: "检查一条面试建议是否涉及隐私、公平性或自动化录用风险。", riskLevel: "high" },
  { label: "生成下周带教计划", value: "为 HR 和导师生成下周带教计划，并标注哪些步骤需要人工确认。", riskLevel: "medium" },
  { label: "拆成执行工作流", value: "把新人学习推荐任务拆成可审计工作流：检索、生成、检查、人工确认、审计。", riskLevel: "medium" },
  { label: "预览学习推荐运行", value: "预览一次学习推荐运行，展示工具调用和审计状态。", riskLevel: "medium" },
  { label: "总结审计风险模式", value: "总结最近审计事件中的高风险模式，不输出任何人事裁决。", riskLevel: "high" },
];

const defaultCommandPrompt = "为云衡互联网科技有限公司（虚构样本组织）的平台研发新人林晨生成新人 30 天成长计划，包含导师周雨桐复盘和 AI 学习任务。";

function riskLabel(risk: string) {
  const labels: Record<string, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
  };
  return labels[risk] ?? risk;
}

function previewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    previewed: "已预览",
    blocked: "已阻断",
  };
  return labels[status] ?? status;
}

function toolNameLabel(tool: string) {
  const labels: Record<string, string> = {
    rag_search: "知识检索",
    learning_recommend: "学习推荐",
    people_decision_execute: "人事裁决写入",
  };
  return labels[tool] ?? tool;
}

function auditEventLabel(event: string) {
  const labels: Record<string, string> = {
    "ai.command.recommendation.preview": "AI 建议预览",
    "rag.citation.used": "已记录引用",
    "human.review.requested": "已请求人工复核",
    "agent.run.previewed": "已生成运行预览",
    "high_risk.action.blocked": "高风险动作已阻断",
    "audit.event.ready": "审计记录已准备",
  };
  return labels[event] ?? event;
}

function buildResult(chat: AIChatResponse, run: AgentRun, fallbackRiskLevel: string): CommandResult {
  const riskLevel = maxRiskLevel(chat.riskLevel || "low", fallbackRiskLevel);
  const humanReviewRequired = Boolean(chat.humanReviewRequired ?? riskLevel !== "low");
  return {
    answer: chat.message,
    citations: chat.citations ?? [],
    run,
    riskLevel,
    confidence: Math.round((chat.confidence ?? (riskLevel === "high" ? 0.76 : riskLevel === "medium" ? 0.84 : 0.91)) * 100),
    humanReviewRequired,
    suggestedActions: riskLevel === "high"
      ? ["生成风险说明", "请求 HR 人工确认", "查看引用和审计草案"]
      : riskLevel === "medium"
        ? ["生成执行计划预览", "请求导师/HR 复核", "把证据写入审计"]
        : ["生成低风险解释", "保存为运行预览", "写入检索日志"],
    toolPreview: [
      { tool: "rag_search", purpose: "检索已发布制度和治理资料", riskLevel: "low", status: "previewed" },
      { tool: "learning_recommend", purpose: "生成学习任务草案", riskLevel: "medium", status: "previewed" },
      { tool: "people_decision_execute", purpose: "自动做录用/淘汰/降薪判断", riskLevel: "high", status: "blocked" },
    ],
    auditPreview: [
      "ai.command.recommendation.preview",
      "rag.citation.used",
      humanReviewRequired ? "human.review.requested" : "agent.run.previewed",
      humanReviewRequired ? "high_risk.action.blocked" : "audit.event.ready",
    ],
    executionDecision: chat.executionDecision,
    contextPacket: chat.contextPacket,
    trustPacket: chat.trustPacket,
  };
}

export function AiCommandCenterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryPrompt = searchParams.get("q")?.trim() ?? "";
  const [prompt, setPrompt] = useState(queryPrompt || defaultCommandPrompt);
  const [riskLevel, setRiskLevel] = useState("medium");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasAgentRun = Boolean(result && result.run.status !== "not_created" && result.run.id !== "program-flow");

  useEffect(() => {
    if (!queryPrompt) return;
    setPrompt(queryPrompt);
    setResult(null);
  }, [queryPrompt]);

  const execute = async () => {
    setLoading(true);
    setError("");
    try {
      const chat = await api.aiChat(prompt);
      const effectiveRiskLevel = maxRiskLevel(chat.riskLevel || "low", riskLevel);
      const shouldCreateRun = ["single_agent", "multi_agent", "action_preview", "human_review_required"].includes(chat.executionDecision?.executionMode ?? "");
      const createdRun = shouldCreateRun
        ? await api.createAgentRun({ runType: "command_center", prompt, riskLevel: effectiveRiskLevel })
        : {
          id: "program-flow",
          runType: "deterministic_program_flow",
          status: "not_created",
          provider: chat.provider ?? "go-api",
          model: chat.model ?? "program",
          riskLevel: effectiveRiskLevel,
          summary: "执行路由判定该请求可由程序或检索完成，因此没有创建新的智能任务运行。",
          createdAt: new Date().toISOString(),
        };
      setResult(buildResult(chat, createdRun, riskLevel));
    } catch (err) {
      setError(getErrorMessage(err, "AI 指挥中心执行失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-command-page" data-vc-page="ai-command">
      <PageTitle
        title="AI 指挥中心"
        description="这是 HR 的任务操作台：检索、解释、生成计划、形成动作草稿，并把人工确认写入审计。"
      />
      <InlineError message={error} />
      <TaskPath
        title="AI 指挥闭环"
        steps={[
          { title: "选业务场景", detail: "用样例任务或直接输入需求", status: result ? "done" : "current" },
          { title: "生成治理型建议", detail: "得到计划、风险、引用和动作草稿", status: result ? "done" : "next" },
          { title: "人工判断", detail: "高风险只进入确认，不自动执行", status: result?.humanReviewRequired ? "blocked" : result ? "current" : "next" },
          { title: "追踪证据", detail: "去智能任务或审计页继续看链路", status: result ? "next" : "next" },
        ]}
      />

      <section className="command-layout">
        <Card className="command-panel" data-vc-kind="ai-command-panel">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            {queryPrompt ? (
              <Alert
                showIcon
                type="success"
                title="已带入刚才的问题"
                description="检查或补充下面的内容后，点击“生成治理型建议”查看结果。"
              />
            ) : null}
            <Alert
              showIcon
              type="info"
              title="统一风险策略"
              description="低风险只读解释；中风险生成计划和动作草稿，写操作前需要复核；高风险阻断执行，等待明确人工确认。"
            />
            <div className="prompt-library" data-vc-kind="ai-command-prompt-library">
              {promptLibrary.map((item) => (
                <Button
                  key={item.label}
                  size="small"
                  onClick={() => {
                    setPrompt(item.value);
                    setRiskLevel(item.riskLevel);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Input.TextArea
              data-vc-field="ai.prompt"
              aria-label="AI Command prompt"
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <Space wrap>
              <Select
                data-vc-field="ai.riskLevel"
                value={riskLevel}
                style={{ width: 220 }}
                onChange={setRiskLevel}
                options={[
                  { value: "low", label: "低风险：只读解释" },
                  { value: "medium", label: "中风险：行动计划预览" },
                  { value: "high", label: "高风险：必须人工确认" },
                ]}
              />
              <Button data-vc-action="ai.execute" type="primary" loading={loading} onClick={execute} icon={<ThunderboltOutlined />}>
                生成治理型建议
              </Button>
            </Space>
          </Space>
        </Card>

        <Card className="command-side-panel" title="人机协作边界">
          <div className="command-policy-list">
            <div><RobotOutlined /><span>AI 负责检索、解释、建议和生成计划。</span></div>
            <div><SafetyCertificateOutlined /><span>高风险建议只生成预览，不自动执行。</span></div>
            <div><FileSearchOutlined /><span>所有知识型回答必须展示 citation。</span></div>
            <div><AuditOutlined /><span>工具调用、人工确认和阻断都进入审计。</span></div>
          </div>
        </Card>
      </section>

      {result ? (
        <Card className="section-card structured-result" title="HR 场景工作台" data-vc-kind="ai-result">
          <TrustMetaBar
            riskLevel={result.riskLevel}
            confidence={result.confidence}
            evidenceCount={result.citations.length}
            humanReviewRequired={result.humanReviewRequired}
            toolPreview
            auditStatus={result.humanReviewRequired ? "waiting_human_review" : "preview_ready"}
          />
          <TrustPacketBar packet={result.trustPacket} />
          <ExecutionDecisionPanel decision={result.executionDecision} />
          <ContextPacketPanel packet={result.contextPacket} />
          <ActionResultGuide
            title={result.humanReviewRequired ? "建议已停在人工确认前" : "建议已生成，可继续核验证据"}
            description={hasAgentRun
              ? (result.humanReviewRequired ? "下一步不要把它当成已执行结果，先让 HR/导师查看证据和审计链。" : "低风险或中风险内容仍建议检查引用和动作草稿，再决定是否沉淀为运行预览。")
              : "这次请求由受控查询或知识检索完成，没有创建新的智能任务记录；请直接核验证据与审计说明。"}
            actions={hasAgentRun
              ? [
                { label: "查看本次任务记录", onClick: () => navigate("/app/agents"), type: "primary", icon: <RobotOutlined /> },
                { label: "查看审计记录", onClick: () => navigate("/app/audit"), icon: <AuditOutlined /> },
              ]
              : [
                { label: "查看审计记录", onClick: () => navigate("/app/audit"), type: "primary", icon: <AuditOutlined /> },
              ]}
          />
          <Divider />
          <HumanReviewBanner riskLevel={result.riskLevel} humanReviewRequired={result.humanReviewRequired} />
          <div className="result-section-grid">
            <article>
              <Typography.Title level={4}>业务场景</Typography.Title>
              <Space wrap>
                <Tag>对象：林晨 / 平台研发新人</Tag>
                <Tag>制度：入职 / AI 安全</Tag>
                <Tag>模式：预览</Tag>
              </Space>
              <Typography.Title level={4}>建议草案</Typography.Title>
              <Typography.Paragraph>{result.answer}</Typography.Paragraph>
            </article>
            <article>
              <Typography.Title level={4}>人工判断点</Typography.Title>
              <Typography.Paragraph type="secondary">
                这一步不是让 AI 做最终裁决，而是把计划、证据、动作草稿和审计草案交给 HR/导师确认。
              </Typography.Paragraph>
              <Typography.Title level={4}>建议下一步</Typography.Title>
              <Space wrap>
                {result.suggestedActions.map((action) => (
                  <Button
                    key={action}
                    onClick={() => message.info(`${action}：Demo 已生成反馈，真实执行前仍需权限和审计校验。`)}
                  >
                    {action}
                  </Button>
                ))}
              </Space>
            </article>
          </div>
          <Divider />
          <Typography.Title level={4}>证据与引用</Typography.Title>
          <CitationList citations={result.citations} />
          <Divider />
          <Typography.Title level={4}>动作草稿</Typography.Title>
          <div className="tool-preview-grid">
            {result.toolPreview.map((tool) => (
              <div className={tool.status === "blocked" ? "tool-preview-card blocked" : "tool-preview-card"} key={tool.tool}>
                <Typography.Text strong>{toolNameLabel(tool.tool)}</Typography.Text>
                <Typography.Text type="secondary">{tool.purpose}</Typography.Text>
                <Space wrap>
                  <Tag color={tool.riskLevel === "high" ? "red" : tool.riskLevel === "medium" ? "orange" : "blue"}>{riskLabel(tool.riskLevel)}</Tag>
                  <Tag>{previewStatusLabel(tool.status)}</Tag>
                </Space>
              </div>
            ))}
          </div>
          <Divider />
          <Typography.Title level={4}>审计预览</Typography.Title>
          <Col span={24}>
            <Space wrap>
              {result.auditPreview.map((event) => <Tag key={event}>{auditEventLabel(event)}</Tag>)}
            </Space>
          </Col>
        </Card>
      ) : null}
    </div>
  );
}

function maxRiskLevel(left: string, right: string) {
  const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
  return (rank[right] ?? 1) > (rank[left] ?? 1) ? right : left;
}
