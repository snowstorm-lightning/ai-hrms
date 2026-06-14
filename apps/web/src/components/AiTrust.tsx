import {
  AuditOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Collapse, Progress, Space, Tag, Timeline, Typography } from "antd";
import type { ContextPacket, HarnessDecision, RAGCitation, TrustPacket } from "../api/types";

export type TrustRiskLevel = "low" | "medium" | "high" | string;

const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const riskColors: Record<string, string> = {
  low: "blue",
  medium: "orange",
  high: "red",
};

export function riskLabel(risk: TrustRiskLevel) {
  return riskLabels[risk] ?? risk;
}

export function riskColor(risk: TrustRiskLevel) {
  return riskColors[risk] ?? "default";
}

export function RiskTag({ risk }: { risk: TrustRiskLevel }) {
  return <Tag color={riskColor(risk)}>{riskLabel(risk)}</Tag>;
}

export function TrustMetaBar({
  riskLevel,
  confidence,
  evidenceCount,
  humanReviewRequired,
  auditStatus,
  toolPreview,
}: {
  riskLevel: TrustRiskLevel;
  confidence?: number;
  evidenceCount?: number;
  humanReviewRequired?: boolean;
  auditStatus?: string;
  toolPreview?: boolean;
}) {
  return (
    <Space wrap className="trust-meta-bar">
      <RiskTag risk={riskLevel} />
      {typeof confidence === "number" ? <Tag>置信度 {confidence}%</Tag> : null}
      {typeof evidenceCount === "number" ? <Tag icon={<FileSearchOutlined />}>证据 {evidenceCount}</Tag> : null}
      {typeof toolPreview === "boolean" ? <Tag color={toolPreview ? "purple" : "default"}>{toolPreview ? "工具预览" : "无工具预览"}</Tag> : null}
      <Tag color={humanReviewRequired ? "red" : "green"}>
        {humanReviewRequired ? "需要人工复核" : "无需人工复核"}
      </Tag>
      {auditStatus ? <Tag icon={<AuditOutlined />}>审计：{auditStatus}</Tag> : null}
    </Space>
  );
}

export function TrustPacketBar({ packet }: { packet?: TrustPacket | null }) {
  if (!packet) return null;
  return (
    <TrustMetaBar
      riskLevel={packet.riskLevel}
      confidence={Math.round(packet.confidence * 100)}
      evidenceCount={packet.evidenceCount}
      humanReviewRequired={packet.humanReviewRequired}
      toolPreview={Boolean(packet.toolPreview)}
      auditStatus={packet.auditStatus}
    />
  );
}

export function ExecutionDecisionPanel({ decision }: { decision?: HarnessDecision | null }) {
  if (!decision) return null;
  return (
    <Collapse
      className="harness-decision-collapse"
      size="small"
      items={[{
        key: "execution",
        label: <Typography.Text strong>执行思路与路径</Typography.Text>,
        children: (
          <Alert
            className="harness-decision-panel"
            showIcon
            type={decision.humanReviewRequired ? "warning" : "info"}
            title={`Execution Router：${decision.executionMode}`}
            description={(
              <Space orientation="vertical" size={6}>
                <Typography.Text>{decision.reason}</Typography.Text>
                <Space wrap>
                  <Tag color={riskColor(decision.riskLevel)}>risk={decision.riskLevel}</Tag>
                  <Tag>intent={decision.intent}</Tag>
                  <Tag color={decision.useLlm ? "purple" : "default"}>LLM={String(decision.useLlm)}</Tag>
                  <Tag color={decision.useAgent ? "geekblue" : "default"}>agent={String(decision.useAgent)}</Tag>
                  {decision.routedBy.map((item) => <Tag key={item}>{item}</Tag>)}
                </Space>
              </Space>
            )}
          />
        ),
      }]}
    />
  );
}

