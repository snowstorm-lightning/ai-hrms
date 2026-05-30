package app

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"ai-hrms/apps/api/internal/agentbridge"
	"ai-hrms/apps/api/internal/auth"
	"ai-hrms/apps/api/internal/config"
	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/httpx"
	"ai-hrms/apps/api/internal/rbac"
	"ai-hrms/apps/api/internal/store"
	"github.com/rs/cors"
)

type Server struct {
	cfg   config.Config
	store *store.Store
	agent *agentbridge.Client
}

type contextKey string

const principalKey contextKey = "principal"

func New(cfg config.Config, db *store.Store) http.Handler {
	server := &Server{cfg: cfg, store: db, agent: agentbridge.New(cfg.AI)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", server.health)
	mux.HandleFunc("POST /api/auth/login", server.login)
	mux.Handle("GET /api/profile", server.authenticated(http.HandlerFunc(server.profile)))
	mux.Handle("GET /api/legal-entities", server.authenticated(http.HandlerFunc(server.listLegalEntities)))
	mux.Handle("POST /api/legal-entities", server.authenticated(http.HandlerFunc(server.createLegalEntity)))
	mux.Handle("PUT /api/legal-entities/{id}", server.authenticated(http.HandlerFunc(server.updateLegalEntity)))
	mux.Handle("GET /api/org-units", server.authenticated(http.HandlerFunc(server.listOrgUnits)))
	mux.Handle("POST /api/org-units", server.authenticated(http.HandlerFunc(server.createOrgUnit)))
	mux.Handle("PUT /api/org-units/{id}", server.authenticated(http.HandlerFunc(server.updateOrgUnit)))
	mux.Handle("GET /api/roles", server.authenticated(http.HandlerFunc(server.listRoles)))
	mux.Handle("GET /api/capabilities", server.authenticated(http.HandlerFunc(server.listCapabilities)))
	mux.Handle("GET /api/users", server.authenticated(http.HandlerFunc(server.listUsers)))
	mux.Handle("POST /api/users", server.authenticated(http.HandlerFunc(server.createUser)))
	mux.Handle("PUT /api/users/{id}", server.authenticated(http.HandlerFunc(server.updateUser)))
	mux.Handle("GET /api/users/{id}/role-bindings", server.authenticated(http.HandlerFunc(server.listUserRoleBindings)))
	mux.Handle("PUT /api/users/{id}/role-bindings", server.authenticated(http.HandlerFunc(server.replaceUserRoleBindings)))
	mux.Handle("GET /api/employees/export", server.authenticated(http.HandlerFunc(server.exportEmployees)))
	mux.Handle("GET /api/employees", server.authenticated(http.HandlerFunc(server.listEmployees)))
	mux.Handle("GET /api/employees/{id}", server.authenticated(http.HandlerFunc(server.getEmployee)))
	mux.Handle("POST /api/employees", server.authenticated(http.HandlerFunc(server.createEmployee)))
	mux.Handle("PUT /api/employees/{id}", server.authenticated(http.HandlerFunc(server.updateEmployee)))
	mux.Handle("GET /api/employees/{id}/assignments", server.authenticated(http.HandlerFunc(server.listEmployeeAssignments)))
	mux.Handle("PUT /api/employees/{id}/assignments", server.authenticated(http.HandlerFunc(server.replaceEmployeeAssignments)))
	mux.Handle("GET /api/attendance/export", server.authenticated(http.HandlerFunc(server.exportAttendance)))
	mux.Handle("GET /api/attendance", server.authenticated(http.HandlerFunc(server.listAttendance)))
	mux.Handle("POST /api/attendance", server.authenticated(http.HandlerFunc(server.createAttendance)))
	mux.Handle("PUT /api/attendance/{id}/checkout", server.authenticated(http.HandlerFunc(server.checkoutAttendance)))
	mux.Handle("GET /api/messages", server.authenticated(http.HandlerFunc(server.listMessages)))
	mux.Handle("POST /api/messages", server.authenticated(http.HandlerFunc(server.createMessage)))
	mux.Handle("GET /api/messages/{id}/comments", server.authenticated(http.HandlerFunc(server.listComments)))
	mux.Handle("POST /api/messages/{id}/comments", server.authenticated(http.HandlerFunc(server.createComment)))
	mux.Handle("GET /api/audit/events", server.authenticated(http.HandlerFunc(server.listAuditEvents)))
	mux.Handle("POST /api/rag/sources", server.authenticated(http.HandlerFunc(server.createRAGSource)))
	mux.Handle("GET /api/rag/sources", server.authenticated(http.HandlerFunc(server.listRAGSources)))
	mux.Handle("POST /api/rag/documents", server.authenticated(http.HandlerFunc(server.createRAGDocument)))
	mux.Handle("GET /api/rag/documents", server.authenticated(http.HandlerFunc(server.listRAGDocuments)))
	mux.Handle("POST /api/rag/documents/{id}/rebuild", server.authenticated(http.HandlerFunc(server.rebuildRAGDocument)))
	mux.Handle("POST /api/rag/ingest-jobs", server.authenticated(http.HandlerFunc(server.createRAGIngestJob)))
	mux.Handle("GET /api/rag/ingest-jobs/{id}", server.authenticated(http.HandlerFunc(server.getRAGIngestJob)))
	mux.Handle("POST /api/rag/search", server.authenticated(http.HandlerFunc(server.searchRAG)))
	mux.Handle("POST /api/ai/chat", server.authenticated(http.HandlerFunc(server.aiChat)))
	mux.Handle("GET /api/ai/provider-status", server.authenticated(http.HandlerFunc(server.aiProviderStatus)))
	mux.Handle("GET /api/learning/courses", server.authenticated(http.HandlerFunc(server.listLearningCourses)))
	mux.Handle("POST /api/learning/courses", server.authenticated(http.HandlerFunc(server.createLearningCourse)))
	mux.Handle("GET /api/learning/courses/{id}/lessons", server.authenticated(http.HandlerFunc(server.listLearningLessons)))
	mux.Handle("GET /api/learning/enrollments", server.authenticated(http.HandlerFunc(server.listLearningEnrollments)))
	mux.Handle("GET /api/learning/recommendations", server.authenticated(http.HandlerFunc(server.listLearningRecommendations)))
	mux.Handle("GET /api/agent/runs", server.authenticated(http.HandlerFunc(server.listAgentRuns)))
	mux.Handle("POST /api/agent/runs", server.authenticated(http.HandlerFunc(server.createAgentRun)))
	mux.Handle("POST /api/agent/workflows/langgraph/demo", server.authenticated(http.HandlerFunc(server.langgraphWorkflowDemo)))
	mux.Handle("POST /api/agent/tools/preview", server.authenticated(http.HandlerFunc(server.previewAgentTool)))
	mux.Handle("POST /api/visual-copilot/context", server.authenticated(http.HandlerFunc(server.visualContext)))
	mux.Handle("POST /api/visual-copilot/suggestions", server.authenticated(http.HandlerFunc(server.visualSuggestions)))
	mux.Handle("POST /api/visual-copilot/actions/preview", server.authenticated(http.HandlerFunc(server.visualActionPreview)))
	mux.Handle("POST /api/visual-copilot/actions/execute", server.authenticated(http.HandlerFunc(server.visualActionExecute)))
	mux.Handle("GET /api/visual-copilot/events", server.authenticated(http.HandlerFunc(server.listVisualEvents)))

	return cors.New(cors.Options{
		AllowedOrigins: cfg.AllowedOrigins,
		AllowedMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}).Handler(mux)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	httpx.OK(w, map[string]string{"status": "ok"})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Mobile   string `json:"mobile"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	user, err := s.store.Authenticate(r.Context(), req.Mobile, req.Password)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, 4005, "用户名或密码错误")
		return
	}
	token, err := auth.CreateToken(s.cfg.JWTSecret, user.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, 5000, "生成令牌失败")
		return
	}
	httpx.OK(w, map[string]any{"token": token, "user": user})
}

func (s *Server) authenticated(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		token := strings.TrimPrefix(header, "Bearer ")
		if token == "" || token == header {
			httpx.Error(w, http.StatusUnauthorized, 4002, "未登录")
			return
		}
		claims, err := auth.ParseToken(s.cfg.JWTSecret, token)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, 4002, "未登录")
			return
		}
		principal, err := s.store.GetPrincipal(r.Context(), claims.UserID)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, 4002, "未登录")
			return
		}
		ctx := context.WithValue(r.Context(), principalKey, principal)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func principal(r *http.Request) rbac.Principal {
	return r.Context().Value(principalKey).(rbac.Principal)
}

func (s *Server) scope(r *http.Request) (store.Scope, bool) {
	resolved, err := s.store.ResolveScope(r.Context(), principal(r))
	if err != nil {
		return store.Scope{}, false
	}
	return resolved, true
}

func requireGlobal(w http.ResponseWriter, r *http.Request) bool {
	if !principal(r).IsGlobal() {
		httpx.Error(w, http.StatusForbidden, 4003, "权限不足")
		return false
	}
	return true
}

func requireCapability(w http.ResponseWriter, r *http.Request, capability string) bool {
	if principal(r).HasCapability(capability) {
		return true
	}
	httpx.Error(w, http.StatusForbidden, 4003, "权限不足")
	return false
}

func requestID(r *http.Request) string {
	if id := r.Header.Get("X-Request-Id"); id != "" {
		return id
	}
	return r.Header.Get("X-Request-ID")
}

func (s *Server) profile(w http.ResponseWriter, r *http.Request) {
	user, err := s.store.GetUser(r.Context(), principal(r).UserID)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, user)
}

func (s *Server) listLegalEntities(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	items, err := s.store.ListLegalEntities(r.Context(), scope)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, items)
}

func (s *Server) createLegalEntity(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var item domain.LegalEntity
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.SaveLegalEntity(r.Context(), item)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, saved)
}

func (s *Server) updateLegalEntity(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var item domain.LegalEntity
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.UpdateLegalEntity(r.Context(), r.PathValue("id"), item)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, saved)
}

func (s *Server) listOrgUnits(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	items, err := s.store.ListOrgUnits(r.Context(), scope)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, items)
}

func (s *Server) createOrgUnit(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var item domain.OrgUnit
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.SaveOrgUnit(r.Context(), item)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, saved)
}

func (s *Server) updateOrgUnit(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var item domain.OrgUnit
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.UpdateOrgUnit(r.Context(), r.PathValue("id"), item)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, saved)
}

func (s *Server) listRoles(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	roles, err := s.store.ListRoles(r.Context())
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, roles)
}

func (s *Server) listCapabilities(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	capabilities, err := s.store.ListCapabilities(r.Context())
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, capabilities)
}

func (s *Server) respondErr(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, 4001, "未找到资源")
		return
	}
	httpx.Error(w, http.StatusInternalServerError, 5000, err.Error())
}
