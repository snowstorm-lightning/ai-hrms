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

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
  };
  return labels[value] ?? value;
}

function trustLabel(value: string) {
  const labels: Record<string, string> = {
    official: "官方",
    reviewed: "已复核",
    internal: "内部资料",
  };
  return labels[value] ?? value;
}

function sensitivityLabel(value: string) {
  const labels: Record<string, string> = {
    normal: "普通",
    internal: "内部",
    restricted: "受限",
  };
  return labels[value] ?? value;
}

function providerLabel(value: string | undefined) {
  if (!value) return "未返回";
  if (value === "fake") return "演示适配器";
  if (value === "local-preview") return "本地预览";
  if (value === "metadata-only") return "仅元数据";
  return value;
}

function humanizeDocumentText(value: string) {
  return value
    .replaceAll("Agent Run", "智能体运行")
    .replaceAll("Agent run", "智能体运行")
    .replaceAll("toolPreview", "动作草稿")
    .replaceAll("riskLevel", "风险等级")
    .replaceAll("requiredCapability", "所需权限")
    .replaceAll("humanReviewRequired", "需要人工复核")
    .replaceAll("auditStatus", "审计状态")
    .replaceAll("status=published", "已发布")
    .replaceAll("trust_level", "可信等级")
    .replaceAll("sensitivity", "敏感级别")
    .replaceAll("scope", "可见范围")
    .replaceAll("chunk", "分块")
    .replaceAll("embedding", "检索索引")
    .replaceAll("retrieval log", "检索日志")
    .replaceAll("audit", "审计");
}

function documentPreview(document: RAGDocument) {
  const content = humanizeDocumentText(document.content ?? "该资料只展示治理元数据；真实内容会按可见范围返回。");
  const firstLine = content
    .split(/\r?\n+/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean)[0] ?? content;
  return firstLine.length > 180 ? `${firstLine.slice(0, 180)}...` : firstLine;
}

