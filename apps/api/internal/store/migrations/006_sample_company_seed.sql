-- Synthetic demo company data. This is business context only; it is separate
-- from the AI-HRMS product positioning.

INSERT INTO legal_entities (id, parent_id, code, name, legal_name, unified_social_credit_code, legal_representative, company_phone, email, area, address)
VALUES
  ('00000000-0000-0000-0000-000000000101', NULL, 'GROUP', '云衡科技集团', '云衡互联网科技有限公司', '91440300YUNHENG001', '许海川', '0755-86000000', 'people@yunheng.example', '深圳', '深圳市南山区海湾科技园 1 号'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 'SUB-A', '云衡企业服务', '云衡企业服务有限公司', '91440300YUNHENG002', '罗启明', '0755-86000002', 'enterprise-hr@yunheng.example', '深圳', '深圳市南山区企业服务路 8 号'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', 'SUB-B', '云衡协同产品', '云衡协同产品有限公司', '91440300YUNHENG003', '顾明远', '028-86000003', 'yunheng-collab-hr@yunheng.example', '成都', '成都市高新区协同产品大道 12 号'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000101', 'YUNHENG-RISK', '云衡风控科技', '云衡风控科技有限公司', '91440300YUNHENG004', '沈知衡', '020-86000004', 'risk-hr@yunheng.example', '广州', '广州市天河区风险治理路 6 号'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000101', 'YUNHENG-GROWTH', '云衡增长科技', '云衡增长科技有限公司', '91440300YUNHENG005', '周雨桐', '0571-86000005', 'growth-ops@yunheng.example', '杭州', '杭州市余杭区增长街 9 号')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  unified_social_credit_code = EXCLUDED.unified_social_credit_code,
  legal_representative = EXCLUDED.legal_representative,
  company_phone = EXCLUDED.company_phone,
  email = EXCLUDED.email,
  area = EXCLUDED.area,
  address = EXCLUDED.address,
  updated_at = now();

INSERT INTO org_units (id, parent_id, legal_entity_id, code, name, type, manager_name)
VALUES
  ('00000000-0000-0000-0000-000000000201', NULL, '00000000-0000-0000-0000-000000000101', 'GROUP-HR', '集团人力资源部', 'shared', '许安宁'),
  ('00000000-0000-0000-0000-000000000202', NULL, '00000000-0000-0000-0000-000000000101', 'AI-PLATFORM', 'AI 平台工程部', 'department', '顾明远'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'AI-GOV', 'AI 安全与治理委员会', 'committee', '沈知衡'),
  ('00000000-0000-0000-0000-000000000204', NULL, '00000000-0000-0000-0000-000000000103', 'COLLAB-RD', '协同产品研发部', 'department', '顾明远'),
  ('00000000-0000-0000-0000-000000000205', NULL, '00000000-0000-0000-0000-000000000102', 'ENTERPRISE-CS', '企业服务交付与客户成功部', 'department', '陈向南'),
  ('00000000-0000-0000-0000-000000000206', NULL, '00000000-0000-0000-0000-000000000105', 'GROWTH-STRATEGY', '增长策略部', 'department', '周雨桐'),
  ('00000000-0000-0000-0000-000000000207', NULL, '00000000-0000-0000-0000-000000000104', 'RISK-GOV', '风险策略部', 'department', '沈知衡')
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  legal_entity_id = EXCLUDED.legal_entity_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  manager_name = EXCLUDED.manager_name,
  updated_at = now();

UPDATE users SET username = '许安宁 集团 HR' WHERE id = '00000000-0000-0000-0000-000000000301';
UPDATE users SET username = '陈向南 HRBP' WHERE id = '00000000-0000-0000-0000-000000000302';
UPDATE users SET username = '林晨 新人研发' WHERE id = '00000000-0000-0000-0000-000000000303';
UPDATE users SET username = '周雨桐 导师' WHERE id = '00000000-0000-0000-0000-000000000304';

DELETE FROM user_role_bindings
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000304'
);

INSERT INTO user_role_bindings (user_id, role_id, scope_type, scope_id, include_descendants)
VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', 'global', NULL, true),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000502', 'global', NULL, true),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000505', 'org_unit', '00000000-0000-0000-0000-000000000202', false),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000504', 'org_unit', '00000000-0000-0000-0000-000000000206', true);

