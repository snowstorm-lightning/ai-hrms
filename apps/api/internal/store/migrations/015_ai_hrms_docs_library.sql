-- Expand the governed knowledge base for AI-HRMS product, Visual Copilot,
-- layout snapshot, and RAG/function-call decision boundaries.
INSERT INTO rag_sources (id, source_type, name, uri, status, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000904', 'upload', 'AI-HRMS 产品与 Copilot 文档库', 'seed://ai-hrms-product-docs', 'active', '00000000-0000-0000-0000-000000000301')
ON CONFLICT (id) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  name = EXCLUDED.name,
  uri = EXCLUDED.uri,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO rag_documents (id, source_id, title, version, status, trust_level, sensitivity, content, content_hash, published_at, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000918', '00000000-0000-0000-0000-000000000904', 'Visual Copilot 问答模式与截图模式边界', 'v1', 'published', 'official', 'normal',
   'Visual Copilot 分为普通问答和截图/圈选问。普通问答只发送用户问题，走 AI Chat、RAG 检索和审计；截图/圈选问会额外发送选区、DOM 摘要和 layout snapshot。当前系统不上传未脱敏截图给外部模型，也不声称具备像素级图片识别能力。',
   encode(digest('Visual Copilot 问答模式与截图模式边界', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000919', '00000000-0000-0000-0000-000000000904', 'Layout Snapshot 采集规范', 'v1', 'published', 'official', 'normal',
   '当用户询问页面区域、相对位置、视觉布局或截图中的某块内容时，前端需要在固定容器宽度、字体、字号、line-height、缩放比例和设备像素比条件下提取 layout snapshot。Snapshot 保存 container 宽高、文本片段、相对坐标、颜色、背景色、字号、字重和字体族；RAG 理解内容时只需要标题层级、段落顺序和表格结构。',
   encode(digest('Layout Snapshot 采集规范', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000920', '00000000-0000-0000-0000-000000000904', 'RAG 精准回答与函数调用策略', 'v1', 'published', 'official', 'normal',
   '涉及具体依据、引用位置、制度条款、知识资料或业务对象详情的问题，必须优先通过 RAG 检索和 Go Context Resolver 函数解析。回答需要展示 citations、trustLevel、sensitivity、scope、confidence 和 auditStatus。确定性模板只能用于无引用兜底、风险边界提示和工具预览，不应替代可检索资料。',
   encode(digest('RAG 精准回答与函数调用策略', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000928', '00000000-0000-0000-0000-000000000904', 'AI-HRMS 文档库使用说明', 'v1', 'published', 'reviewed', 'normal',
   '文档库是面向阅读和引用定位的受治理资料页面。知识治理页负责发布、敏感级别、scope、chunk 和 embedding 重建；文档库负责阅读资料、筛选来源、查看治理元数据，并通过 RAG 问答生成带引用的回答。',
   encode(digest('AI-HRMS 文档库使用说明', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000929', '00000000-0000-0000-0000-000000000904', '界面语言与设置扩展规范', 'v1', 'published', 'reviewed', 'normal',
   'AI-HRMS 的界面语言通过应用设置管理。新增语言时需要扩展 locale 字典、Ant Design locale 映射和必要的业务文案命名空间。用户偏好保存在本地设置中，后续可替换为后端用户偏好存储。',
   encode(digest('界面语言与设置扩展规范', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301')
ON CONFLICT (id) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  title = EXCLUDED.title,
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  trust_level = EXCLUDED.trust_level,
  sensitivity = EXCLUDED.sensitivity,
  content = EXCLUDED.content,
  content_hash = EXCLUDED.content_hash,
  published_at = EXCLUDED.published_at,
  updated_at = now();

INSERT INTO rag_document_scopes (document_id, scope_type, scope_id, role_code, include_descendants)
SELECT d.id, 'global', NULL, NULL, true
FROM rag_documents d
WHERE d.id IN (
  '00000000-0000-0000-0000-000000000918',
  '00000000-0000-0000-0000-000000000919',
  '00000000-0000-0000-0000-000000000920',
  '00000000-0000-0000-0000-000000000928',
  '00000000-0000-0000-0000-000000000929'
)
AND NOT EXISTS (
  SELECT 1 FROM rag_document_scopes s
  WHERE s.document_id = d.id
    AND s.scope_type = 'global'
    AND s.scope_id IS NULL
    AND s.role_code IS NULL
    AND s.employee_id IS NULL
);

INSERT INTO rag_chunks (
  id, document_id, chunk_index, title, content, content_hash, sensitivity,
  section_path, body_content, context_prefix, chunk_strategy, token_budget, body_runes, overlap_runes
)
VALUES
  ('00000000-0000-0000-0000-000000000928', '00000000-0000-0000-0000-000000000918', 0, 'Copilot 普通问答与截图问', 'Visual Copilot 普通问答只发送用户问题，走 AI Chat、RAG 检索和审计；截图/圈选问额外发送选区、DOM 摘要和 layout snapshot。当前系统不上传未脱敏截图给外部模型。', encode(digest('Copilot 普通问答与截图问', 'sha256'), 'hex'), 'normal', 'Visual Copilot/模式边界', 'Visual Copilot 普通问答只发送用户问题，走 AI Chat、RAG 检索和审计；截图/圈选问额外发送选区、DOM 摘要和 layout snapshot。当前系统不上传未脱敏截图给外部模型。', 'Visual Copilot 问答模式与截图模式边界', 'heading_sentence_context_v2_qwen3_2048', 2048, 88, 120),
  ('00000000-0000-0000-0000-000000000929', '00000000-0000-0000-0000-000000000919', 0, 'Layout Snapshot 坐标采集', '用户询问页面区域、相对位置、视觉布局或截图中的某块内容时，前端需要固定容器宽度、字体、字号、line-height、缩放比例和设备像素比，并提取文本片段、相对坐标、颜色、背景色、字号、字重和字体族。', encode(digest('Layout Snapshot 坐标采集', 'sha256'), 'hex'), 'normal', 'Visual Copilot/Layout Snapshot', '用户询问页面区域、相对位置、视觉布局或截图中的某块内容时，前端需要固定容器宽度、字体、字号、line-height、缩放比例和设备像素比，并提取文本片段、相对坐标、颜色、背景色、字号、字重和字体族。', 'Layout Snapshot 采集规范', 'heading_sentence_context_v2_qwen3_2048', 2048, 103, 120),
  ('00000000-0000-0000-0000-000000000930', '00000000-0000-0000-0000-000000000920', 0, 'RAG 与函数解析优先级', '涉及具体依据、引用位置、制度条款、知识资料或业务对象详情的问题，必须优先通过 RAG 检索和 Go Context Resolver 函数解析。回答需要展示 citations、trustLevel、sensitivity、scope、confidence 和 auditStatus。', encode(digest('RAG 与函数解析优先级', 'sha256'), 'hex'), 'normal', 'RAG/函数调用策略', '涉及具体依据、引用位置、制度条款、知识资料或业务对象详情的问题，必须优先通过 RAG 检索和 Go Context Resolver 函数解析。回答需要展示 citations、trustLevel、sensitivity、scope、confidence 和 auditStatus。', 'RAG 精准回答与函数调用策略', 'heading_sentence_context_v2_qwen3_2048', 2048, 95, 120),
  ('00000000-0000-0000-0000-000000000931', '00000000-0000-0000-0000-000000000928', 0, '文档库与知识治理分工', '文档库用于阅读资料、筛选来源、查看治理元数据，并通过 RAG 问答生成带引用的回答。知识治理页负责发布、敏感级别、scope、chunk 和 embedding 重建。', encode(digest('文档库与知识治理分工', 'sha256'), 'hex'), 'normal', '文档库/使用说明', '文档库用于阅读资料、筛选来源、查看治理元数据，并通过 RAG 问答生成带引用的回答。知识治理页负责发布、敏感级别、scope、chunk 和 embedding 重建。', 'AI-HRMS 文档库使用说明', 'heading_sentence_context_v2_qwen3_2048', 2048, 73, 120),
  ('00000000-0000-0000-0000-000000000932', '00000000-0000-0000-0000-000000000929', 0, '语言设置扩展', 'AI-HRMS 的界面语言通过应用设置管理。新增语言时需要扩展 locale 字典、Ant Design locale 映射和必要的业务文案命名空间。用户偏好保存在本地设置中，后续可替换为后端用户偏好存储。', encode(digest('语言设置扩展', 'sha256'), 'hex'), 'normal', '设置/语言', 'AI-HRMS 的界面语言通过应用设置管理。新增语言时需要扩展 locale 字典、Ant Design locale 映射和必要的业务文案命名空间。用户偏好保存在本地设置中，后续可替换为后端用户偏好存储。', '界面语言与设置扩展规范', 'heading_sentence_context_v2_qwen3_2048', 2048, 88, 120)
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  content_hash = EXCLUDED.content_hash,
  sensitivity = EXCLUDED.sensitivity,
  section_path = EXCLUDED.section_path,
  body_content = EXCLUDED.body_content,
  context_prefix = EXCLUDED.context_prefix,
  chunk_strategy = EXCLUDED.chunk_strategy,
  token_budget = EXCLUDED.token_budget,
  body_runes = EXCLUDED.body_runes,
  overlap_runes = EXCLUDED.overlap_runes;

INSERT INTO rag_embeddings (chunk_id, provider, model, dimensions, embedding)
VALUES
  ('00000000-0000-0000-0000-000000000928', 'fake', 'deterministic-v1', 8, '[0.23,0.31,0.44,0.52,0.61,0.70,0.79,0.88]'),
  ('00000000-0000-0000-0000-000000000929', 'fake', 'deterministic-v1', 8, '[0.19,0.33,0.47,0.58,0.62,0.74,0.81,0.90]'),
  ('00000000-0000-0000-0000-000000000930', 'fake', 'deterministic-v1', 8, '[0.29,0.17,0.39,0.51,0.68,0.73,0.84,0.92]'),
  ('00000000-0000-0000-0000-000000000931', 'fake', 'deterministic-v1', 8, '[0.15,0.28,0.36,0.49,0.57,0.69,0.78,0.86]'),
  ('00000000-0000-0000-0000-000000000932', 'fake', 'deterministic-v1', 8, '[0.13,0.26,0.35,0.48,0.59,0.66,0.77,0.89]')
ON CONFLICT DO NOTHING;
