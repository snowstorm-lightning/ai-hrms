-- Keep the persisted demo seed aligned with the product boundary language.
-- AI-HRMS is the product; this fictional company is only sample data.

UPDATE legal_entities
SET name = '企鹅互联网科技有限公司',
    legal_name = '企鹅互联网科技有限公司',
    updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000101'
  AND name = '企鹅科技集团';

UPDATE employees
SET home_company = '企鹅互联网科技有限公司',
    updated_at = now()
WHERE home_company = '企鹅科技集团';

UPDATE messages
SET title = replace(title, '企鹅科技', '企鹅互联网科技'),
    content = replace(replace(content, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技'),
    updated_at = now()
WHERE title LIKE '%企鹅科技%' OR content LIKE '%企鹅科技%';

UPDATE rag_sources
SET name = replace(name, '企鹅科技', '企鹅互联网科技'),
    updated_at = now()
WHERE name LIKE '%企鹅科技%';

UPDATE rag_documents
SET title = replace(title, '企鹅科技', '企鹅互联网科技'),
    content = replace(replace(content, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技'),
    content_hash = encode(digest(replace(replace(content, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技'), 'sha256'), 'hex'),
    updated_at = now()
WHERE title LIKE '%企鹅科技%' OR content LIKE '%企鹅科技%';

UPDATE rag_chunks
SET title = replace(title, '企鹅科技', '企鹅互联网科技'),
    content = replace(replace(content, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技'),
    content_hash = encode(digest(replace(replace(content, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技'), 'sha256'), 'hex')
WHERE title LIKE '%企鹅科技%' OR content LIKE '%企鹅科技%';

UPDATE learning_courses
SET title = replace(title, '企鹅科技', '企鹅互联网科技'),
    description = replace(replace(description, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技'),
    updated_at = now()
WHERE title LIKE '%企鹅科技%' OR description LIKE '%企鹅科技%';

UPDATE learning_lessons
SET title = replace(title, '企鹅科技', '企鹅互联网科技'),
    content = replace(replace(content, '企鹅科技集团', '企鹅互联网科技有限公司'), '企鹅科技', '企鹅互联网科技')
WHERE title LIKE '%企鹅科技%' OR content LIKE '%企鹅科技%';
