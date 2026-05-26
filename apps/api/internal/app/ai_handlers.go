package app

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/httpx"
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

func (s *Server) createRAGDocument(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.publish") {
		return
	}
	var item domain.RAGDocument
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateRAGDocument(r.Context(), item, principal(r).UserID)
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

func (s *Server) createRAGIngestJob(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "rag.publish") {
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
			savedDoc, err := s.store.CreateRAGDocument(r.Context(), *doc, principal(r).UserID)
			if err != nil {
				s.respondErr(w, err)
				return
			}
			item.DocumentID = &savedDoc.ID
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
	scopes := job.Scopes
	if len(scopes) == 0 {
		scopes = []domain.RAGDocumentScope{{ScopeType: "global", IncludeDescendants: true}}
	}
	return &domain.RAGDocument{
		SourceID:    sourceID,
		Title:       title,
		Version:     "v1",
		Status:      "published",
		TrustLevel:  "internal",
		Sensitivity: "normal",
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
	result, err := s.store.SearchRAG(r.Context(), scope, principal(r), req)
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
	result, err := s.store.SearchRAG(r.Context(), scope, principal(r), domain.RAGSearchRequest{Query: req.Message, Limit: 5})
	if err != nil {
		s.respondErr(w, err)
		return
	}
	if result.RefusalReason != "" {
		httpx.OK(w, domain.AIChatResponse{Message: "没有可引用的资料，因此不能直接回答该问题。"})
		return
	}
	httpx.OK(w, domain.AIChatResponse{Message: result.Answer, Citations: result.Citations})
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
	if !requireCapability(w, r, "agent.execute_read") {
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
	if req.RiskLevel == "high" && !principal(r).HasCapability("agent.execute_write") {
		httpx.Error(w, http.StatusForbidden, 4003, "高风险 Agent 动作需要写执行权限")
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	run, err := s.store.CreateAgentRun(r.Context(), domain.AgentRun{
		RunType: req.RunType, RiskLevel: req.RiskLevel,
	}, principal(r).UserID, map[string]any{
		"userId":       principal(r).UserID,
		"roles":        principal(r).RoleCodes(),
		"capabilities": principal(r).Capabilities,
		"scope":        map[string]any{"global": scope.Global},
	}, req.Prompt)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "agent.run.create",
		ObjectType:      "agent_run",
		ObjectID:        run.ID,
		RequestID:       requestID(r),
		RiskLevel:       run.RiskLevel,
		NewValueSummary: map[string]any{"runType": run.RunType},
	})
	httpx.Created(w, run)
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
	if strings.TrimSpace(req.UserID) != "" {
		httpx.Error(w, http.StatusBadRequest, 4001, "Agent 工具不接受裸 userId")
		return
	}
	accepted := isReadOnlyTool(req.ToolName)
	if !accepted && principal(r).HasCapability("agent.execute_write") {
		accepted = true
	}
	message := "工具已进入预览，执行前仍由 Go 重新校验权限。"
	if !accepted {
		message = "该工具需要写执行权限或二次确认。"
	}
	if err := s.store.CreateAgentToolCall(r.Context(), req.RunID, req.ToolName, req.Arguments, accepted, message); err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, domain.AgentToolPreviewResponse{
		Accepted: accepted,
		Message:  message,
		RequiredRisk: func() string {
			if accepted {
				return "low"
			}
			return "high"
		}(),
		ResultPreview: map[string]any{"toolName": req.ToolName},
	})
}

func isReadOnlyTool(tool string) bool {
	switch tool {
	case "list_employees", "get_employee", "list_attendance", "rag_search", "learning_recommend":
		return true
	default:
		return false
	}
}

func fetchRAGURL(ctx context.Context, rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("url source requires http or https URI")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "AI-HRMS-RAG/0.1")
	resp, err := http.DefaultClient.Do(req)
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

func readRAGLocalSource(uri string) (string, error) {
	root := os.Getenv("AI_HRMS_INGEST_ROOT")
	if root == "" {
		return "", errors.New("directory ingestion requires AI_HRMS_INGEST_ROOT")
	}
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	targetAbs, err := filepath.Abs(uri)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(rootAbs, targetAbs)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", errors.New("directory source is outside AI_HRMS_INGEST_ROOT")
	}

	var builder strings.Builder
	info, err := os.Stat(targetAbs)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return readOneRAGFile(targetAbs)
	}
	count := 0
	err = filepath.WalkDir(targetAbs, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		if count >= 20 || !isRAGTextFile(path) {
			return nil
		}
		content, err := readOneRAGFile(path)
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
	s.handleVisual(w, r, "executed", "action_execute", 0.88)
}

func (s *Server) handleVisual(w http.ResponseWriter, r *http.Request, status, intent string, confidence float64) {
	if !requireCapability(w, r, "visual_copilot.use") {
		return
	}
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
	for _, region := range req.Regions {
		for _, ref := range region.BusinessRefs {
			visible, err := s.store.BusinessRefVisible(r.Context(), scope, ref)
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
	result := map[string]any{
		"preview": "已基于圈选区域生成建议。写操作必须先预览再执行。",
		"actions": []map[string]any{{
			"type":  "explain",
			"label": "解释选区",
			"risk":  "low",
		}},
	}
	event, err := s.store.CreateVisualCopilotEvent(r.Context(), principal(r).UserID, req, status, intent, confidence, result)
	if err != nil {
		s.respondErr(w, err)
		return
	}
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
	httpx.OK(w, map[string]any{"event": event, "result": result})
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
