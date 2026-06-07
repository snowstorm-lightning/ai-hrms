package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"ai-hrms/apps/api/internal/agentbridge"
	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/httpx"
	"ai-hrms/apps/api/internal/rbac"
	"ai-hrms/apps/api/internal/store"
)

func (s *Server) listAuditEvents(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "audit.read") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListAuditEvents(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.AuditEvent]{Total: total, Rows: rows})
}

func (s *Server) listRAGSources(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	items, err := s.store.ListRAGSources(r.Context())
	if err != nil {
		s.respondErr(w, err)
		return
	}
	if !principal(r).HasCapability("rag.publish") {
		for i := range items {
			items[i].URI = redactRAGSourceURI(items[i].URI)
		}
	}
	httpx.OK(w, items)
}

func (s *Server) createRAGSource(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.publish") {
		return
	}
	var item domain.RAGSource
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateRAGSource(r.Context(), item, principal(r).UserID)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "rag.source.create",
		ObjectType:      "rag_source",
		ObjectID:        saved.ID,
		RequestID:       requestID(r),
		RiskLevel:       "low",
		NewValueSummary: map[string]any{"name": saved.Name, "sourceType": saved.SourceType},
	})
	httpx.Created(w, saved)
}

func (s *Server) listRAGDocuments(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListRAGDocuments(r.Context(), scope, principal(r), page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.RAGDocument]{Total: total, Rows: rows})
}

func (s *Server) getRAGDocument(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	doc, err := s.store.GetRAGDocument(r.Context(), scope, principal(r), r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, doc)
}

func (s *Server) createRAGDocument(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.publish") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var item domain.RAGDocument
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if err := store.NormalizeRAGDocumentForCreate(&item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "RAG scope 校验失败：发布资料必须携带显式、合法的 scope")
		return
	}
	if err := ensureRAGDocumentScopesPublishable(item.Scopes, scope, principal(r)); err != nil {
		httpx.Error(w, http.StatusForbidden, 4003, "RAG scope 超出当前用户可发布范围")
		return
	}
	embeddings, err := s.embeddingsForDocument(r.Context(), item)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "Embedding policy 阻断：内部、受限或含高影响 HR/个人信息的资料必须使用本地 embedding provider")
		return
	}
	saved, err := s.store.CreateRAGDocumentWithEmbeddings(r.Context(), item, principal(r).UserID, embeddings)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "rag.document.create",
		ObjectType:      "rag_document",
		ObjectID:        saved.ID,
		RequestID:       requestID(r),
		RiskLevel:       "high",
		NewValueSummary: map[string]any{"title": saved.Title, "status": saved.Status},
	})
	httpx.Created(w, saved)
}

func ensureRAGDocumentScopesPublishable(scopes []domain.RAGDocumentScope, resolvedScope store.Scope, actor rbac.Principal) error {
	if resolvedScope.Global {
		return nil
	}
	for _, docScope := range scopes {
		switch docScope.ScopeType {
		case "global":
			return errors.New("non-global users cannot publish global RAG documents")
		case "legal_entity":
			if docScope.ScopeID == nil || !resolvedScope.LegalEntityID[strings.TrimSpace(*docScope.ScopeID)] {
				return errors.New("legal entity scope outside publisher scope")
			}
		case "org_unit":
			if docScope.ScopeID == nil || !resolvedScope.OrgUnitID[strings.TrimSpace(*docScope.ScopeID)] {
				return errors.New("org unit scope outside publisher scope")
			}
		case "role":
			if docScope.RoleCode == nil || strings.TrimSpace(*docScope.RoleCode) == "" || docScope.ScopeID == nil {
				return errors.New("non-global role RAG scope requires role_code and scope_id")
			}
			if !actorHasScopedRole(actor, *docScope.RoleCode, *docScope.ScopeID) {
				return errors.New("role scope outside publisher role bindings")
			}
		case "employee":
			return errors.New("non-global users cannot publish employee-specific RAG documents")
		default:
			return errors.New("unsupported RAG document scope")
		}
	}
	return nil
}

func actorHasScopedRole(actor rbac.Principal, roleCode, scopeID string) bool {
	roleCode = strings.TrimSpace(roleCode)
	scopeID = strings.TrimSpace(scopeID)
	for _, binding := range actor.Bindings {
		if binding.ScopeID == nil || strings.TrimSpace(*binding.ScopeID) != scopeID {
			continue
		}
		if binding.RoleCode == roleCode && (binding.ScopeType == rbac.ScopeLegalEntity || binding.ScopeType == rbac.ScopeOrgUnit) {
			return true
		}
	}
	return false
}

func (s *Server) createRAGIngestJob(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.publish") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var item domain.RAGIngestJob
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if item.DocumentID == nil {
		doc, err := s.materializeRAGDocument(r.Context(), item)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, 4001, err.Error())
			return
		}
		if doc != nil {
			if err := store.NormalizeRAGDocumentForCreate(doc); err != nil {
				httpx.Error(w, http.StatusBadRequest, 4001, "RAG scope 校验失败：发布资料必须携带显式、合法的 scope")
				return
			}
			if err := ensureRAGDocumentScopesPublishable(doc.Scopes, scope, principal(r)); err != nil {
				httpx.Error(w, http.StatusForbidden, 4003, "RAG scope 超出当前用户可发布范围")
				return
			}
			embeddings, err := s.embeddingsForDocument(r.Context(), *doc)
			if err != nil {
				httpx.Error(w, http.StatusBadRequest, 4001, "Embedding policy 阻断：内部、受限或含高影响 HR/个人信息的资料必须使用本地 embedding provider")
				return
			}
			if len(embeddings) > 0 {
				item.Provider = embeddings[0].Provider
			}
			savedDoc, err := s.store.CreateRAGDocumentWithEmbeddings(r.Context(), *doc, principal(r).UserID, embeddings)
			if err != nil {
				s.respondErr(w, err)
				return
			}
			item.DocumentID = &savedDoc.ID
		}
	} else {
		doc, err := s.store.GetRAGDocument(r.Context(), scope, principal(r), *item.DocumentID)
		if err != nil {
			s.respondErr(w, err)
			return
		}
		if err := ensureRAGDocumentScopesPublishable(doc.Scopes, scope, principal(r)); err != nil {
			httpx.Error(w, http.StatusForbidden, 4003, "RAG scope 超出当前用户可发布范围")
			return
		}
	}
	saved, err := s.store.CreateRAGIngestJob(r.Context(), item, principal(r).UserID)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "rag.ingest.complete",
		ObjectType:      "rag_ingest_job",
		ObjectID:        saved.ID,
		RequestID:       requestID(r),
		RiskLevel:       "high",
		NewValueSummary: map[string]any{"sourceId": saved.SourceID, "documentId": saved.DocumentID},
	})
	httpx.Created(w, saved)
}

func (s *Server) rebuildRAGDocument(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.publish") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	doc, err := s.store.GetRAGDocument(r.Context(), scope, principal(r), r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	if err := ensureRAGDocumentScopesPublishable(doc.Scopes, scope, principal(r)); err != nil {
		httpx.Error(w, http.StatusForbidden, 4003, "RAG scope 超出当前用户可发布范围")
		return
	}
	embeddings, err := s.embeddingsForDocument(r.Context(), *doc)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "Embedding policy 阻断：内部、受限或含高影响 HR/个人信息的资料必须使用本地 embedding provider")
		return
	}
	expectedChunks := len(store.PrepareRAGChunks(doc.Content, doc.Title))
	if expectedChunks == 0 {
		httpx.Error(w, http.StatusBadRequest, 4001, "RAG 文档没有可重建的 chunk")
		return
	}
	if expectedChunks > 0 && len(embeddings) == 0 {
		httpx.Error(w, http.StatusBadGateway, 5001, "Embedding provider 未返回向量，已保留旧 chunk/embedding；请先修复 provider 或改用本地 embedding 后再重建")
		return
	}
	if len(embeddings) > 0 && len(embeddings) != expectedChunks {
		httpx.Error(w, http.StatusBadGateway, 5001, "Embedding provider 返回的向量数量与 chunk 数量不一致，已拒绝重建以避免混合索引")
		return
	}
	chunkCount, err := s.store.RebuildRAGDocumentChunksWithEmbeddings(r.Context(), *doc, embeddings)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	provider := embeddings[0].Provider
	model := embeddings[0].Model
	dimensions := embeddings[0].Dimensions
	summary := fmt.Sprintf("Rebuilt %d chunks with %s/%s embeddings (%d dimensions).", chunkCount, provider, model, dimensions)
	savedJob, err := s.store.CreateRAGIngestJob(r.Context(), domain.RAGIngestJob{
		SourceID:   doc.SourceID,
		DocumentID: &doc.ID,
		JobType:    "rebuild_embeddings",
		Provider:   provider,
		Summary:    summary,
	}, principal(r).UserID)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID: principal(r).UserID,
		EventType:   "rag.document.rebuild",
		ObjectType:  "rag_document",
		ObjectID:    doc.ID,
		RequestID:   requestID(r),
		RiskLevel:   "high",
		NewValueSummary: map[string]any{
			"title":          doc.Title,
			"chunkCount":     chunkCount,
			"provider":       provider,
			"model":          model,
			"dimensions":     dimensions,
			"degraded":       false,
			"chunkStrategy":  "heading_sentence_context_v2_qwen3_2048",
			"actionExecuted": true,
		},
	})
	httpx.Created(w, savedJob)
}

func (s *Server) materializeRAGDocument(ctx context.Context, job domain.RAGIngestJob) (*domain.RAGDocument, error) {
	content := strings.TrimSpace(job.Content)
	title := strings.TrimSpace(job.Title)
	var sourceID *string
	if job.SourceID != nil && *job.SourceID != "" {
		source, err := s.store.GetRAGSource(ctx, *job.SourceID)
		if err != nil {
			return nil, err
		}
		sourceID = &source.ID
		if title == "" {
			title = source.Name
		}
		if content == "" {
			switch source.SourceType {
			case "url":
				content, err = fetchRAGURL(ctx, source.URI)
			case "directory":
				content, err = readRAGLocalSource(source.URI)
			case "upload":
				return nil, errors.New("upload ingestion requires content")
			case "connector":
				return nil, errors.New("enterprise connector adapter is configured but not executable yet")
			default:
				return nil, errors.New("unsupported RAG source type")
			}
			if err != nil {
				return nil, err
			}
		}
	}
	if content == "" {
		return nil, nil
	}
	if title == "" {
		title = "Untitled knowledge document"
	}
	sensitivity := materializedRAGSensitivity(title + "\n" + content)
	scopes := job.Scopes
	status := "published"
	if len(scopes) == 0 {
		status = "draft"
	}
	return &domain.RAGDocument{
		SourceID:    sourceID,
		Title:       title,
		Version:     "v1",
		Status:      status,
		TrustLevel:  "internal",
		Sensitivity: sensitivity,
		Content:     content,
		Scopes:      scopes,
	}, nil
}

