import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { RAGDocument, RAGSearchResult, RAGSource } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function KnowledgePage() {
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("入职");
  const [result, setResult] = useState<RAGSearchResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSources, docs] = await Promise.all([api.ragSources(), api.ragDocuments(1, 20)]);
      setSources(nextSources);
      setDocuments(docs.rows ?? []);
      setTotal(docs.total);
    } catch (err) {
      setError(getErrorMessage(err, "知识库加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const search = async () => {
    setError("");
    try {
      setResult(await api.ragSearch(query));
    } catch (err) {
      setError(getErrorMessage(err, "知识检索失败"));
    }
  };

  return (
    <div data-vc-page="knowledge">
      <PageTitle title="知识库" description="管理可信资料、发布范围、RAG 检索和引用来源。" />
      <InlineError message={error} onRetry={reload} />
      <Card data-vc-kind="rag-search">
        <Space.Compact style={{ width: "100%" }}>
          <Input data-vc-field="rag.query" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button data-vc-action="rag.search" type="primary" onClick={search}>检索</Button>
          <Button data-vc-action="rag.document.create" onClick={() => setEditing(true)}>新增资料</Button>
        </Space.Compact>
        {result ? (
          <div className="result-panel">
            <Typography.Paragraph>{result.refusalReason ? "没有可引用资料，已拒绝回答。" : result.answer}</Typography.Paragraph>
            {result.citations.map((citation) => (
              <Tag key={citation.chunkId} data-vc-object-type="rag_document" data-vc-object-id={citation.documentId}>
                {citation.title}
              </Tag>
            ))}
          </div>
        ) : null}
      </Card>
      <Table
        className="section-card"
        rowKey="id"
        loading={loading}
        dataSource={documents}
        pagination={{ total }}
        locale={{ emptyText: <EmptyBlock description="暂无知识资料" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "rag_document",
          "data-vc-object-id": row.id,
          "data-vc-label": row.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "标题", dataIndex: "title" },
          { title: "版本", dataIndex: "version" },
          { title: "状态", dataIndex: "status", render: (status) => <Tag color={status === "published" ? "green" : "default"}>{status}</Tag> },
          { title: "可信等级", dataIndex: "trustLevel" },
          { title: "敏感级别", dataIndex: "sensitivity" },
        ]}
      />
      <Modal title="新增资料" open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()} width={760}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: "published", trustLevel: "official", sensitivity: "normal" }}
          onFinish={async (values) => {
            try {
              await api.createRAGDocument({
                ...values,
                scopes: [{ scopeType: "global", includeDescendants: true }],
              });
              setEditing(false);
              form.resetFields();
              await reload();
            } catch (err) {
              setError(getErrorMessage(err, "资料创建失败"));
            }
          }}
        >
          <Form.Item name="sourceId" label="来源"><Select allowClear options={sources.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: "draft", label: "草稿" }, { value: "published", label: "发布" }]} /></Form.Item>
          <Form.Item name="trustLevel" label="可信等级"><Input /></Form.Item>
          <Form.Item name="sensitivity" label="敏感级别"><Input /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
