import { Card, Col, Row, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { AuditEvent } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

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
  const coGrowthEvents = useMemo(() => items.filter((item) => item.objectType.includes("co_growth") || item.eventType.includes("co_growth")), [items]);
  const highRiskEvents = useMemo(() => items.filter((item) => item.riskLevel === "high"), [items]);

  return (
    <div data-vc-page="audit">
      <PageTitle title="审计与回滚中心" description="追踪 AI、知识库、学习和业务写操作的证据链。" />
      <InlineError message={error} onRetry={reload} />
      <Row gutter={[16, 16]} className="section-card">
        <Col xs={24} md={8}><Card><Typography.Text type="secondary">审计事件</Typography.Text><Typography.Title level={3}>{items.length}</Typography.Title></Card></Col>
        <Col xs={24} md={8}><Card><Typography.Text type="secondary">Co-Growth 相关</Typography.Text><Typography.Title level={3}>{coGrowthEvents.length}</Typography.Title></Card></Col>
        <Col xs={24} md={8}><Card><Typography.Text type="secondary">高风险需人工确认</Typography.Text><Typography.Title level={3}>{highRiskEvents.length}</Typography.Title></Card></Col>
      </Row>
      <Table
        className="section-card"
        rowKey="id"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: <EmptyBlock description="暂无审计事件" /> }}
        onRow={(row) => ({
          "data-vc-kind": "audit-event-row",
          "data-vc-object-type": row.objectType,
          "data-vc-object-id": row.objectId,
          "data-vc-label": row.eventType,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "事件", dataIndex: "eventType" },
          { title: "对象", render: (_, row) => <><Tag>{row.objectType}</Tag><Typography.Text>{row.objectId}</Typography.Text></> },
          { title: "风险", dataIndex: "riskLevel", render: (risk) => <Tag color={risk === "high" ? "red" : risk === "medium" ? "orange" : "blue"}>{risk}</Tag> },
          { title: "来源", dataIndex: "source" },
          { title: "摘要", render: (_, row) => <Typography.Text ellipsis>{JSON.stringify(row.newValueSummary)}</Typography.Text> },
          { title: "时间", dataIndex: "createdAt" },
        ]}
      />
    </div>
  );
}