func (s *Server) getRAGIngestJob(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	job, err := s.store.GetRAGIngestJob(r.Context(), r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, job)
}

func (s *Server) searchRAG(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var req domain.RAGSearchRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if tooLong(req.Query, 800) {
		httpx.Error(w, http.StatusBadRequest, 4001, "RAG query 过长，请缩短问题并避免粘贴大段原文")
		return
	}
	result, err := s.searchRAGResult(r.Context(), scope, principal(r), req)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, result)
}

func (s *Server) aiChat(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var req domain.AIChatRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if tooLong(req.Message, 2000) {
		httpx.Error(w, http.StatusBadRequest, 4001, "AI Command prompt 过长，请缩短问题并通过知识库 ingestion 提供长文档")
		return
	}
	decision := decidePromptHarness(req.Message)
	if !requireAIChatDecisionCapability(w, r, decision.Intent) {
		return
	}
	if isProductIdentityQuestion(req.Message) {
		s.respondAIChatProductIdentity(w, r, decision, req.Message)
		return
	}
	if decision.Intent == "employee_status_lookup" {
		total, counts, err := s.store.EmployeeStatusCounts(r.Context(), scope)
		if err != nil {
			s.respondErr(w, err)
			return
		}
		item := domain.ContextItem{
			Type:       "employee_status_counts",
			Label:      "员工数量与状态统计",
			Summary:    fmt.Sprintf("当前权限范围内员工总数=%d，状态分布=%v。", total, counts),
			Source:     "postgres.sql",
			Provenance: "employees",
			Metadata:   map[string]any{"total": total, "statusCounts": counts},
		}
		contextPacket := domain.ContextPacket{
			Intent:      decision.Intent,
			Subject:     "employee_status_counts",
			Items:       []domain.ContextItem{item},
			SourceCount: map[string]int{"postgres.sql": 1},
			Staleness:   "live_database",
			Boundary:    "该结果由 SQL 直接统计，不调用 DeepSeek、embedding 或 Agent。",
		}
		trust := buildTrustPacket(decision, 0.99, nil, "program_sql_logged", nil)
		summary := promptAuditSummary(req.Message, decision)
		summary["total"] = total
		summary["statusCounts"] = counts
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID:     principal(r).UserID,
			EventType:       "ai.command.deterministic_query",
			ObjectType:      "employees",
			ObjectID:        "status_counts",
			RequestID:       requestID(r),
			RiskLevel:       "low",
			NewValueSummary: summary,
		})
		httpx.OK(w, domain.AIChatResponse{
			Message:             fmt.Sprintf("当前权限范围内共有 %d 名员工。状态分布：%s。该结果由 SQL 直接统计，没有调用大模型。", total, formatCounts(counts)),
			Confidence:          trust.Confidence,
			RiskLevel:           "low",
			HumanReviewRequired: false,
			AuditStatus:         "program_sql_logged",
			ExecutionDecision:   &decision,
			ContextPacket:       &contextPacket,
			TrustPacket:         &trust,
		})
		return
	}
	if decision.Intent == "legal_entity_lookup" {
		items, err := s.store.ListLegalEntities(r.Context(), scope)
		if err != nil {
			s.respondErr(w, err)
			return
		}
		labels := make([]string, 0, len(items))
		for _, item := range items {
			labels = append(labels, fmt.Sprintf("%s（%s，%s）", item.Name, item.Area, item.Status))
		}
		s.respondDeterministicAIChat(w, r, decision, req.Message, "legal_entities", "法人实体与公司 scope", fmt.Sprintf("当前权限范围内共有 %d 个法人实体：%s。该结果由 SQL 直接读取，没有调用 DeepSeek、embedding 或 Agent。", len(items), joinLimited(labels, 6)), map[string]any{"total": len(items), "items": labels})
		return
	}
	if decision.Intent == "org_unit_lookup" {
		items, err := s.store.ListOrgUnits(r.Context(), scope)
		if err != nil {
			s.respondErr(w, err)
			return
		}
		labels := make([]string, 0, len(items))
		typeCounts := map[string]int64{}
		for _, item := range items {
			labels = append(labels, fmt.Sprintf("%s（%s，负责人=%s）", item.Name, item.Type, item.ManagerName))
			typeCounts[item.Type]++
		}
		s.respondDeterministicAIChat(w, r, decision, req.Message, "org_units", "组织单元与 scope 图谱", fmt.Sprintf("当前权限范围内共有 %d 个组织单元。类型分布：%s。示例：%s。该结果由 SQL 直接读取，没有调用 DeepSeek、embedding 或 Agent。", len(items), formatCounts(typeCounts), joinLimited(labels, 6)), map[string]any{"total": len(items), "typeCounts": typeCounts, "items": labels})
		return
	}
	if decision.Intent == "agent_run_lookup" {
		runs, total, err := s.store.ListAgentRuns(r.Context(), principal(r).UserID, 1, 5)
		if err != nil {
			s.respondErr(w, err)
			return
		}
		labels := make([]string, 0, len(runs))
		statusCounts := map[string]int64{}
		for _, run := range runs {
			statusCounts[run.Status]++
			labels = append(labels, fmt.Sprintf("%s（status=%s，risk=%s）", run.RunType, run.Status, run.RiskLevel))
		}
		s.respondDeterministicAIChat(w, r, decision, req.Message, "agent_runs", "Agent run 状态", fmt.Sprintf("当前用户共有 %d 条 Agent run。最近记录：%s。状态分布：%s。该结果由 SQL 直接读取，没有调用 DeepSeek、embedding 或新的 Agent run。", total, joinLimited(labels, 5), formatCounts(statusCounts)), map[string]any{"total": total, "statusCounts": statusCounts, "recent": labels})
		return
	}
	if decision.ExecutionMode == executionHumanReviewRequired {
		boundaryCitations := s.highImpactBoundaryCitations(r.Context(), scope, principal(r))
		citationPacket := contextPacketFromCitations(req.Message, decision, boundaryCitations)
		contextPacket := domain.ContextPacket{
			Intent:      decision.Intent,
			Subject:     "blocked_high_impact_hr_request",
			Items:       citationPacket.Items,
			SourceCount: map[string]int{"rag_citation": len(boundaryCitations)},
			Staleness:   "not_retrieved",
			Boundary:    "高风险人事裁决请求在外部 embedding/chat 前被本地策略阻断；边界说明只使用本地已发布 RAG 资料。",
		}
		trust := buildTrustPacket(decision, 0.9, boundaryCitations, "blocked_before_external_call", nil)
		summary := promptAuditSummary(req.Message, decision)
		summary["blockedReason"] = decision.Reason
		summary["actionExecuted"] = false
		summary["citations"] = citationIDs(boundaryCitations)
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID:     principal(r).UserID,
			EventType:       "ai.chat.blocked",
			ObjectType:      "ai_chat",
			ObjectID:        requestID(r),
			RequestID:       requestID(r),
			RiskLevel:       decision.RiskLevel,
			NewValueSummary: summary,
		})
		httpx.OK(w, domain.AIChatResponse{
			Message:             "不能。AI-HRMS 可以帮你整理事实、生成检查清单、解释制度和准备人工审阅草稿，但不会自动做出录用、淘汰、调薪、降薪、绩效评级、处分或解雇等高影响人事裁决。最终判断必须由有权限的 HR、业务负责人或法务基于可审计证据确认。",
			Citations:           boundaryCitations,
			Confidence:          trust.Confidence,
			RiskLevel:           decision.RiskLevel,
			HumanReviewRequired: true,
			AuditStatus:         "blocked_before_external_call",
			ExecutionDecision:   &decision,
			ContextPacket:       &contextPacket,
			TrustPacket:         &trust,
		})
		return
	}
	if decision.ExecutionMode == executionActionPreview {
		s.respondAIChatActionPreview(w, r, decision, req.Message)
		return
	}
	result, err := s.searchRAGResult(r.Context(), scope, principal(r), domain.RAGSearchRequest{Query: req.Message, Limit: 5})
	if err != nil {
		s.respondErr(w, err)
		return
	}
	contextPacket := contextPacketFromCitations(req.Message, decision, result.Citations)
	if result.RefusalReason != "" {
		decision.RiskLevel = maxRisk(decision.RiskLevel, "medium")
		decision.HumanReviewRequired = true
		trust := buildTrustPacket(decision, result.Confidence, result.Citations, "refused_no_citation", nil)
		summary := promptAuditSummary(req.Message, decision)
		summary["refusalReason"] = result.RefusalReason
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID:     principal(r).UserID,
			EventType:       "ai.chat.refused",
			ObjectType:      "ai_chat",
			ObjectID:        requestID(r),
			RequestID:       requestID(r),
			RiskLevel:       "medium",
			NewValueSummary: summary,
		})
		httpx.OK(w, domain.AIChatResponse{
			Message:             "没有可引用的资料，因此不能直接回答该问题。",
			RiskLevel:           "medium",
			HumanReviewRequired: true,
			AuditStatus:         "refused_no_citation",
			ExecutionDecision:   &decision,
			ContextPacket:       &contextPacket,
			TrustPacket:         &trust,
		})
		return
	}
	decision.RiskLevel = maxRisk(decision.RiskLevel, result.RiskLevel)
	if result.HumanReviewRequired {
		decision.HumanReviewRequired = true
		decision.RoutedBy = append(decision.RoutedBy, "retrieval.human_review_required")
	}
	if decision.UseLLM && s.externalChatProvider(r.Context()) && !externalChatAllowed(req.Message, result.Citations) {
		decision.RoutedBy = append(decision.RoutedBy, "llm.external_safety_fallback")
		decision.UseLLM = false
	}
	llmFallback := false
	if decision.UseLLM && s.agent != nil && s.agent.Enabled() {
		chatCtx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		response, err := s.agent.Chat(chatCtx, req.Message, result.Citations)
		cancel()
		if err == nil {
			if highImpactOutputViolation(response.Message) {
				decision.RiskLevel = "high"
				decision.HumanReviewRequired = true
				decision.ExecutionMode = executionHumanReviewRequired
				decision.RoutedBy = append(decision.RoutedBy, "output.verifier.high_impact_block")
				trust := buildTrustPacket(decision, 0.92, result.Citations, "blocked_after_output_verification", nil)
				summary := promptAuditSummary(req.Message, decision)
				summary["provider"] = response.Provider
				summary["model"] = response.Model
				summary["citations"] = citationIDs(result.Citations)
				summary["blockedReason"] = "llm_output_high_impact_hr_decision"
				_ = s.store.RecordAudit(r.Context(), store.AuditInput{
					ActorUserID:     principal(r).UserID,
					EventType:       "ai.chat.output_blocked",
					ObjectType:      "ai_chat",
					ObjectID:        requestID(r),
					RequestID:       requestID(r),
					RiskLevel:       "high",
					NewValueSummary: summary,
				})
				httpx.OK(w, domain.AIChatResponse{
					Message:             "模型输出触及自动化人事裁决边界，AI-HRMS 已阻断该回答。系统只允许查看证据、整理复核问题，并提交人工确认。",
					Citations:           result.Citations,
					Provider:            response.Provider,
					Model:               response.Model,
					Confidence:          trust.Confidence,
					RiskLevel:           "high",
					HumanReviewRequired: true,
					AuditStatus:         "blocked_after_output_verification",
					ExecutionDecision:   &decision,
					ContextPacket:       &contextPacket,
					TrustPacket:         &trust,
				})
				return
			}
			trust := buildTrustPacket(decision, result.Confidence, result.Citations, "agent_preview_logged", nil)
			summary := promptAuditSummary(req.Message, decision)
			summary["provider"] = response.Provider
			summary["model"] = response.Model
			summary["citations"] = citationIDs(result.Citations)
			summary["actionExecuted"] = false
			summary["useLlm"] = decision.UseLLM
			summary["useAgent"] = decision.UseAgent
			_ = s.store.RecordAudit(r.Context(), store.AuditInput{
				ActorUserID:     principal(r).UserID,
				EventType:       "ai.chat.preview",
				ObjectType:      "ai_chat",
				ObjectID:        requestID(r),
				RequestID:       requestID(r),
				RiskLevel:       decision.RiskLevel,
				NewValueSummary: summary,
			})
			httpx.OK(w, domain.AIChatResponse{
				Message:             response.Message,
				Citations:           result.Citations,
				Provider:            response.Provider,
				Model:               response.Model,
				Confidence:          result.Confidence,
				RiskLevel:           decision.RiskLevel,
				HumanReviewRequired: decision.HumanReviewRequired,
				AuditStatus:         "agent_preview_logged",
				ExecutionDecision:   &decision,
				ContextPacket:       &contextPacket,
				TrustPacket:         &trust,
			})
			return
		}
		decision.RoutedBy = append(decision.RoutedBy, "llm.unavailable.fallback")
		decision.UseLLM = false
		llmFallback = true
	}
	trust := buildTrustPacket(decision, result.Confidence, result.Citations, "deterministic_preview_logged", nil)
	auditStatus := "deterministic_preview_logged"
	if decision.ExecutionMode == executionRetrievalOnly {
		auditStatus = "program_retrieval_logged"
		trust.AuditStatus = auditStatus
	}
	summary := promptAuditSummary(req.Message, decision)
	summary["provider"] = result.Provider
	summary["model"] = result.Model
	summary["citations"] = citationIDs(result.Citations)
	summary["actionExecuted"] = false
	summary["useLlm"] = decision.UseLLM
	summary["useAgent"] = decision.UseAgent
	if llmFallback {
		summary["fallbackMode"] = "deterministic_rag_after_llm_unavailable"
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "ai.chat.preview",
		ObjectType:      "ai_chat",
		ObjectID:        requestID(r),
		RequestID:       requestID(r),
		RiskLevel:       decision.RiskLevel,
		NewValueSummary: summary,
	})
	message := deterministicRAGAnswer(req.Message, result.Citations)
	if llmFallback {
		auditStatus = "llm_unavailable_rag_fallback_logged"
		trust.AuditStatus = auditStatus
	}
	httpx.OK(w, domain.AIChatResponse{
		Message:             message,
		Citations:           result.Citations,
		Provider:            result.Provider,
		Model:               result.Model,
		Confidence:          result.Confidence,
		RiskLevel:           decision.RiskLevel,
		HumanReviewRequired: decision.HumanReviewRequired,
		AuditStatus:         auditStatus,
		ExecutionDecision:   &decision,
		ContextPacket:       &contextPacket,
		TrustPacket:         &trust,
	})
}