INSERT INTO employees (id, user_id, employee_no, name, mobile, status, sex, highest_degree_of_education, place_of_residence, graduate_school, major, home_company, title, remarks)
VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'PG001', '许安宁', '13000001001', 'active', '未知', '硕士', '深圳', '中国人民大学', '组织发展', '云衡科技集团', '集团 HR', '模拟公司样本：集团 HR 和 Demo 主讲角色'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000302', 'PG002', '陈向南', '13000001002', 'active', '未知', '本科', '深圳', '华南理工大学', '人力资源', '云衡企业服务', 'HRBP', '模拟公司样本：企业服务 HRBP'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000303', 'PG003', '林晨', '13000001003', 'active', '未知', '本科', '深圳', '同济大学', '软件工程', '云衡科技集团', 'AI 平台研发工程师', '模拟公司样本：新人研发，参与 Co-Growth mission'),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000304', 'PG004', '周雨桐', '13000001004', 'active', '未知', '硕士', '杭州', '浙江大学', '计算机科学', '云衡增长科技', '算法导师', '模拟公司样本：导师，复核新人 AI Work Journal'),
  ('00000000-0000-0000-0000-000000000405', NULL, 'PG005', '顾明远', '13000001005', 'active', '未知', '硕士', '成都', '电子科技大学', '协同产品工程', '云衡协同产品', '业务管理者', '模拟公司样本：关注组织能力和 Agent 风险'),
  ('00000000-0000-0000-0000-000000000406', NULL, 'PG006', '沈知衡', '13000001006', 'active', '未知', '博士', '广州', '中山大学', '信息安全', '云衡风控科技', 'AI 安全与审计负责人', '模拟公司样本：负责知识治理和风险边界')
ON CONFLICT (id) DO UPDATE SET
  employee_no = EXCLUDED.employee_no,
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  mobile = EXCLUDED.mobile,
  status = EXCLUDED.status,
  sex = EXCLUDED.sex,
  highest_degree_of_education = EXCLUDED.highest_degree_of_education,
  place_of_residence = EXCLUDED.place_of_residence,
  graduate_school = EXCLUDED.graduate_school,
  major = EXCLUDED.major,
  home_company = EXCLUDED.home_company,
  title = EXCLUDED.title,
  remarks = EXCLUDED.remarks,
  updated_at = now();

UPDATE attendance_records SET
  employee_id = '00000000-0000-0000-0000-000000000403',
  attendance_status = 1,
  attendance_in_time = '2026-05-29 09:02:00+08',
  attendance_out_time = NULL,
  day = '2026-05-29',
  remarks = 'AI 平台新人完成 Co-Growth mission 签到'
WHERE id = '00000000-0000-0000-0000-000000000601';

UPDATE attendance_records SET
  employee_id = '00000000-0000-0000-0000-000000000402',
  attendance_status = 3,
  attendance_in_time = '2026-05-29 09:18:00+08',
  attendance_out_time = '2026-05-29 18:15:00+08',
  day = '2026-05-29',
  remarks = '企业服务交付周会延迟'
WHERE id = '00000000-0000-0000-0000-000000000602';

UPDATE attendance_records SET
  employee_id = '00000000-0000-0000-0000-000000000404',
  attendance_status = 1,
  attendance_in_time = '2026-05-29 08:55:00+08',
  attendance_out_time = '2026-05-29 18:30:00+08',
  day = '2026-05-29',
  remarks = '导师复盘日'
WHERE id = '00000000-0000-0000-0000-000000000603';

UPDATE messages SET
  title = '云衡科技 AI-HRMS Demo 数据说明',
  author_user_id = '00000000-0000-0000-0000-000000000301',
  category = 'announcement',
  org_unit_id = '00000000-0000-0000-0000-000000000201',
  scope_type = 'global',
  scope_id = NULL,
  include_descendants = true,
  content = '<p>本环境使用虚构的云衡互联网科技有限公司作为模拟租户，用于展示 AI-HRMS 的组织、知识、Agent 与审计闭环。</p>',
  star = 12,
  view_count = 168,
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000701';

