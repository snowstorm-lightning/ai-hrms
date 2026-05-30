package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
	"github.com/jackc/pgx/v5"
)

func (s *Store) ListRAGSources(ctx context.Context) ([]domain.RAGSource, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, source_type, name, uri, status, created_by_user_id::text, created_at
		FROM rag_sources
		ORDER BY created_at DESC, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.RAGSource
	for rows.Next() {
		var item domain.RAGSource
		if err := rows.Scan(&item.ID, &item.SourceType, &item.Name, &item.URI, &item.Status, &item.CreatedByUserID, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) CreateRAGSource(ctx context.Context, item domain.RAGSource, userID string) (*domain.RAGSource, error) {
	if item.SourceType == "" {
		item.SourceType = "upload"
	}
	if item.Status == "" {
		item.Status = "active"
	}
	var saved domain.RAGSource
	err := s.pool.QueryRow(ctx, `
		INSERT INTO rag_sources (source_type, name, uri, status, created_by_user_id)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id::text, source_type, name, uri, status, created_by_user_id::text, created_at
	`, item.SourceType, item.Name, item.URI, item.Status, userID).Scan(
		&saved.ID, &saved.SourceType, &saved.Name, &saved.URI, &saved.Status, &saved.CreatedByUserID, &saved.CreatedAt)
	return &saved, err
}

func (s *Store) GetRAGSource(ctx context.Context, id string) (*domain.RAGSource, error) {
	var item domain.RAGSource
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, source_type, name, uri, status, created_by_user_id::text, created_at
		FROM rag_sources
		WHERE id = $1
	`, id).Scan(&item.ID, &item.SourceType, &item.Name, &item.URI, &item.Status, &item.CreatedByUserID, &item.CreatedAt)
	return &item, notFound(err)
}

func (s *Store) ListRAGDocuments(ctx context.Context, scope Scope, principal rbac.Principal, page, size int) ([]domain.RAGDocument, int64, error) {
	where, args := ragVisibleWhere(scope, principal, 1)
	countSQL := `SELECT count(DISTINCT d.id) FROM rag_documents d WHERE ` + where
	var total int64
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	query := `
		SELECT DISTINCT d.id::text, d.source_id::text, d.title, d.version, d.status,
			d.trust_level, d.sensitivity, d.effective_from, d.effective_to,
			d.published_at, d.created_by_user_id::text, d.created_at
		FROM rag_documents d
		WHERE ` + where + `
		ORDER BY d.created_at DESC
		LIMIT $` + itoa(len(queryArgs)-1) + ` OFFSET $` + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var docs []domain.RAGDocument
	for rows.Next() {
		var doc domain.RAGDocument
		if err := rows.Scan(&doc.ID, &doc.SourceID, &doc.Title, &doc.Version, &doc.Status,
			&doc.TrustLevel, &doc.Sensitivity, &doc.EffectiveFrom, &doc.EffectiveTo,
			&doc.PublishedAt, &doc.CreatedByUserID, &doc.CreatedAt); err != nil {
			return nil, 0, err
		}
		docs = append(docs, doc)
	}
	return docs, total, rows.Err()
}

func (s *Store) CreateRAGDocument(ctx context.Context, doc domain.RAGDocument, userID string) (*domain.RAGDocument, error) {
	return s.CreateRAGDocumentWithEmbeddings(ctx, doc, userID, nil)
}

func (s *Store) CreateRAGDocumentWithEmbeddings(ctx context.Context, doc domain.RAGDocument, userID string, embeddings []domain.RAGEmbeddingInput) (*domain.RAGDocument, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if doc.Version == "" {
		doc.Version = "v1"
	}
	if doc.Status == "" {
		doc.Status = "draft"
	}
	if doc.TrustLevel == "" {
		doc.TrustLevel = "internal"
	}
	if doc.Sensitivity == "" {
		doc.Sensitivity = "normal"
	}
	var publishedAt any
	if doc.Status == "published" {
		publishedAt = time.Now()
	}
	contentHash := hashText(doc.Title + "\n" + doc.Content)
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO rag_documents (
			source_id, title, version, status, trust_level, sensitivity, content,
			content_hash, effective_from, effective_to, published_at, created_by_user_id
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id::text
	`, doc.SourceID, doc.Title, doc.Version, doc.Status, doc.TrustLevel, doc.Sensitivity,
		doc.Content, contentHash, doc.EffectiveFrom, doc.EffectiveTo, publishedAt, userID).Scan(&id)
	if err != nil {
		return nil, err
	}
	if len(doc.Scopes) == 0 {
		doc.Scopes = []domain.RAGDocumentScope{{ScopeType: "global", IncludeDescendants: true}}
	}
	for _, scope := range doc.Scopes {
		if scope.ScopeType == "" {
			scope.ScopeType = "global"
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO rag_document_scopes (document_id, scope_type, scope_id, role_code, employee_id, include_descendants)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, id, scope.ScopeType, scope.ScopeID, scope.RoleCode, scope.EmployeeID, scope.IncludeDescendants)
		if err != nil {
			return nil, err
		}
	}
	if _, err := insertRAGChunkRecords(ctx, tx, id, doc.Content, doc.Title, doc.Sensitivity, embeddings); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetRAGDocument(ctx, Scope{Global: true}, rbac.Principal{}, id)
}

func (s *Store) RebuildRAGDocumentChunksWithEmbeddings(ctx context.Context, doc domain.RAGDocument, embeddings []domain.RAGEmbeddingInput) (int, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var lockedID string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM rag_documents WHERE id = $1 FOR UPDATE`, doc.ID).Scan(&lockedID); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM rag_chunks WHERE document_id = $1`, doc.ID); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE rag_documents
		SET content_hash = $2, updated_at = now()
		WHERE id = $1
	`, doc.ID, hashText(doc.Title+"\n"+doc.Content)); err != nil {
		return 0, err
	}
	count, err := insertRAGChunkRecords(ctx, tx, doc.ID, doc.Content, doc.Title, doc.Sensitivity, embeddings)
	if err != nil {
		return 0, err
	}
	return count, tx.Commit(ctx)
}

func (s *Store) GetRAGDocument(ctx context.Context, scope Scope, principal rbac.Principal, id string) (*domain.RAGDocument, error) {
	where, args := ragVisibleWhere(scope, principal, 2)
	query := `
		SELECT DISTINCT d.id::text, d.source_id::text, d.title, d.version, d.status,
			d.trust_level, d.sensitivity, d.content, d.effective_from, d.effective_to,
			d.published_at, d.created_by_user_id::text, d.created_at
		FROM rag_documents d
		WHERE d.id = $1 AND ` + where
	queryArgs := append([]any{id}, args...)
	var doc domain.RAGDocument
	err := s.pool.QueryRow(ctx, query, queryArgs...).Scan(&doc.ID, &doc.SourceID, &doc.Title, &doc.Version,
		&doc.Status, &doc.TrustLevel, &doc.Sensitivity, &doc.Content, &doc.EffectiveFrom, &doc.EffectiveTo,
		&doc.PublishedAt, &doc.CreatedByUserID, &doc.CreatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	doc.Scopes, err = s.documentScopes(ctx, id)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func (s *Store) documentScopes(ctx context.Context, documentID string) ([]domain.RAGDocumentScope, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, document_id::text, scope_type, scope_id::text, role_code, employee_id::text, include_descendants
		FROM rag_document_scopes
		WHERE document_id = $1
		ORDER BY scope_type
	`, documentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var scopes []domain.RAGDocumentScope
	for rows.Next() {
		var scope domain.RAGDocumentScope
		if err := rows.Scan(&scope.ID, &scope.DocumentID, &scope.ScopeType, &scope.ScopeID, &scope.RoleCode, &scope.EmployeeID, &scope.IncludeDescendants); err != nil {
			return nil, err
		}
		scopes = append(scopes, scope)
	}
	return scopes, rows.Err()
}