func (s *Server) respondDeterministicAIChat(w http.ResponseWriter, r *http.Request, decision domain.HarnessDecision, prompt, objectType, label, message string, metadata map[string]any) {
	item := domain.ContextItem{
		Type:       objectType,
		Label:      label,
		Summary:    message,
		Source:     "postgres.sql",
		Provenance: objectType,
		Metadata:   metadata,
	}
	contextPacket := domain.ContextPacket{
		Intent:      decision.Intent,
		Subject:     objectType,
		Items:       []domain.ContextItem{item},
		SourceCount: map[string]int{"postgres.sql": 1},
		Staleness:   "live_database",
		Boundary:    "该结果由 SQL 直接读取，不调用 DeepSeek、embedding 或 Agent；适合低成本、高确定性的结构化查询。",
	}
	trust := buildTrustPacket(decision, 0.99, nil, "program_sql_logged", nil)
	summary := promptAuditSummary(prompt, decision)
	for key, value := range metadata {
		summary[key] = value
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "ai.command.deterministic_query",
		ObjectType:      objectType,
		ObjectID:        "program_sql",
		RequestID:       requestID(r),
		RiskLevel:       "low",
		NewValueSummary: summary,
	})
	httpx.OK(w, domain.AIChatResponse{
		Message:             message,
		Confidence:          trust.Confidence,
		RiskLevel:           "low",
		HumanReviewRequired: false,
		AuditStatus:         "program_sql_logged",
		ExecutionDecision:   &decision,
		ContextPacket:       &contextPacket,
		TrustPacket:         &trust,
	})
}

func isProductIdentityQuestion(message string) bool {
	normalized := strings.ToLower(strings.TrimSpace(message))
	normalized = strings.Trim(normalized, " \t\r\n?？。.!！")
	if normalized == "" {
		return false
	}
	exact := map[string]bool{
		"你是谁":             true,
		"你是什么":            true,
		"这是什么":            true,
		"这是什么系统":          true,
		"这个系统是什么":         true,
		"who are you":     true,
		"what are you":    true,
		"what is this":    true,
		"what is ai-hrms": true,
	}
	if exact[normalized] {
		return true
	}
	return containsAny(normalized, []string{"ai-hrms 是什么", "visual copilot 是什么", "介绍一下你自己", "介绍下你自己"})
}

func (s *Server) respondAIChatProductIdentity(w http.ResponseWriter, r *http.Request, decision domain.HarnessDecision, prompt string) {
	decision.Intent = "product_identity"
	decision.ExecutionMode = executionDeterministic
	decision.UseLLM = false
	decision.UseAgent = false
	decision.UseMultiAgent = false
	decision.RiskLevel = "low"
	decision.HumanReviewRequired = false
	decision.RoutedBy = append(decision.RoutedBy, "program.product_identity")
	message := "我是 AI-HRMS 里的 Visual Copilot，用来帮助你理解当前人力资源操作系统里的页面、制度资料、RAG 引用、Agent 运行和审计边界。\n\n你可以直接问我页面怎么用、某条制度依据在哪里；如果要解释某个卡片、表格行或按钮，请切换到“截图/圈选问”并圈选那块区域。"
	contextPacket := domain.ContextPacket{
		Intent:  decision.Intent,
		Subject: "AI-HRMS Visual Copilot",
		Items: []domain.ContextItem{{
			Type:       "product_identity",
			Label:      "AI-HRMS Visual Copilot",
			Summary:    "产品内 Copilot，用于页面解释、RAG 问答、Agent/审计边界说明和圈选上下文解释。",
			Source:     "program.product_profile",
			Provenance: "ai_chat.identity",
		}},
		SourceCount: map[string]int{"program.product_profile": 1},
		Staleness:   "product_runtime",
		Boundary:    "身份类问题由产品配置直接回答，不进行 RAG 检索，不调用外部模型。",
	}
	trust := buildTrustPacket(decision, 0.98, nil, "program_identity_logged", nil)
	summary := promptAuditSummary(prompt, decision)
	summary["actionExecuted"] = false
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "ai.chat.product_identity",
		ObjectType:      "ai_chat",
		ObjectID:        requestID(r),
		RequestID:       requestID(r),
		RiskLevel:       "low",
		NewValueSummary: summary,
	})
	httpx.OK(w, domain.AIChatResponse{
		Message:             message,
		Confidence:          trust.Confidence,
		RiskLevel:           "low",
		HumanReviewRequired: false,
		AuditStatus:         "program_identity_logged",
		ExecutionDecision:   &decision,
		ContextPacket:       &contextPacket,
		TrustPacket:         &trust,
	})
}

func (s *Server) respondAIChatActionPreview(w http.ResponseWriter, r *http.Request, decision domain.HarnessDecision, prompt string) {
	toolName := toolNameForActionPrompt(prompt)
	toolPreview := previewForTool(toolName, map[string]any{"promptPreview": redactPromptPreview(prompt)}, principal(r).HasCapability("agent.execute_write"))
	decision.UseLLM = false
	decision.UseAgent = false
	decision.RiskLevel = maxRisk(decision.RiskLevel, toolPreview.RiskLevel)
	decision.HumanReviewRequired = true
	decision.RoutedBy = append(decision.RoutedBy, "tool.preview.ai_chat")
	contextPacket := domain.ContextPacket{
		Intent:      decision.Intent,
		Subject:     toolName,
		Items:       []domain.ContextItem{{Type: "tool_preview", Label: toolName, Summary: toolPreview.Purpose, Source: "go.tool_registry", Provenance: "tool_catalog", RiskLevel: toolPreview.RiskLevel}},
		SourceCount: map[string]int{"tool_registry": 1},
		Staleness:   "live_registry",
		Boundary:    "动作类请求只生成工具预览，不调用 DeepSeek，不执行写操作；真实执行必须经过权限复核、参数校验、人工确认和审计。",
	}
	trust := buildTrustPacket(decision, 0.9, nil, "tool_preview_logged", &toolPreview)
	summary := promptAuditSummary(prompt, decision)
	summary["toolName"] = toolPreview.ToolName
	summary["previewOnly"] = toolPreview.PreviewOnly
	summary["requiredCapability"] = toolPreview.RequiredCapability
	summary["writes"] = toolPreview.Writes
	summary["actionExecuted"] = false
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "ai.chat.tool_preview",
		ObjectType:      "tool_preview",
		ObjectID:        toolPreview.ToolName,
		RequestID:       requestID(r),
		RiskLevel:       toolPreview.RiskLevel,
		NewValueSummary: summary,
	})
	message := fmt.Sprintf("已生成工具预览：%s。该请求没有执行任何写操作；需要人工确认、权限复核和审计记录后才能继续。", toolPreview.Purpose)
	if toolPreview.Decision == "blocked" {
		message = fmt.Sprintf("该动作已被阻断：%s。系统不会通过 AI 自动执行高风险人事动作。", toolPreview.Purpose)
	}
	httpx.OK(w, domain.AIChatResponse{
		Message:             message,
		Confidence:          trust.Confidence,
		RiskLevel:           decision.RiskLevel,
		HumanReviewRequired: true,
		AuditStatus:         "tool_preview_logged",
		ExecutionDecision:   &decision,
		ContextPacket:       &contextPacket,
		TrustPacket:         &trust,
	})
}

