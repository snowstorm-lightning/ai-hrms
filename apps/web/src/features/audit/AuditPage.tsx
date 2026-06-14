import { AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, FileSearchOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Card, Col, Row, Space, Table, Tag, Timeline, Typography } from "antd";
import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { AuditEvent } from "../../api/types";
import { EvidenceTimeline, TrustMetaBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

function riskColor(risk: string) {
  if (risk === "high") return "red";
  if (risk === "medium") return "orange";
  return "blue";
}

function eventLabel(eventType: string) {
  const type = eventType.toLowerCase();
  if (type.includes("blocked")) return "High-risk blocked";
  if (type.includes("citation")) return "Knowledge citation";
  if (type.includes("visual_copilot")) return "Visual Copilot evidence";
  if (type.includes("tool") || type.includes("preview")) return "Agent tool preview";
  if (type.includes("human.review") || type.endsWith(".reviewed") || type.includes("review.requested")) return "Human review";
  if (type.includes("co_growth")) return "Co-Growth evidence";
  if (type.includes("command")) return "AI suggestion";
  return "Audit event";
}

function auditSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return String(value || "已记录事件");
  }
  const data = value as Record<string, unknown>;
  const parts = [
    data.blockedReason ? `阻断原因：${String(data.blockedReason)}` : "",
    data.riskReason ? `风险原因：${String(data.riskReason)}` : "",
    typeof data.humanReviewRequired === "boolean" ? `人工确认：${data.humanReviewRequired ? "需要" : "不需要"}` : "",
    data.provider ? `provider=${String(data.provider)}` : "",
    Array.isArray(data.citations) && data.citations.length ? `引用=${data.citations.length}` : "",
    data.queryPreview ? `查询：${String(data.queryPreview)}` : "",
  ].filter(Boolean);
  if (parts.length) {
    return parts.join(" · ");
  }
  return JSON.stringify(value);
}

