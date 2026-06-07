-- Add globally visible product knowledge for AI-HRMS QA and Visual Copilot RAG answers.
-- This migration intentionally reuses the governed AI-HRMS product source instead of
-- changing earlier seed migrations.
INSERT INTO rag_sources (id, source_type, name, uri, status, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000904', 'upload', 'AI-HRMS 产品与 Copilot 文档库', 'seed://ai-hrms-product-docs', 'active', NULL)
ON CONFLICT (id) DO NOTHING;

WITH docs(id, title, trust_level, content) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000950'::uuid, 'AI-HRMS 产品身份与使用边界', 'official',
     $doc$AI-HRMS 是面向人力资源、组织数据、学习成长、RAG 知识治理、Agent 运行和审计的企业应用。它不是公网搜索引擎，也不是绕过权限的个人助理；回答必须基于当前用户权限、可见 scope、已发布 RAG 文档、只读业务上下文或经过确认的工具预览。普通问答可以解释产品能力、页面用途和操作路径；涉及制度依据、员工数据、组织数据或高风险人事建议时，需要展示引用、置信度、风险和审计状态。$doc$),
    ('00000000-0000-0000-0000-000000000951'::uuid, 'AI-HRMS 页面导航地图', 'reviewed',
     $doc$AI-HRMS 登录后默认进入 /app/dashboard 指挥看板。主要导航分为运营、知识、成长、数据和支持：AI 指挥中心在 /app/ai-command，Agent 运行中心在 /app/agents，Knowledge Hub 在 /app/knowledge，文档库在 /app/docs，信任与审计在 /app/audit，共生成长引擎在 /co-growth，学习在 /app/learning，法人实体在 /app/legal-entities，组织单元在 /app/org-units，账号在 /app/users，员工在 /app/employees，考勤在 /app/attendance，消息在 /app/messages，设置在 /app/settings，帮助在 /app/help。$doc$),
    ('00000000-0000-0000-0000-000000000952'::uuid, '设置语言侧边栏与 Copilot 默认项', 'reviewed',
     $doc$设置页用于管理界面语言、界面密度、演示横幅、侧边栏宽度、Visual Copilot 默认模式和证据面板默认展开状态。语言切换来自本地应用设置，当前支持中文和英文；新增语言需要扩展 locale 字典、Ant Design locale 映射和业务文案命名空间。侧边栏宽度由设置保存，桌面端可拖动调整，移动端使用抽屉导航；Visual Copilot 可以折叠为窄侧栏，折叠状态不应拦截页面输入。$doc$),
    ('00000000-0000-0000-0000-000000000953'::uuid, 'Visual Copilot 普通问答与圈选问流程', 'official',
     $doc$Visual Copilot 有两类入口。普通问答只发送用户文字问题和必要的业务上下文，适合询问产品功能、页面用途、制度解释和 RAG 引用。圈选问或截图模式会额外携带用户选择区域、DOM 摘要、可见文本、相对坐标和 layout snapshot，适合询问页面上某块区域是什么、为什么看不到某个控件、表格某列含义或当前卡片数据来源。系统不应声称进行未脱敏原图识别；无法从 layout snapshot 支撑的结论要明确说明需要用户补充信息。$doc$),
    ('00000000-0000-0000-0000-000000000954'::uuid, 'RAG 文档发布检索与引用链', 'official',
     $doc$RAG 文档只有 status=published 且通过当前 scope 校验后才能进入正式检索。知识治理页负责创建来源、发布资料、设置 trust_level、sensitivity 和 scope，并重建 chunk 与 embedding；文档库负责阅读资料和触发带引用的 RAG 问答。检索结果需要返回 citations、documentId、chunkId、title、trustLevel、sensitivity、scope、confidence 和 auditStatus。没有命中可引用资料时应拒绝编造依据，改为说明未找到可引用文档。$doc$),
    ('00000000-0000-0000-0000-000000000955'::uuid, 'Agent 工具预览协议', 'official',
     $doc$Agent 在执行工具前必须生成 toolPreview，展示工具名、用途、参数摘要、读取或写入范围、目标 scope、风险级别、可逆性、所需 capability、预计审计事件和是否需要人工确认。只读工具如 rag_search、context_resolve、audit_read 可以在权限允许时直接返回预览结果；写入员工、角色、组织、法人、考勤、消息或学习记录的工具必须先等待确认。预览不得隐藏关键参数，也不得把高风险动作伪装成普通问答。$doc$),
    ('00000000-0000-0000-0000-000000000956'::uuid, '人工确认与审计留痕规范', 'official',
     $doc$涉及写入、权限变更、员工资料修改、组织或法人调整、RAG 发布、Agent 执行和高风险建议时，系统需要保留人工确认与审计记录。审计记录应包含操作者、时间、请求摘要、旧值摘要、新值摘要、风险等级、引用或证据、toolPreview、确认结果和阻断原因。用户询问某个回答或动作是否可信时，应说明证据来源、是否经过人工确认、auditStatus 以及仍需人工复核的部分。$doc$),
    ('00000000-0000-0000-0000-000000000957'::uuid, '高风险人事决策边界', 'official',
     $doc$AI-HRMS 可以辅助整理事实、生成检查清单、解释制度、提示风险和准备需要人工审阅的草稿，但不得自动做出录用、淘汰、调薪、降薪、绩效评级、纪律处分、解雇、医疗、签证、仲裁或其他高影响人事裁决。涉及候选人、员工、薪酬、绩效、合规或劳动关系的结论必须由授权 HR、业务负责人或法务人工确认。回答必须避免歧视性推断，并提示需要使用可审计证据。$doc$),
    ('00000000-0000-0000-0000-000000000958'::uuid, '管理员权限与可见性模型', 'reviewed',
     $doc$管理员能力按角色和 scope 控制。group_admin 可以看到管理员指南、账号维护、角色绑定、法人 scope、组织 scope、RAG 发布和高风险审计入口；group_hr、entity_hr、org_manager 和 employee 只能看到与自身职责和授权范围相关的页面或数据。用户看不到某块功能时，优先检查当前账号角色、capability、scope、登录状态和前端菜单可见性；角色刚调整后需要刷新或重新登录。$doc$),
    ('00000000-0000-0000-0000-000000000959'::uuid, '组织与法人 Scope 使用说明', 'reviewed',
     $doc$AI-HRMS 使用 global、legal_entity、org_unit、role 和 employee scope 控制 RAG 文档、业务数据、角色授权和审计范围。legal_entity 表示法人实体边界，适合公司主体、分支法人和合同主体；org_unit 表示组织树节点，适合部门、团队、共享中心和项目组，include_descendants=true 时包含下级组织。scope 校验应 fail-closed：没有明确授权时不返回数据，不用全局资料替代受限资料。$doc$),
    ('00000000-0000-0000-0000-000000000960'::uuid, '员工数据隐私与最小化原则', 'official',
     $doc$员工数据包括身份信息、联系方式、任职记录、考勤、绩效、薪酬、学习记录、消息、审计记录和可能推断个人状态的信息。系统回答和工具调用应遵循最小必要原则，只返回当前任务需要且用户有权查看的字段；向外部模型或日志发送前应脱敏或摘要化。不得把员工敏感信息、客户数据、密钥、未授权代码或高影响人事决策材料直接放入外部 prompt。$doc$)
)
INSERT INTO rag_documents (id, source_id, title, version, status, trust_level, sensitivity, content, content_hash, published_at, created_by_user_id)
SELECT
  id,
  '00000000-0000-0000-0000-000000000904'::uuid,
  title,
  'v1',
  'published',
  trust_level,
  'normal',
  content,
  encode(digest(title, 'sha256'), 'hex'),
  now(),
  NULL