func requireAIChatDecisionCapability(w http.ResponseWriter, r *http.Request, intent string) bool {
	capability := aiChatIntentCapability(intent)
	if capability == "" {
		return true
	}
	return requireCapability(w, r, capability)
}

func aiChatIntentCapability(intent string) string {
	switch intent {
	case "employee_status_lookup", "legal_entity_lookup", "org_unit_lookup":
		return "employee.read"
	case "agent_run_lookup":
		return "agent.execute_read"
	default:
		return ""
	}
}

func (s *Server) aiProviderStatus(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.search") {
		return
	}
	status := map[string]any{
		"agentBoundaryConfigured": s.agent != nil && s.agent.Enabled(),
		"agentBoundaryStatus":     "not_configured",
		"chatProvider":            safeProviderStatusValue(s.cfg.AI.ChatProvider),
		"chatModel":               safeProviderStatusValue(s.cfg.AI.DeepSeekChatModel),
		"deepseekKeyConfigured":   false,
		"embeddingProvider":       safeProviderStatusValue(s.cfg.AI.EmbeddingProvider),
		"embeddingModel":          safeProviderStatusValue(s.cfg.AI.OpenAICompatibleEmbeddingModel),
		"embeddingDimensions":     s.cfg.AI.RAGEmbeddingDimensions,
		"embeddingKeyConfigured":  false,
	}
	if s.agent != nil && s.agent.Enabled() {
		if agentStatus, err := s.cachedAgentConfig(r.Context()); err == nil {
			status["agentBoundaryStatus"] = "ok"
			status["chatProvider"] = safeProviderStatusValue(agentStatus.ChatProvider)
			status["chatModel"] = safeProviderStatusValue(agentStatus.DeepSeekChatModel)
			status["deepseekKeyConfigured"] = agentStatus.DeepSeekAPIKeyConfigured
			status["embeddingProvider"] = safeProviderStatusValue(agentStatus.EmbeddingProvider)
			status["embeddingModel"] = safeProviderStatusValue(agentStatus.EmbeddingModel)
			status["embeddingDimensions"] = agentStatus.EmbeddingDimensions
			status["embeddingKeyConfigured"] = agentStatus.EmbeddingAPIKeyConfigured
		} else {
			status["agentBoundaryStatus"] = "degraded"
			status["agentBoundaryError"] = "agent_config_unavailable"
		}
	}
	httpx.OK(w, status)
}

func (s *Server) embeddingsForDocument(ctx context.Context, doc domain.RAGDocument) ([]domain.RAGEmbeddingInput, error) {
	if s.agent == nil || !s.agent.Enabled() {
		if s.embeddingProviderConfigured(ctx) {
			return nil, errors.New("embedding provider is configured but the agent boundary is unavailable")
		}
		return nil, nil
	}
	if s.externalEmbeddingProvider(ctx) {
		if err := validateExternalEmbeddingDocument(doc); err != nil {
			return nil, err
		}
	}
	chunks := store.PrepareRAGChunks(doc.Content, doc.Title)
	if len(chunks) == 0 {
		return nil, nil
	}
	response, err := s.agent.Embed(ctx, chunks)
	if err != nil {
		if s.embeddingProviderConfigured(ctx) {
			return nil, fmt.Errorf("embedding provider failed: %w", err)
		}
		return nil, nil
	}
	if len(response.Embeddings) != len(chunks) {
		return nil, fmt.Errorf("embedding response count mismatch: got %d embeddings for %d chunks", len(response.Embeddings), len(chunks))
	}
	inputs := make([]domain.RAGEmbeddingInput, 0, len(response.Embeddings))
	for i, vector := range response.Embeddings {
		content := ""
		if i < len(chunks) {
			content = chunks[i]
		}
		inputs = append(inputs, domain.RAGEmbeddingInput{
			Content:    content,
			Provider:   response.Provider,
			Model:      response.Model,
			Dimensions: response.Dimensions,
			Vector:     vector,
		})
	}
	return inputs, nil
}

func (s *Server) embeddingProviderConfigured(ctx context.Context) bool {
	if providerConfiguredForRouting(s.cfg.AI.EmbeddingProvider) {
		return true
	}
	if s.agent != nil && s.agent.Enabled() {
		if agentStatus, err := s.cachedAgentConfig(ctx); err == nil {
			return providerConfiguredForRouting(agentStatus.EmbeddingProvider)
		}
		return true
	}
	return false
}

func (s *Server) searchRAGResult(ctx context.Context, scope store.Scope, actor rbac.Principal, req domain.RAGSearchRequest) (*domain.RAGSearchResult, error) {
	if s.agent == nil || !s.agent.Enabled() {
		return s.store.SearchRAG(ctx, scope, actor, req)
	}
	if s.externalEmbeddingProvider(ctx) && unsafeExternalProviderText(req.Query) {
		return s.store.SearchRAG(ctx, scope, actor, req)
	}
	embeddingQuery := store.PrepareRAGQuery(req.Query)
	if embeddingQuery == "" {
		return s.store.SearchRAG(ctx, scope, actor, req)
	}
	response, err := s.agent.Embed(ctx, []string{embeddingQuery})
	if err != nil {
		return s.store.SearchRAG(ctx, scope, actor, req)
	}
	if len(response.Embeddings) == 0 {
		return s.store.SearchRAG(ctx, scope, actor, req)
	}
	result, err := s.store.SearchRAGHybrid(ctx, scope, actor, req, response.Embeddings[0], response.Provider, response.Model, response.Dimensions)
	if err != nil {
		return nil, err
	}
	if result.RefusalReason == "no_citation" {
		return s.store.SearchRAG(ctx, scope, actor, req)
	}
	return result, nil
}

func (s *Server) highImpactBoundaryCitations(ctx context.Context, scope store.Scope, actor rbac.Principal) []domain.RAGCitation {
	result, err := s.store.SearchRAG(ctx, scope, actor, domain.RAGSearchRequest{
		Query: "高风险人事决策边界 调薪 薪酬 绩效 人事裁决",
		Limit: 3,
	})
	if err != nil || result == nil {
		return nil
	}
	return result.Citations
}

func deterministicRAGAnswer(query string, citations []domain.RAGCitation) string {
	lower := strings.ToLower(strings.TrimSpace(query))
	if len(citations) == 0 {
		return "没有找到当前用户可见的引用资料，因此不能给出确定回答。"
	}
	switch {
	case containsAny(lower, []string{"普通问答", "圈选", "截图", "选区", "layout", "这块", "这部分"}):
		return "普通问答适合问产品功能、制度解释、资料依据和一般操作路径，只发送文字问题；截图/圈选问会额外带上选区、DOM 摘要、可见文本、相对坐标和 layout snapshot，适合解释某个卡片、表格行、按钮或页面区域。当前系统不做未脱敏原图识别，证据不足时会要求你补充信息。"
	case containsAny(lower, []string{"发布", "问不到", "问不出", "资料", "知识库", "文档库", "引用", "citation", "rag", "embedding"}):
		return "如果 RAG 资料发布后问不到，按这个顺序排查：先确认文档是 published，不是 draft；再看 scope 是否覆盖当前用户、sensitivity 是否允许进入检索、有效期是否生效；然后检查 chunk 和 embedding 是否重建完成、embedding 维度是否和配置一致；最后用文档库里的真实问题验证 citation。没有命中可引用资料时，系统应该说明未找到依据，而不是编造答案。"
	case containsAny(lower, []string{"30 天", "30天", "成长计划", "新人计划", "入职计划"}):
		return "新人 30 天计划应当是学习和协作草稿：第 1 周完成账号、制度、信息安全、协作工具和团队介绍；第 2 周理解岗位职责、业务链路、RAG、Agent 和审计基础；第 3 周完成一个低风险实践任务并记录证据；第 4 周由导师复盘成果、风险、待补知识和下月目标。它不能直接用于淘汰、降薪或绩效评级。"
	case containsAny(lower, []string{"语言", "英文", "中文", "设置", "侧边栏", "sidebar", "默认模式"}):
		return "到设置页可以切换中文/英文、调整界面密度和演示提示、设置侧边栏宽度、选择 Visual Copilot 默认模式，并决定证据面板是否默认展开。桌面端侧边栏支持拖动改宽度；语言能力通过 locale 字典和 Ant Design locale 映射扩展，后续新增语言不需要逐页硬改文案。"
	case containsAny(lower, []string{"管理员指南", "看不到", "看不了", "没有权限", "不可见", "group_admin"}):
		return "管理员指南只对 group_admin 可见。看不到时先检查当前账号角色、capability、scope、登录状态和菜单可见性；如果刚调整过角色，刷新或重新登录后再看。普通员工、导师、仅有 group_hr 或 org_manager 的账号不会看到完整管理员入口。"
	case containsAny(lower, []string{"scope", "法人", "组织", "权限范围", "数据范围"}):
		return "scope 决定你能看到哪些 RAG 文档、业务数据、角色授权和审计记录。legal_entity 是法人实体边界，适合公司主体和合同边界；org_unit 是组织树节点，适合部门、团队和下级组织。系统应 fail-closed：没有明确授权时不返回受限数据，也不用全局资料替代受限资料。"
	case containsAny(lower, []string{"人工确认", "toolpreview", "工具预览", "审计", "audit", "agent run", "agent"}):
		return "涉及写入、权限变更、员工资料修改、组织或法人调整、RAG 发布、Agent 执行或高风险建议时，系统先生成 toolPreview，说明工具、参数摘要、读写范围、风险、scope、是否可逆和所需 capability，再等待人工确认并记录审计。只读解释可以直接返回，但仍会保留引用、置信度和 auditStatus。"
	case containsAny(lower, []string{"隐私", "敏感", "个人信息", "员工数据", "脱敏", "外部模型"}):
		return "员工数据要按最小必要原则使用：只返回当前任务需要且你有权查看的字段。手机号、证件、地址、薪酬、绩效明细、医疗、纪律处分和劳动争议属于高敏信息；外发给模型或写入日志前应脱敏或摘要化。"
	}
	return "可以。当前可见资料的核心结论是：" + citationSynthesis(citations, 3)
}

func citationSynthesis(citations []domain.RAGCitation, limit int) string {
	if limit <= 0 || limit > len(citations) {
		limit = len(citations)
	}
	parts := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, citation := range citations {
		if len(parts) >= limit {
			break
		}
		title := strings.TrimSpace(citation.Title)
		if title == "" || seen[title] {
			continue
		}
		seen[title] = true
		snippet := shortCitationSnippet(citation.Snippet, 96)
		if snippet == "" {
			parts = append(parts, "《"+title+"》提供了可引用依据")
			continue
		}
		parts = append(parts, "《"+title+"》说明："+snippet)
	}
	if len(parts) == 0 {
		return "已有可见引用资料，但片段为空，请打开引用详情查看原文。"
	}
	return strings.Join(parts, "；")
}

