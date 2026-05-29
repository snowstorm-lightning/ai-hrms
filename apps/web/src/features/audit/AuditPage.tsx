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
  if (eventType.includes("citation")) return "Knowledge citation";
  if (eventType.includes("tool")) return "Agent tool preview";
  if (eventType.includes("review")) return "Human review";
  if (eventType.includes("blocked")) return "High-risk blocked";
  if (eventType.includes("co_growth")) return "Co-Growth evidence";
  if (eventType.includes("command")) return "AI suggestion";
  return "Audit event";
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
            <Card className="audit-risk-card" data-vc-kind="audit-risk-card" data-vc-object-type={item.objectType} data-vc-object-id={item.objectId} data-vc-label={item.eventType}>
              <Space orientation="vertical">
                <Tag color={riskColor(item.riskLevel)}>{item.riskLevel}</Tag>
                <Typography.Text strong>{eventLabel(item.eventType)}</Typography.Text>
                <Typography.Text type="secondary">{item.eventType}</Typography.Text>
                <Typography.Paragraph>{JSON.stringify(item.newValueSummary)}</Typography.Paragraph>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Table
        className="section-card"
        rowKey="id"
        loading={loading}
        dataSource={items}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: <EmptyBlock description="暂无审计事件" /> }}
        onRow={(row) => ({
          "data-vc-kind": "audit-event-row",
          "data-vc-object-type": row.objectType,
          "data-vc-object-id": row.objectId,
          "data-vc-label": row.eventType,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "事件类型", dataIndex: "eventType", width: 260, ellipsis: true },
          { title: "分类", width: 180, render: (_, row) => <Tag>{eventLabel(row.eventType)}</Tag> },
          { title: "对象", width: 260, render: (_, row) => <><Tag>{row.objectType}</Tag><Typography.Text>{row.objectId}</Typography.Text></> },
          { title: "风险", dataIndex: "riskLevel", width: 100, render: (risk) => <Tag color={riskColor(risk)}>{risk}</Tag> },
          { title: "来源", dataIndex: "source", width: 120 },
          { title: "证据摘要", width: 340, render: (_, row) => <Typography.Text ellipsis>{JSON.stringify(row.newValueSummary)}</Typography.Text> },
          { title: "时间", dataIndex: "createdAt", width: 220 },
        ]}
      />
    </div>
  );
}
