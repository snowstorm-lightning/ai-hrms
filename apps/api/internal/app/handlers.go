package app

import (
	"net/http"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/httpx"
	"ai-hrms/apps/api/internal/store"
)

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListUsers(r.Context(), page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.User]{Total: total, Rows: rows})
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var req struct {
		Mobile   string `json:"mobile"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	if req.Password == "" {
		req.Password = "password"
	}
	user, err := s.store.CreateUser(r.Context(), req.Mobile, req.Username, req.Password)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, user)
}

func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var req struct {
		Username    string `json:"username"`
		EnableState int    `json:"enableState"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	user, err := s.store.UpdateUser(r.Context(), r.PathValue("id"), req.Username, req.EnableState)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, user)
}

func (s *Server) listUserRoleBindings(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	bindings, err := s.store.ListUserRoleBindings(r.Context(), r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, bindings)
}

func (s *Server) replaceUserRoleBindings(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var req struct {
		Bindings []domain.RoleBinding `json:"bindings"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	for _, binding := range req.Bindings {
		if binding.RoleCode == "" {
			httpx.Error(w, http.StatusBadRequest, 4001, "角色不能为空")
			return
		}
		switch binding.ScopeType {
		case "global":
		case "legal_entity", "org_unit":
			if binding.ScopeID == nil || *binding.ScopeID == "" {
				httpx.Error(w, http.StatusBadRequest, 4001, "作用域不能为空")
				return
			}
		default:
			httpx.Error(w, http.StatusBadRequest, 4001, "作用域类型错误")
			return
		}
	}
	bindings, err := s.store.ReplaceUserRoleBindings(r.Context(), r.PathValue("id"), req.Bindings)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, bindings)
}

func (s *Server) listEmployees(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListEmployees(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.Employee]{Total: total, Rows: rows})
}

func (s *Server) getEmployee(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	employee, err := s.store.GetEmployee(r.Context(), scope, r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, employee)
}

func (s *Server) createEmployee(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var employee domain.Employee
	if err := httpx.Decode(r, &employee); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateEmployee(r.Context(), employee)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, saved)
}

func (s *Server) updateEmployee(w http.ResponseWriter, r *http.Request) {
	if !requireGlobal(w, r) {
		return
	}
	var employee domain.Employee
	if err := httpx.Decode(r, &employee); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.UpdateEmployee(r.Context(), r.PathValue("id"), employee)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, saved)
}

func (s *Server) listEmployeeAssignments(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	assignments, err := s.store.ListEmployeeAssignments(r.Context(), scope, r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, assignments)
}

func (s *Server) replaceEmployeeAssignments(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "employee.write") {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var req struct {
		Assignments []domain.Assignment `json:"assignments"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	assignments, err := s.store.ReplaceEmployeeAssignments(r.Context(), scope, r.PathValue("id"), req.Assignments)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID:     principal(r).UserID,
		EventType:       "employee.assignments.replace",
		ObjectType:      "employee",
		ObjectID:        r.PathValue("id"),
		RequestID:       requestID(r),
		RiskLevel:       "medium",
		NewValueSummary: map[string]any{"assignmentCount": len(assignments)},
	})
	httpx.OK(w, assignments)
}

func (s *Server) listAttendance(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListAttendance(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.Attendance]{Total: total, Rows: rows})
}

func (s *Server) createAttendance(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var item domain.Attendance
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateAttendance(r.Context(), scope, item)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, saved)
}

func (s *Server) checkoutAttendance(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	saved, err := s.store.CheckoutAttendance(r.Context(), scope, r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, saved)
}

func (s *Server) listMessages(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.ListMessages(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.Message]{Total: total, Rows: rows})
}

func (s *Server) createMessage(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var item domain.Message
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateMessage(r.Context(), scope, item, principal(r).UserID)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, saved)
}

func (s *Server) listComments(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	rows, err := s.store.ListComments(r.Context(), scope, r.PathValue("id"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, rows)
}

func (s *Server) createComment(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var item domain.Comment
	if err := httpx.Decode(r, &item); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	saved, err := s.store.CreateComment(r.Context(), scope, r.PathValue("id"), principal(r).UserID, item)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.Created(w, saved)
}