func shortCitationSnippet(value string, limit int) string {
	text := strings.Join(strings.Fields(value), " ")
	if text == "" {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	if limit < 4 {
		limit = 4
	}
	return string(runes[:limit-3]) + "..."
}

func (s *Server) externalEmbeddingProvider(ctx context.Context) bool {
	if providerConfiguredForRouting(s.cfg.AI.EmbeddingProvider) {
		return !localEmbeddingProvider(s.cfg.AI.EmbeddingProvider, s.cfg.AI.OpenAICompatibleEmbeddingBaseURL)
	}
	if s.agent != nil && s.agent.Enabled() {
		if agentStatus, err := s.cachedAgentConfig(ctx); err == nil {
			return providerConfiguredForRouting(agentStatus.EmbeddingProvider) && !localEmbeddingProvider(agentStatus.EmbeddingProvider, s.cfg.AI.OpenAICompatibleEmbeddingBaseURL)
		}
		return true
	}
	return false
}

func (s *Server) externalChatProvider(ctx context.Context) bool {
	if providerConfiguredForRouting(s.cfg.AI.ChatProvider) {
		return true
	}
	if s.agent != nil && s.agent.Enabled() {
		if agentStatus, err := s.cachedAgentConfig(ctx); err == nil {
			return providerConfiguredForRouting(agentStatus.ChatProvider)
		}
		return true
	}
	return false
}

func (s *Server) cachedAgentConfig(ctx context.Context) (*agentbridge.ProviderConfig, error) {
	if s.agent == nil || !s.agent.Enabled() {
		return nil, errors.New("agent boundary is not configured")
	}
	now := time.Now()
	s.agentConfigMu.Lock()
	defer s.agentConfigMu.Unlock()
	if s.agentConfig != nil && now.Sub(s.agentConfigFetched) < 30*time.Second {
		return s.agentConfig, nil
	}
	configCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	status, err := s.agent.Config(configCtx)
	if err != nil {
		return nil, err
	}
	s.agentConfig = status
	s.agentConfigFetched = now
	return status, nil
}

func providerConfiguredForRouting(provider string) bool {
	value := strings.ToLower(strings.TrimSpace(provider))
	return value != "" && value != "fake"
}

func localEmbeddingProvider(provider, baseURL string) bool {
	value := strings.ToLower(strings.TrimSpace(provider))
	value = strings.ReplaceAll(value, "_", "-")
	if value == "local-openai-compatible" || value == "local-cpu" {
		return true
	}
	if value == "openai-compatible" {
		return localProviderURL(baseURL)
	}
	return false
}

func localProviderURL(rawURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate())
}

func safeProviderStatusValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if keyLikePattern.MatchString(value) {
		return "[redacted-key-like-value]"
	}
	return value
}

func materializedRAGSensitivity(value string) string {
	if unsafeExternalProviderText(value) {
		return "restricted"
	}
	return "internal"
}

func externalChatAllowed(message string, citations []domain.RAGCitation) bool {
	if unsafeExternalProviderText(message) {
		return false
	}
	for _, citation := range citations {
		if !citationSafeForExternalProvider(citation) {
			return false
		}
	}
	return true
}

func citationSafeForExternalProvider(citation domain.RAGCitation) bool {
	trustLevel := strings.ToLower(strings.TrimSpace(citation.TrustLevel))
	if trustLevel == "" {
		trustLevel = "internal"
	}
	if !externalTrustLevelAllowed(trustLevel) {
		return false
	}
	sensitivity := strings.ToLower(strings.TrimSpace(citation.Sensitivity))
	if sensitivity == "" {
		sensitivity = "internal"
	}
	if sensitivity != "normal" && sensitivity != "public" {
		return false
	}
	return !unsafeExternalProviderText(citation.Title + "\n" + citation.Snippet)
}

func validateExternalEmbeddingDocument(doc domain.RAGDocument) error {
	trustLevel := strings.ToLower(strings.TrimSpace(doc.TrustLevel))
	if trustLevel == "" {
		trustLevel = "internal"
	}
	if !externalTrustLevelAllowed(trustLevel) {
		return errors.New("external embedding is disabled for internal or restricted knowledge; redact it or use a local/fake embedding provider")
	}
	sensitivity := strings.ToLower(strings.TrimSpace(doc.Sensitivity))
	if sensitivity == "" {
		sensitivity = "internal"
	}
	if sensitivity != "normal" && sensitivity != "public" {
		return errors.New("external embedding is disabled for internal or restricted knowledge; redact it or use a local/fake embedding provider")
	}
	if unsafeExternalProviderText(doc.Title + "\n" + doc.Content) {
		return errors.New("external embedding is disabled for content that appears to contain personal or high-impact HR data")
	}
	return nil
}

func externalTrustLevelAllowed(trustLevel string) bool {
	switch strings.ToLower(strings.TrimSpace(trustLevel)) {
	case "official", "public", "reviewed", "approved", "trusted":
		return true
	default:
		return false
	}
}

func unsafeExternalProviderText(value string) bool {
	if emailLikePattern.MatchString(value) || mobileLikePattern.MatchString(value) || idLikePattern.MatchString(value) {
		return true
	}
	if longNumberPattern.MatchString(value) {
		return true
	}
	if employeeNoPattern.MatchString(value) || demoPersonPattern.MatchString(value) || workforcePromptPattern.MatchString(value) {
		return true
	}
	risk, _ := classifyAIRisk(value)
	return risk == "high"
}

func classifyAIRisk(message string) (string, string) {
	lower := strings.ToLower(message)
	policyExplain := containsAny(lower, []string{"制度", "政策", "流程", "规范", "说明", "引用", "解释", "查询", "查看", "怎么", "如何", "policy", "guideline", "process", "explain", "citation"})
	individualDecision := containsAny(lower, []string{"名单", "这个员工", "该员工", "某员工", "这个候选人", "该候选人", "候选人是否", "判断是否", "决定是否", "给出结论", "给出裁决", "排名", "rank employees", "which employee", "this candidate"})
	highRiskPatterns := []string{
		"录用", "拒绝候选人", "辞退", "解雇", "淘汰", "降薪", "调薪", "晋升", "绩效评级",
		"裁员", "末位淘汰", "pip", "绩效排名", "排名员工", "奖金", "年终奖", "调岗", "离职",
		"纪律处分", "停职", "受保护特征", "年龄歧视", "性别", "婚育", "病史",
		"hire", "reject candidate", "fire", "terminate", "layoff", "salary", "compensation", "promotion", "performance rating",
		"rank employees", "bonus", "disciplinary", "protected characteristic", "pip",
	}
	for _, pattern := range highRiskPatterns {
		if strings.Contains(lower, strings.ToLower(pattern)) {
			if policyExplain && !individualDecision {
				return "medium", ""
			}
			return "high", "high_impact_hr_decision"
		}
	}
	mediumRiskPatterns := []string{"面试", "绩效", "候选人", "薪酬", "公平", "敏感", "隐私", "调动", "员工关系", "interview", "candidate", "pay", "privacy", "fairness"}
	for _, pattern := range mediumRiskPatterns {
		if strings.Contains(lower, strings.ToLower(pattern)) {
			return "medium", ""
		}
	}
	return "low", ""
}

