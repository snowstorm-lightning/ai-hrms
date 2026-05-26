import { Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
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

  return (
    <div data-vc-page="audit">
      <PageTitle title="审计与回滚中心" description="追踪 AI、知识库、学习和业务写操作的证据链。" />
      <InlineError message={error} onRetry={reload} />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: <EmptyBlock description="暂无审计事件" /> }}
        columns={[
          { title: "事件", dataIndex: "eventType" },
          { title: "对象", render: (_, row) => `${row.objectType}:${row.objectId}` },
          { title: "风险", dataIndex: "riskLevel", render: (risk) => <Tag color={risk === "high" ? "red" : risk === "medium" ? "orange" : "blue"}>{risk}</Tag> },
          { title: "来源", dataIndex: "source" },
          { title: "摘要", render: (_, row) => <Typography.Text ellipsis>{JSON.stringify(row.newValueSummary)}</Typography.Text> },
          { title: "时间", dataIndex: "createdAt" },
        ]}
      />
    </div>
  );
}