function scopeText(document: RAGDocument) {
  const scopes = document.scopes ?? [];
  if (!scopes.length) return "全局可见";
  const labels: Record<string, string> = {
    global: "全局",
    legal_entity: "法人",
    org_unit: "组织",
    role: "角色",
  };
  return scopes.map((scope) => {
    const label = labels[scope.scopeType] ?? scope.scopeType;
    return scope.roleCode ? `${label}：${scope.roleCode}` : label;
  }).join("、");
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
      message.success(job.summary || "已刷新检索索引。");
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "刷新检索索引失败"));
    } finally {
      setRebuildingId("");
    }
  };

  const governanceStats = useMemo(() => ({
    official: documents.filter((item) => item.trustLevel === "official").length,
    restricted: documents.filter((item) => item.sensitivity === "restricted").length,
    usable: documents.filter(canUseForAI).length,
  }), [documents]);

  const openDocumentEditor = () => {
    form.resetFields();
    setEditing(true);
  };

  const closeDocumentEditor = () => {
    setEditing(false);
    form.resetFields();
  };

  const openIngestEditor = () => {
    ingestForm.resetFields();
    setIngestJob(null);
    setIngestOpen(true);
  };

  const closeIngestEditor = () => {
    setIngestOpen(false);
    ingestForm.resetFields();
    setIngestJob(null);
  };

  return (
    <div className="knowledge-page" data-vc-page="knowledge">
      {modalContextHolder}
      <PageTitle
        title="治理型知识库"
        description="这里管理可被 AI 引用的资料：每份资料都有来源、可信等级、敏感级别、可见范围和审计记录。"
      />
      <InlineError message={error} onRetry={reload} />
      <TaskPath
        title="知识引用闭环"
        steps={[
          { title: "检索或选择资料", detail: "先定位候选资料和引用范围", status: result ? "done" : "current" },
          { title: "检查治理状态", detail: "看发布状态、敏感级别和可见范围是否允许引用", status: result ? "done" : "next" },
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
              title="引用回答必须说明资料来源和治理状态"
              description="系统会先检查发布状态、可信等级、敏感级别和可见范围，再从已治理资料中挑选候选引用；重排模型暂不启用，保留为后续受控阶段。"
            />
            <div className="knowledge-search-row">
              <Input data-vc-field="rag.query" aria-label="RAG search query" placeholder="输入要回答的问题或需要核验的政策点" value={query} onChange={(event) => setQuery(event.target.value)} onPressEnter={search} />
              <Button data-vc-action="rag.search" type="primary" loading={searching} onClick={search}>检索引用</Button>
              <Button data-vc-action="rag.document.create" onClick={openDocumentEditor}>新增资料</Button>
              <Button data-vc-action="rag.ingest" onClick={openIngestEditor}>导入/重建资料</Button>
            </div>
            {result ? (
              <div className="result-panel">
                <TrustMetaBar riskLevel={result.riskLevel ?? "unknown"} confidence={result.confidence === undefined ? 0 : Math.round(result.confidence * 100)} evidenceCount={result.citations.length} humanReviewRequired={result.humanReviewRequired ?? true} auditStatus={result.auditStatus ?? "metadata_missing"} />
                <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} className="knowledge-retrieval-meta">
                  <Descriptions.Item label="检索来源">{providerLabel(result.provider)}</Descriptions.Item>
                  <Descriptions.Item label="模型">{providerLabel(result.model)}</Descriptions.Item>
                  <Descriptions.Item label="最高匹配分">{result.citations[0]?.score ? result.citations[0].score.toFixed(2) : "未返回"}</Descriptions.Item>
                </Descriptions>
                <Typography.Paragraph>{result.refusalReason ? "没有可引用资料，已拒绝回答。" : result.answer}</Typography.Paragraph>
                <CitationList citations={result.citations} />
              </div>
            ) : null}
            {rebuildJob ? (
              <Alert
                showIcon
                type={rebuildJob.provider === "fake" ? "warning" : "success"}
                title={`重建${rebuildJob.status === "completed" ? "完成" : "已提交"} / ${providerLabel(rebuildJob.provider)}`}
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
          <Tag color="blue">切分方式：标题 + 句子上下文</Tag>
          <Tag color="cyan">单段长度：760 字符</Tag>
          <Tag color="geekblue">上下文重叠：120 字符</Tag>
          <Tag color="purple">检索方式：关键词 + 语义匹配</Tag>
          <Tag color="default">重排模型：暂不启用</Tag>
        </Space>
        <Typography.Paragraph type="secondary">
          系统会保存正文、章节路径、上下文前缀和策略版本；模型或策略变化时使用“刷新检索索引”重新整理检索入口。受限资料只做治理展示，不进入正式回答引用。
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
              <Tag color={document.status === "published" ? "green" : "default"}>{statusLabel(document.status)}</Tag>
            </div>
            <Typography.Text strong>{humanizeDocumentText(document.title)}</Typography.Text>
            <Typography.Paragraph type="secondary">{documentPreview(document)}</Typography.Paragraph>
            <Space wrap>
              <Tag color={trustColor(document.trustLevel)}>可信等级：{trustLabel(document.trustLevel)}</Tag>
              <Tag color={sensitivityColor(document.sensitivity)}>敏感级别：{sensitivityLabel(document.sensitivity)}</Tag>
              <Tag>可见范围：{scopeText(document)}</Tag>
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
                      answer: `${document.title} 当前只能做治理预览，不能作为正式 AI 回答引用。请先处理发布状态、敏感级别和可见范围，并由人工复核。`,
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
                    answer: `治理预览：${document.title} 可以作为候选引用。正式回答仍必须通过受控检索，按可见范围、敏感级别和检索分数确认。`,
                    citations: [{ documentId: document.id, chunkId: `${document.id}-preview`, title: document.title, snippet: document.content ?? "资料预览片段", trustLevel: document.trustLevel, sensitivity: document.sensitivity, score: 0.72 }],
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
              <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => message.info(demoMode ? "已生成资料治理提示，正式发布前仍需权限校验和审计。" : "已生成资料治理提示；发布动作需权限校验和审计。")}>
                生成治理建议
              </Button>
              <Button
                size="small"
                icon={<SyncOutlined />}
                loading={rebuildingId === document.id}
                onClick={() => {
                  modal.confirm({
                    title: "刷新该资料的检索索引？",
                    content: "该操作会替换旧索引，并写入导入任务与审计事件。不会修改原文、可见范围或发布时间。",
                    okText: "刷新",
                    cancelText: "取消",
                    onOk: () => rebuildDocument(document),
                  });
                }}
              >
                刷新索引
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
          { title: "状态", dataIndex: "status", width: 120, render: (status) => <Tag color={status === "published" ? "green" : "default"}>{statusLabel(status)}</Tag> },
          { title: "可信等级", dataIndex: "trustLevel", width: 140, render: (value) => <Tag color={trustColor(value)}>{trustLabel(value)}</Tag> },
          { title: "敏感级别", dataIndex: "sensitivity", width: 140, render: (value) => <Tag color={sensitivityColor(value)}>{sensitivityLabel(value)}</Tag> },
          { title: "AI 使用", width: 150, render: (_, row) => canUseForAI(row) ? <Tag color="green">可引用</Tag> : <Tag icon={<WarningOutlined />} color="orange">先复核</Tag> },
        ]}
      />

      <Modal title="新增治理型知识资料" open={editing} onCancel={closeDocumentEditor} onOk={() => form.submit()} confirmLoading={savingDocument} width={760}>
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
              closeDocumentEditor();
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
          <Form.Item name="trustLevel" label="可信等级"><Select options={[{ value: "official", label: "官方" }, { value: "reviewed", label: "已复核" }, { value: "internal", label: "内部资料" }]} /></Form.Item>
          <Form.Item name="sensitivity" label="敏感级别"><Select options={[{ value: "normal", label: "普通" }, { value: "internal", label: "内部" }, { value: "restricted", label: "受限" }]} /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="资料导入与重建"
        open={ingestOpen}
        onCancel={closeIngestEditor}
        onOk={() => ingestForm.submit()}
        confirmLoading={ingesting}
        width={760}
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            showIcon
            type="info"
            title="真实模式会先经过权限校验，再刷新受控检索索引"
            description="系统负责生成检索索引；检索仍按可见范围、敏感级别和发布状态过滤。"
          />
          {ingestJob ? (
            <Alert
              showIcon
              type={ingestJob.status === "completed" ? "success" : "warning"}
              title={`导入${ingestJob.status === "completed" ? "完成" : "已提交"} / ${providerLabel(ingestJob.provider)}`}
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
                message.success("资料导入已完成，已进入可治理知识层。");
              } catch (err) {
                setError(getErrorMessage(err, "Ingest job 创建失败"));
              } finally {
                setIngesting(false);
              }
            }}
          >
            <Form.Item name="sourceId" label="来源"><Select allowClear options={sources.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
            <Form.Item name="jobType" label="任务类型"><Select options={[{ value: "ingest", label: "导入资料" }]} /></Form.Item>
            <Form.Item name="title" label="资料标题" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="content" label="资料内容" rules={[{ required: true }]}><Input.TextArea rows={7} /></Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}