func highImpactOutputViolation(message string) bool {
	lower := strings.ToLower(message)
	patterns := []string{
		"建议录用", "可以录用", "应当录用", "建议拒绝", "拒绝候选人",
		"建议辞退", "可以辞退", "建议解雇", "建议淘汰", "建议降薪", "建议调薪",
		"建议晋升", "绩效评级为", "hire this candidate", "reject this candidate",
		"should be fired", "should terminate", "recommend promotion", "salary should",
	}
	for _, pattern := range patterns {
		if strings.Contains(lower, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

func citationIDs(citations []domain.RAGCitation) []string {
	ids := make([]string, 0, len(citations))
	for _, citation := range citations {
		ids = append(ids, citation.DocumentID+":"+citation.ChunkID)
	}
	return ids
}

func visualRAGQuery(requested, route string, packet domain.ContextPacket) string {
	if visualPacketHasAdminGuide(packet) {
		return "管理员指南 group_admin"
	}
	parts := []string{routeSummary(route), "用户问题：" + requested}
	if labels := visualExternalQueryLabels(packet, 6); len(labels) > 0 {
		parts = append(parts, "选区对象："+strings.Join(labels, "、"))
	}
	var focus []string
	for _, item := range packet.Items {
		switch item.Type {
		case "rag_document":
			focus = append(focus, "知识资料治理、引用可信度、RAG scope")
		case "agent_run":
			focus = append(focus, "Agent run、工具预览、人工确认")
		case "audit_event":
			focus = append(focus, "审计证据、风险事件、human review")
		case "learning":
			focus = append(focus, "学习成长、Co-Growth mission、成长证据")
		case "legal_entity", "org_unit":
			focus = append(focus, "法人/组织 scope 与可见性边界")
		}
	}
	if len(focus) == 0 {
		focus = append(focus, "AI-HRMS 业务上下文、知识治理和审计边界")
	}
	if visualPacketHasAdminGuide(packet) {
		focus = append(focus, "管理员指南、group_admin 角色可见性、账号权限与 scope 治理")
	}
	if packet.SourceCount["layout_item"] > 0 {
		focus = append(focus, "Visual Copilot layout snapshot、截图问答模式、页面区域解释")
	}
	parts = append(parts, "检索重点："+strings.Join(dedupeStrings(focus), "；"))
	return strings.Join(parts, "\n")
}

func visualShouldSearchRAG(requested string, packet domain.ContextPacket) bool {
	lower := strings.ToLower(strings.TrimSpace(requested))
	if containsAny(lower, []string{
		"引用", "资料", "知识", "制度", "政策", "规范", "手册", "证据", "审计", "agent", "智能体", "rag", "这是什么", "这部分", "截图", "位置", "布局",
		"citation", "knowledge", "policy", "guideline", "evidence", "audit", "what is this", "screenshot", "layout",
	}) {
		return true
	}
	for _, item := range packet.Items {
		switch item.Type {
		case "rag_document", "agent_run", "audit_event", "learning":
			return true
		}
	}
	if packet.SourceCount["postgres_context"] > 0 {
		return false
	}
	if packet.SourceCount["layout_item"] > 0 || packet.SourceCount["dom_node"] > 0 {
		return true
	}
	return len(packet.Items) == 0
}

func visualLLMMessage(requested, route string, packet domain.ContextPacket) string {
	lines := []string{
		"任务：为 Visual Copilot 生成用户可读的业务解释。",
		"用户问题：" + requested,
		"页面：" + routeSummary(route),
		"要求：先直接回答用户问题，再给出必要的下一步；不要以“你的意图是”或“系统依据”开头；不要描述内部路由字段、DOM 坐标、layout snapshot、executionMode；不要声称做了图片识别；如涉及“看不了/看不到”，优先解释权限、角色、scope 或刷新状态；如涉及修改数据，只能说明预览和人工确认边界。",
	}
	if len(packet.Items) > 0 {
		lines = append(lines, "Scoped context:")
		count := 0
		for _, item := range packet.Items {
			if count >= 6 {
				break
			}
			if !visualContextItemCanLeaveBoundary(item) || unsafeExternalProviderText(item.Label+"\n"+item.Summary) {
				continue
			}
			lines = append(lines, fmt.Sprintf("- %s「%s」：%s", item.Type, compactVisualText(item.Label, 60), compactVisualText(item.Summary, 180)))
			count++
		}
	}
	return strings.Join(lines, "\n")
}

func dedupeStrings(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func visualShouldUseLLM(requested string, decision domain.HarnessDecision, packet domain.ContextPacket, citations []domain.RAGCitation) bool {
	if !decision.UseLLM || decision.ExecutionMode != executionLLMExplain {
		return false
	}
	if decision.ExecutionMode == executionActionPreview || decision.ExecutionMode == executionHumanReviewRequired || decision.UseAgent || decision.UseMultiAgent {
		return false
	}
	if len(citations) == 0 {
		return false
	}
	lower := strings.ToLower(strings.TrimSpace(requested))
	openEnded := containsAny(lower, []string{
		"解释", "说明", "总结", "分析", "为什么", "如何", "怎么", "业务", "影响", "边界", "建议",
		"explain", "summarize", "analyze", "why", "how", "business", "impact", "boundary",
	})
	hasTrustedContext := packet.SourceCount["rag_citation"] > 0
	if !hasTrustedContext {
		return false
	}
	if containsAny(lower, []string{"这是什么", "这部分", "截图", "位置", "布局", "what is this", "screenshot", "layout"}) {
		return true
	}
	return openEnded
}

func visualContextLabels(packet domain.ContextPacket, limit int) []string {
	labels := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, item := range packet.Items {
		label := compactVisualText(item.Label, 40)
		if label == "" || seen[label] {
			continue
		}
		seen[label] = true
		labels = append(labels, label)
		if len(labels) >= limit {
			break
		}
	}
	return labels
}

func visualExternalQueryLabels(packet domain.ContextPacket, limit int) []string {
	labels := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, item := range packet.Items {
		label := ""
		switch item.Type {
		case "employee", "user":
			label = "员工对象（已按 scope 校验）"
		case "agent_run":
			label = "Agent run 记录"
		case "audit_event":
			label = "审计事件"
		default:
			label = compactVisualText(item.Label, 40)
		}
		if label == "" || unsafeExternalProviderText(label) || seen[label] {
			continue
		}
		seen[label] = true
		labels = append(labels, label)
		if len(labels) >= limit {
			break
		}
	}
	return labels
}

func visualContextCitations(packet domain.ContextPacket) []domain.RAGCitation {
	citations := make([]domain.RAGCitation, 0, len(packet.Items))
	for _, item := range packet.Items {
		if !visualContextItemCanLeaveBoundary(item) {
			continue
		}
		title := compactVisualText(item.Label, 80)
		snippet := compactVisualText(item.Summary, 240)
		if title == "" || snippet == "" || unsafeExternalProviderText(title+"\n"+snippet) {
			continue
		}
		chunkID := item.ID
		if chunkID == "" {
			chunkID = item.Type
		}
		trustLevel := "official"
		sensitivity := "normal"
		if item.Type == "rag_document" {
			trustLevel = strings.ToLower(strings.TrimSpace(fmt.Sprint(item.Metadata["trustLevel"])))
			sensitivity = strings.ToLower(strings.TrimSpace(fmt.Sprint(item.Metadata["sensitivity"])))
			if trustLevel == "" || trustLevel == "<nil>" {
				trustLevel = "internal"
			}
			if sensitivity == "" || sensitivity == "<nil>" {
				sensitivity = "internal"
			}
		}
		citation := domain.RAGCitation{
			DocumentID:  "visual-context:" + item.Type,
			ChunkID:     chunkID,
			Title:       "已校验业务对象：" + title,
			Snippet:     snippet,
			TrustLevel:  trustLevel,
			Sensitivity: sensitivity,
			Score:       0.76,
		}
		if !citationSafeForExternalProvider(citation) {
			continue
		}
		citations = append(citations, citation)
	}
	return citations
}

func visualFilterRAGCitations(_ string, packet domain.ContextPacket, citations []domain.RAGCitation) []domain.RAGCitation {
	if len(citations) == 0 {
		return nil
	}
	if visualPacketHasAdminGuide(packet) {
		return filterCitationsByKeywords(citations, []string{"管理员指南", "group_admin", "角色", "权限", "可见性", "可见", "scope"})
	}
	return citations
}

func filterCitationsByKeywords(citations []domain.RAGCitation, keywords []string) []domain.RAGCitation {
	filtered := make([]domain.RAGCitation, 0, len(citations))
	for _, citation := range citations {
		combined := strings.ToLower(citation.Title + "\n" + citation.Snippet)
		for _, keyword := range keywords {
			if strings.Contains(combined, strings.ToLower(keyword)) {
				filtered = append(filtered, citation)
				break
			}
		}
	}
	return filtered
}

func visualAdminGuideCitations() []domain.RAGCitation {
	return []domain.RAGCitation{{
		DocumentID:  "00000000-0000-0000-0000-000000000933",
		ChunkID:     "00000000-0000-0000-0000-000000000933",
		Title:       "管理员指南与可见性规则",
		Snippet:     "管理员指南只对 group_admin 角色可见，包含账号、角色、法人 scope、组织 scope、RAG 资料发布和高风险审计检查。用户看不到该区域时，应先检查账号角色、scope 和登录状态，并在角色调整后重新登录或刷新。",
		TrustLevel:  "official",
		Sensitivity: "normal",
		Score:       0.92,
	}}
}

func visualContextItemCanLeaveBoundary(item domain.ContextItem) bool {
	switch item.Type {
	case "legal_entity", "rag_document", "learning", "dom_module":
		return item.Source == "postgres.business_ref" || item.Source == "visual_selection.dom_ref" || item.Source == "visual_selection.dom_snapshot_unverified"
	default:
		return false
	}
}

func visualPreview(packet domain.ContextPacket, decision domain.HarnessDecision) string {
	labels := visualContextLabels(packet, 3)
	if len(labels) == 0 {
		return "未命中可验证业务对象；已按页面模块生成有限解释。"
	}
	if decision.UseLLM {
		return "已基于受控业务上下文和可用引用生成解释：" + strings.Join(labels, "、")
	}
	return "已基于可验证业务上下文生成解释：" + strings.Join(labels, "、")
}

func (s *Server) listLearningCourses(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "learning.view") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListLearningCourses(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.LearningCourse]{Total: total, Rows: rows})
}

func (s *Server) createLearningCourse(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "learning.manage") {
		return
	}
	var item domain.LearningCourse
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateLearningCourse(r.Context(), item, principal(r).UserID)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "learning.course.create",
		ObjectType:      "learning_course",
		ObjectID:        saved.ID,
		RequestID:       requestID(r),
		RiskLevel:       "medium",
		NewValueSummary: map[string]any{"title": saved.Title, "status": saved.Status},
	})
	httpx.Created(w, saved)
}

func (s *Server) listLearningLessons(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "learning.view") {
		return
	}
	lessons, err := s.store.ListLearningLessons(r.Context(), r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, lessons)
}

func (s *Server) listLearningEnrollments(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "learning.view") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListLearningEnrollments(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.LearningEnrollment]{Total: total, Rows: rows})
}

func (s *Server) listLearningRecommendations(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "learning.view") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListLearningRecommendations(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.LearningRecommendation]{Total: total, Rows: rows})
}

func (s *Server) listAgentRuns(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "agent.execute_read") {
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListAgentRuns(r.Context(), principal(r).UserID, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.AgentRun]{Total: total, Rows: rows})
}