FROM docs
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

WITH scopes(id, document_id) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000981'::uuid, '00000000-0000-0000-0000-000000000950'::uuid),
    ('00000000-0000-0000-0000-000000000982'::uuid, '00000000-0000-0000-0000-000000000951'::uuid),
    ('00000000-0000-0000-0000-000000000983'::uuid, '00000000-0000-0000-0000-000000000952'::uuid),
    ('00000000-0000-0000-0000-000000000984'::uuid, '00000000-0000-0000-0000-000000000953'::uuid),
    ('00000000-0000-0000-0000-000000000985'::uuid, '00000000-0000-0000-0000-000000000954'::uuid),
    ('00000000-0000-0000-0000-000000000986'::uuid, '00000000-0000-0000-0000-000000000955'::uuid),
    ('00000000-0000-0000-0000-000000000987'::uuid, '00000000-0000-0000-0000-000000000956'::uuid),
    ('00000000-0000-0000-0000-000000000988'::uuid, '00000000-0000-0000-0000-000000000957'::uuid),
    ('00000000-0000-0000-0000-000000000989'::uuid, '00000000-0000-0000-0000-000000000958'::uuid),
    ('00000000-0000-0000-0000-000000000990'::uuid, '00000000-0000-0000-0000-000000000959'::uuid),
    ('00000000-0000-0000-0000-000000000991'::uuid, '00000000-0000-0000-0000-000000000960'::uuid)
)
INSERT INTO rag_document_scopes (id, document_id, scope_type, scope_id, role_code, include_descendants)
SELECT scopes.id, scopes.document_id, 'global', NULL, NULL, true
FROM scopes
JOIN rag_documents d ON d.id = scopes.document_id
WHERE NOT EXISTS (
  SELECT 1 FROM rag_document_scopes s
  WHERE s.document_id = scopes.document_id
    AND s.scope_type = 'global'
    AND s.scope_id IS NULL
    AND s.role_code IS NULL
    AND s.employee_id IS NULL
);