UPDATE messages SET
  title = 'AI 使用安全与人工确认提醒',
  author_user_id = '00000000-0000-0000-0000-000000000302',
  category = 'governance',
  org_unit_id = '00000000-0000-0000-0000-000000000201',
  scope_type = 'global',
  scope_id = NULL,
  include_descendants = true,
  content = '<p>候选人、绩效、薪酬、客户数据和员工敏感信息场景只允许 AI 生成预览。最终判断必须由 HR、导师或业务负责人确认，并写入审计。</p>',
  star = 9,
  view_count = 121,
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000702';

UPDATE comments SET
  author_user_id = '00000000-0000-0000-0000-000000000304',
  content = '<p>导师侧会重点检查 evidence、riskLevel 和 humanReviewRequired 是否完整。</p>',
  created_at = '2026-05-29 10:30:00+08'
WHERE id = '00000000-0000-0000-0000-000000000801';

UPDATE comments SET
  author_user_id = '00000000-0000-0000-0000-000000000302',
  content = '<p>集团 HR 会把高风险 Agent run 保持在预览状态，直到人工确认完成。</p>',
  created_at = '2026-05-29 11:10:00+08'
WHERE id = '00000000-0000-0000-0000-000000000802';

UPDATE employee_assignments SET
  legal_entity_id = '00000000-0000-0000-0000-000000000101',
  org_unit_id = '00000000-0000-0000-0000-000000000201',
  position_title = '集团 HR',
  employment_type = 'full_time'
WHERE employee_id = '00000000-0000-0000-0000-000000000401' AND is_primary AND end_date IS NULL;

UPDATE employee_assignments SET
  legal_entity_id = '00000000-0000-0000-0000-000000000102',
  org_unit_id = '00000000-0000-0000-0000-000000000205',
  position_title = '企业服务 HRBP',
  employment_type = 'full_time'
WHERE employee_id = '00000000-0000-0000-0000-000000000402' AND is_primary AND end_date IS NULL;

UPDATE employee_assignments SET
  legal_entity_id = '00000000-0000-0000-0000-000000000101',
  org_unit_id = '00000000-0000-0000-0000-000000000202',
  position_title = 'AI 平台研发工程师',
  employment_type = 'full_time'
WHERE employee_id = '00000000-0000-0000-0000-000000000403' AND is_primary AND end_date IS NULL;

UPDATE employee_assignments SET
  legal_entity_id = '00000000-0000-0000-0000-000000000105',
  org_unit_id = '00000000-0000-0000-0000-000000000206',
  position_title = '增长算法导师',
  employment_type = 'full_time'
WHERE employee_id = '00000000-0000-0000-0000-000000000404' AND is_primary AND end_date IS NULL;

INSERT INTO employee_assignments (employee_id, legal_entity_id, org_unit_id, position_title, is_primary, start_date, employment_type)
SELECT '00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000204', '协同产品研发管理者', true, '2026-04-01', 'full_time'
WHERE NOT EXISTS (SELECT 1 FROM employee_assignments WHERE employee_id = '00000000-0000-0000-0000-000000000405' AND is_primary AND end_date IS NULL);

INSERT INTO employee_assignments (employee_id, legal_entity_id, org_unit_id, position_title, is_primary, start_date, employment_type)
SELECT '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000207', 'AI 安全与审计负责人', true, '2026-04-01', 'full_time'
WHERE NOT EXISTS (SELECT 1 FROM employee_assignments WHERE employee_id = '00000000-0000-0000-0000-000000000406' AND is_primary AND end_date IS NULL);

