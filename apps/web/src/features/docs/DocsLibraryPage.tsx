import { BookOutlined, DatabaseOutlined, FileSearchOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Drawer, Input, Select, Space, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { RAGDocument, RAGSearchResult, RAGSource } from "../../api/types";
import { CitationList, TrustMetaBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { useI18n } from "../../i18n";

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

function scopeText(document: RAGDocument) {
  const scopes = document.scopes ?? [];
  if (!scopes.length) return "global";
  return scopes.map((scope) => scope.roleCode ? `${scope.scopeType}:${scope.roleCode}` : scope.scopeType).join(", ");
}

export function DocsLibraryPage() {
  const { t } = useI18n();
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<RAGDocument | null>(null);
  const [query, setQuery] = useState("Visual Copilot 什么时候需要 layout snapshot？");
  const [result, setResult] = useState<RAGSearchResult | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [trustFilter, setTrustFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSources, docPage] = await Promise.all([api.ragSources(), api.ragDocuments(1, 100)]);
      setSources(nextSources);
      setDocuments(docPage.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "文档库加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    if (sourceFilter !== "all" && document.sourceId !== sourceFilter) return false;
    if (trustFilter !== "all" && document.trustLevel !== trustFilter) return false;
    return true;
  }), [documents, sourceFilter, trustFilter]);

  const ask = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setError("");
    try {
      setResult(await api.ragSearch(trimmed, 6));
    } catch (err) {
      setError(getErrorMessage(err, "RAG 问答失败"));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="docs-library-page" data-vc-page="docs-library">
      <PageTitle title={t("docs.title")} description={t("docs.description")} />
      <InlineError message={error} onRetry={reload} />

      <section className="docs-library-hero" data-vc-kind="docs-rag-workbench">
        <Card className="docs-ask-card" title={t("docs.answerTitle")}>
          <Space orientation="vertical" size="middle" className="docs-full-width">
            <Alert
              type="info"
              showIcon
              title="精准回答必须走 RAG 引用链"
              description="涉及“依据在哪里、引用哪份资料、哪个 scope 可见”时，系统会使用 RAG 检索和审计记录；普通模板只能做兜底说明。"
            />
            <Input.Search
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onSearch={ask}
              enterButton={t("docs.askButton")}
              loading={searching}
              placeholder={t("docs.askPlaceholder")}
              data-vc-field="docs.rag_question"
            />
            {result ? (
              <div className="result-panel">
                <TrustMetaBar riskLevel={result.riskLevel ?? "unknown"} confidence={Math.round((result.confidence ?? 0) * 100)} evidenceCount={result.citations.length} humanReviewRequired={result.humanReviewRequired ?? false} auditStatus={result.auditStatus ?? "retrieval_logged"} />
                <Typography.Paragraph>{result.refusalReason ? "没有命中可引用资料，系统拒绝生成正式答案。" : result.answer}</Typography.Paragraph>
                <CitationList citations={result.citations} />
              </div>
            ) : null}
          </Space>
        </Card>
        <Card className="docs-policy-card" title="文档库使用边界">
          <Space orientation="vertical" size="middle">
            <Tag icon={<SafetyCertificateOutlined />} color="blue">scope.checked</Tag>
            <Tag icon={<FileSearchOutlined />} color="purple">citation.required</Tag>
            <Tag icon={<DatabaseOutlined />} color="cyan">retrieval.audit.logged</Tag>
            <Typography.Paragraph type="secondary">
              文档库用于阅读、引用和定位资料；资料发布、敏感级别、向量重建仍在知识治理页完成。
            </Typography.Paragraph>
          </Space>
        </Card>
      </section>

      <Card className="section-card" title={t("docs.libraryTitle")}>
        <Space wrap className="docs-filter-row">
          <Select
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[{ value: "all", label: "全部来源" }, ...sources.map((source) => ({ value: source.id, label: source.name }))]}
            style={{ minWidth: 220 }}
          />
          <Select
            value={trustFilter}
            onChange={setTrustFilter}
            options={[
              { value: "all", label: "全部可信等级" },
              { value: "official", label: "official" },
              { value: "reviewed", label: "reviewed" },
              { value: "internal", label: "internal" },
            ]}
            style={{ minWidth: 180 }}
          />
          <Tag>{loading ? "loading" : `${filteredDocuments.length}/${documents.length}`}</Tag>
        </Space>
        {filteredDocuments.length ? (
          <div className="docs-document-grid" data-vc-kind="docs-document-grid">
            {filteredDocuments.map((document) => (
              <article
                className="docs-document-card"
                key={document.id}
                data-vc-kind="docs-document-card"
                data-vc-object-type="rag_document"
                data-vc-object-id={document.id}
                data-vc-label={document.title}
              >
                <div className="docs-card-header">
                  <span className="docs-card-icon"><BookOutlined /></span>
                  <Tag color={document.status === "published" ? "green" : "default"}>{document.status}</Tag>
                </div>
                <Typography.Text strong>{document.title}</Typography.Text>
                <Typography.Paragraph type="secondary">{document.content || "该资料没有返回正文预览。"}</Typography.Paragraph>
                <Space wrap>
                  <Tag color={trustColor(document.trustLevel)}>{t("docs.trust")}={document.trustLevel}</Tag>
                  <Tag color={sensitivityColor(document.sensitivity)}>{t("docs.sensitivity")}={document.sensitivity}</Tag>
                  <Tag>{t("docs.scope")}={scopeText(document)}</Tag>
                </Space>
                <Button icon={<FileSearchOutlined />} onClick={() => setSelectedDocument(document)}>{t("docs.preview")}</Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyBlock description={t("docs.noDocs")} />
        )}
      </Card>

      <Drawer
        title={selectedDocument?.title}
        open={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        size="large"
        data-vc-kind="docs-document-reader"
        data-vc-object-type={selectedDocument ? "rag_document" : undefined}
        data-vc-object-id={selectedDocument?.id}
        data-vc-label={selectedDocument?.title}
      >
        {selectedDocument ? (
          <Space orientation="vertical" size="middle" className="docs-full-width">
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t("docs.source")}>{sources.find((source) => source.id === selectedDocument.sourceId)?.name ?? "未绑定"}</Descriptions.Item>
              <Descriptions.Item label={t("docs.status")}>{selectedDocument.status}</Descriptions.Item>
              <Descriptions.Item label={t("docs.trust")}>{selectedDocument.trustLevel}</Descriptions.Item>
              <Descriptions.Item label={t("docs.sensitivity")}>{selectedDocument.sensitivity}</Descriptions.Item>
              <Descriptions.Item label={t("docs.scope")}>{scopeText(selectedDocument)}</Descriptions.Item>
            </Descriptions>
            <Typography.Paragraph className="docs-reader-content">{selectedDocument.content}</Typography.Paragraph>
            <Alert
              showIcon
              type={selectedDocument.sensitivity === "restricted" ? "warning" : "success"}
              title={selectedDocument.sensitivity === "restricted" ? "该资料需要人工复核后查看或引用" : "该资料可作为 RAG 候选引用"}
              description="正式回答不会直接使用当前阅读视图，而是通过 RAG 检索、scope 校验和 citation 记录生成。"
            />
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
