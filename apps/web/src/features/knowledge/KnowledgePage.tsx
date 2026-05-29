import { DatabaseOutlined, FileSearchOutlined, SafetyCertificateOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { RAGDocument, RAGIngestJob, RAGSearchResult, RAGSource } from "../../api/types";
import { CitationList, TrustMetaBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

function sensitivityColor(value: string) {
  if (value === "restricted") return "red";
  if (value === "internal") return "orange";
  return "green";
}

function trustColor(value: string) {
  if (value === "official") return "green";
  if (value === "reviewed") return "blue";
  return "orange";
}

function canUseForAI(document: RAGDocument) {
  return document.status === "published" && document.sensitivity !== "restricted";
}

function scopeText(document: RAGDocument) {
  const scopes = document.scopes ?? [];
  if (!scopes.length) return "global";
  return scopes.map((scope) => scope.roleCode ? `${scope.scopeType}:${scope.roleCode}` : scope.scopeType).join(", ");
}

export function KnowledgePage() {
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("新人 30 天成长计划需要引用哪些资料？");
  const [result, setResult] = useState<RAGSearchResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestJob, setIngestJob] = useState<RAGIngestJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const [ingestForm] = Form.useForm();

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
    setSearching(true);
    setError("");
    try {
      setResult(await api.ragSearch(query));
    } catch (err) {
      setError(getErrorMessage(err, "知识检索失败"));
    } finally {
      setSearching(false);
    }
  };

  const governanceStats = useMemo(() => ({
    official: documents.filter((item) => item.trustLevel === "official").length,
    restricted: documents.filter((item) => item.sensitivity === "restricted").length,
    usable: documents.filter(canUseForAI).length,
  }), [documents]);

  return (
    <div className="knowledge-page" data-vc-page="knowledge">
      <PageTitle
        title="Governed Knowledge Hub"
        description="组织知识层不是普通文档表，而是 AI-HRMS 回答、计划、Agent run 和审计证据的受控来源。"
      />
      <InlineError message={error} onRetry={reload} />

      <section className="knowledge-hero">
        <Card className="knowledge-search-card" data-vc-kind="rag-search">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              showIcon
              type="info"
              title="RAG 回答必须暴露资料治理状态"
              description="AI 回答前需要检查 status、trustLevel、sensitivity、scope 和 citation。敏感或草稿资料不能直接进入正式建议。"
            />
            <Space.Compact style={{ width: "100%" }}>
              <Input data-vc-field="rag.query" aria-label="RAG search query" value={query} onChange={(event) => setQuery(event.target.value)} />
              <Button data-vc-action="rag.search" type="primary" loading={searching} onClick={search}>RAG Search</Button>
              <Button data-vc-action="rag.document.create" onClick={() => setEditing(true)}>新增资料</Button>
              <Button data-vc-action="rag.ingest" onClick={() => setIngestOpen(true)}>Ingest</Button>
            </Space.Compact>
            {result ? (
              <div className="result-panel">
                <TrustMetaBar riskLevel={result.riskLevel ?? "medium"} confidence={Math.round((result.confidence ?? 0.86) * 100)} evidenceCount={result.citations.length} humanReviewRequired={result.humanReviewRequired ?? false} auditStatus={result.auditStatus ?? "retrieval_logged"} />
                <Typography.Paragraph>{result.refusalReason ? "没有可引用资料，已拒绝回答。" : result.answer}</Typography.Paragraph>
                <CitationList citations={result.citations} />
              </div>
            ) : null}
          </Space>
        </Card>
        <div className="knowledge-stats">
          <Card><Typography.Text type="secondary">Official sources</Typography.Text><Typography.Title level={3}>{governanceStats.official}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">AI usable</Typography.Text><Typography.Title level={3}>{governanceStats.usable}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">Restricted</Typography.Text><Typography.Title level={3}>{governanceStats.restricted}</Typography.Title></Card>
        </div>
      </section>

      <section className="knowledge-document-grid" data-vc-kind="governed-document-cards">
        {documents.map((document) => (
          <article
            className={canUseForAI(document) ? "knowledge-document-card" : "knowledge-document-card warning"}
            key={document.id}
            data-vc-kind="rag-document-card"
            data-vc-object-type="rag_document"
            data-vc-object-id={document.id}
            data-vc-label={document.title}
          >
            <div className="knowledge-card-top">
              <span className="knowledge-card-icon"><DatabaseOutlined /></span>
              <Tag color={document.status === "published" ? "green" : "default"}>{document.status}</Tag>
            </div>
            <Typography.Text strong>{document.title}</Typography.Text>
            <Typography.Paragraph type="secondary">{document.content ?? "该资料只展示治理元数据；真实内容由 Go/RAG 层按 scope 返回。"}</Typography.Paragraph>
            <Space wrap>
              <Tag color={trustColor(document.trustLevel)}>trustLevel={document.trustLevel}</Tag>
              <Tag color={sensitivityColor(document.sensitivity)}>sensitivity={document.sensitivity}</Tag>
              <Tag>scope={scopeText(document)}</Tag>
            </Space>
            <Alert
              showIcon
              type={canUseForAI(document) ? "success" : "warning"}
              title={canUseForAI(document) ? "可用于 AI 回答" : "不可直接用于正式 AI 回答"}
              description={canUseForAI(document) ? "引用会进入 retrieval log 和 audit。" : "草稿、受限或过期资料需要人工复核。"}
            />
            <Space wrap>
              <Button
                size="small"
                icon={<FileSearchOutlined />}
                onClick={() => {
                  setResult({
                    answer: `引用预览：${document.title} 可作为回答证据，但结论仍需人工检查是否被片段支持。`,
                    citations: [{ documentId: document.id, chunkId: `${document.id}-preview`, title: document.title, snippet: document.content ?? "Demo citation preview" }],
                  });
                }}
              >
                引用预览
              </Button>
              <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => message.info("Demo：已生成资料治理提示，真实发布需 Go 授权和审计。")}>
                治理提示
              </Button>
            </Space>
          </article>
        ))}
      </section>

      <Table
        className="section-card"
        rowKey="id"
        loading={loading}
        dataSource={documents}
        pagination={{ total }}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: <EmptyBlock description="暂无知识资料" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "rag_document",
          "data-vc-object-id": row.id,
          "data-vc-label": row.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "标题", dataIndex: "title", width: 260, ellipsis: true },
          { title: "来源", width: 220, ellipsis: true, render: (_, row) => sources.find((source) => source.id === row.sourceId)?.name ?? "未绑定" },
          { title: "状态", dataIndex: "status", width: 120, render: (status) => <Tag color={status === "published" ? "green" : "default"}>{status}</Tag> },
          { title: "可信等级", dataIndex: "trustLevel", width: 140, render: (value) => <Tag color={trustColor(value)}>{value}</Tag> },
          { title: "敏感级别", dataIndex: "sensitivity", width: 140, render: (value) => <Tag color={sensitivityColor(value)}>{value}</Tag> },
          { title: "AI 使用", width: 150, render: (_, row) => canUseForAI(row) ? <Tag color="green">allowed</Tag> : <Tag icon={<WarningOutlined />} color="orange">review first</Tag> },
        ]}
      />

      <Modal title="新增治理型知识资料" open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()} width={760}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: "published", trustLevel: "reviewed", sensitivity: "normal" }}
          onFinish={async (values) => {
            try {
              await api.createRAGDocument({
                ...values,
                scopes: [{ scopeType: "global", includeDescendants: true }],
              });
              setEditing(false);
              form.resetFields();
              await reload();
              message.success("Demo 已保存资料，并生成可审计的治理元数据。");
            } catch (err) {
              setError(getErrorMessage(err, "资料创建失败"));
            }
          }}
        >
          <Form.Item name="sourceId" label="来源"><Select allowClear options={sources.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: "draft", label: "草稿" }, { value: "published", label: "发布" }]} /></Form.Item>
          <Form.Item name="trustLevel" label="可信等级"><Select options={[{ value: "official", label: "official" }, { value: "reviewed", label: "reviewed" }, { value: "internal", label: "internal" }]} /></Form.Item>
          <Form.Item name="sensitivity" label="敏感级别"><Select options={[{ value: "normal", label: "normal" }, { value: "internal", label: "internal" }, { value: "restricted", label: "restricted" }]} /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="RAG Ingest Job"
        open={ingestOpen}
        onCancel={() => setIngestOpen(false)}
        onOk={() => ingestForm.submit()}
        confirmLoading={ingesting}
        width={760}
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            showIcon
            type="info"
            title="真实模式会通过 Go 授权后调用 Python Agent Boundary"
            description="Agent 负责生成 embedding，PostgreSQL/pgvector 存储向量，检索仍按 scope、sensitivity、status 过滤。"
          />
          {ingestJob ? (
            <Alert
              showIcon
              type={ingestJob.status === "completed" ? "success" : "warning"}
              title={`Job ${ingestJob.status} / ${ingestJob.provider}`}
              description={ingestJob.summary || ingestJob.error || "已创建 ingest job。"}
            />
          ) : null}
          <Form
            form={ingestForm}
            layout="vertical"
            initialValues={{ jobType: "ingest" }}
            onFinish={async (values) => {
              setIngesting(true);
              setError("");
              try {
                const job = await api.createRAGIngestJob(values);
                setIngestJob(job);
                await reload();
                message.success("Ingest job 已完成，资料进入可治理知识层。");
              } catch (err) {
                setError(getErrorMessage(err, "Ingest job 创建失败"));
              } finally {
                setIngesting(false);
              }
            }}
          >
            <Form.Item name="sourceId" label="来源"><Select allowClear options={sources.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
            <Form.Item name="jobType" label="Job 类型"><Select options={[{ value: "ingest", label: "ingest" }]} /></Form.Item>
            <Form.Item name="title" label="资料标题" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="content" label="资料内容" rules={[{ required: true }]}><Input.TextArea rows={7} /></Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}