func (s *Store) CreateRAGIngestJob(ctx context.Context, job domain.RAGIngestJob, userID string) (*domain.RAGIngestJob, error) {
	if job.JobType == "" {
		job.JobType = "ingest"
	}
	if job.Provider == "" {
		job.Provider = "fake"
	}
	summary := fmt.Sprintf("%s provider completed RAG ingestion.", job.Provider)
	if strings.TrimSpace(job.Summary) != "" {
		summary = strings.TrimSpace(job.Summary)
	}
	var saved domain.RAGIngestJob
	err := s.pool.QueryRow(ctx, `
		INSERT INTO rag_ingest_jobs (source_id, document_id, job_type, status, provider, summary, created_by_user_id, completed_at)
		VALUES ($1,$2,$3,'completed',$4,$5,$6,now())
		RETURNING id::text, source_id::text, document_id::text, job_type, status, provider, summary, error, created_by_user_id::text, created_at, completed_at
	`, job.SourceID, job.DocumentID, job.JobType, job.Provider, summary, userID).Scan(
		&saved.ID, &saved.SourceID, &saved.DocumentID, &saved.JobType, &saved.Status, &saved.Provider,
		&saved.Summary, &saved.Error, &saved.CreatedByUserID, &saved.CreatedAt, &saved.CompletedAt)
	return &saved, err
}

