-- Fictional sample company data for production-like environments.
-- This seed is opt-in and does not create login users or passwords.

INSERT INTO legal_entities (id, parent_id, code, name, legal_name, unified_social_credit_code, legal_representative, company_phone, email, area, address, status)
VALUES
  ('00000000-0000-0000-0000-000000000101', NULL, 'GROUP', '云衡互联网科技有限公司', '云衡互联网科技有限公司', '91440300YUNHENG001', '许海川', '0755-86000000', 'people@yunheng.example', '深圳', '深圳市南山区海湾科技园 1 号', 'active'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 'SUB-A', '云衡企业服务', '云衡企业服务有限公司', '91440300YUNHENG002', '罗启明', '0755-86000002', 'enterprise-hr@yunheng.example', '深圳', '深圳市南山区企业服务路 8 号', 'active'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', 'SUB-B', '云衡协同产品', '云衡协同产品有限公司', '91440300YUNHENG003', '顾明远', '028-86000003', 'yunheng-collab-hr@yunheng.example', '成都', '成都市高新区协同产品大道 12 号', 'active'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000101', 'YUNHENG-RISK', '云衡风控科技', '云衡风控科技有限公司', '91440300YUNHENG004', '沈知衡', '020-86000004', 'risk-hr@yunheng.example', '广州', '广州市天河区风险治理路 6 号', 'active'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000101', 'YUNHENG-GROWTH', '云衡增长科技', '云衡增长科技有限公司', '91440300YUNHENG005', '周雨桐', '0571-86000005', 'growth-ops@yunheng.example', '杭州', '杭州市余杭区增长街 9 号', 'active')
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  unified_social_credit_code = EXCLUDED.unified_social_credit_code,
  legal_representative = EXCLUDED.legal_representative,
  company_phone = EXCLUDED.company_phone,
  email = EXCLUDED.email,
  area = EXCLUDED.area,
  address = EXCLUDED.address,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO org_units (id, parent_id, legal_entity_id, code, name, type, manager_name, status)
VALUES
  ('00000000-0000-0000-0000-000000000201', NULL, '00000000-0000-0000-0000-000000000101', 'GROUP-HR', '集团人力资源部', 'shared', '许安宁', 'active'),
  ('00000000-0000-0000-0000-000000000202', NULL, '00000000-0000-0000-0000-000000000101', 'AI-PLATFORM', 'AI 平台工程部', 'department', '顾明远', 'active'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'AI-GOV', 'AI 安全与治理委员会', 'committee', '沈知衡', 'active'),
  ('00000000-0000-0000-0000-000000000204', NULL, '00000000-0000-0000-0000-000000000103', 'COLLAB-RD', '协同产品研发部', 'department', '顾明远', 'active'),
  ('00000000-0000-0000-0000-000000000205', NULL, '00000000-0000-0000-0000-000000000102', 'ENTERPRISE-CS', '企业服务交付与客户成功部', 'department', '陈向南', 'active'),
  ('00000000-0000-0000-0000-000000000206', NULL, '00000000-0000-0000-0000-000000000105', 'GROWTH-STRATEGY', '增长策略部', 'department', '周雨桐', 'active'),
  ('00000000-0000-0000-0000-000000000207', NULL, '00000000-0000-0000-0000-000000000104', 'RISK-GOV', '风险策略部', 'department', '沈知衡', 'active')
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  legal_entity_id = EXCLUDED.legal_entity_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  manager_name = EXCLUDED.manager_name,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO employees (id, user_id, employee_no, name, mobile, status, sex, highest_degree_of_education, place_of_residence, graduate_school, major, home_company, title, remarks)
VALUES
  ('00000000-0000-0000-0000-000000000401', NULL, 'PG001', '许安宁', '13800000001', 'active', '未知', '硕士', '深圳', '中国人民大学', '组织发展', '云衡互联网科技有限公司', '集团 HR', '云衡科技虚构样本：集团 HR 和 Demo 主讲角色'),
  ('00000000-0000-0000-0000-000000000402', NULL, 'PG002', '陈向南', '13800000002', 'active', '未知', '本科', '深圳', '华南理工大学', '人力资源', '云衡企业服务', '企业服务 HRBP', '云衡科技虚构样本：企业服务 HRBP'),
  ('00000000-0000-0000-0000-000000000403', NULL, 'PG003', '林晨', '13800000003', 'active', '未知', '本科', '深圳', '同济大学', '软件工程', '云衡互联网科技有限公司', 'AI 平台研发工程师', '云衡科技虚构样本：新人研发，参与 Co-Growth mission'),
  ('00000000-0000-0000-0000-000000000404', NULL, 'PG004', '周雨桐', '13800000004', 'active', '未知', '硕士', '杭州', '浙江大学', '计算机科学', '云衡增长科技', '算法导师', '云衡科技虚构样本：导师，复核新人 AI Work Journal'),
  ('00000000-0000-0000-0000-000000000405', NULL, 'PG005', '顾明远', '13800000005', 'active', '未知', '硕士', '成都', '电子科技大学', '协同产品工程', '云衡协同产品', '业务管理者', '云衡科技虚构样本：关注组织能力和 Agent 风险'),
  ('00000000-0000-0000-0000-000000000406', NULL, 'PG006', '沈知衡', '13800000006', 'active', '未知', '博士', '广州', '中山大学', '信息安全', '云衡风控科技', 'AI 安全与审计负责人', '云衡科技虚构样本：负责知识治理和风险边界')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  employee_no = EXCLUDED.employee_no,
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

UPDATE employee_assignments
SET is_primary = false,
    end_date = COALESCE(end_date, current_date)
WHERE employee_id IN (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000403',
  '00000000-0000-0000-0000-000000000404',
  '00000000-0000-0000-0000-000000000405',
  '00000000-0000-0000-0000-000000000406'
)
AND id NOT IN (
  '00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000412',
  '00000000-0000-0000-0000-000000000413',
  '00000000-0000-0000-0000-000000000414',
  '00000000-0000-0000-0000-000000000415',
  '00000000-0000-0000-0000-000000000416'
)
AND is_primary
AND end_date IS NULL;

INSERT INTO employee_assignments (id, employee_id, legal_entity_id, org_unit_id, position_title, is_primary, start_date, end_date, employment_type)
VALUES
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '集团 HR', true, '2026-04-01', NULL, 'full_time'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000205', '企业服务 HRBP', true, '2026-04-01', NULL, 'full_time'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', 'AI 平台研发工程师', true, '2026-05-01', NULL, 'full_time'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000206', '增长算法导师', true, '2026-04-01', NULL, 'full_time'),
  ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000204', '协同产品研发管理者', true, '2026-04-01', NULL, 'full_time'),
  ('00000000-0000-0000-0000-000000000416', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000207', 'AI 安全与审计负责人', true, '2026-04-01', NULL, 'full_time')
ON CONFLICT (id) DO UPDATE SET
  legal_entity_id = EXCLUDED.legal_entity_id,
  org_unit_id = EXCLUDED.org_unit_id,
  position_title = EXCLUDED.position_title,
  is_primary = EXCLUDED.is_primary,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  employment_type = EXCLUDED.employment_type;

INSERT INTO attendance_records (id, employee_id, attendance_status, attendance_in_time, attendance_out_time, attendance_in_place, day, remarks)
VALUES
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000403', 1, '2026-05-29 09:02:00+08', NULL, '深圳', '2026-05-29', 'AI 平台新人完成 Co-Growth mission 签到'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000402', 3, '2026-05-29 09:18:00+08', '2026-05-29 18:15:00+08', '深圳', '2026-05-29', '企业服务交付周会延迟'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000404', 1, '2026-05-29 08:55:00+08', '2026-05-29 18:30:00+08', '杭州', '2026-05-29', '导师复盘日')
ON CONFLICT (id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  attendance_status = EXCLUDED.attendance_status,
  attendance_in_time = EXCLUDED.attendance_in_time,
  attendance_out_time = EXCLUDED.attendance_out_time,
  attendance_in_place = EXCLUDED.attendance_in_place,
  day = EXCLUDED.day,
  remarks = EXCLUDED.remarks;

INSERT INTO messages (id, title, category, content, author_user_id, org_unit_id, scope_type, scope_id, include_descendants, star, view_count)
VALUES
  ('00000000-0000-0000-0000-000000000701', '本周 AI 学习 mission 开放试用', 'announcement', '<p>云衡互联网科技有限公司（虚构样本组织）的 AI-HRMS 成长引擎样本任务已开放。欢迎先从 RAG 原理卡和工作内嵌 mission 开始体验。</p>', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '00000000-0000-0000-0000-000000000201', 'global', NULL, true, 7, 128),
  ('00000000-0000-0000-0000-000000000702', '请在使用 AI 建议前保留人工确认点', 'governance', '<p>涉及候选人、隐私、公平性或客户承诺的场景，AI 只做辅助建议，最终判断必须由人确认。</p>', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '00000000-0000-0000-0000-000000000202', 'global', NULL, true, 4, 86)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  author_user_id = COALESCE(EXCLUDED.author_user_id, messages.author_user_id),
  org_unit_id = EXCLUDED.org_unit_id,
  scope_type = EXCLUDED.scope_type,
  scope_id = EXCLUDED.scope_id,
  include_descendants = EXCLUDED.include_descendants,
  star = EXCLUDED.star,
  view_count = EXCLUDED.view_count,
  updated_at = now();

INSERT INTO comments (id, message_id, author_user_id, content, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000701', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '<p>我先试了案例推演模式，mission 推荐会跟着偏好变化。</p>', '2026-05-28 10:30:00+08'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000702', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '<p>高风险场景请保留 evidence、riskLevel 和 humanReviewRequired。</p>', '2026-05-28 11:40:00+08')
ON CONFLICT (id) DO UPDATE SET
  message_id = EXCLUDED.message_id,
  author_user_id = COALESCE(EXCLUDED.author_user_id, comments.author_user_id),
  content = EXCLUDED.content,
  created_at = EXCLUDED.created_at;

INSERT INTO rag_sources (id, source_type, name, uri, status, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000902', 'upload', '云衡互联网科技 HR 制度库', 'seed://yunheng-hr-policy', 'active', (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000903', 'upload', '云衡互联网科技 AI 治理资料包', 'seed://yunheng-ai-governance', 'active', (SELECT id FROM ai_hrms_seed_actor LIMIT 1))
ON CONFLICT (id) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  name = EXCLUDED.name,
  uri = EXCLUDED.uri,
  status = EXCLUDED.status,
  created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, rag_sources.created_by_user_id),
  updated_at = now();

INSERT INTO rag_documents (id, source_id, title, version, status, trust_level, sensitivity, content, content_hash, published_at, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000912', '00000000-0000-0000-0000-000000000902', '云衡互联网科技新员工入职指南', 'v1', 'published', 'official', 'normal', '云衡互联网科技有限公司新员工入职 7 天内完成账号、信息安全、协作工具和事业群业务导览。30 天内由导师完成一次成长复盘，确认工作上下文、学习计划和协作风险。', encode(digest('云衡互联网科技新员工入职指南', 'sha256'), 'hex'), now(), (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000913', '00000000-0000-0000-0000-000000000903', '云衡互联网科技 AI 使用安全规范', 'v1', 'published', 'official', 'internal', '员工不得把客户数据、未授权代码、密钥、员工敏感信息或高影响人事决策材料直接放入外部 AI prompt。AI 生成建议必须保留 evidence、riskLevel、confidence 和 humanReviewRequired。', encode(digest('云衡互联网科技 AI 使用安全规范', 'sha256'), 'hex'), now(), (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000914', '00000000-0000-0000-0000-000000000903', 'Agent 工具调用审计规范', 'v1', 'published', 'official', 'internal', 'Agent 工具调用必须先生成 toolPreview，展示工具名、参数摘要、写入范围、可逆性和人工确认要求。中高风险动作必须进入人工复核，执行和阻断都写入审计。', encode(digest('Agent 工具调用审计规范', 'sha256'), 'hex'), now(), (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000915', '00000000-0000-0000-0000-000000000902', 'AI 平台工程部新人 30 天成长计划', 'v1', 'published', 'reviewed', 'normal', 'AI 平台新人第 1 周完成工程环境和代码规范，第 2 周完成 RAG 与 Agent 基础任务，第 3 周参与一次工具预览评审，第 4 周提交 AI Work Journal 和导师复盘。', encode(digest('AI 平台工程部新人 30 天成长计划', 'sha256'), 'hex'), now(), (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000916', '00000000-0000-0000-0000-000000000902', '面试公平性与招聘合规指引', 'v1', 'published', 'reviewed', 'restricted', 'AI 可以辅助生成结构化面试问题、评分维度和一致性检查清单，但不得输出录用、淘汰、薪酬或绩效裁决。涉及候选人的结论必须由 HR 和业务面试官人工确认。', encode(digest('面试公平性与招聘合规指引', 'sha256'), 'hex'), now(), (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000917', '00000000-0000-0000-0000-000000000902', '企业服务客户交付手册', 'v1', 'published', 'reviewed', 'normal', '企业服务团队在项目启动、方案评审、客户培训和上线复盘阶段沉淀知识。客户数据和访问凭证不得进入外部 AI；可公开的流程知识可以用于 RAG 检索。', encode(digest('企业服务客户交付手册', 'sha256'), 'hex'), now(), (SELECT id FROM ai_hrms_seed_actor LIMIT 1))
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
  created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, rag_documents.created_by_user_id),
  updated_at = now();

INSERT INTO rag_document_scopes (document_id, scope_type, scope_id, role_code, employee_id, include_descendants)
SELECT d.id, 'global', NULL, NULL, NULL, true
FROM rag_documents d
WHERE d.id IN (
  '00000000-0000-0000-0000-000000000912',
  '00000000-0000-0000-0000-000000000913',
  '00000000-0000-0000-0000-000000000914',
  '00000000-0000-0000-0000-000000000915',
  '00000000-0000-0000-0000-000000000916',
  '00000000-0000-0000-0000-000000000917'
)
AND NOT EXISTS (
  SELECT 1
  FROM rag_document_scopes s
  WHERE s.document_id = d.id
    AND s.scope_type = 'global'
    AND s.scope_id IS NULL
    AND s.role_code IS NULL
    AND s.employee_id IS NULL
);

INSERT INTO rag_chunks (id, document_id, chunk_index, title, content, content_hash, sensitivity)
VALUES
  ('00000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000912', 0, '入职 7/30 天要求', '云衡互联网科技有限公司新员工入职 7 天内完成账号、信息安全、协作工具和事业群业务导览。30 天内由导师完成一次成长复盘。', encode(digest('入职 7/30 天要求', 'sha256'), 'hex'), 'normal'),
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

UPDATE rag_chunks
SET section_path = title,
    body_content = content,
    context_prefix = '',
    chunk_strategy = 'seed_sample_company',
    body_runes = char_length(content),
    overlap_runes = 0
WHERE id IN (
  '00000000-0000-0000-0000-000000000922',
  '00000000-0000-0000-0000-000000000923',
  '00000000-0000-0000-0000-000000000924',
  '00000000-0000-0000-0000-000000000925',
  '00000000-0000-0000-0000-000000000926',
  '00000000-0000-0000-0000-000000000927'
);

INSERT INTO rag_embeddings (chunk_id, provider, model, dimensions, embedding)
VALUES
  ('00000000-0000-0000-0000-000000000922', 'fake', 'deterministic-v1', 8, '[0.11,0.20,0.31,0.42,0.52,0.61,0.72,0.83]'),
  ('00000000-0000-0000-0000-000000000923', 'fake', 'deterministic-v1', 8, '[0.21,0.12,0.41,0.32,0.67,0.48,0.59,0.76]'),
  ('00000000-0000-0000-0000-000000000924', 'fake', 'deterministic-v1', 8, '[0.18,0.29,0.37,0.46,0.55,0.64,0.73,0.82]'),
  ('00000000-0000-0000-0000-000000000925', 'fake', 'deterministic-v1', 8, '[0.31,0.23,0.35,0.47,0.58,0.69,0.71,0.84]'),
  ('00000000-0000-0000-0000-000000000926', 'fake', 'deterministic-v1', 8, '[0.41,0.33,0.28,0.57,0.62,0.71,0.36,0.89]'),
  ('00000000-0000-0000-0000-000000000927', 'fake', 'deterministic-v1', 8, '[0.17,0.34,0.25,0.52,0.43,0.60,0.78,0.81]')
ON CONFLICT (chunk_id, provider, model) DO UPDATE SET
  dimensions = EXCLUDED.dimensions,
  embedding = EXCLUDED.embedding;

INSERT INTO learning_courses (id, title, description, status, scope_type, scope_id, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000934', '云衡互联网科技新人 30 天融入计划', '面向综合互联网业务新人，覆盖信息安全、事业群协作、AI 工具边界和导师复盘。', 'published', 'global', NULL, (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000935', 'AI 平台工程人机协作训练', '面向 AI 平台工程部新人，围绕 RAG、Agent 工具预览、审计证据和工作日志训练。', 'published', 'global', NULL, (SELECT id FROM ai_hrms_seed_actor LIMIT 1))
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  scope_type = EXCLUDED.scope_type,
  scope_id = EXCLUDED.scope_id,
  created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, learning_courses.created_by_user_id),
  updated_at = now();

INSERT INTO learning_lessons (id, course_id, title, content, sort_order, rag_document_id)
VALUES
  ('00000000-0000-0000-0000-000000000936', '00000000-0000-0000-0000-000000000934', '组织与业务导览', '了解协同产品、企业服务、风险策略、增长策略和 AI 平台的协作方式。', 1, '00000000-0000-0000-0000-000000000912'),
  ('00000000-0000-0000-0000-000000000937', '00000000-0000-0000-0000-000000000934', '信息安全与 AI 使用边界', '学习客户数据、密钥、代码和员工敏感信息不能进入外部 AI 的场景。', 2, '00000000-0000-0000-0000-000000000913'),
  ('00000000-0000-0000-0000-000000000938', '00000000-0000-0000-0000-000000000935', '从 RAG 到 Agent 工具预览', '把一次知识检索任务拆成 context、toolPreview、humanReview 和 audit。', 1, '00000000-0000-0000-0000-000000000914')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  sort_order = EXCLUDED.sort_order,
  rag_document_id = EXCLUDED.rag_document_id;

INSERT INTO learning_enrollments (id, employee_id, course_id, status, due_date, created_by_user_id)
VALUES
  ('00000000-0000-0000-0000-000000000941', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000934', 'in_progress', current_date + 14, (SELECT id FROM ai_hrms_seed_actor LIMIT 1)),
  ('00000000-0000-0000-0000-000000000942', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000935', 'completed', current_date + 7, (SELECT id FROM ai_hrms_seed_actor LIMIT 1))
ON CONFLICT (employee_id, course_id) DO UPDATE SET
  status = EXCLUDED.status,
  due_date = EXCLUDED.due_date,
  created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, learning_enrollments.created_by_user_id);

INSERT INTO learning_recommendations (id, employee_id, recommendation_type, title, reason, evidence, status)
VALUES
  ('00000000-0000-0000-0000-000000000944', '00000000-0000-0000-0000-000000000403', 'co_growth_mission', '用 RAG 思路整理部门知识库问答', '结合真实知识库任务学习 AI 可靠性。', '[{"source":"rag_document","id":"00000000-0000-0000-0000-000000000915"}]'::jsonb, 'recommended'),
  ('00000000-0000-0000-0000-000000000945', NULL, 'reflection', '复盘一次 AI 输出中的不可靠推理', '补齐批判性判断证据。', '[{"source":"audit_event","id":"sample-high-risk-blocked"}]'::jsonb, 'recommended')
ON CONFLICT (id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  recommendation_type = EXCLUDED.recommendation_type,
  title = EXCLUDED.title,
  reason = EXCLUDED.reason,
  evidence = EXCLUDED.evidence,
  status = EXCLUDED.status;

INSERT INTO agent_runs (id, run_type, status, actor_user_id, delegated_context, provider, model, risk_level, summary, created_at, completed_at)
VALUES
  ('00000000-0000-0000-0000-000000000951', 'co_growth_coach', 'completed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","employee":"林晨"}'::jsonb, 'fake', 'deterministic-v1', 'low', '生成本周 AI 学习 mission，并保留 evidence。', '2026-05-28 09:00:00+08', '2026-05-28 09:01:00+08'),
  ('00000000-0000-0000-0000-000000000952', 'ai_literacy_path', 'completed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","persona":"mentor"}'::jsonb, 'fake', 'deterministic-v1', 'low', '根据学习画像推荐 AI 原理卡和 30 分钟 mission。', '2026-05-28 09:08:00+08', '2026-05-28 09:09:00+08'),
  ('00000000-0000-0000-0000-000000000953', 'work_learning_balance', 'previewed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","tool":"learning_recommend"}'::jsonb, 'fake', 'deterministic-v1', 'medium', '检查工作负荷，建议把深度实验降级为微学习。', '2026-05-28 09:16:00+08', NULL),
  ('00000000-0000-0000-0000-000000000954', 'agent_workflow_lab', 'previewed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","workflow":"preview_first"}'::jsonb, 'fake', 'deterministic-v1', 'medium', '预览个性化学习任务推荐 Agent 节点链路。', '2026-05-28 09:24:00+08', NULL),
  ('00000000-0000-0000-0000-000000000955', 'knowledge_governance', 'completed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","object":"rag_documents"}'::jsonb, 'fake', 'deterministic-v1', 'medium', '扫描 RAG 资料可信等级和敏感范围。', '2026-05-28 09:32:00+08', '2026-05-28 09:33:00+08'),
  ('00000000-0000-0000-0000-000000000956', 'onboarding_planner', 'completed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","employee":"林晨"}'::jsonb, 'fake', 'deterministic-v1', 'low', '生成新人 30 天成长计划，引用入职指南。', '2026-05-28 09:40:00+08', '2026-05-28 09:41:00+08'),
  ('00000000-0000-0000-0000-000000000957', 'audit_risk_scanner', 'waiting_human_review', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","scenario":"interview_fairness"}'::jsonb, 'fake', 'deterministic-v1', 'high', '发现面试公平性场景，等待 HR 人工确认。', '2026-05-28 09:48:00+08', NULL),
  ('00000000-0000-0000-0000-000000000958', 'visual_copilot', 'previewed', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), '{"companyDataset":"fictional_sample_company","route":"/app/dashboard"}'::jsonb, 'fake', 'deterministic-v1', 'medium', '基于页面选区解释知识资料与审计事件关系。', '2026-05-28 09:56:00+08', NULL)
ON CONFLICT (id) DO UPDATE SET
  run_type = EXCLUDED.run_type,
  status = EXCLUDED.status,
  actor_user_id = COALESCE(EXCLUDED.actor_user_id, agent_runs.actor_user_id),
  delegated_context = EXCLUDED.delegated_context,
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  risk_level = EXCLUDED.risk_level,
  summary = EXCLUDED.summary,
  created_at = EXCLUDED.created_at,
  completed_at = EXCLUDED.completed_at;

INSERT INTO agent_tool_calls (id, run_id, tool_name, arguments, sanitized_arguments, status, result_summary, created_at, completed_at)
VALUES
  ('00000000-0000-0000-0000-000000000959', '00000000-0000-0000-0000-000000000953', 'learning_recommend', '{"employee":"林晨","topic":"RAG reliability"}'::jsonb, '{"employee":"林晨","topic":"RAG reliability"}'::jsonb, 'previewed', '{"recommendation":"降级为 30 分钟微学习"}'::jsonb, '2026-05-28 09:17:00+08', '2026-05-28 09:17:20+08')
ON CONFLICT (id) DO UPDATE SET
  run_id = EXCLUDED.run_id,
  tool_name = EXCLUDED.tool_name,
  arguments = EXCLUDED.arguments,
  sanitized_arguments = EXCLUDED.sanitized_arguments,
  status = EXCLUDED.status,
  result_summary = EXCLUDED.result_summary,
  created_at = EXCLUDED.created_at,
  completed_at = EXCLUDED.completed_at;

INSERT INTO agent_action_plans (id, run_id, title, risk_level, status, plan, requires_confirmation, rollback_plan, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000960', '00000000-0000-0000-0000-000000000957', '面试公平性场景人工复核', 'high', 'draft', '[{"step":"review","description":"HR 和业务面试官复核 AI 建议边界"}]'::jsonb, true, '[{"step":"block","description":"不自动执行录用或淘汰结论"}]'::jsonb, '2026-05-28 09:49:00+08')
ON CONFLICT (id) DO UPDATE SET
  run_id = EXCLUDED.run_id,
  title = EXCLUDED.title,
  risk_level = EXCLUDED.risk_level,
  status = EXCLUDED.status,
  plan = EXCLUDED.plan,
  requires_confirmation = EXCLUDED.requires_confirmation,
  rollback_plan = EXCLUDED.rollback_plan,
  created_at = EXCLUDED.created_at;

INSERT INTO audit_events (id, actor_user_id, event_type, object_type, object_id, scope_type, scope_id, request_id, source, risk_level, old_value_summary, new_value_summary, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000961', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'ai.command.recommendation.preview', 'ai_recommendation', 'cmd-onboarding-30d', 'global', NULL, 'sample-req-001', 'web', 'medium', '{}'::jsonb, '{"confidence":86,"citations":["00000000-0000-0000-0000-000000000912"],"humanReviewRequired":false,"auditStatus":"previewed"}'::jsonb, '2026-05-28 10:00:00+08'),
  ('00000000-0000-0000-0000-000000000962', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'agent.tool.preview', 'agent_tool_call', '00000000-0000-0000-0000-000000000959', 'global', NULL, 'sample-req-002', 'agent', 'medium', '{}'::jsonb, '{"toolName":"learning_recommend","accepted":true,"reversible":true}'::jsonb, '2026-05-28 10:06:00+08'),
  ('00000000-0000-0000-0000-000000000963', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'human.review.requested', 'learning_mission', 'mission-interview-bias', 'global', NULL, 'sample-req-003', 'web', 'high', '{}'::jsonb, '{"reason":"fairness boundary","humanReviewRequired":true,"blocked":true}'::jsonb, '2026-05-28 10:12:00+08'),
  ('00000000-0000-0000-0000-000000000964', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'rag.citation.used', 'rag_document', '00000000-0000-0000-0000-000000000912', 'global', NULL, 'sample-req-004', 'rag', 'low', '{}'::jsonb, '{"title":"云衡互联网科技新员工入职指南","trustLevel":"official","sensitivity":"normal"}'::jsonb, '2026-05-28 10:18:00+08'),
  ('00000000-0000-0000-0000-000000000965', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'co_growth.evidence.recorded', 'co_growth_evidence', 'ev-current-001', 'global', NULL, 'sample-req-005', 'web', 'low', '{}'::jsonb, '{"reflection":true,"promptVersion":"v3","confidence":89}'::jsonb, '2026-05-28 10:24:00+08'),
  ('00000000-0000-0000-0000-000000000966', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'high_risk.action.blocked', 'agent_run', '00000000-0000-0000-0000-000000000957', 'global', NULL, 'sample-req-006', 'agent', 'high', '{}'::jsonb, '{"action":"people_decision","allowed":false,"humanReviewRequired":true}'::jsonb, '2026-05-28 10:30:00+08'),
  ('00000000-0000-0000-0000-000000000967', (SELECT id FROM ai_hrms_seed_actor LIMIT 1), 'human.review.approved_preview', 'agent_run', '00000000-0000-0000-0000-000000000954', 'global', NULL, 'sample-req-007', 'web', 'medium', '{}'::jsonb, '{"reviewer":"mentor","auditStatus":"approved_preview","reversible":true}'::jsonb, '2026-05-28 10:36:00+08')
ON CONFLICT (id) DO UPDATE SET
  actor_user_id = COALESCE(EXCLUDED.actor_user_id, audit_events.actor_user_id),
  event_type = EXCLUDED.event_type,
  object_type = EXCLUDED.object_type,
  object_id = EXCLUDED.object_id,
  scope_type = EXCLUDED.scope_type,
  scope_id = EXCLUDED.scope_id,
  request_id = EXCLUDED.request_id,
  source = EXCLUDED.source,
  risk_level = EXCLUDED.risk_level,
  old_value_summary = EXCLUDED.old_value_summary,
  new_value_summary = EXCLUDED.new_value_summary,
  created_at = EXCLUDED.created_at;