WITH chunks(id, document_id, chunk_index, title, section_path, context_prefix, content) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000970'::uuid, '00000000-0000-0000-0000-000000000950'::uuid, 0, '产品身份与回答边界', '产品身份/使用边界', 'AI-HRMS 产品身份与使用边界',
     $chunk$AI-HRMS 是企业 HR、组织数据、学习成长、RAG、Agent 和审计应用。普通问答可解释产品能力和操作路径；涉及制度依据、员工数据、组织数据或高风险建议时，必须基于权限、scope、已发布 RAG 引用、只读上下文或经过确认的工具预览。$chunk$),
    ('00000000-0000-0000-0000-000000000971'::uuid, '00000000-0000-0000-0000-000000000951'::uuid, 0, '页面导航与模块入口', '导航/页面地图', 'AI-HRMS 页面导航地图',
     $chunk$主要页面包括 /app/dashboard 指挥看板、/app/ai-command AI 指挥中心、/app/agents Agent 运行中心、/app/knowledge Knowledge Hub、/app/docs 文档库、/app/audit 信任与审计、/co-growth 共生成长引擎、/app/learning 学习、/app/legal-entities 法人实体、/app/org-units 组织单元、/app/users 账号、/app/employees 员工、/app/attendance 考勤、/app/messages 消息、/app/settings 设置和 /app/help 帮助。$chunk$),
    ('00000000-0000-0000-0000-000000000972'::uuid, '00000000-0000-0000-0000-000000000952'::uuid, 0, '设置语言侧边栏与 Copilot 默认项', '设置/语言与侧边栏', '设置语言侧边栏与 Copilot 默认项',
     $chunk$设置页管理语言、密度、演示横幅、侧边栏宽度、Visual Copilot 默认模式和证据面板默认展开。语言切换来自本地设置；新增语言要扩展 locale 字典、Ant Design locale 映射和业务文案。桌面侧边栏可拖动调整，移动端使用抽屉导航，Copilot 折叠窄侧栏不应拦截页面输入。$chunk$),
    ('00000000-0000-0000-0000-000000000973'::uuid, '00000000-0000-0000-0000-000000000953'::uuid, 0, 'Copilot 普通问答与圈选问', 'Visual Copilot/问答模式', 'Visual Copilot 普通问答与圈选问流程',
     $chunk$Visual Copilot 普通问答只发送文字问题和必要上下文，适合产品、页面、制度和 RAG 引用。圈选问会携带选区、DOM 摘要、可见文本、相对坐标和 layout snapshot，适合解释页面区域、控件缺失、表格列或卡片来源。系统不声称未脱敏原图识别；证据不足时要求补充信息。$chunk$),
    ('00000000-0000-0000-0000-000000000974'::uuid, '00000000-0000-0000-0000-000000000954'::uuid, 0, 'RAG 发布检索与引用链', 'RAG/发布与检索', 'RAG 文档发布检索与引用链',
     $chunk$RAG 文档必须 status=published 且通过 scope 校验才能检索。知识治理页负责来源、发布、trust_level、sensitivity、scope、chunk 和 embedding；文档库负责阅读和引用问答。正式结果应返回 citation、documentId、chunkId、title、trustLevel、sensitivity、scope、confidence 和 auditStatus；没有命中时拒绝编造依据。$chunk$),
    ('00000000-0000-0000-0000-000000000975'::uuid, '00000000-0000-0000-0000-000000000955'::uuid, 0, 'Agent 工具预览字段', 'Agent/工具预览', 'Agent 工具预览协议',
     $chunk$Agent 执行工具前必须生成 toolPreview，展示工具名、用途、参数摘要、读写范围、目标 scope、风险级别、可逆性、capability、预计审计事件和人工确认要求。只读工具可在权限允许时返回预览结果；写入员工、角色、组织、法人、考勤、消息或学习记录的工具必须等待确认。$chunk$),
    ('00000000-0000-0000-0000-000000000976'::uuid, '00000000-0000-0000-0000-000000000956'::uuid, 0, '人工确认与审计字段', '审计/人工确认', '人工确认与审计留痕规范',
     $chunk$写入、权限变更、员工资料修改、组织或法人调整、RAG 发布、Agent 执行和高风险建议需要人工确认与审计记录。审计应包含操作者、时间、请求摘要、旧值、新值、风险等级、引用证据、toolPreview、确认结果和阻断原因。回答可信度问题时要说明证据、人工确认、auditStatus 和复核需求。$chunk$),
    ('00000000-0000-0000-0000-000000000977'::uuid, '00000000-0000-0000-0000-000000000957'::uuid, 0, '高风险人事裁决边界', '风险/高影响人事决策', '高风险人事决策边界',
     $chunk$AI-HRMS 可辅助事实整理、制度解释、风险提示和人工审阅草稿，但不得自动做出录用、淘汰、调薪、降薪、绩效评级、纪律处分、解雇、医疗、签证、仲裁等高影响人事裁决。候选人、员工、薪酬、绩效、合规或劳动关系结论必须由授权人员人工确认。$chunk$),
    ('00000000-0000-0000-0000-000000000978'::uuid, '00000000-0000-0000-0000-000000000958'::uuid, 0, '管理员权限与可见性', '权限/管理员可见性', '管理员权限与可见性模型',
     $chunk$group_admin 可以看到管理员指南、账号维护、角色绑定、法人 scope、组织 scope、RAG 发布和高风险审计入口；group_hr、entity_hr、org_manager 和 employee 只看到职责和授权范围内的数据。用户看不到功能时，先检查账号角色、capability、scope、登录状态和菜单可见性，角色调整后刷新或重新登录。$chunk$),
    ('00000000-0000-0000-0000-000000000979'::uuid, '00000000-0000-0000-0000-000000000959'::uuid, 0, '组织法人 Scope 与 fail-closed', 'Scope/法人和组织', '组织与法人 Scope 使用说明',
     $chunk$global、legal_entity、org_unit、role 和 employee scope 控制 RAG、业务数据、角色授权和审计范围。legal_entity 是法人实体边界；org_unit 是组织树节点，include_descendants=true 时包含下级组织。scope 校验应 fail-closed：没有明确授权时不返回数据，也不用全局资料替代受限资料。$chunk$),
    ('00000000-0000-0000-0000-000000000980'::uuid, '00000000-0000-0000-0000-000000000960'::uuid, 0, '员工数据隐私最小化', '隐私/员工数据', '员工数据隐私与最小化原则',
     $chunk$员工数据包括身份、联系方式、任职、考勤、绩效、薪酬、学习、消息、审计和可推断个人状态的信息。回答和工具调用遵循最小必要原则，只返回当前任务需要且用户有权查看的字段；外发给模型或日志前应脱敏或摘要化，不得直接发送敏感员工信息、客户数据、密钥或高影响决策材料。$chunk$)
)
INSERT INTO rag_chunks (
  id, document_id, chunk_index, title, content, content_hash, sensitivity,
  section_path, body_content, context_prefix, chunk_strategy, token_budget, body_runes, overlap_runes
)
SELECT
  id,
  document_id,
  chunk_index,
  title,
  content,
  encode(digest(title, 'sha256'), 'hex'),
  'normal',
  section_path,
  content,
  context_prefix,
  'heading_sentence_context_v2_qwen3_2048',
  2048,
  char_length(content),
  120
