import { AuditOutlined, FileSearchOutlined, RobotOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Divider, Input, Select, Space, Tag, Typography, message } from "antd";
import { useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { AgentRun, RAGCitation } from "../../api/types";
import { CitationList, HumanReviewBanner, TrustMetaBar } from "../../components/AiTrust";
import { InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

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
};

const promptLibrary = [
  { label: "解释制度并给引用", value: "解释新员工 7 天内必须完成哪些事项，并给出引用来源。", riskLevel: "low" },
  { label: "生成新人 30 天成长计划", value: "为研发实习生生成新人 30 天成长计划，包含导师复盘和 AI 学习 mission。", riskLevel: "medium" },
  { label: "检查高风险建议", value: "检查一条面试建议是否涉及隐私、公平性或自动化录用风险。", riskLevel: "high" },
  { label: "生成下周带教计划", value: "为 HR 和导师生成下周带教计划，并标注哪些步骤需要人工确认。", riskLevel: "medium" },
  { label: "拆成 Agent workflow", value: "把新人学习推荐任务拆成 Agent workflow：检索、生成、检查、人工确认、审计。", riskLevel: "medium" },
  { label: "预览学习推荐 Agent run", value: "预览一次学习推荐 Agent run，展示工具调用和审计状态。", riskLevel: "medium" },
  { label: "总结审计风险模式", value: "总结最近审计事件中的高风险模式，不输出任何人事裁决。", riskLevel: "high" },
];

function buildResult(chatMessage: string, citations: RAGCitation[], run: AgentRun, riskLevel: string): CommandResult {
  const humanReviewRequired = riskLevel !== "low";
  return {
    answer: chatMessage,
    citations,
    run,
    riskLevel,
    confidence: riskLevel === "high" ? 76 : riskLevel === "medium" ? 84 : 91,
    humanReviewRequired,
    suggestedActions: riskLevel === "high"
      ? ["生成风险说明", "请求 HR 人工确认", "查看引用和审计草案"]
      : riskLevel === "medium"
        ? ["生成执行计划预览", "请求导师/HR 复核", "把证据写入审计"]
        : ["生成低风险解释", "保存为 Agent run", "写入检索日志"],
    toolPreview: [
      { tool: "rag_search", purpose: "检索已发布制度和治理资料", riskLevel: "low", status: "previewed" },
      { tool: "learning_recommend", purpose: "生成学习 mission 草案", riskLevel: "medium", status: "previewed" },
      { tool: "people_decision_execute", purpose: "自动做录用/淘汰/降薪判断", riskLevel: "high", status: "blocked" },
    ],
    auditPreview: [
      "ai.command.recommendation.preview",
      "rag.citation.used",
      humanReviewRequired ? "human.review.requested" : "agent.run.previewed",
      humanReviewRequired ? "high_risk.action.blocked" : "audit.event.ready",
    ],
  };
}

export function AiCommandCenterPage() {
  const [prompt, setPrompt] = useState("为研发实习生生成新人 30 天成长计划，包含导师复盘和 AI 学习 mission。");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const execute = async () => {
    setLoading(true);
    setError("");
    try {
      const [chat, createdRun] = await Promise.all([
        api.aiChat(prompt),
        api.createAgentRun({ runType: "command_center", prompt, riskLevel }),
      ]);
      setResult(buildResult(chat.message, chat.citations, createdRun, riskLevel));
    } catch (err) {
      setError(getErrorMessage(err, "AI 指挥中心执行失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-command-page" data-vc-page="ai-command">
      <PageTitle
        title="Agentic HR Command Center"
        description="不是聊天框，而是 HR Agent 操作台：检索、解释、建议、生成计划、预览工具调用，并把人工确认写入审计。"
      />
      <InlineError message={error} />

      <section className="command-layout">
        <Card className="command-panel" data-vc-kind="ai-command-panel">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              showIcon
              type="info"
              title="统一风险策略"
              description="low=只读解释；medium=生成计划和工具预览，写操作前需要复核；high=阻断执行，等待明确人工确认。"
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

        <Card className="command-side-panel" title="Human-Agent Policy">
          <div className="command-policy-list">
            <div><RobotOutlined /><span>AI 负责检索、解释、建议和生成计划。</span></div>
            <div><SafetyCertificateOutlined /><span>高风险建议只生成预览，不自动执行。</span></div>
            <div><FileSearchOutlined /><span>所有知识型回答必须展示 citation。</span></div>
            <div><AuditOutlined /><span>工具调用、人工确认和阻断都进入审计。</span></div>
          </div>
        </Card>
      </section>

      {result ? (
        <Card className="section-card structured-result" title="HR Scenario Workbench" data-vc-kind="ai-result">
          <TrustMetaBar
            riskLevel={result.riskLevel}
            confidence={result.confidence}
            evidenceCount={result.citations.length}
            humanReviewRequired={result.humanReviewRequired}
            toolPreview
            auditStatus={result.humanReviewRequired ? "waiting_human_review" : "preview_ready"}
          />
          <Divider />
          <HumanReviewBanner riskLevel={result.riskLevel} humanReviewRequired={result.humanReviewRequired} />
          <div className="result-section-grid">
            <article>
              <Typography.Title level={4}>Scenario</Typography.Title>
              <Space wrap>
                <Tag>object=employee:研发实习生</Tag>
                <Tag>policy=onboarding / AI safety</Tag>
                <Tag>mode=preview</Tag>
              </Space>
              <Typography.Title level={4}>Proposed Plan</Typography.Title>
              <Typography.Paragraph>{result.answer}</Typography.Paragraph>
            </article>
            <article>
              <Typography.Title level={4}>Human Decision Gate</Typography.Title>
              <Typography.Paragraph type="secondary">
                这一步不是让 AI 做最终裁决，而是把计划、证据、工具预览和审计草案交给 HR/导师确认。
              </Typography.Paragraph>
              <Typography.Title level={4}>Suggested Actions</Typography.Title>
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
          <Typography.Title level={4}>Evidence / Citation</Typography.Title>
          <CitationList citations={result.citations} />
          <Divider />
          <Typography.Title level={4}>Tool Preview</Typography.Title>
          <div className="tool-preview-grid">
            {result.toolPreview.map((tool) => (
              <div className={tool.status === "blocked" ? "tool-preview-card blocked" : "tool-preview-card"} key={tool.tool}>
                <Typography.Text strong>{tool.tool}</Typography.Text>
                <Typography.Text type="secondary">{tool.purpose}</Typography.Text>
                <Space wrap>
                  <Tag color={tool.riskLevel === "high" ? "red" : tool.riskLevel === "medium" ? "orange" : "blue"}>{tool.riskLevel}</Tag>
                  <Tag>{tool.status}</Tag>
                </Space>
              </div>
            ))}
          </div>
          <Divider />
          <Typography.Title level={4}>Audit Preview</Typography.Title>
          <Col span={24}>
            <Space wrap>
              {result.auditPreview.map((event) => <Tag key={event}>{event}</Tag>)}
            </Space>
          </Col>
        </Card>
      ) : null}
    </div>
  );
}
