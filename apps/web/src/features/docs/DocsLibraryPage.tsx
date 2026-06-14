import {
  ArrowLeftOutlined,
  BookOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Drawer, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import type { RAGDocument, RAGSearchResult, RAGSource } from "../../api/types";
import { CitationList, TrustMetaBar } from "../../components/AiTrust";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";
import { useI18n } from "../../i18n";

type DocumentSection = {
  id: string;
  title: string;
  blocks: string[];
};

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

function humanizeDocumentText(value: string) {
  return value
    .replaceAll("Visual Copilot", "圈选助手")
    .replaceAll("Agent Run", "智能体运行")
    .replaceAll("Agent run", "智能体运行")
    .replaceAll("toolPreview", "工具调用预览")
    .replaceAll("riskLevel", "风险等级")
    .replaceAll("requiredCapability", "所需权限")
    .replaceAll("humanReviewRequired", "需要人工复核")
    .replaceAll("waiting_human_review", "等待人工确认")
    .replaceAll("previewed", "已预览")
    .replaceAll("running", "运行中")
    .replaceAll("completed", "已完成")
    .replaceAll("failed", "失败")
    .replaceAll("blocked", "已阻断")
    .replaceAll("cancelled", "已取消")
    .replaceAll("auditStatus", "审计状态")
    .replaceAll("fake provider", "演示适配器")
    .replaceAll("provider status", "适配器状态")
    .replaceAll("provider", "适配器")
    .replaceAll("API key", "接口密钥")
    .replaceAll("status=published", "已发布")
    .replaceAll("trust_level", "可信等级")
    .replaceAll("sensitivity", "敏感级别")
    .replaceAll("scope", "可见范围")
    .replaceAll("chunk", "分块")
    .replaceAll("embedding", "向量索引")
    .replaceAll("layout snapshot", "页面线索")
    .replaceAll("prompt", "提问")
    .replaceAll("citation", "引用")
    .replaceAll("audit", "审计");
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

function documentSummary(document: RAGDocument) {
  const content = humanizeDocumentText(document.content ?? "");
  const firstBodyLine = content
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.startsWith("#"));
  const text = firstBodyLine ?? "该资料没有返回正文预览。";
  return text.length > 138 ? `${text.slice(0, 138)}...` : text;
}

function slugify(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `section-${index + 1}`;
}

function parseDocumentContent(document: RAGDocument) {
  const content = (document.content ?? "").trim();
  if (!content) {
    return {
      intro: ["该资料没有返回正文。请在知识治理页补充正文、发布后重建 chunk 与 embedding。"],
      sections: [{ id: "content", title: "完整正文", blocks: ["该资料没有返回正文。"] }],
    };
  }

  const intro: string[] = [];
  const sections: DocumentSection[] = [];
  let current: DocumentSection | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      const title = line.replace(/^##\s+/, "").trim();
      current = { id: slugify(title, sections.length), title, blocks: [] };
      continue;
    }
    if (current) {
      current.blocks.push(line);
    } else {
      intro.push(line);
    }
  }

  if (current) sections.push(current);
  if (!sections.length) {
    sections.push({ id: "content", title: "完整正文", blocks: intro.length ? intro : [content] });
  }
  return {
    intro: intro.length ? intro : [documentSummary(document)],
    sections,
  };
}

function sourceName(sources: RAGSource[], document: RAGDocument | null) {
  if (!document?.sourceId) return "未绑定";
  return sources.find((source) => source.id === document.sourceId)?.name ?? "未绑定";
}

function GovernanceTags({ document }: { document: RAGDocument }) {
  return (
    <Space wrap>
      <Tag color={document.status === "published" ? "green" : "default"}>{statusLabel(document.status)}</Tag>
      <Tag color={trustColor(document.trustLevel)}>可信等级：{trustLabel(document.trustLevel)}</Tag>
      <Tag color={sensitivityColor(document.sensitivity)}>敏感级别：{sensitivityLabel(document.sensitivity)}</Tag>
      <Tag>可见范围：{scopeText(document)}</Tag>
    </Space>
  );
}