FROM chunks
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

INSERT INTO rag_embeddings (id, chunk_id, provider, model, dimensions, embedding)
VALUES
  ('00000000-0000-0000-0000-000000001000', '00000000-0000-0000-0000-000000000970', 'fake', 'deterministic-v1', 8, '[0.34,0.18,0.47,0.52,0.63,0.71,0.80,0.91]'),
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000971', 'fake', 'deterministic-v1', 8, '[0.12,0.39,0.44,0.56,0.61,0.73,0.82,0.90]'),
  ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000972', 'fake', 'deterministic-v1', 8, '[0.21,0.32,0.40,0.58,0.66,0.75,0.79,0.88]'),
  ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000973', 'fake', 'deterministic-v1', 8, '[0.27,0.16,0.49,0.54,0.69,0.72,0.84,0.93]'),
  ('00000000-0000-0000-0000-000000001004', '00000000-0000-0000-0000-000000000974', 'fake', 'deterministic-v1', 8, '[0.30,0.25,0.37,0.51,0.65,0.70,0.86,0.94]'),
  ('00000000-0000-0000-0000-000000001005', '00000000-0000-0000-0000-000000000975', 'fake', 'deterministic-v1', 8, '[0.18,0.36,0.42,0.53,0.67,0.74,0.81,0.92]'),
  ('00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-000000000976', 'fake', 'deterministic-v1', 8, '[0.24,0.29,0.46,0.57,0.62,0.78,0.83,0.89]'),
  ('00000000-0000-0000-0000-000000001007', '00000000-0000-0000-0000-000000000977', 'fake', 'deterministic-v1', 8, '[0.33,0.14,0.38,0.59,0.64,0.76,0.85,0.95]'),
  ('00000000-0000-0000-0000-000000001008', '00000000-0000-0000-0000-000000000978', 'fake', 'deterministic-v1', 8, '[0.15,0.31,0.45,0.50,0.68,0.77,0.82,0.87]'),
  ('00000000-0000-0000-0000-000000001009', '00000000-0000-0000-0000-000000000979', 'fake', 'deterministic-v1', 8, '[0.20,0.28,0.43,0.55,0.60,0.79,0.88,0.96]'),
  ('00000000-0000-0000-0000-000000001010', '00000000-0000-0000-0000-000000000980', 'fake', 'deterministic-v1', 8, '[0.26,0.35,0.41,0.48,0.70,0.73,0.87,0.97]')