func (s *Server) createAgentRun(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "agent.execute_write") {
		return
	}
	var req struct {
		RunType   string `json:"runType"`
		Prompt    string `json:"prompt"`
		RiskLevel string `json:"riskLevel"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if tooLong(req.Prompt, 1200) || tooLong(req.RunType, 120) {
		httpx.Error(w, http.StatusBadRequest, 4001, "Agent run prompt 过长，请缩短目标并只传递必要上下文")
		return
	}
	decision := decidePromptHarness(req.RunType + " " + req.Prompt)
	req.RiskLevel = maxRisk(req.RiskLevel, decision.RiskLevel)
	decision.RiskLevel = req.RiskLevel
	decision.HumanReviewRequired = decision.HumanReviewRequired || req.RiskLevel != "low"
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	run, err := s.store.CreateAgentRun(r.Context(), domain.AgentRun{
		RunType: req.RunType, RiskLevel: req.RiskLevel, Summary: "Agent run routed by Go harness as " + decision.ExecutionMode + ".",
	}, principal(r).UserID, map[string]any{
		"userId":            principal(r).UserID,
		"roles":             principal(r).RoleCodes(),
		"capabilities":      principal(r).Capabilities,
		"scope":             map[string]any{"global": scope.Global},
		"executionDecision": decision,
	}, redactPromptPreview(req.Prompt))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID: principal(r).UserID,
		EventType:   "agent.run.create",
		ObjectType:  "agent_run",
		ObjectID:    run.ID,
		RequestID:   requestID(r),
		RiskLevel:   run.RiskLevel,
		NewValueSummary: map[string]any{
			"runType":             run.RunType,
			"status":              run.Status,
			"executionMode":       decision.ExecutionMode,
			"humanReviewRequired": decision.HumanReviewRequired,
		},
	})
	httpx.Created(w, run)
}

func (s *Server) langgraphWorkflowDemo(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "agent.execute_read") {
		return
	}
	var req struct {
		Goal    string   `json:"goal"`
		Context []string `json:"context"`
	}
	if err := httpx.Decode(r, &req); err != nil || strings.TrimSpace(req.Goal) == "" {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if tooLong(req.Goal, 1200) || len(req.Context) > 12 {
		httpx.Error(w, http.StatusBadRequest, 4001, "Workflow preview 请求过大")
		return
	}
	if s.agent == nil || !s.agent.Enabled() {
		httpx.Error(w, http.StatusServiceUnavailable, 5001, "Agent boundary is not configured")
		return
	}
	result, err := s.agent.WorkflowDemo(r.Context(), req.Goal, req.Context)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	result["demo_only"] = true
	result["execution_mode"] = "preview_only"
	if _, ok := result["boundary"]; !ok {
		result["boundary"] = "LangGraph demo only: no HR data is written, no tool is executed, and human review is required before any real workflow run."
	}
	decision := decidePromptHarness(req.Goal)
	summary := promptAuditSummary(req.Goal, decision)
	summary["auditStatus"] = result["audit_status"]
	summary["steps"] = result["steps"]
	summary["demoOnly"] = result["demo_only"]
	summary["executionMode"] = result["execution_mode"]
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "agent.workflow.preview",
		ObjectType:      "agent_workflow",
		ObjectID:        requestID(r),
		RequestID:       requestID(r),
		RiskLevel:       fmt.Sprint(result["risk_level"]),
		NewValueSummary: summary,
	})
	httpx.OK(w, result)
}

func (s *Server) previewAgentTool(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "agent.execute_read") {
		return
	}
	var req domain.AgentToolPreviewRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if tooLong(req.ToolName, 120) || len(req.Arguments) > 20 {
		httpx.Error(w, http.StatusBadRequest, 4001, "工具预览请求过大")
		return
	}
	if strings.TrimSpace(req.UserID) != "" {
		httpx.Error(w, http.StatusBadRequest, 4001, "Agent 工具不接受裸 userId")
		return
	}
	if req.RunID != nil {
		owned, err := s.store.AgentRunOwnedBy(r.Context(), *req.RunID, principal(r).UserID)
		if err != nil {
			s.respondErr(w, err)
			return
		}
		if !owned {
			httpx.Error(w, http.StatusForbidden, 4003, "Agent run 不属于当前用户")
			return
		}
	}
	toolPreview := previewForTool(req.ToolName, req.Arguments, principal(r).HasCapability("agent.execute_write"))
	accepted := toolPreview.Accepted
	if req.RunID == nil {
		accepted = false
		toolPreview.Accepted = false
		toolPreview.PreviewOnly = true
		toolPreview.Decision = "detached_preview_only"
		toolPreview.Reason = "未绑定当前用户的 Agent run，系统只返回 detached preview，不记录为可执行工具调用。"
	}
	if toolPreview.RequiredCapability != "" && !principal(r).HasCapability(toolPreview.RequiredCapability) {
		accepted = false
		toolPreview.Accepted = false
		toolPreview.PreviewOnly = true
		toolPreview.Decision = "missing_required_capability"
		toolPreview.Reason = "当前用户缺少该工具要求的模块 capability，只能查看被拒绝的预览。"
	}
	message := "工具已进入预览，执行前仍由 Go 重新校验权限。"
	if !accepted {
		message = "该工具需要写执行权限或二次确认。"
	}
	if err := s.store.CreateAgentToolCall(r.Context(), req.RunID, req.ToolName, req.Arguments, accepted, message); err != nil {
		s.respondErr(w, err)
		return
	}
	decision := domain.HarnessDecision{
		Intent:              "tool_preview",
		ExecutionMode:       toolPreview.ExecutionMode,
		RiskLevel:           toolPreview.RiskLevel,
		HumanReviewRequired: toolPreview.PreviewOnly,
		Reason:              toolPreview.Reason,
		RoutedBy:            []string{"tool.registry", "rbac.capability", "preview.first"},
	}
	trust := buildTrustPacket(decision, 0.9, nil, "tool_preview_logged", &toolPreview)
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID: principal(r).UserID,
		EventType:   "agent.tool.preview",
		ObjectType:  "agent_tool_call",
		ObjectID:    req.ToolName,
		RequestID:   requestID(r),
		RiskLevel:   toolPreview.RiskLevel,
		NewValueSummary: map[string]any{
			"toolName":            req.ToolName,
			"accepted":            accepted,
			"previewOnly":         toolPreview.PreviewOnly,
			"executionMode":       toolPreview.ExecutionMode,
			"humanReviewRequired": decision.HumanReviewRequired,
			"writes":              toolPreview.Writes,
		},
	})
	httpx.OK(w, domain.AgentToolPreviewResponse{
		Accepted: accepted,
		Message:  message,
		RequiredRisk: func() string {
			if accepted {
				return toolPreview.RiskLevel
			}
			return "high"
		}(),
		ResultPreview:     map[string]any{"toolName": req.ToolName, "executionMode": toolPreview.ExecutionMode, "writes": toolPreview.Writes},
		ToolPreview:       &toolPreview,
		ExecutionDecision: &decision,
		TrustPacket:       &trust,
	})
}

func fetchRAGURL(ctx context.Context, rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("url source requires http or https URI")
	}
	if err := validatePublicRAGURL(ctx, parsed); err != nil {
		return "", err
	}
	client := &http.Client{
		Transport: ragHTTPTransport(),
		Timeout:   8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("url source redirected too many times")
			}
			return validatePublicRAGURL(req.Context(), req.URL)
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "AI-HRMS-RAG/0.1")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", errors.New("url source returned non-success status")
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return "", err
	}
	text := string(data)
	if strings.Contains(resp.Header.Get("Content-Type"), "html") || strings.Contains(text, "<html") {
		return stripHTML(text), nil
	}
	return text, nil
}

func ragHTTPTransport() *http.Transport {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	return &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(address)
			if err != nil {
				return nil, err
			}
			ip, err := resolvePublicRAGHost(ctx, host)
			if err != nil {
				return nil, err
			}
			return dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		},
	}
}

func validatePublicRAGURL(ctx context.Context, parsed *url.URL) error {
	host := parsed.Hostname()
	if host == "" {
		return errors.New("url source requires a host")
	}
	if strings.EqualFold(host, "localhost") || strings.HasSuffix(strings.ToLower(host), ".localhost") {
		return errors.New("url source cannot target localhost")
	}
	_, err := resolvePublicRAGHost(ctx, host)
	return err
}

func resolvePublicRAGHost(ctx context.Context, host string) (net.IP, error) {
	if ip := net.ParseIP(host); ip != nil {
		if blockedRAGIP(ip) {
			return nil, errors.New("url source cannot target private, loopback, link-local, or multicast addresses")
		}
		return ip, nil
	}
	lookupCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupIPAddr(lookupCtx, host)
	if err != nil || len(addresses) == 0 {
		return nil, errors.New("url source host could not be resolved")
	}
	for _, address := range addresses {
		if blockedRAGIP(address.IP) {
			return nil, errors.New("url source resolved to a private, loopback, link-local, or multicast address")
		}
	}
	return addresses[0].IP, nil
}

func blockedRAGIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified()
}

func redactRAGSourceURI(rawURI string) string {
	parsed, err := url.Parse(rawURI)
	if err != nil || parsed.Host == "" {
		return "[redacted]"
	}
	return parsed.Scheme + "://" + parsed.Host + "/[redacted]"
}

func readRAGLocalSource(uri string) (string, error) {
	root := os.Getenv("AI_HRMS_INGEST_ROOT")
	if root == "" {
		return "", errors.New("directory ingestion requires AI_HRMS_INGEST_ROOT")
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	rootReal, err := filepath.EvalSymlinks(rootAbs)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(uri)
	if err != nil {
		return "", err
	}
	targetReal, err := filepath.EvalSymlinks(targetAbs)
	if err != nil {
		return "", err
	}
	if !pathInsideRoot(rootReal, targetReal) {
		return "", errors.New("directory source is outside AI_HRMS_INGEST_ROOT")
	}

	var builder strings.Builder
	info, err := os.Stat(targetReal)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return readOneRAGFile(targetReal)
	}
	count := 0
	err = filepath.WalkDir(targetReal, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		if count >= 20 || !isRAGTextFile(path) {
			return nil
		}
		pathReal, err := filepath.EvalSymlinks(path)
		if err != nil {
			return err
		}
		if !pathInsideRoot(rootReal, pathReal) {
			return errors.New("directory source contains symlink outside AI_HRMS_INGEST_ROOT")
		}
		content, err := readOneRAGFile(pathReal)
		if err != nil {
			return err
		}
		builder.WriteString("\n\n# ")
		builder.WriteString(filepath.Base(path))
		builder.WriteString("\n")
		builder.WriteString(content)
		count++
		return nil
	})
	if err != nil {
		return "", err
	}
	if builder.Len() == 0 {
		return "", errors.New("directory source contained no readable text files")
	}
	return builder.String(), nil
}

func pathInsideRoot(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func readOneRAGFile(path string) (string, error) {
	if !isRAGTextFile(path) {
		return "", errors.New("only txt, md, html, and htm files are supported")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if len(data) > 256*1024 {
		data = data[:256*1024]
	}
	text := string(data)
	if strings.HasSuffix(strings.ToLower(path), ".html") || strings.HasSuffix(strings.ToLower(path), ".htm") {
		return stripHTML(text), nil
	}
	return text, nil
}

func isRAGTextFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".txt" || ext == ".md" || ext == ".html" || ext == ".htm"
}

var (
	scriptTagPattern = regexp.MustCompile(`(?is)<(script|style)[^>]*>.*?</(script|style)>`)
	htmlTagPattern   = regexp.MustCompile(`(?s)<[^>]+>`)
	spacePattern     = regexp.MustCompile(`\s+`)
	keyLikePattern   = regexp.MustCompile(`(?i)^(sk-|sk_)[A-Za-z0-9_-]{16,}$|^(ghp_|github_pat_|AKIA|AIza)[A-Za-z0-9_-]{12,}$`)
)

func stripHTML(value string) string {
	value = scriptTagPattern.ReplaceAllString(value, " ")
	value = htmlTagPattern.ReplaceAllString(value, " ")
	value = strings.ReplaceAll(value, "&nbsp;", " ")
	value = strings.ReplaceAll(value, "&amp;", "&")
	value = strings.ReplaceAll(value, "&lt;", "<")
	value = strings.ReplaceAll(value, "&gt;", ">")
	return strings.TrimSpace(spacePattern.ReplaceAllString(value, " "))
}

func (s *Server) visualContext(w http.ResponseWriter, r *http.Request) {
	s.handleVisual(w, r, "captured", "context", 0.72)
}

func (s *Server) visualSuggestions(w http.ResponseWriter, r *http.Request) {
	s.handleVisual(w, r, "suggested", "explain_or_act_on_selection", 0.78)
}

func (s *Server) visualActionPreview(w http.ResponseWriter, r *http.Request) {
	s.handleVisual(w, r, "previewed", "action_preview", 0.82)
}

func (s *Server) visualActionExecute(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "agent.execute_write") {
		return
	}
	s.handleVisual(w, r, "blocked_preview", "action_execute_blocked", 0.88)
}

func visualActionIntent(intent string) bool {
	return intent == "action_preview" || intent == "action_execute" || intent == "action_execute_blocked"
}

func (s *Server) handleVisual(w http.ResponseWriter, r *http.Request, status, intent string, confidence float64) {
	if !requireCapability(w, r, "visual_copilot.use") {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 768*1024)
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var req domain.VisualContextRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	totalRefs := 0
	for _, region := range req.Regions {
		totalRefs += len(region.BusinessRefs)
	}
	if len(req.Route) > 240 || len(req.Regions) > 8 || totalRefs > 16 || len(req.DOM) > 200 || visualLayoutItemCount(req.Layout) > 120 || len(req.Instruction) > 1200 {
		httpx.Error(w, http.StatusBadRequest, 4001, "Visual Copilot 请求过大")
		return
	}
	if req.Screenshot != nil {
		if data, ok := req.Screenshot["dataBase64"].(string); ok && len(data) > 512*1024 {
			httpx.Error(w, http.StatusBadRequest, 4001, "Visual Copilot 截图只允许脱敏小图或哈希用途")
			return
		}
		if redacted, ok := req.Screenshot["redacted"].(bool); !ok || !redacted {
			httpx.Error(w, http.StatusBadRequest, 4001, "Visual Copilot 截图必须先脱敏")
			return
		}
	}
	for _, region := range req.Regions {
		for _, ref := range region.BusinessRefs {
			visible, err := s.store.BusinessRefVisible(r.Context(), scope, principal(r), ref)
			if err != nil {
				s.respondErr(w, err)
				return
			}
			if !visible {
				_ = s.store.RecordAudit(r.Context(), store.AuditInput{
					ActorUserID:     principal(r).UserID,
					EventType:       "visual_copilot.ref.rejected",
					ObjectType:      ref.Type,
					ObjectID:        ref.ID,
					RequestID:       requestID(r),
					RiskLevel:       "medium",
					NewValueSummary: map[string]any{"route": req.Route},
				})
				httpx.Error(w, http.StatusForbidden, 4003, "选区包含不可见业务对象")
				return
			}
		}
	}
	refs := make([]domain.BusinessRef, 0)
	for _, region := range req.Regions {
		for _, ref := range region.BusinessRefs {
			refs = append(refs, ref)
		}
	}
	requested := redactPromptPreview(strings.TrimSpace(req.Instruction))
	if requested == "" {
		requested = "解释选区"
	}
	sanitizedReq := req
	sanitizedReq.Instruction = requested
	imageMode := "no-image-analysis"
	if req.Screenshot != nil {
		imageMode = "screenshot-hash-only"
	}
	decision := decideVisualHarness(sanitizedReq)
	isActionIntent := visualActionIntent(intent)
	riskLevel := "low"
	if len(refs) > 0 {
		riskLevel = "medium"
	}
	if status == "executed" || intent == "action_execute" || intent == "action_execute_blocked" {
		riskLevel = "high"
	}
	decision.RiskLevel = maxRisk(decision.RiskLevel, riskLevel)
	decision.HumanReviewRequired = decision.HumanReviewRequired || decision.RiskLevel != "low"
	riskLevel = decision.RiskLevel
	if isActionIntent {
		decision.Intent = intent
		decision.ExecutionMode = executionActionPreview
		decision.UseLLM = false
		decision.HumanReviewRequired = true
		decision.RoutedBy = append(decision.RoutedBy, "visual.action.preview")
	}
	isActionDecision := isActionIntent || decision.Intent == "action_request" || decision.ExecutionMode == executionActionPreview
	if isActionDecision {
		decision.UseLLM = false
		decision.UseAgent = false
		decision.UseMultiAgent = false
		decision.ExecutionMode = executionActionPreview
		decision.HumanReviewRequired = true
		decision.RoutedBy = append(decision.RoutedBy, "visual.action.preview_required")
	}
	requiresPreviewBoundary := isActionDecision || decision.ExecutionMode == executionHumanReviewRequired
	contextPacket := visualContextPacket(sanitizedReq, decision)
	resolvedItems, err := s.store.ResolveBusinessRefs(r.Context(), scope, principal(r), collectRefs(sanitizedReq.Regions))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	if len(resolvedItems) > 0 {
		contextPacket.Items = mergeContextItems(resolvedItems, visualSupplementalContextItems(contextPacket.Items))
		contextPacket.SourceCount["postgres_context"] = len(resolvedItems)
		contextPacket.Boundary = "业务对象详情由 Go Context Resolver 按当前用户 scope 从数据库读取；DeepSeek 不直接访问数据库或页面。"
	}
	ragCitations := []domain.RAGCitation{}
	if visualShouldSearchRAG(requested, contextPacket) {
		ragLimit := 4
		if visualPacketHasAdminGuide(contextPacket) {
			ragLimit = 10
		}
		ragReq := domain.RAGSearchRequest{
			Query: visualRAGQuery(requested, sanitizedReq.Route, contextPacket),
			Limit: ragLimit,
		}
		var ragResult *domain.RAGSearchResult
		var ragErr error
		if visualPacketHasAdminGuide(contextPacket) {
			ragResult, ragErr = s.store.SearchRAG(r.Context(), scope, principal(r), ragReq)
		} else {
			ragResult, ragErr = s.searchRAGResult(r.Context(), scope, principal(r), ragReq)
		}
		if ragErr == nil && ragResult != nil && ragResult.RefusalReason == "" && len(ragResult.Citations) > 0 {
			ragCitations = visualFilterRAGCitations(requested, contextPacket, ragResult.Citations)
			if len(ragCitations) > 0 {
				contextPacket.Items = append(contextPacket.Items, contextPacketFromCitations(requested, decision, ragCitations).Items...)
				contextPacket.SourceCount["rag_citation"] = len(ragCitations)
				if ragResult.Confidence > confidence {
					confidence = ragResult.Confidence
				}
			} else {
				decision.RoutedBy = append(decision.RoutedBy, "visual.rag.irrelevant_filtered")
			}
		} else if ragErr != nil {
			decision.RoutedBy = append(decision.RoutedBy, "visual.rag.unavailable_fallback")
		}
	} else {
		decision.RoutedBy = append(decision.RoutedBy, "visual.rag.skipped_program_context")
	}
	if len(ragCitations) == 0 && visualPacketHasAdminGuide(contextPacket) {
		ragCitations = visualAdminGuideCitations()
		contextPacket.Items = append(contextPacket.Items, contextPacketFromCitations(requested, decision, ragCitations).Items...)
		contextPacket.SourceCount["rag_citation"] = len(ragCitations)
		if confidence < 0.86 {
			confidence = 0.86
		}
		decision.RoutedBy = append(decision.RoutedBy, "visual.rag.admin_guide_citation")
	}
	evidenceCitations := append(visualContextCitations(contextPacket), ragCitations...)
	explanation := visualExplanation(requested, contextPacket, decision)
	provider := ""
	model := ""
	llmCitations := evidenceCitations
	llmMessage := visualLLMMessage(requested, sanitizedReq.Route, contextPacket)
	llmAllowed := visualShouldUseLLM(requested, decision, contextPacket, llmCitations) && s.agent != nil && s.agent.Enabled()
	llmSucceeded := false
	if llmAllowed && s.externalChatProvider(r.Context()) && !externalChatAllowed(llmMessage, llmCitations) {
		llmAllowed = false
		decision.UseLLM = false
		decision.RoutedBy = append(decision.RoutedBy, "visual.llm.external_safety_fallback")
	}
	if llmAllowed {
		chatCtx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
		response, err := s.agent.Chat(chatCtx, llmMessage, llmCitations)
		cancel()
		if err == nil && strings.TrimSpace(response.Message) != "" {
			if highImpactOutputViolation(response.Message) {
				decision.RiskLevel = "high"
				decision.HumanReviewRequired = true
				decision.ExecutionMode = executionHumanReviewRequired
				decision.UseLLM = false
				decision.RoutedBy = append(decision.RoutedBy, "visual.output_verifier.high_impact_block")
			} else {
				explanation = strings.TrimSpace(response.Message)
				provider = response.Provider
				model = response.Model
				decision.UseLLM = true
				llmSucceeded = true
				if requiresPreviewBoundary {
					if isActionDecision {
						decision.Intent = intent
					}
					decision.HumanReviewRequired = true
					if decision.RiskLevel == "high" || decision.ExecutionMode == executionHumanReviewRequired {
						decision.ExecutionMode = executionHumanReviewRequired
					} else {
						decision.ExecutionMode = executionActionPreview
					}
				} else {
					decision.ExecutionMode = executionLLMExplain
				}
				decision.RoutedBy = append(decision.RoutedBy, "visual.llm.scoped_context")
				if confidence < 0.82 {
					confidence = 0.82
				}
			}
		} else if err != nil {
			decision.UseLLM = false
			decision.RoutedBy = append(decision.RoutedBy, "visual.llm.unavailable_fallback")
		}
	}
	if !llmSucceeded {
		decision.UseLLM = false
	}
	riskLevel = decision.RiskLevel
	trust := buildTrustPacket(decision, confidence, evidenceCitations, status, nil)
	selectedSummary := visualSelectedSummary(len(req.Regions), trustedVisualLabels(resolvedItems), contextPacket)
	title := "选区业务解释已生成"
	if llmSucceeded {
		title = "DeepSeek 已基于受控上下文生成解释"
	}
	result := map[string]any{
		"title":             title,
		"preview":           visualPreview(contextPacket, decision),
		"explanation":       explanation,
		"selectedSummary":   selectedSummary,
		"trustBoundary":     "当前模式是 DOM + 业务对象上下文解释；截图只用于审计哈希，不用于模型视觉识别。图片/像素级解释需要接入支持 vision 的 OpenAI-compatible provider。",
		"riskLevel":         riskLevel,
		"confidence":        confidence,
		"provider":          provider,
		"model":             model,
		"citations":         evidenceCitations,
		"imageMode":         imageMode,
		"executionDecision": decision,
		"contextPacket":     contextPacket,
		"trustPacket":       trust,
		"actions": []map[string]any{
			{"type": "explain", "label": "解释选区", "riskLevel": "low"},
			{"type": "open_evidence", "label": "查看证据链", "riskLevel": "medium"},
			{"type": "request_review", "label": "请求人工确认", "riskLevel": "high", "blocked": true},
		},
	}
	event, err := s.store.CreateVisualCopilotEvent(r.Context(), principal(r).UserID, sanitizedReq, status, intent, confidence, result)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	auditEventType := "visual_copilot.preview"
	if intent == "action_execute_blocked" {
		auditEventType = "visual_copilot.action.blocked"
	} else if intent == "action_preview" {
		auditEventType = "visual_copilot.action.preview"
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID: principal(r).UserID,
		EventType:   auditEventType,
		ObjectType:  "visual_copilot_event",
		ObjectID:    event.ID,
		RequestID:   requestID(r),
		RiskLevel:   decision.RiskLevel,
		NewValueSummary: map[string]any{
			"route":               event.Route,
			"intent":              event.Intent,
			"status":              event.Status,
			"executionMode":       decision.ExecutionMode,
			"humanReviewRequired": decision.HumanReviewRequired,
			"contextItems":        len(contextPacket.Items),
			"imageMode":           imageMode,
		},
	})
	if status == "executed" {
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID:     principal(r).UserID,
			EventType:       "visual_copilot.action.execute",
			ObjectType:      "visual_copilot_event",
			ObjectID:        event.ID,
			RequestID:       requestID(r),
			RiskLevel:       "high",
			NewValueSummary: map[string]any{"route": event.Route, "intent": event.Intent},
		})
	}
	httpx.OK(w, map[string]any{"event": event, "result": result, "executionDecision": decision, "contextPacket": contextPacket, "trustPacket": trust})
}

func (s *Server) listVisualEvents(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "visual_copilot.use") {
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListVisualCopilotEvents(r.Context(), principal(r).UserID, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.VisualCopilotEvent]{Total: total, Rows: rows})
}