export function ContextPacketPanel({ packet }: { packet?: ContextPacket | null }) {
  if (!packet) return null;
  return (
    <Collapse
      className="context-packet-collapse"
      size="small"
      items={[{
        key: "context",
        label: <Typography.Text strong>上下文证据</Typography.Text>,
        children: (
          <div className="context-packet-panel" data-vc-kind="context-packet">
            <Typography.Paragraph type="secondary">{packet.boundary}</Typography.Paragraph>
            <Space wrap>
              {Object.entries(packet.sourceCount).map(([key, value]) => <Tag key={key}>{key}={value}</Tag>)}
              <Tag>staleness={packet.staleness}</Tag>
            </Space>
            <div className="context-item-list">
              {packet.items.slice(0, 4).map((item, index) => (
                <article key={`${item.type}:${item.id ?? item.label}:${index}`} className="context-item-card">
                  <Typography.Text strong>{item.label}</Typography.Text>
                  <Typography.Text type="secondary">{item.summary}</Typography.Text>
                  <Space wrap>
                    <Tag>{item.type}</Tag>
                    {item.riskLevel ? <Tag color={riskColor(item.riskLevel)}>{item.riskLevel}</Tag> : null}
                    <Tag>{item.source}</Tag>
                  </Space>
                </article>
              ))}
            </div>
          </div>
        ),
      }]}
    />
  );
}

export function HumanReviewBanner({
  riskLevel,
  humanReviewRequired,
  text,
}: {
  riskLevel: TrustRiskLevel;
  humanReviewRequired: boolean;
  text?: string;
}) {
  if (!humanReviewRequired) {
    return (
      <Alert
        showIcon
        type="success"
        title="允许生成建议和预览"
        description={text ?? "该建议仍保留证据、引用和审计记录；执行前由人判断是否采纳。"}
      />
    );
  }

  return (
    <Alert
      showIcon
      type={riskLevel === "high" ? "warning" : "info"}
      title="需要人工确认"
      description={text ?? "涉及人、隐私、公平性或业务影响的场景只允许生成预览。系统不会自动执行人事裁决。"}
    />
  );
}

export function CitationList({ citations }: { citations: RAGCitation[] }) {
  if (!citations.length) {
    return <Typography.Text type="secondary">没有可展示引用；该回答不应进入正式建议。</Typography.Text>;
  }
  return (
    <div className="citation-list">
      {citations.map((citation) => (
        <article className="citation-card" key={citation.chunkId} data-vc-kind="citation" data-vc-object-type="rag_document" data-vc-object-id={citation.documentId} data-vc-label={citation.title}>
          <Space align="start">
            <FileSearchOutlined className="citation-icon" />
            <div>
              <Typography.Text strong>{citation.title}</Typography.Text>
              <Typography.Paragraph type="secondary">{citation.snippet}</Typography.Paragraph>
              <Tag>{citation.documentId}</Tag>
            </div>
          </Space>
        </article>
      ))}
    </div>
  );
}

export function CollaborationWorkflow() {
  const steps = [
    "Goal",
    "Context",
    "Agent Plan",
    "Tool Preview",
    "Human Review",
    "Audit",
  ];

  return (
    <div className="workflow-strip" data-vc-kind="human-agent-workflow">
      {steps.map((step, index) => (
        <div className="workflow-strip-step" key={step}>
          <span className="workflow-strip-index">{index + 1}</span>
          <Typography.Text strong>{step}</Typography.Text>
        </div>
      ))}
    </div>
  );
}

export function CollaborationRubric({ compact = false }: { compact?: boolean }) {
  const items = [
    { label: "目标明确", score: 88 },
    { label: "上下文充分", score: 82 },
    { label: "要求证据", score: 91 },
    { label: "识别风险", score: 86 },
    { label: "人工验证", score: 94 },
    { label: "进入审计", score: 89 },
  ];

  return (
    <div className={compact ? "rubric-grid compact" : "rubric-grid"} data-vc-kind="collaboration-rubric">
      {items.map((item) => (
        <div className="rubric-item" key={item.label}>
          <Typography.Text>{item.label}</Typography.Text>
          <Progress percent={item.score} size={compact ? "small" : "default"} aria-label={`${item.label}协作健康度`} />
        </div>
      ))}
    </div>
  );
}

export function EvidenceTimeline({ items }: { items: Array<{ title: string; description: string; riskLevel: TrustRiskLevel; time?: string }> }) {
  return (
    <Timeline
      items={items.map((item) => ({
        color: riskColor(item.riskLevel),
        icon: item.riskLevel === "high" ? <ExclamationCircleOutlined /> : item.riskLevel === "medium" ? <SafetyCertificateOutlined /> : <CheckCircleOutlined />,
        content: (
          <div>
            <Typography.Text strong>{item.title}</Typography.Text>
            <p>{item.description}</p>
            <Space wrap>
              <RiskTag risk={item.riskLevel} />
              {item.time ? <Tag>{item.time}</Tag> : null}
            </Space>
          </div>
        ),
      }))}
    />
  );
}