ON CONFLICT (chunk_id, provider, model) DO UPDATE SET
  dimensions = EXCLUDED.dimensions,
  embedding = EXCLUDED.embedding;

-- Add deeper user-facing playbooks and dictionaries so RAG answers can move beyond
-- high-level policy into concrete operations, troubleshooting, and field meaning.
WITH docs(id, title, trust_level, content) AS (
  VALUES
    ('00000000-0000-0000-0000-000000001100'::uuid, 'AI-HRMS 页面级操作指南合集', 'reviewed',
     $doc$页面级操作指南用于回答“这个页面怎么用”和“某个入口在哪里”。指挥看板用于查看风险、证据和建议概览；AI 指挥中心用于生成受控 HR 工作草稿；Knowledge Hub 用于创建来源、发布资料、设置 scope 并重建 embedding；文档库用于阅读资料、筛选来源和带引用问答；Agent 运行中心用于查看 run 状态、toolPreview 和人工确认；信任与审计用于检索 audit event、风险、证据和确认记录；设置页用于语言、界面密度、侧边栏宽度和 Copilot 默认项。$doc$),
    ('00000000-0000-0000-0000-000000001101'::uuid, 'RAG 发布 SOP 与失败排查', 'official',
     $doc$发布 RAG 资料的标准步骤是：创建或选择 source，录入标题、版本、正文和有效期，设置 trust_level、sensitivity、scope，保存为 draft，复核后切换为 published，触发 chunk 与 embedding 重建，并在文档库用一个真实问题验证 citation。资料问不到时依次检查 status 是否 published、scope 是否覆盖当前用户、sensitivity 是否被过滤、effective 时间是否生效、ingest job 是否 completed、embedding 维度是否与配置一致、查询是否过短或过宽。$doc$),
    ('00000000-0000-0000-0000-000000001102'::uuid, 'Citation 字段与引用定位说明', 'reviewed',
     $doc$citation 是 RAG 回答的证据定位。documentId 指向资料，chunkId 指向切片，title 是资料标题，snippet 是引用片段，trustLevel 表示资料可信等级，sensitivity 表示敏感级别，score 表示检索相关性，pageRef 和 locationRef 可用于页码、章节、段落或表格位置。用户问“依据在哪里”时，回答应先给结论，再列出引用标题、片段和可定位字段；没有 citation 时应说未找到可引用资料。$doc$),
    ('00000000-0000-0000-0000-000000001103'::uuid, 'Visual Copilot 页面字段字典', 'reviewed',
     $doc$Visual Copilot 解释页面字段时优先使用 DOM label、data-vc-kind、data-vc-field、businessRef、route 和 layout snapshot。按钮通常表示可执行命令；卡片通常表示业务对象摘要；表格行通常对应员工、组织、法人、资料、Agent run 或审计事件；Tag 常用于 riskLevel、confidence、sensitivity、trustLevel、auditStatus、toolPreview 和 humanReviewRequired。普通问答缺少选区时只能回答通用含义；要解释具体列、按钮或卡片，应切换到圈选问。$doc$),
    ('00000000-0000-0000-0000-000000001104'::uuid, '角色 Capability 对照与权限申请', 'reviewed',
     $doc$group_admin 拥有账号、角色、scope、RAG 发布、审计和高风险治理入口；group_hr 可处理集团 HR 数据和制度资料；entity_hr 面向法人边界内的人事数据；org_manager 只看授权组织及其下级；employee 只看个人相关记录和公开资料。常见 capability 包括 rag.search、visual_copilot.use、agent.execute_read、agent.execute_write、audit.read、employee.read、org.read、legal_entity.read 和 user.manage。申请权限时应说明业务目的、需要的 scope、持续时间和审批人；审批后需要刷新或重新登录。$doc$),
    ('00000000-0000-0000-0000-000000001105'::uuid, 'Agent Run 状态与工具调用字段字典', 'official',
     $doc$Agent run 常见状态包括 previewed、waiting_human_review、running、completed、failed、blocked 和 cancelled。runType 表示任务类型，provider/model 表示模型或执行后端，riskLevel 表示风险，summary 是摘要，toolCalls 记录工具名、参数摘要、读写范围、accepted、previewOnly、reversible 和 auditStatus。用户问某个 run 时，应先解释当前状态和是否等待人工确认，再说明证据、工具预览和下一步，不应把预览当成已执行结果。$doc$),
    ('00000000-0000-0000-0000-000000001106'::uuid, '审计事件类型与筛选导出说明', 'official',
     $doc$审计事件用于追踪 AI 回答、RAG 引用、工具预览、人工确认和业务写入。常见 eventType 包括 ai.chat.answer、rag.citation.used、visual_copilot.preview、agent.tool.preview、human.review.requested、human.review.approved_preview、high_risk.action.blocked、employee.update、role.binding.changed 和 rag.document.published。筛选审计时优先使用时间、操作者、objectType、objectId、riskLevel、auditStatus 和 requestId；导出前应确认权限和敏感字段脱敏。$doc$),
    ('00000000-0000-0000-0000-000000001107'::uuid, 'Embedding 与 Provider 状态排查', 'reviewed',
     $doc$RAG 检索质量依赖 embedding provider、维度、chunk 策略和检索融合。排查顺序是：provider status 是否 healthy，API key 或本地 fake provider 是否配置，RAG_EMBEDDING_DIMENSIONS 是否与已有 embedding 一致，ingest job 是否失败，chunk 数是否为零，文档内容是否过短，查询是否命中停用词过多，hybrid 检索是否只命中低分片段。维度变更后需要重建所有受影响 embedding，不能混用不同维度。$doc$),
    ('00000000-0000-0000-0000-000000001108'::uuid, '员工字段分级与脱敏模板', 'official',
     $doc$员工字段按敏感度分级。低敏字段包括姓名、组织、岗位、任职状态和公开工作职责；中敏字段包括考勤摘要、学习记录、任职变更和内部消息摘要；高敏字段包括手机号、身份证件、家庭地址、薪酬、绩效明细、医疗信息、纪律处分和劳动争议。外发给模型时应优先使用摘要，例如“员工 A，AI 平台工程部，新人，入职第 3 周”，不要发送手机号、证件号、薪酬或个人敏感原因。$doc$),
    ('00000000-0000-0000-0000-000000001109'::uuid, '新人 30 天成长计划模板', 'reviewed',
     $doc$新人 30 天成长计划应以学习和协作为目标，而不是绩效裁决。第 1 周完成账号开通、制度、信息安全、协作工具和团队介绍；第 2 周理解岗位职责、业务链路、RAG/Agent/审计基础；第 3 周完成低风险实践任务并记录证据；第 4 周由导师复盘成果、风险、待补知识和下月目标。每周应包含任务、负责人、证据、风险和人工复核点；不得把计划结果直接用于淘汰、降薪或绩效评级。$doc$)
)
INSERT INTO rag_documents (id, source_id, title, version, status, trust_level, sensitivity, content, content_hash, published_at, created_by_user_id)
SELECT
  id,
  '00000000-0000-0000-0000-000000000904'::uuid,
  title,
  'v1',
  'published',
  trust_level,
  'normal',
  content,
  encode(digest(title, 'sha256'), 'hex'),
  now(),
  NULL