INSERT INTO rag_sources (id, source_type, name, uri, status, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000902', 'upload', '云衡科技 HR 制度库', 'seed://yunheng-hr-policy', 'active', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000903', 'upload', '云衡科技 AI 治理资料包', 'seed://yunheng-ai-governance', 'active', '00000000-0000-0000-0000-000000000301')
ON CONFLICT (id) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  name = EXCLUDED.name,
  uri = EXCLUDED.uri,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO rag_documents (id, source_id, title, version, status, trust_level, sensitivity, content, content_hash, published_at, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000912', '00000000-0000-0000-0000-000000000902', '云衡科技新员工入职指南', 'v1', 'published', 'official', 'normal',
   '云衡科技新员工入职 7 天内完成账号、信息安全、协作工具和事业群业务导览。30 天内由导师完成一次成长复盘，确认工作上下文、学习计划和协作风险。', encode(digest('云衡科技新员工入职指南', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000913', '00000000-0000-0000-0000-000000000903', '云衡科技 AI 使用安全规范', 'v1', 'published', 'official', 'normal',
   '员工不得把客户数据、未授权代码、密钥、员工敏感信息或高影响人事决策材料直接放入外部 AI prompt。AI 生成建议必须保留 evidence、riskLevel、confidence 和 humanReviewRequired。', encode(digest('云衡科技 AI 使用安全规范', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000914', '00000000-0000-0000-0000-000000000903', 'Agent 工具调用审计规范', 'v1', 'published', 'official', 'normal',
   'Agent 工具调用必须先生成 toolPreview，展示工具名、参数摘要、写入范围、可逆性和人工确认要求。中高风险动作必须进入人工复核，执行和阻断都写入审计。', encode(digest('Agent 工具调用审计规范', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000915', '00000000-0000-0000-0000-000000000902', 'AI 平台工程部新人 30 天成长计划', 'v1', 'published', 'reviewed', 'normal',
   'AI 平台新人第 1 周完成工程环境和代码规范，第 2 周完成 RAG 与 Agent 基础任务，第 3 周参与一次工具预览评审，第 4 周提交 AI Work Journal 和导师复盘。', encode(digest('AI 平台工程部新人 30 天成长计划', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000916', '00000000-0000-0000-0000-000000000902', '面试公平性与招聘合规指引', 'v1', 'published', 'reviewed', 'restricted',
   'AI 可以辅助生成结构化面试问题、评分维度和一致性检查清单，但不得输出录用、淘汰、薪酬或绩效裁决。涉及候选人的结论必须由 HR 和业务面试官人工确认。', encode(digest('面试公平性与招聘合规指引', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000917', '00000000-0000-0000-0000-000000000902', '企业服务客户交付手册', 'v1', 'published', 'reviewed', 'normal',
   '企业服务团队在项目启动、方案评审、客户培训和上线复盘阶段沉淀知识。客户数据和访问凭证不得进入外部 AI；可公开的流程知识可以用于 RAG 检索。', encode(digest('企业服务客户交付手册', 'sha256'), 'hex'), now(), '00000000-0000-0000-0000-000000000301')
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
  '00000000-0000-0000-0000-000000000912',
  '00000000-0000-0000-0000-000000000913',
  '00000000-0000-0000-0000-000000000914',
  '00000000-0000-0000-0000-000000000915',
  '00000000-0000-0000-0000-000000000917'
)
AND NOT EXISTS (
  SELECT 1 FROM rag_document_scopes s
  WHERE s.document_id = d.id
    AND s.scope_type = 'global'
    AND s.scope_id IS NULL
    AND s.role_code IS NULL
    AND s.employee_id IS NULL
);

INSERT INTO rag_document_scopes (document_id, scope_type, scope_id, role_code, include_descendants)
SELECT '00000000-0000-0000-0000-000000000916', 'role', NULL, 'group_hr', false
WHERE NOT EXISTS (
  SELECT 1 FROM rag_document_scopes
  WHERE document_id = '00000000-0000-0000-0000-000000000916' AND scope_type = 'role' AND role_code = 'group_hr'
);

INSERT INTO rag_chunks (id, document_id, chunk_index, title, content, content_hash, sensitivity)
VALUES
  ('00000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000912', 0, '云衡科技入职 7/30 天要求', '云衡科技新员工入职 7 天内完成账号、信息安全、协作工具和事业群业务导览。30 天内由导师完成一次成长复盘。', encode(digest('云衡科技入职 7/30 天要求', 'sha256'), 'hex'), 'normal'),
  ('00000000-0000-0000-0000-000000000923', '00000000-0000-0000-0000-000000000913', 0, 'AI 使用安全边界', '员工不得把客户数据、未授权代码、密钥、员工敏感信息或高影响人事决策材料直接放入外部 AI prompt。', encode(digest('AI 使用安全边界', 'sha256'), 'hex'), 'internal'),
  ('00000000-0000-0000-0000-000000000924', '00000000-0000-0000-0000-000000000914', 0, 'Agent 工具调用预览和审计', 'Agent 工具调用必须先生成 toolPreview，展示工具名、参数摘要、写入范围、可逆性和人工确认要求。', encode(digest('Agent 工具调用预览和审计', 'sha256'), 'hex'), 'internal'),
  ('00000000-0000-0000-0000-000000000925', '00000000-0000-0000-0000-000000000915', 0, 'AI 平台新人 30 天成长节奏', 'AI 平台新人第 1 周完成工程环境和代码规范，第 2 周完成 RAG 与 Agent 基础任务，第 3 周参与工具预览评审，第 4 周提交 AI Work Journal。', encode(digest('AI 平台新人 30 天成长节奏', 'sha256'), 'hex'), 'normal'),
  ('00000000-0000-0000-0000-000000000926', '00000000-0000-0000-0000-000000000916', 0, '招聘合规边界', 'AI 可以辅助生成结构化面试问题和一致性检查清单，但不得输出录用、淘汰、薪酬或绩效裁决。', encode(digest('招聘合规边界', 'sha256'), 'hex'), 'restricted'),
  ('00000000-0000-0000-0000-000000000927', '00000000-0000-0000-0000-000000000917', 0, '企业服务知识沉淀', '企业服务团队在项目启动、方案评审、客户培训和上线复盘阶段沉淀知识。客户数据和访问凭证不得进入外部 AI。', encode(digest('企业服务知识沉淀', 'sha256'), 'hex'), 'normal')
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  content_hash = EXCLUDED.content_hash,
  sensitivity = EXCLUDED.sensitivity;

INSERT INTO rag_embeddings (chunk_id, provider, model, dimensions, embedding)
VALUES
  ('00000000-0000-0000-0000-000000000922', 'fake', 'deterministic-v1', 8, '[0.11,0.20,0.31,0.42,0.52,0.61,0.72,0.83]'),
  ('00000000-0000-0000-0000-000000000923', 'fake', 'deterministic-v1', 8, '[0.21,0.12,0.41,0.32,0.67,0.48,0.59,0.76]'),
  ('00000000-0000-0000-0000-000000000924', 'fake', 'deterministic-v1', 8, '[0.18,0.29,0.37,0.46,0.55,0.64,0.73,0.82]'),
  ('00000000-0000-0000-0000-000000000925', 'fake', 'deterministic-v1', 8, '[0.31,0.23,0.35,0.47,0.58,0.69,0.71,0.84]'),
  ('00000000-0000-0000-0000-000000000927', 'fake', 'deterministic-v1', 8, '[0.17,0.34,0.25,0.52,0.43,0.60,0.78,0.81]')
ON CONFLICT (chunk_id, provider, model) DO UPDATE SET
  dimensions = EXCLUDED.dimensions,
  embedding = EXCLUDED.embedding;

INSERT INTO learning_courses (id, title, description, status, scope_type, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000934', '云衡科技新人 30 天融入计划', '面向综合互联网业务新人，覆盖信息安全、事业群协作、AI 工具边界和导师复盘。', 'published', 'global', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000935', 'AI 平台工程人机协作训练', '面向 AI 平台工程部新人，围绕 RAG、Agent 工具预览、审计证据和工作日志训练。', 'published', 'global', '00000000-0000-0000-0000-000000000301')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO learning_lessons (id, course_id, title, content, sort_order, rag_document_id)
VALUES
  ('00000000-0000-0000-0000-000000000936', '00000000-0000-0000-0000-000000000934', '云衡科技组织与业务导览', '了解协同产品、内容运营、企业服务、风险策略、增长运营和 AI 平台的协作方式。', 1, '00000000-0000-0000-0000-000000000912'),
  ('00000000-0000-0000-0000-000000000937', '00000000-0000-0000-0000-000000000934', '信息安全与 AI 使用边界', '学习客户数据、密钥、代码和员工敏感信息不能进入外部 AI 的场景。', 2, '00000000-0000-0000-0000-000000000913'),
  ('00000000-0000-0000-0000-000000000938', '00000000-0000-0000-0000-000000000935', '从 RAG 到 Agent 工具预览', '把一次知识检索任务拆成 context、toolPreview、humanReview 和 audit。', 1, '00000000-0000-0000-0000-000000000914')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  sort_order = EXCLUDED.sort_order,
  rag_document_id = EXCLUDED.rag_document_id;