function DocumentToc({ sections, onNavigate }: { sections: DocumentSection[]; onNavigate?: () => void }) {
  return (
    <nav className="docs-detail-toc-list" data-vc-kind="docs-document-toc">
      <a href="#doc-overview" onClick={onNavigate}>资料概览</a>
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`} onClick={onNavigate}>{section.title}</a>
      ))}
    </nav>
  );
}

export function DocsLibraryPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [query, setQuery] = useState("圈选助手什么时候需要页面线索？");
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
  useEffect(() => {
    const nextQuery = searchParams.get("query");
    if (nextQuery) setQuery(nextQuery);
  }, [searchParams]);

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
              description="涉及“依据在哪里、引用哪份资料、谁可以看”时，系统会使用 RAG 检索和审计记录；目录页只显示资料简介，完整正文在文档详情页阅读。"
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
            <Tag icon={<SafetyCertificateOutlined />} color="blue">已检查可见范围</Tag>
            <Tag icon={<FileSearchOutlined />} color="purple">必须带引用</Tag>
            <Tag icon={<DatabaseOutlined />} color="cyan">检索写入审计</Tag>
            <Typography.Paragraph type="secondary">
              文档库目录用于筛选资料和查看简介；详情页用于完整阅读，资料发布、敏感级别、可见范围和向量重建仍在知识治理页完成。
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
              { value: "official", label: "官方" },
              { value: "reviewed", label: "已复核" },
              { value: "internal", label: "内部资料" },
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
                  <Tag color={document.status === "published" ? "green" : "default"}>{statusLabel(document.status)}</Tag>
                </div>
                <div className="docs-card-title">
                  <Typography.Text strong>{humanizeDocumentText(document.title)}</Typography.Text>
                  <Typography.Text type="secondary">{sourceName(sources, document)}</Typography.Text>
                </div>
                <Typography.Paragraph type="secondary">{documentSummary(document)}</Typography.Paragraph>
                <Space wrap>
                  <Tag color={trustColor(document.trustLevel)}>{t("docs.trust")}：{trustLabel(document.trustLevel)}</Tag>
                  <Tag color={sensitivityColor(document.sensitivity)}>{t("docs.sensitivity")}：{sensitivityLabel(document.sensitivity)}</Tag>
                  <Tag>{t("docs.scope")}：{scopeText(document)}</Tag>
                </Space>
                <Button icon={<FileSearchOutlined />} onClick={() => navigate(`/app/docs/${document.id}`)}>阅读全文</Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyBlock description={t("docs.noDocs")} />
        )}
      </Card>
    </div>
  );
}

export function DocsDocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<RAGDocument | null>(null);
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [nextSources, nextDocument] = await Promise.all([api.ragSources(), api.ragDocument(id)]);
      setSources(nextSources);
      setDocument(nextDocument);
    } catch (err) {
      setError(getErrorMessage(err, "文档详情加载失败"));
      setDocument(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [id]);

  const parsed = useMemo(() => document ? parseDocumentContent(document) : null, [document]);

  return (
    <div className="docs-detail-page" data-vc-page="docs-document-detail">
      <Button className="docs-back-button" icon={<ArrowLeftOutlined />}>
        <Link to="/app/docs">返回文档目录</Link>
      </Button>
      <InlineError message={error} onRetry={reload} />

      {loading ? (
        <div className="docs-detail-loading"><Spin /></div>
      ) : document && parsed ? (
        <>
          <section className="docs-detail-header" data-vc-kind="docs-document-detail-header" data-vc-object-type="rag_document" data-vc-object-id={document.id} data-vc-label={document.title}>
            <div>
              <PageTitle title={document.title} description="完整正文集中在本页阅读；目录、来源和引用治理信息可从抽屉查看。" />
              <GovernanceTags document={document} />
            </div>
            <Space className="docs-detail-actions" wrap>
              <Button icon={<MenuOutlined />} onClick={() => setTocOpen(true)}>目录</Button>
              <Button icon={<SafetyCertificateOutlined />} onClick={() => setGovernanceOpen(true)}>引用与治理</Button>
              <Button icon={<FileSearchOutlined />} onClick={() => navigate(`/app/docs?query=${encodeURIComponent(document.title)}`)}>回目录提问</Button>
            </Space>
          </section>

          <section className="docs-detail-layout">
            <article className="docs-reader-main" data-vc-kind="docs-document-full-content">
              <section id="doc-overview" className="docs-reader-section">
                <Typography.Title level={2}>资料概览</Typography.Title>
                {parsed.intro.map((line, index) => (
                  <Typography.Paragraph key={`${line}-${index}`}>{line}</Typography.Paragraph>
                ))}
              </section>

              {parsed.sections.map((section) => (
                <section className="docs-reader-section" id={section.id} key={section.id}>
                  <Typography.Title level={2}>{section.title}</Typography.Title>
                  {section.blocks.length ? section.blocks.map((line, index) => (
                    <Typography.Paragraph key={`${section.id}-${index}`}>{line}</Typography.Paragraph>
                  )) : (
                    <Typography.Paragraph type="secondary">该章节暂无正文。</Typography.Paragraph>
                  )}
                </section>
              ))}
            </article>
          </section>

          <Drawer title="本页目录" placement="left" size="min(320px, 100vw)" open={tocOpen} onClose={() => setTocOpen(false)}>
            <DocumentToc sections={parsed.sections} onNavigate={() => setTocOpen(false)} />
          </Drawer>

          <Drawer title="引用与治理状态" placement="right" size="min(440px, 100vw)" open={governanceOpen} onClose={() => setGovernanceOpen(false)}>
            <Space orientation="vertical" size="middle" className="docs-full-width docs-governance-drawer" data-vc-kind="docs-document-governance">
              <GovernanceTags document={document} />
              <Alert
                showIcon
                type={document.sensitivity === "restricted" ? "warning" : "success"}
                title={document.sensitivity === "restricted" ? "该资料需要人工复核后查看或引用" : "该资料可作为 RAG 候选引用"}
                description="正式回答不会直接使用当前阅读视图，而是通过 RAG 检索、可见范围校验和引用记录生成。"
              />
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="文档 ID">{document.id}</Descriptions.Item>
                <Descriptions.Item label="来源">{sourceName(sources, document)}</Descriptions.Item>
                <Descriptions.Item label="版本">{document.version}</Descriptions.Item>
                <Descriptions.Item label="发布时间">{document.publishedAt ? new Date(document.publishedAt).toLocaleString("zh-CN") : "未发布"}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{document.createdAt}</Descriptions.Item>
                <Descriptions.Item label="可见范围">{scopeText(document)}</Descriptions.Item>
                <Descriptions.Item label="正文状态">{document.content ? "已返回完整正文" : "缺少正文"}</Descriptions.Item>
              </Descriptions>
              <Button block icon={<FileSearchOutlined />} onClick={() => navigate(`/app/docs?query=${encodeURIComponent(document.title)}`)}>
                回目录提问
              </Button>
            </Space>
          </Drawer>
        </>
      ) : (
        <EmptyBlock description="文档不存在或当前账号不可见。" />
      )}
    </div>
  );
}