FROM docs
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

WITH scopes(id, document_id) AS (
  VALUES
    ('00000000-0000-0000-0000-000000001110'::uuid, '00000000-0000-0000-0000-000000001100'::uuid),
    ('00000000-0000-0000-0000-000000001111'::uuid, '00000000-0000-0000-0000-000000001101'::uuid),
    ('00000000-0000-0000-0000-000000001112'::uuid, '00000000-0000-0000-0000-000000001102'::uuid),
    ('00000000-0000-0000-0000-000000001113'::uuid, '00000000-0000-0000-0000-000000001103'::uuid),
    ('00000000-0000-0000-0000-000000001114'::uuid, '00000000-0000-0000-0000-000000001104'::uuid),
    ('00000000-0000-0000-0000-000000001115'::uuid, '00000000-0000-0000-0000-000000001105'::uuid),
    ('00000000-0000-0000-0000-000000001116'::uuid, '00000000-0000-0000-0000-000000001106'::uuid),
    ('00000000-0000-0000-0000-000000001117'::uuid, '00000000-0000-0000-0000-000000001107'::uuid),
    ('00000000-0000-0000-0000-000000001118'::uuid, '00000000-0000-0000-0000-000000001108'::uuid),
    ('00000000-0000-0000-0000-000000001119'::uuid, '00000000-0000-0000-0000-000000001109'::uuid)
)
INSERT INTO rag_document_scopes (id, document_id, scope_type, scope_id, role_code, include_descendants)
SELECT scopes.id, scopes.document_id, 'global', NULL, NULL, true
FROM scopes
JOIN rag_documents d ON d.id = scopes.document_id
WHERE NOT EXISTS (
  SELECT 1 FROM rag_document_scopes s
  WHERE s.document_id = scopes.document_id
    AND s.scope_type = 'global'
    AND s.scope_id IS NULL
    AND s.role_code IS NULL
    AND s.employee_id IS NULL
);