func (s *Store) GetRAGIngestJob(ctx context.Context, id string) (*domain.RAGIngestJob, error) {
	var job domain.RAGIngestJob
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, source_id::text, document_id::text, job_type, status, provider, summary, error, created_by_user_id::text, created_at, completed_at
		FROM rag_ingest_jobs
		WHERE id = $1
	`, id).Scan(&job.ID, &job.SourceID, &job.DocumentID, &job.JobType, &job.Status, &job.Provider, &job.Summary, &job.Error, &job.CreatedByUserID, &job.CreatedAt, &job.CompletedAt)
	return &job, notFound(err)
}

func (s *Store) SearchRAG(ctx context.Context, scope Scope, principal rbac.Principal, req domain.RAGSearchRequest) (*domain.RAGSearchResult, error) {
	limit := req.Limit
	if limit < 1 || limit > 10 {
		limit = 5
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return &domain.RAGSearchResult{RefusalReason: "empty_query"}, nil
	}
	candidates, err := s.searchRAGLexicalCandidates(ctx, scope, principal, req, limit)
	if err != nil {
		return nil, err
	}
	return s.ragSearchResultFromCitations(ctx, principal.UserID, query, scope, citationsFromCandidates(candidates), "lexical-fallback", "websearch+ILIKE", 0.72)
}

func (s *Store) SearchRAGVector(ctx context.Context, scope Scope, principal rbac.Principal, req domain.RAGSearchRequest, queryVector []float64, provider, model string, dimensions int) (*domain.RAGSearchResult, error) {
	limit := req.Limit
	if limit < 1 || limit > 10 {
		limit = 5
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return &domain.RAGSearchResult{RefusalReason: "empty_query"}, nil
	}
	if len(queryVector) == 0 || dimensions <= 0 {
		return s.SearchRAG(ctx, scope, principal, req)
	}
	if provider == "" {
		provider = "fake"
	}
	if model == "" {
		model = "deterministic-v1"
	}
	candidates, err := s.searchRAGVectorCandidates(ctx, scope, principal, req, queryVector, provider, model, dimensions, limit)
	if err != nil {
		return nil, err
	}
	confidence := 0.72
	if len(candidates) > 0 {
		confidence = candidates[0].Citation.Score
	}
	return s.ragSearchResultFromCitations(ctx, principal.UserID, query, scope, citationsFromCandidates(candidates), provider, model, confidence)
}

func (s *Store) SearchRAGHybrid(ctx context.Context, scope Scope, principal rbac.Principal, req domain.RAGSearchRequest, queryVector []float64, provider, model string, dimensions int) (*domain.RAGSearchResult, error) {
	limit := req.Limit
	if limit < 1 || limit > 10 {
		limit = 5
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return &domain.RAGSearchResult{RefusalReason: "empty_query"}, nil
	}
	if len(queryVector) == 0 || dimensions <= 0 {
		return s.SearchRAG(ctx, scope, principal, req)
	}
	if provider == "" {
		provider = "fake"
	}
	if model == "" {
		model = "deterministic-v1"
	}
	candidateLimit := limit * 4
	if candidateLimit < 20 {
		candidateLimit = 20
	}
	vectorCandidates, err := s.searchRAGVectorCandidates(ctx, scope, principal, req, queryVector, provider, model, dimensions, candidateLimit)
	if err != nil {
		return nil, err
	}
	lexicalCandidates, err := s.searchRAGLexicalCandidates(ctx, scope, principal, req, candidateLimit)
	if err != nil {
		return nil, err
	}
	if len(vectorCandidates) == 0 {
		return s.ragSearchResultFromCitations(ctx, principal.UserID, query, scope, citationsFromCandidates(lexicalCandidates), "lexical-fallback", "websearch+ILIKE;vector_hit_count=0", 0.72)
	}
	fused := fuseRAGCandidates(vectorCandidates, lexicalCandidates, limit)
	if len(fused) == 0 {
		_ = s.recordRAGRetrieval(ctx, principal.UserID, query, scope, nil, nil, "no_citation")
		return &domain.RAGSearchResult{RefusalReason: "no_citation", Provider: "hybrid-rrf", Model: provider + ":" + model + "+lexical"}, nil
	}
	confidence := fused[0].Score
	if confidence <= 0 {
		confidence = 0.72
	}
	return s.ragSearchResultFromCitations(ctx, principal.UserID, query, scope, fused, "hybrid-rrf", provider+":"+model+"+websearch+ILIKE", confidence)
}

type ragCandidate struct {
	Citation domain.RAGCitation
}

func (s *Store) searchRAGLexicalCandidates(ctx context.Context, scope Scope, principal rbac.Principal, req domain.RAGSearchRequest, limit int) ([]ragCandidate, error) {
	if limit < 1 {
		limit = 5
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return nil, nil
	}
	where, args := ragVisibleWhere(scope, principal, 3)
	searchPatterns := ragSearchPatterns(query)
	sql := `
		SELECT c.id::text, d.id::text, d.title, COALESCE(NULLIF(c.body_content, ''), c.content), d.trust_level, d.sensitivity,
			GREATEST(
				ts_rank_cd(to_tsvector('simple', d.title || ' ' || c.content), websearch_to_tsquery('simple', $2)),
				CASE
					WHEN d.title ILIKE ANY($1::text[]) THEN 0.88
					WHEN c.content ILIKE ANY($1::text[]) THEN 0.72
					ELSE 0.55
				END
			) AS lexical_score
		FROM rag_chunks c
		JOIN rag_documents d ON d.id = c.document_id
		WHERE d.status = 'published'
		  AND (d.effective_from IS NULL OR d.effective_from <= now())
		  AND (d.effective_to IS NULL OR d.effective_to >= now())
		  AND c.sensitivity IN ('normal', 'internal')
		  AND d.sensitivity IN ('normal', 'internal')
		  AND (
			c.content ILIKE ANY($1::text[])
			OR d.title ILIKE ANY($1::text[])
			OR to_tsvector('simple', d.title || ' ' || c.content) @@ websearch_to_tsquery('simple', $2)
		  )
		  AND ` + where + `
		ORDER BY lexical_score DESC, d.trust_level DESC, c.chunk_index
		LIMIT $` + itoa(len(args)+3)
	queryArgs := append([]any{searchPatterns, query}, args...)
	queryArgs = append(queryArgs, limit)
	rows, err := s.pool.Query(ctx, sql, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []ragCandidate
	for rows.Next() {
		var citation domain.RAGCitation
		if err := rows.Scan(&citation.ChunkID, &citation.DocumentID, &citation.Title, &citation.Snippet, &citation.TrustLevel, &citation.Sensitivity, &citation.Score); err != nil {
			return nil, err
		}
		citation.Snippet = trimRunes(citation.Snippet, 160)
		candidates = append(candidates, ragCandidate{Citation: citation})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return candidates, nil
}

func (s *Store) searchRAGVectorCandidates(ctx context.Context, scope Scope, principal rbac.Principal, req domain.RAGSearchRequest, queryVector []float64, provider, model string, dimensions, limit int) ([]ragCandidate, error) {
	if limit < 1 {
		limit = 5
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return nil, nil
	}
	if len(queryVector) == 0 || dimensions <= 0 {
		return nil, nil
	}
	if provider == "" {
		provider = "fake"
	}
	if model == "" {
		model = "deterministic-v1"
	}
	where, args := ragVisibleWhere(scope, principal, 5)
	sql := `
		SELECT c.id::text, d.id::text, d.title, COALESCE(NULLIF(c.body_content, ''), c.content), d.trust_level, d.sensitivity,
			(e.embedding <=> $1::vector) AS distance
		FROM rag_embeddings e
		JOIN rag_chunks c ON c.id = e.chunk_id
		JOIN rag_documents d ON d.id = c.document_id
		WHERE d.status = 'published'
		  AND (d.effective_from IS NULL OR d.effective_from <= now())
		  AND (d.effective_to IS NULL OR d.effective_to >= now())
		  AND c.sensitivity IN ('normal', 'internal')
		  AND d.sensitivity IN ('normal', 'internal')
		  AND e.dimensions = $2
		  AND e.provider = $3
		  AND e.model = $4
		  AND ` + where + `
		ORDER BY distance ASC, d.trust_level DESC, c.chunk_index
		LIMIT $` + itoa(len(args)+5)
	queryArgs := []any{vectorString(queryVector), dimensions, provider, model}
	queryArgs = append(queryArgs, args...)
	queryArgs = append(queryArgs, limit)
	rows, err := s.pool.Query(ctx, sql, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []ragCandidate
	for rows.Next() {
		var citation domain.RAGCitation
		var distance float64
		if err := rows.Scan(&citation.ChunkID, &citation.DocumentID, &citation.Title, &citation.Snippet, &citation.TrustLevel, &citation.Sensitivity, &distance); err != nil {
			return nil, err
		}
		citation.Snippet = trimRunes(citation.Snippet, 160)
		citation.Score = 1 / (1 + distance)
		candidates = append(candidates, ragCandidate{Citation: citation})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return candidates, nil
}

func (s *Store) ragSearchResultFromCitations(ctx context.Context, userID, query string, scope Scope, citations []domain.RAGCitation, provider, model string, confidence float64) (*domain.RAGSearchResult, error) {
	if len(citations) == 0 {
		_ = s.recordRAGRetrieval(ctx, userID, query, scope, nil, nil, "no_citation")
		return &domain.RAGSearchResult{RefusalReason: "no_citation", Provider: provider, Model: model}, nil
	}
	chunkIDs := make([]string, 0, len(citations))
	for _, citation := range citations {
		chunkIDs = append(chunkIDs, citation.ChunkID)
	}
	if confidence <= 0 {
		confidence = 0.72
	}
	if confidence > 0.98 {
		confidence = 0.98
	}
	result := &domain.RAGSearchResult{
		Answer:              "根据已发布且当前可见的知识库资料，可参考以下来源处理该问题。",
		Citations:           citations,
		Provider:            provider,
		Model:               model,
		Confidence:          confidence,
		RiskLevel:           "medium",
		HumanReviewRequired: true,
		AuditStatus:         "retrieval_logged",
	}
	_ = s.recordRAGRetrieval(ctx, userID, query, scope, chunkIDs, citations, "")
	return result, nil
}

func citationsFromCandidates(candidates []ragCandidate) []domain.RAGCitation {
	citations := make([]domain.RAGCitation, 0, len(candidates))
	for _, candidate := range candidates {
		citations = append(citations, candidate.Citation)
	}
	return citations
}

func fuseRAGCandidates(vectorCandidates, lexicalCandidates []ragCandidate, limit int) []domain.RAGCitation {
	if limit < 1 {
		limit = 5
	}
	type fusedCandidate struct {
		citation domain.RAGCitation
		score    float64
	}
	byChunk := map[string]*fusedCandidate{}
	add := func(candidates []ragCandidate, weight float64) {
		for index, candidate := range candidates {
			key := candidate.Citation.ChunkID
			if key == "" {
				continue
			}
			item := byChunk[key]
			if item == nil {
				item = &fusedCandidate{citation: candidate.Citation}
				byChunk[key] = item
			}
			item.score += weight / float64(60+index+1)
			if candidate.Citation.Score > item.citation.Score {
				item.citation.Score = candidate.Citation.Score
			}
		}
	}
	add(vectorCandidates, 1.0)
	add(lexicalCandidates, 0.8)

	items := make([]fusedCandidate, 0, len(byChunk))
	for _, item := range byChunk {
		if item.citation.Score < 0.55 {
			item.citation.Score = 0.55 + item.score*8
		}
		if item.citation.Score > 0.98 {
			item.citation.Score = 0.98
		}
		items = append(items, *item)
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].score == items[j].score {
			return items[i].citation.Score > items[j].citation.Score
		}
		return items[i].score > items[j].score
	})
	if len(items) > limit {
		items = items[:limit]
	}
	citations := make([]domain.RAGCitation, 0, len(items))
	for _, item := range items {
		citations = append(citations, item.citation)
	}
	return citations
}

func insertRAGChunkRecords(ctx context.Context, tx pgx.Tx, documentID, content, title, sensitivity string, embeddings []domain.RAGEmbeddingInput) (int, error) {
	chunks := prepareRAGChunkRecords(content, title)
	for i, chunk := range chunks {
		var chunkID string
		err := tx.QueryRow(ctx, `
			INSERT INTO rag_chunks (
				document_id, chunk_index, title, content, body_content, location_ref, section_path,
				chunk_strategy, token_budget, overlap_runes, body_runes, context_prefix,
				content_hash, sensitivity
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
			RETURNING id::text
		`, documentID, i, chunk.Title, chunk.Content, chunk.BodyContent, chunk.LocationRef, chunk.SectionPath,
			chunk.ChunkStrategy, chunk.TokenBudget, chunk.OverlapRunes, chunk.BodyRunes, chunk.ContextPrefix,
			hashText(chunk.Content), sensitivity).Scan(&chunkID)
		if err != nil {
			return 0, err
		}
		provider := "fake"
		model := "deterministic-v1"
		dimensions := 8
		vector := fakeVector(chunk.Content)
		if i < len(embeddings) && len(embeddings[i].Vector) > 0 {
			if embeddings[i].Provider != "" {
				provider = embeddings[i].Provider
			}
			if embeddings[i].Model != "" {
				model = embeddings[i].Model
			}
			dimensions = embeddings[i].Dimensions
			if dimensions <= 0 || dimensions != len(embeddings[i].Vector) {
				dimensions = len(embeddings[i].Vector)
			}
			vector = vectorString(embeddings[i].Vector)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO rag_embeddings (chunk_id, provider, model, dimensions, embedding)
			VALUES ($1, $2, $3, $4, $5)
		`, chunkID, provider, model, dimensions, vector)
		if err != nil {
			return 0, err
		}
	}
	return len(chunks), nil
}

