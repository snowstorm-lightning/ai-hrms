import { Alert, Button, Card, Input, Select, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { AgentRun, RAGCitation } from "../../api/types";
import { InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function AiCommandCenterPage() {
  const [prompt, setPrompt] = useState("新员工入职 7 天内应该完成什么？");
  const [riskLevel, setRiskLevel] = useState("low");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<RAGCitation[]>([]);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const promptLibrary = [
    { label: "AI 原理解释", value: "用 5 分钟解释 RAG 原理，并说明它为什么不能彻底消除错误。" },
    { label: "工作任务改造", value: "把当前工作任务改造成一个不超过 30 分钟的 AI 实战 mission。" },
    { label: "学习负荷检查", value: "检查我的学习负荷是否过高，并给出不影响交付的节奏。" },
    { label: "复盘辅助", value: "帮我复盘一次 AI 使用过程，列出不可靠输出、验证方式和下次改进。" },
    { label: "Agent workflow 解释", value: "解释 Agent workflow 中 state、node、edge、工具调用和人工确认的作用。" },
    { label: "风险检查", value: "检查这条 AI 建议是否涉及隐私、公平性或自动化人事裁决风险。" },
  ];

  const execute = async () => {
    setLoading(true);
    setError("");
    try {
      const [chat, createdRun] = await Promise.all([
        api.aiChat(prompt),
        api.createAgentRun({ runType: "command_center", prompt, riskLevel }),
      ]);
      setAnswer(chat.message);
      setCitations(chat.citations);
      setRun(createdRun);
    } catch (err) {
      setError(getErrorMessage(err, "AI 指挥中心执行失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-vc-page="ai-command">
      <PageTitle title="AI Command Center" description="统一处理问答、检索、Agent 运行和可执行建议。" />
      <InlineError message={error} />
      <Card data-vc-kind="ai-command-panel">
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap data-vc-kind="ai-command-prompt-library">
            {promptLibrary.map((item) => (
              <Button key={item.label} size="small" onClick={() => setPrompt(item.value)}>
                {item.label}
              </Button>
            ))}
          </Space>
          <Input.TextArea
            data-vc-field="ai.prompt"
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <Space wrap>
            <Select
              data-vc-field="ai.riskLevel"
              value={riskLevel}
              style={{ width: 180 }}
              onChange={setRiskLevel}
              options={[
                { value: "low", label: "低风险自动执行" },
                { value: "medium", label: "中风险行动计划" },
                { value: "high", label: "高风险需确认" },
              ]}
            />
            <Button data-vc-action="ai.execute" type="primary" loading={loading} onClick={execute}>
              执行
            </Button>
          </Space>
        </Space>
      </Card>
      {answer ? (
        <Card className="section-card" title="结果" data-vc-kind="ai-result">
          <Alert
            showIcon
            type={riskLevel === "high" ? "warning" : "info"}
            message="AI 建议预览"
            description="结果仅作为可解释建议，执行前需要检查证据、风险、置信度和人工确认边界。"
          />
          <Typography.Paragraph>{answer}</Typography.Paragraph>
          <Space wrap>
            <Tag color={run?.riskLevel === "high" ? "red" : run?.riskLevel === "medium" ? "orange" : "blue"}>riskLevel={run?.riskLevel ?? riskLevel}</Tag>
            <Tag>confidence={run?.riskLevel === "high" ? 76 : run?.riskLevel === "medium" ? 84 : 91}%</Tag>
            <Tag>preview=true</Tag>
            <Tag color={run?.riskLevel === "high" ? "red" : "green"}>humanReviewRequired={String(run?.riskLevel === "high")}</Tag>
            <Tag>{run?.provider ?? "fake"} / {run?.model ?? "deterministic-v1"}</Tag>
            <Tag>{run?.status ?? "completed"}</Tag>
          </Space>
          <div className="reference-list">
            {citations.length ? citations.map((item) => (
              <div className="reference-row" key={item.chunkId} data-vc-kind="citation" data-vc-object-type="rag_document" data-vc-object-id={item.documentId}>
                <Typography.Text strong>{item.title}</Typography.Text>
                <Typography.Text type="secondary">{item.snippet}</Typography.Text>
              </div>
            )) : <Typography.Text type="secondary">没有引用来源</Typography.Text>}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