WITH chunks(id, document_id, chunk_index, title, section_path, context_prefix, content) AS (
  VALUES
    ('00000000-0000-0000-0000-000000001120'::uuid, '00000000-0000-0000-0000-000000001100'::uuid, 0, '页面级操作入口', '页面指南/入口', 'AI-HRMS 页面级操作指南合集',
     $chunk$指挥看板看风险、证据和建议概览；AI 指挥中心生成受控 HR 草稿；Knowledge Hub 发布资料、设置 scope 并重建 embedding；文档库阅读资料和带引用问答；Agent 运行中心查看 run、toolPreview 和人工确认；信任与审计检索事件；设置页调整语言、密度、侧边栏和 Copilot 默认项。$chunk$),
    ('00000000-0000-0000-0000-000000001121'::uuid, '00000000-0000-0000-0000-000000001101'::uuid, 0, 'RAG 发布与问不到排查', 'RAG/SOP', 'RAG 发布 SOP 与失败排查',
     $chunk$发布资料先建 source，录入标题版本正文有效期，设置 trust、sensitivity 和 scope，保存 draft，复核 published，重建 chunk/embedding，再用真实问题验证 citation。问不到时检查 published、scope、sensitivity、effective 时间、ingest job、embedding 维度和查询质量。$chunk$),
    ('00000000-0000-0000-0000-000000001122'::uuid, '00000000-0000-0000-0000-000000001102'::uuid, 0, 'Citation 字段定位', 'RAG/Citation', 'Citation 字段与引用定位说明',
     $chunk$citation 包含 documentId、chunkId、title、snippet、trustLevel、sensitivity、score、pageRef 和 locationRef。用户问依据时先给结论，再列出引用标题、片段和可定位字段；没有 citation 时说明未找到可引用资料。$chunk$),
    ('00000000-0000-0000-0000-000000001123'::uuid, '00000000-0000-0000-0000-000000001103'::uuid, 0, '页面字段和控件含义', 'Visual Copilot/字段字典', 'Visual Copilot 页面字段字典',
     $chunk$解释页面字段优先用 DOM label、data-vc-kind、data-vc-field、businessRef、route 和 layout snapshot。按钮表示命令，卡片表示业务对象摘要，表格行对应员工、组织、法人、资料、Agent run 或审计事件，Tag 常表示 risk、confidence、sensitivity、trust、auditStatus、toolPreview 和 humanReviewRequired。$chunk$),
    ('00000000-0000-0000-0000-000000001124'::uuid, '00000000-0000-0000-0000-000000001104'::uuid, 0, '角色 Capability 权限表', '权限/Capability', '角色 Capability 对照与权限申请',
     $chunk$group_admin 拥有账号、角色、scope、RAG 发布、审计和高风险治理入口；group_hr 处理集团 HR 数据和制度；entity_hr 面向法人边界；org_manager 看授权组织；employee 看个人记录和公开资料。申请权限需说明目的、scope、持续时间和审批人。$chunk$),
    ('00000000-0000-0000-0000-000000001125'::uuid, '00000000-0000-0000-0000-000000001105'::uuid, 0, 'Agent Run 状态字段', 'Agent/Run 字典', 'Agent Run 状态与工具调用字段字典',
     $chunk$Agent run 状态包括 previewed、waiting_human_review、running、completed、failed、blocked 和 cancelled。用户问 run 时先解释状态和是否等待人工确认，再说明证据、工具预览和下一步，不把预览当成已执行结果。$chunk$),
    ('00000000-0000-0000-0000-000000001126'::uuid, '00000000-0000-0000-0000-000000001106'::uuid, 0, '审计事件筛选', '审计/事件类型', '审计事件类型与筛选导出说明',
     $chunk$常见审计事件包括 ai.chat.answer、rag.citation.used、visual_copilot.preview、agent.tool.preview、human.review.requested、human.review.approved_preview、high_risk.action.blocked、employee.update、role.binding.changed 和 rag.document.published。筛选优先用时间、操作者、objectType、objectId、riskLevel、auditStatus 和 requestId。$chunk$),
    ('00000000-0000-0000-0000-000000001127'::uuid, '00000000-0000-0000-0000-000000001107'::uuid, 0, 'Embedding Provider 排查', 'RAG/Provider', 'Embedding 与 Provider 状态排查',
     $chunk$RAG 质量排查先看 provider status、API key 或 fake provider、RAG_EMBEDDING_DIMENSIONS、ingest job、chunk 数、文档长度、查询质量和 hybrid 低分命中。维度变更后需要重建受影响 embedding，不能混用不同维度。$chunk$),
    ('00000000-0000-0000-0000-000000001128'::uuid, '00000000-0000-0000-0000-000000001108'::uuid, 0, '员工字段脱敏模板', '隐私/脱敏', '员工字段分级与脱敏模板',
     $chunk$低敏字段包括姓名、组织、岗位、任职状态和公开职责；中敏字段包括考勤摘要、学习记录、任职变更和内部消息摘要；高敏字段包括手机号、证件、地址、薪酬、绩效明细、医疗、纪律处分和劳动争议。外发给模型时优先使用摘要，不发送高敏字段。$chunk$),
    ('00000000-0000-0000-0000-000000001129'::uuid, '00000000-0000-0000-0000-000000001109'::uuid, 0, '新人 30 天计划模板', '成长/新人计划', '新人 30 天成长计划模板',
     $chunk$新人 30 天计划第 1 周完成账号、制度、安全、协作和团队介绍；第 2 周理解岗位、业务链路、RAG/Agent/审计基础；第 3 周完成低风险实践并记录证据；第 4 周导师复盘成果、风险、待补知识和下月目标。不得把计划结果直接用于淘汰、降薪或绩效评级。$chunk$)
)
INSERT INTO rag_chunks (
  id, document_id, chunk_index, title, content, content_hash, sensitivity,
  section_path, body_content, context_prefix, chunk_strategy, token_budget, body_runes, overlap_runes
)
SELECT
  id,
  document_id,
  chunk_index,
  title,
  content,
  encode(digest(title, 'sha256'), 'hex'),
  'normal',
  section_path,
  content,
  context_prefix,
  'heading_sentence_context_v2_qwen3_2048',
  2048,
  char_length(content),
  120
