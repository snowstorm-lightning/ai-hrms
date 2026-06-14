import { DatabaseOutlined, FileSearchOutlined, SafetyCertificateOutlined, SyncOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { RAGDocument, RAGIngestJob, RAGSearchResult, RAGSource } from "../../api/types";
import { CitationList, TrustMetaBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { TaskPath } from "../../components/TaskFlow";

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
  const [savingDocument, setSavingDocument] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestJob, setIngestJob] = useState<RAGIngestJob | null>(null);
  const [rebuildJob, setRebuildJob] = useState<RAGIngestJob | null>(null);
  const [rebuildingId, setRebuildingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [ingestForm] = Form.useForm();
  const [modal, modalContextHolder] = Modal.useModal();

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
    const trimmed = query.trim();
    if (!trimmed) {
      message.warning("请输入需要检索的问题。");
      return;
    }
    setSearching(true);
    setError("");
    try {
      setResult(await api.ragSearch(trimmed));
    } catch (err) {
      setError(getErrorMessage(err, "知识检索失败"));
    } finally {
      setSearching(false);
    }
  };

  const rebuildDocument = async (document: RAGDocument) => {
    setRebuildingId(document.id);
    setError("");
    try {
      const job = await api.rebuildRAGDocument(document.id);
      setRebuildJob(job);
      message.success(job.summary || "已重建 chunk 与 embedding。");
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "重建向量失败"));
    } finally {
      setRebuildingId("");
    }
  };

  const governanceStats = useMemo(() => ({
    official: documents.filter((item) => item.trustLevel === "official").length,
    restricted: documents.filter((item) => item.sensitivity === "restricted").length,
    usable: documents.filter(canUseForAI).length,
  }), [documents]);

  return (
    <div className="knowledge-page" data-vc-page="knowledge">
      {modalContextHolder}
      <PageTitle
        title="治理型知识库"
        description="组织知识层不是普通文档表，而是 AI-HRMS 回答、计划、Agent run 和审计证据的受控来源。"
      />
      <InlineError message={error} onRetry={reload} />
      <TaskPath
        title="知识引用闭环"
        steps={[
          { title: "检索或选择资料", detail: "先定位候选资料和引用范围", status: result ? "done" : "current" },
          { title: "检查治理状态", detail: "看 status、sensitivity、scope 是否允许引用", status: result ? "done" : "next" },
          { title: "生成候选引用", detail: "只把可用资料带入回答", status: result ? "current" : "next" },
          { title: "重建或复核", detail: "过期、受限、草稿资料先处理再使用", status: result?.refusalReason ? "blocked" : "next" },
        ]}
      />

      <section className="knowledge-hero">
        <Card className="knowledge-search-card" data-vc-kind="rag-search">
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Alert
              showIcon
              type="info"
              title="RAG Search：回答必须暴露资料治理状态和检索路径"
              description="检索先按 status、trustLevel、sensitivity、scope 过滤，再用 PostgreSQL lexical + pgvector candidates 做 RRF 融合。reranker 暂不启用，保留为后续受控阶段。"
            />
            <div className="knowledge-search-row">
              <Input data-vc-field="rag.query" aria-label="RAG search query" placeholder="输入要回答的问题或需要核验的政策点" value={query} onChange={(event) => setQuery(event.target.value)} onPressEnter={search} />
              <Button data-vc-action="rag.search" type="primary" loading={searching} onClick={search}>检索引用</Button>
              <Button data-vc-action="rag.document.create" onClick={() => setEditing(true)}>新增资料</Button>
              <Button data-vc-action="rag.ingest" onClick={() => setIngestOpen(true)}>导入/重建资料</Button>
            </div>
            {result ? (
              <div className="result-panel">
                <TrustMetaBar riskLevel={result.riskLevel ?? "unknown"} confidence={result.confidence === undefined ? 0 : Math.round(result.confidence * 100)} evidenceCount={result.citations.length} humanReviewRequired={result.humanReviewRequired ?? true} auditStatus={result.auditStatus ?? "metadata_missing"} />
                <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} className="knowledge-retrieval-meta">
                  <Descriptions.Item label="retrieval">{result.provider ?? "not returned"}</Descriptions.Item>
                  <Descriptions.Item label="model">{result.model ?? "not returned"}</Descriptions.Item>
                  <Descriptions.Item label="top score">{result.citations[0]?.score ? result.citations[0].score.toFixed(2) : "not returned"}</Descriptions.Item>
                </Descriptions>
                <Typography.Paragraph>{result.refusalReason ? "没有可引用资料，已拒绝回答。" : result.answer}</Typography.Paragraph>
                <CitationList citations={result.citations} />
              </div>
            ) : null}
            {rebuildJob ? (
              <Alert
                showIcon
                type={rebuildJob.provider === "fake" ? "warning" : "success"}
                title={`Rebuild ${rebuildJob.status} / ${rebuildJob.provider}`}
                description={rebuildJob.summary}
              />
            ) : null}
          </Space>
        </Card>
        <div className="knowledge-stats">
          <Card><Typography.Text type="secondary">官方资料</Typography.Text><Typography.Title level={3}>{governanceStats.official}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">可被 AI 引用</Typography.Text><Typography.Title level={3}>{governanceStats.usable}</Typography.Title></Card>
          <Card><Typography.Text type="secondary">受限资料</Typography.Text><Typography.Title level={3}>{governanceStats.restricted}</Typography.Title></Card>
        </div>
      </section>

      <section className="section-card knowledge-pipeline" data-vc-kind="rag-pipeline">
        <Space wrap size="middle">
          <Tag color="blue">chunkStrategy=heading_sentence_context_v2_qwen3_2048</Tag>
          <Tag color="cyan">body=760 runes</Tag>
          <Tag color="geekblue">overlap=120 runes</Tag>
          <Tag color="purple">retrieval=hybrid RRF</Tag>
          <Tag color="default">reranker=planned only</Tag>
        </Space>
        <Typography.Paragraph type="secondary">
          Chunk 会保存正文、章节路径、上下文前缀和策略版本；模型或策略变化时使用“重建向量”刷新 chunks/embeddings。受限资料只做治理展示，不进入正式回答引用。
        </Typography.Paragraph>
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
                  if (!canUseForAI(document)) {
                    setResult({
                      answer: `${document.title} 当前只能做治理预览，不能作为正式 AI 回答引用。请先处理 status/sensitivity/scope 并由人工复核。`,
                      citations: [],
                      refusalReason: "governance_preview_only",
                      provider: "local-preview",
                      model: "metadata-only",
                      confidence: 0,
                      riskLevel: "high",
                      humanReviewRequired: true,
                      auditStatus: "preview_not_citation",
                    });
                    return;
                  }
                  setResult({
                    answer: `治理预览：${document.title} 可以作为候选引用。正式回答仍必须通过 /rag/search，按 scope、sensitivity 和检索分数确认。`,
                    citations: [{ documentId: document.id, chunkId: `${document.id}-preview`, title: document.title, snippet: document.content ?? "Demo citation preview", trustLevel: document.trustLevel, sensitivity: document.sensitivity, score: 0.72 }],
                    provider: "local-preview",
                    model: "metadata-only",
                    confidence: 0.72,
                    riskLevel: "medium",
                    humanReviewRequired: true,
                    auditStatus: "preview_not_search",
                  });
                }}
              >
                检查能否引用
              </Button>
              <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => message.info(demoMode ? "Demo：已生成资料治理提示，真实发布需 Go 授权和审计。" : "已生成资料治理提示；发布动作需 Go 授权和审计。")}>
                生成治理建议
              </Button>
              <Button
                size="small"
                icon={<SyncOutlined />}
                loading={rebuildingId === document.id}
                onClick={() => {
                  modal.confirm({
                    title: "重建该资料的 chunk 与 embedding？",
                    content: "该操作会替换旧 chunk/embedding，并写入 ingest job 与审计事件。不会修改原文、scope 或发布时间。",
                    okText: "重建",
                    cancelText: "取消",
                    onOk: () => rebuildDocument(document),
                  });
                }}
              >
                重建向量
              </Button>
            </Space>
          </article>
        ))}
      </section>

      <Table
        className="section-card hr-desktop-record-table"
        rowKey="id"
        loading={loading}
        dataSource={documents}
        pagination={{ total, pageSize: 20 }}
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

      <Modal title="新增治理型知识资料" open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()} confirmLoading={savingDocument} width={760}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: "published", trustLevel: "reviewed", sensitivity: "normal" }}
          onFinish={async (values) => {
            setSavingDocument(true);
            try {
              await api.createRAGDocument({
                ...values,
                scopes: [{ scopeType: "global", includeDescendants: true }],
              });
              setEditing(false);
              form.resetFields();
              await reload();
              message.success(demoMode ? "Demo 已保存资料，并生成可审计的治理元数据。" : "已保存资料，并生成可审计的治理元数据。");
            } catch (err) {
              setError(getErrorMessage(err, "资料创建失败"));
            } finally {
              setSavingDocument(false);
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