func ragSearchPatterns(query string) []string {
	seen := map[string]bool{}
	var patterns []string
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			return
		}
		seen[value] = true
		patterns = append(patterns, "%"+value+"%")
	}
	add(query)
	for _, token := range strings.FieldsFunc(query, func(r rune) bool {
		return r == ' ' || r == '\t' || r == '\n' || r == '\r' ||
			r == '?' || r == '？' || r == ',' || r == '，' ||
			r == '.' || r == '。' || r == ';' || r == '；' ||
			r == '、' || r == ':' || r == '：'
	}) {
		runes := []rune(token)
		if len(runes) >= 2 {
			add(token)
		}
		maxGram := 4
		if len(runes) < maxGram {
			maxGram = len(runes)
		}
		for size := 2; size <= maxGram; size++ {
			for start := 0; start+size <= len(runes); start++ {
				add(string(runes[start : start+size]))
			}
		}
	}
	return patterns
}

func (s *Store) recordRAGRetrieval(ctx context.Context, userID, query string, scope Scope, chunkIDs []string, citations []domain.RAGCitation, rejected string) error {
	scopeJSON, err := json.Marshal(scopeSummary(scope))
	if err != nil {
		return err
	}
	chunksJSON, err := json.Marshal(chunkIDs)
	if err != nil {
		return err
	}
	citationsJSON, err := json.Marshal(citations)
	if err != nil {
		return err
	}
	queryHash := sha256.Sum256([]byte(strings.TrimSpace(query)))
	_, err = s.pool.Exec(ctx, `
		INSERT INTO rag_retrieval_logs (actor_user_id, query, resolved_scope, hit_chunk_ids, citations, rejected_reason)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, nullString(userID), "sha256:"+hex.EncodeToString(queryHash[:]), scopeJSON, chunksJSON, citationsJSON, rejected)
	return err
}

func ragVisibleWhere(scope Scope, principal rbac.Principal, start int) (string, []any) {
	if scope.Global {
		return "true", nil
	}
	parts := []string{`EXISTS (
		SELECT 1 FROM rag_document_scopes ds
		WHERE ds.document_id = d.id AND ds.scope_type = 'global'
	)`}
	args := []any{}
	if cond, condArgs := whereIn("ds.scope_id::text", scope.legalIDs(), start); cond != "" {
		parts = append(parts, `EXISTS (
			SELECT 1 FROM rag_document_scopes ds
			WHERE ds.document_id = d.id AND ds.scope_type = 'legal_entity' AND `+cond+`
		)`)
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn("ds.scope_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, `EXISTS (
			SELECT 1 FROM rag_document_scopes ds
			WHERE ds.document_id = d.id AND ds.scope_type = 'org_unit' AND `+cond+`
		)`)
		args = append(args, condArgs...)
	}
	roles := principal.RoleCodes()
	if cond, condArgs := whereIn("ds.role_code", roles, start+len(args)); cond != "" {
		parts = append(parts, `EXISTS (
			SELECT 1 FROM rag_document_scopes ds
			WHERE ds.document_id = d.id AND ds.scope_type = 'role' AND `+cond+`
		)`)
		args = append(args, condArgs...)
	}
	parts = append(parts, `EXISTS (
		SELECT 1 FROM rag_document_scopes ds
		JOIN employees e ON e.id = ds.employee_id
		WHERE ds.document_id = d.id AND ds.scope_type = 'employee' AND e.user_id::text = $`+itoa(start+len(args))+`
	)`)
	args = append(args, principal.UserID)
	return "(" + strings.Join(parts, " OR ") + ")", args
}

func scopeSummary(scope Scope) map[string]any {
	return map[string]any{
		"global":        scope.Global,
		"legalEntityId": scope.legalIDs(),
		"orgUnitId":     scope.orgIDs(),
	}
}

const (
	ragChunkBodyRunes    = 760
	ragChunkOverlapRunes = 120
	ragChunkTokenBudget  = 2048
	ragChunkStrategy     = "heading_sentence_context_v2_qwen3_2048"
	ragQueryInstruction  = "Instruct: Retrieve the most relevant AI-HRMS passages about HR policy, onboarding, learning, agent runs, audit evidence, governance scope, risk control, and human review. Return passages that directly answer the query.\nQuery: "
)

type ragChunkRecord struct {
	Title         string
	Content       string
	BodyContent   string
	LocationRef   string
	SectionPath   string
	ChunkStrategy string
	TokenBudget   int
	OverlapRunes  int
	BodyRunes     int
	ContextPrefix string
}

func chunkText(content string, size int) []string {
	records := prepareRAGChunkRecordsWithOptions(content, "", size, ragChunkOverlapRunes)
	chunks := make([]string, 0, len(records))
	for _, record := range records {
		chunks = append(chunks, record.Content)
	}
	return chunks
}

func prepareRAGChunkRecords(content, fallback string) []ragChunkRecord {
	return prepareRAGChunkRecordsWithOptions(content, fallback, ragChunkBodyRunes, ragChunkOverlapRunes)
}

func prepareRAGChunkRecordsWithOptions(content, fallback string, size, overlap int) []ragChunkRecord {
	content = sanitizePromptInjection(strings.TrimSpace(content))
	if content == "" {
		fallback = strings.TrimSpace(fallback)
		if fallback == "" {
			return nil
		}
		return []ragChunkRecord{{
			Title:         fallback,
			Content:       contextualizeChunk(fallback, nil, "", fallback),
			BodyContent:   fallback,
			ChunkStrategy: ragChunkStrategy,
			TokenBudget:   ragChunkTokenBudget,
			OverlapRunes:  overlap,
			BodyRunes:     utf8.RuneCountInString(fallback),
			ContextPrefix: "document",
		}}
	}
	if size <= 0 {
		size = ragChunkBodyRunes
	}
	if overlap < 0 {
		overlap = 0
	}
	var records []ragChunkRecord
	documentTitle := strings.TrimSpace(fallback)
	headings := []string{}
	var section strings.Builder
	flushSection := func() {
		body := strings.TrimSpace(section.String())
		section.Reset()
		if body == "" {
			return
		}
		sectionPath := append([]string(nil), headings...)
		for _, bodyChunk := range chunkSectionText(body, size, overlap) {
			contextPrefix := chunkContextPrefix(documentTitle, sectionPath, bodyChunk.Overlap)
			records = append(records, ragChunkRecord{
				Title:         chunkRecordTitle(documentTitle, sectionPath),
				Content:       contextualizeChunk(documentTitle, sectionPath, bodyChunk.Overlap, bodyChunk.Content),
				BodyContent:   bodyChunk.Content,
				LocationRef:   strings.Join(cleanSectionPath(sectionPath), " > "),
				SectionPath:   strings.Join(cleanSectionPath(sectionPath), " > "),
				ChunkStrategy: ragChunkStrategy,
				TokenBudget:   ragChunkTokenBudget,
				OverlapRunes:  utf8.RuneCountInString(bodyChunk.Overlap),
				BodyRunes:     utf8.RuneCountInString(bodyChunk.Content),
				ContextPrefix: contextPrefix,
			})
		}
	}
	for _, rawLine := range strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n") {
		line := strings.TrimSpace(rawLine)
		if level, title, ok := parseMarkdownHeading(line); ok {
			flushSection()
			if documentTitle == "" && level == 1 {
				documentTitle = title
			}
			if level < 1 {
				level = 1
			}
			if level <= len(headings) {
				headings = headings[:level-1]
			}
			for len(headings) < level-1 {
				headings = append(headings, "")
			}
			headings = append(headings, title)
			continue
		}
		if line == "" {
			section.WriteByte('\n')
			continue
		}
		section.WriteString(rawLine)
		section.WriteByte('\n')
	}
	flushSection()
	if len(records) == 0 && documentTitle != "" {
		records = append(records, ragChunkRecord{
			Title:         documentTitle,
			Content:       contextualizeChunk(documentTitle, headings, "", documentTitle),
			BodyContent:   documentTitle,
			LocationRef:   strings.Join(cleanSectionPath(headings), " > "),
			SectionPath:   strings.Join(cleanSectionPath(headings), " > "),
			ChunkStrategy: ragChunkStrategy,
			TokenBudget:   ragChunkTokenBudget,
			OverlapRunes:  0,
			BodyRunes:     utf8.RuneCountInString(documentTitle),
			ContextPrefix: chunkContextPrefix(documentTitle, headings, ""),
		})
	}
	return records
}

type sectionChunk struct {
	Content string
	Overlap string
}

func chunkSectionText(content string, size, overlap int) []sectionChunk {
	var chunks []string
	var current strings.Builder
	flush := func() {
		if strings.TrimSpace(current.String()) != "" {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			current.Reset()
		}
	}
	appendSegment := func(segment string) {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			return
		}
		if utf8.RuneCountInString(segment) > size {
			flush()
			chunks = append(chunks, splitRunes(segment, size, overlap)...)
			return
		}
		nextLen := utf8.RuneCountInString(current.String()) + utf8.RuneCountInString(segment)
		if current.Len() > 0 {
			nextLen++
		}
		if nextLen > size {
			flush()
		}
		if current.Len() > 0 {
			current.WriteByte(' ')
		}
		current.WriteString(segment)
	}
	for _, paragraph := range strings.FieldsFunc(content, func(r rune) bool {
		return r == '\n' || r == '\r'
	}) {
		for _, sentence := range splitSentences(paragraph) {
			appendSegment(sentence)
		}
	}
	flush()
	records := make([]sectionChunk, 0, len(chunks))
	for i, chunk := range chunks {
		record := sectionChunk{Content: chunk}
		if i > 0 && overlap > 0 {
			record.Overlap = tailRunes(chunks[i-1], overlap)
		}
		records = append(records, record)
	}
	return records
}

func parseMarkdownHeading(line string) (int, string, bool) {
	if !strings.HasPrefix(line, "#") {
		return 0, "", false
	}
	level := 0
	for _, r := range line {
		if r != '#' {
			break
		}
		level++
	}
	if level == 0 || level > 6 || len(line) <= level {
		return 0, "", false
	}
	if line[level] != ' ' && line[level] != '\t' {
		return 0, "", false
	}
	title := strings.TrimSpace(line[level:])
	title = strings.Trim(title, "# \t")
	if title == "" {
		return 0, "", false
	}
	return level, title, true
}

func chunkRecordTitle(documentTitle string, sectionPath []string) string {
	if len(sectionPath) == 0 {
		return strings.TrimSpace(documentTitle)
	}
	section := sectionPath[len(sectionPath)-1]
	if strings.TrimSpace(documentTitle) == "" || section == documentTitle {
		return section
	}
	return documentTitle + " / " + section
}

func contextualizeChunk(documentTitle string, sectionPath []string, overlap, body string) string {
	var parts []string
	if strings.TrimSpace(documentTitle) != "" {
		parts = append(parts, "文档："+strings.TrimSpace(documentTitle))
	}
	if len(sectionPath) > 0 {
		parts = append(parts, "章节："+strings.Join(cleanSectionPath(sectionPath), " > "))
	}
	if strings.TrimSpace(overlap) != "" {
		parts = append(parts, "上文："+strings.TrimSpace(overlap))
	}
	body = strings.TrimSpace(body)
	if len(parts) == 0 {
		return body
	}
	parts = append(parts, "正文："+body)
	return strings.Join(parts, "\n")
}

func chunkContextPrefix(documentTitle string, sectionPath []string, overlap string) string {
	var parts []string
	if strings.TrimSpace(documentTitle) != "" {
		parts = append(parts, "document")
	}
	if len(cleanSectionPath(sectionPath)) > 0 {
		parts = append(parts, "section")
	}
	if strings.TrimSpace(overlap) != "" {
		parts = append(parts, "overlap")
	}
	if len(parts) == 0 {
		return "body"
	}
	return strings.Join(parts, "+")
}

func cleanSectionPath(sectionPath []string) []string {
	cleaned := make([]string, 0, len(sectionPath))
	for _, item := range sectionPath {
		item = strings.TrimSpace(item)
		if item != "" {
			cleaned = append(cleaned, item)
		}
	}
	return cleaned
}

func splitSentences(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	var sentences []string
	var current strings.Builder
	for _, r := range value {
		current.WriteRune(r)
		if isSentenceBoundary(r) {
			if sentence := strings.TrimSpace(current.String()); sentence != "" {
				sentences = append(sentences, sentence)
			}
			current.Reset()
		}
	}
	if sentence := strings.TrimSpace(current.String()); sentence != "" {
		sentences = append(sentences, sentence)
	}
	return sentences
}

func isSentenceBoundary(r rune) bool {
	return r == '。' || r == '；' || r == ';' || r == '!' || r == '！' ||
		r == '?' || r == '？'
}

func splitRunes(value string, size, overlap int) []string {
	runes := []rune(value)
	if len(runes) == 0 {
		return nil
	}
	if overlap >= size {
		overlap = 0
	}
	var chunks []string
	for start := 0; start < len(runes); {
		end := start + size
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[start:end]))
		if end == len(runes) {
			break
		}
		start = end - overlap
	}
	return chunks
}

func PrepareRAGChunks(content, fallback string) []string {
	records := prepareRAGChunkRecords(content, fallback)
	chunks := make([]string, 0, len(records))
	for _, record := range records {
		chunks = append(chunks, record.Content)
	}
	return chunks
}

func PrepareRAGQuery(query string) string {
	query = strings.TrimSpace(query)
	if query == "" {
		return ""
	}
	return ragQueryInstruction + query
}

func tailRunes(value string, max int) string {
	runes := []rune(strings.TrimSpace(value))
	if max <= 0 || len(runes) <= max {
		return string(runes)
	}
	return string(runes[len(runes)-max:])
}

func sanitizePromptInjection(content string) string {
	replacers := []string{
		"ignore previous instructions", "[removed]",
		"忽略之前的指令", "[removed]",
		"system prompt", "[removed]",
		"developer message", "[removed]",
	}
	return strings.NewReplacer(replacers...).Replace(content)
}

func hashText(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func fakeVector(content string) string {
	var buckets [8]float64
	for i, r := range content {
		buckets[i%8] += float64(r%31) / 31
	}
	parts := make([]string, 8)
	for i, value := range buckets {
		if value == 0 {
			value = float64(i+1) / 100
		}
		parts[i] = strconvFormat(value)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func vectorString(values []float64) string {
	parts := make([]string, len(values))
	for i, value := range values {
		parts[i] = strconvFormat(value)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func strconvFormat(value float64) string {
	text := fmt.Sprintf("%.4f", value)
	return strings.TrimRight(strings.TrimRight(text, "0"), ".")
}

func trimRunes(value string, max int) string {
	if utf8.RuneCountInString(value) <= max {
		return value
	}
	runes := []rune(value)
	return string(runes[:max])
}