export function AuditPage() {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.auditEvents(1, 50);
      setItems(result.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "审计事件加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const stats = useMemo(() => ({
    high: items.filter((item) => item.riskLevel === "high").length,
    humanReview: items.filter((item) => item.eventType.includes("review")).length,
    citations: items.filter((item) => item.eventType.includes("citation")).length,
    blocked: items.filter((item) => item.eventType.includes("blocked")).length,
  }), [items]);

  const timelineItems = items.slice(0, 7).map((item) => ({
    title: eventLabel(item.eventType),
    description: `${item.eventType} · ${item.objectType}/${item.objectId}`,
    riskLevel: item.riskLevel,
    time: item.createdAt,
  }));

  return (
    <div className="audit-page" data-vc-page="audit">
      <PageTitle
        title="Trust, Audit & Evidence Layer"
        description="审计中心是 AI-HRMS 的可信底座：AI 建议、Agent 工具调用、知识引用、人工确认、阻断事件和成长证据都可回溯。"
      />
      <InlineError message={error} onRetry={reload} />

      <section className="audit-hero">
        <Card className="audit-summary-card">
          <Space orientation="vertical" size="middle">
            <TrustMetaBar riskLevel={stats.high ? "high" : "medium"} confidence={89} evidenceCount={items.length} humanReviewRequired={stats.high > 0} toolPreview auditStatus="recording" />
            <Alert
              showIcon
              type="warning"
              title="高风险动作必须 human-in-the-loop"
              description="审计层记录的不只是执行结果，也记录 AI 预览、人工确认请求、阻断原因和可补偿标记。"
            />
          </Space>
        </Card>
        <div className="audit-stat-grid">
          <Card><Typography.Text type="secondary">审计事件</Typography.Text><Typography.Title level={3}>{items.length}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">高风险</Typography.Text><Typography.Title level={3}>{stats.high}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">人工确认</Typography.Text><Typography.Title level={3}>{stats.humanReview}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">高风险阻断</Typography.Text><Typography.Title level={3}>{stats.blocked}</Typography.Title></Card>
        </div>
      </section>

      <Row gutter={[16, 16]} className="section-card">
        <Col xs={24} lg={12}>
          <Card title="审计链路时间线" data-vc-kind="audit-evidence-timeline">
            <EvidenceTimeline items={timelineItems} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="可解释摘要">
            <div className="audit-explain-grid">
              <div><FileSearchOutlined /><span>Knowledge citation：回答使用了哪些资料、片段和范围。</span></div>
              <div><AuditOutlined /><span>Agent tool preview：执行前展示工具、参数和风险。</span></div>
              <div><SafetyCertificateOutlined /><span>Human review：高风险建议等待人工确认。</span></div>
              <div><CloseCircleOutlined /><span>Blocked event：系统明确阻断自动化人事裁决。</span></div>
              <div><CheckCircleOutlined /><span>Reversible marker：低中风险动作保留回滚或补偿说明。</span></div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="section-card">
        {items.filter((item) => item.riskLevel === "high" || item.eventType.includes("review") || item.eventType.includes("blocked")).slice(0, 3).map((item) => (
          <Col xs={24} md={8} key={item.id}>
            <Card className="audit-risk-card" data-vc-kind="audit-risk-card" data-vc-object-type="audit_event" data-vc-object-id={item.id} data-vc-label={item.eventType}>
              <Space orientation="vertical">
                <Tag color={riskColor(item.riskLevel)}>{item.riskLevel}</Tag>
                <Typography.Text strong>{eventLabel(item.eventType)}</Typography.Text>
                <Typography.Text type="secondary">{item.eventType}</Typography.Text>
                <Typography.Paragraph>{auditSummary(item.newValueSummary)}</Typography.Paragraph>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Table
        className="section-card audit-event-table hr-desktop-record-table"
        rowKey="id"
        loading={loading}
        dataSource={items}
        scroll={{ x: 1180 }}
        locale={{ emptyText: <EmptyBlock description="暂无审计事件" /> }}
        onRow={(row) => ({
          "data-vc-kind": "audit-event-row",
          "data-vc-object-type": "audit_event",
          "data-vc-object-id": row.id,
          "data-vc-label": row.eventType,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "事件类型", dataIndex: "eventType", width: 260, ellipsis: true },
          { title: "分类", width: 180, render: (_, row) => <Tag>{eventLabel(row.eventType)}</Tag> },
          { title: "对象", width: 240, render: (_, row) => <><Tag>{row.objectType}</Tag><Typography.Text className="audit-object-id">{row.objectId}</Typography.Text></> },
          { title: "风险", dataIndex: "riskLevel", width: 100, render: (risk) => <Tag color={riskColor(risk)}>{risk}</Tag> },
          { title: "来源", dataIndex: "source", width: 120 },
          { title: "证据摘要", width: 300, render: (_, row) => <Typography.Text className="audit-summary-text" ellipsis>{auditSummary(row.newValueSummary)}</Typography.Text> },
          { title: "时间", dataIndex: "createdAt", width: 220 },
        ]}
      />
      <div className="section-card hr-mobile-record-list" data-vc-kind="audit-event-mobile-list">
        {loading ? <Card loading className="hr-mobile-record-card" /> : null}
        {!loading && !items.length ? <EmptyBlock description="暂无审计事件" /> : null}
        {items.map((item) => (
          <article className="hr-mobile-record-card" key={item.id} data-vc-kind="audit-event-mobile-card" data-vc-object-type="audit_event" data-vc-object-id={item.id} data-vc-label={item.eventType}>
            <span className="hr-mobile-card-title">{eventLabel(item.eventType)}</span>
            <span className="hr-mobile-card-meta">{item.eventType}</span>
            <span className="hr-mobile-card-meta">{item.objectType}/{item.objectId}</span>
            <span className="hr-mobile-card-tags">
              <Tag color={riskColor(item.riskLevel)}>{item.riskLevel}</Tag>
              <Tag>{item.source}</Tag>
              <Tag>{new Date(item.createdAt).toLocaleString()}</Tag>
            </span>
            <Typography.Text type="secondary">{auditSummary(item.newValueSummary)}</Typography.Text>
          </article>
        ))}
      </div>
    </div>
  );
}