FROM chunks
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

INSERT INTO rag_embeddings (id, chunk_id, provider, model, dimensions, embedding)
VALUES
  ('00000000-0000-0000-0000-000000001130', '00000000-0000-0000-0000-000000001120', 'fake', 'deterministic-v1', 8, '[0.37,0.21,0.40,0.56,0.61,0.75,0.83,0.92]'),
  ('00000000-0000-0000-0000-000000001131', '00000000-0000-0000-0000-000000001121', 'fake', 'deterministic-v1', 8, '[0.29,0.34,0.48,0.52,0.66,0.71,0.86,0.93]'),
  ('00000000-0000-0000-0000-000000001132', '00000000-0000-0000-0000-000000001122', 'fake', 'deterministic-v1', 8, '[0.25,0.30,0.43,0.59,0.64,0.78,0.84,0.91]'),
  ('00000000-0000-0000-0000-000000001133', '00000000-0000-0000-0000-000000001123', 'fake', 'deterministic-v1', 8, '[0.31,0.23,0.45,0.54,0.69,0.74,0.80,0.95]'),
  ('00000000-0000-0000-0000-000000001134', '00000000-0000-0000-0000-000000001124', 'fake', 'deterministic-v1', 8, '[0.19,0.38,0.41,0.57,0.63,0.79,0.82,0.90]'),
  ('00000000-0000-0000-0000-000000001135', '00000000-0000-0000-0000-000000001125', 'fake', 'deterministic-v1', 8, '[0.22,0.35,0.50,0.53,0.67,0.72,0.88,0.96]'),
  ('00000000-0000-0000-0000-000000001136', '00000000-0000-0000-0000-000000001126', 'fake', 'deterministic-v1', 8, '[0.28,0.26,0.47,0.60,0.65,0.77,0.81,0.89]'),
  ('00000000-0000-0000-0000-000000001137', '00000000-0000-0000-0000-000000001127', 'fake', 'deterministic-v1', 8, '[0.32,0.17,0.44,0.58,0.70,0.76,0.85,0.94]'),
  ('00000000-0000-0000-0000-000000001138', '00000000-0000-0000-0000-000000001128', 'fake', 'deterministic-v1', 8, '[0.16,0.33,0.46,0.49,0.62,0.73,0.87,0.97]'),
  ('00000000-0000-0000-0000-000000001139', '00000000-0000-0000-0000-000000001129', 'fake', 'deterministic-v1', 8, '[0.24,0.37,0.42,0.55,0.68,0.80,0.86,0.98]')
ON CONFLICT (chunk_id, provider, model) DO UPDATE SET
  dimensions = EXCLUDED.dimensions,
  embedding = EXCLUDED.embedding;
