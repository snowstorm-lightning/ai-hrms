package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

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
		req.Password = "12345678900"
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

func (s *Server) attendanceOverview(w http.ResponseWriter, r *http.Request) {
	day, ok := attendanceDayParam(w, r.URL.Query().Get("day"))
	if !ok {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	overview, err := s.store.AttendanceOverview(r.Context(), scope, day)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, overview)
}

func (s *Server) attendanceAgentAnalysis(w http.ResponseWriter, r *http.Request) {
	if !requireCapability(w, r, "agent.execute_write") || !requireCapability(w, r, "employee.read") {
		return
	}
	var req domain.AttendanceAgentAnalysisRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	req.Focus = strings.TrimSpace(req.Focus)
	if req.Focus == "" {
		req.Focus = "overview"
	}
	if req.Focus != "overview" && req.Focus != "exceptions" && req.Focus != "org_unit" {
		httpx.Error(w, http.StatusBadRequest, 4001, "考勤分析 focus 不支持")
		return
	}
	day, ok := attendanceDayParam(w, req.Day)
	if !ok {
		return
	}
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	overview, err := s.store.AttendanceOverview(r.Context(), scope, day)
	if err != nil {
		s.respondErr(w, err)
		return
	}

	riskLevel := maxRisk("medium", overview.Summary.RiskLevel)
	decision := domain.HarnessDecision{
		Intent:              "attendance_realtime_analysis",
		ExecutionMode:       executionSingleAgent,
		RiskLevel:           riskLevel,
		UseAgent:            true,
		HumanReviewRequired: true,
		Reason:              "考勤态势分析使用 scoped 聚合快照和只读工具预览生成，不自动形成旷工、绩效或处分结论。",
		RoutedBy:            []string{"attendance.overview", "tool.registry", "agent.preview_first", "human_review.required"},
	}
	toolArgs := map[string]any{
		"day":         overview.Day,
		"focus":       req.Focus,
		"orgUnitName": strings.TrimSpace(req.OrgUnitName),
	}
	toolPreview := previewForTool("attendance_realtime_overview", toolArgs, principal(r).HasCapability("agent.execute_write"))
	trust := buildTrustPacket(decision, attendanceAnalysisConfidence(overview), nil, "attendance_analysis_previewed", &toolPreview)
	run, err := s.store.CreateAgentRun(r.Context(), domain.AgentRun{
		RunType:   "attendance_realtime_analyst",
		RiskLevel: riskLevel,
		Summary:   "考勤实时态势 Agent 分析预览，基于 scoped 聚合快照，不执行人事裁决。",
	}, principal(r).UserID, map[string]any{
		"userId":            principal(r).UserID,
		"roles":             principal(r).RoleCodes(),
		"scope":             map[string]any{"global": scope.Global},
		"executionDecision": decision,
		"attendance":        attendanceAnalysisContext(overview, req),
	}, attendanceAnalysisPrompt(overview, req))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	if err := s.store.CreateAgentToolCall(r.Context(), &run.ID, toolPreview.ToolName, toolArgs, toolPreview.Accepted, "考勤态势只读工具已生成预览；后续处置需要 HR 人工复核。"); err != nil {
		s.respondErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID: principal(r).UserID,
		EventType:   "attendance.agent_analysis.preview",
		ObjectType:  "attendance",
		ObjectID:    overview.Day,
		RequestID:   requestID(r),
		RiskLevel:   riskLevel,
		NewValueSummary: map[string]any{
			"day":                 overview.Day,
			"focus":               req.Focus,
			"orgUnitName":         req.OrgUnitName,
			"expected":            overview.Summary.Expected,
			"abnormal":            overview.Summary.Abnormal,
			"attendanceRate":      overview.Summary.AttendanceRate,
			"toolPreview":         toolPreview.ToolName,
			"humanReviewRequired": true,
		},
	})
	httpx.OK(w, domain.AttendanceAgentAnalysis{
		Run:                run,
		ToolPreview:        &toolPreview,
		ExecutionDecision:  &decision,
		TrustPacket:        &trust,
		Insights:           attendanceAnalysisInsights(overview, req),
		RecommendedActions: attendanceRecommendedActions(overview, req),
		AuditPreview: []string{
			"attendance.overview.read",
			"agent.run.create",
			"agent.tool.preview",
			"attendance.agent_analysis.preview",
			"human.review.required",
		},
		Overview: overview,
	})
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

func attendanceDayParam(w http.ResponseWriter, day string) (string, bool) {
	day = strings.TrimSpace(day)
	if day == "" {
		return "", true
	}
	if _, err := time.Parse("2006-01-02", day); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "日期格式应为 YYYY-MM-DD")
		return "", false
	}
	return day, true
}

func attendanceAnalysisPrompt(overview *domain.AttendanceOverview, req domain.AttendanceAgentAnalysisRequest) string {
	return fmt.Sprintf(
		"分析 %s 考勤态势：focus=%s, org=%s, expected=%d, checkedIn=%d, leave=%d, late=%d, earlyLeave=%d, fieldOrTrip=%d, abnormal=%d。只输出聚合洞察和人工复核建议，不自动做人事裁决。",
		overview.Day,
		req.Focus,
		strings.TrimSpace(req.OrgUnitName),
		overview.Summary.Expected,
		overview.Summary.CheckedIn,
		overview.Summary.Leave,
		overview.Summary.Late,
		overview.Summary.EarlyLeave,
		overview.Summary.FieldOrTrip,
		overview.Summary.Abnormal,
	)
}

func attendanceAnalysisContext(overview *domain.AttendanceOverview, req domain.AttendanceAgentAnalysisRequest) map[string]any {
	exceptions := make([]map[string]any, 0, minAttendanceInt(len(overview.Exceptions), 8))
	for _, item := range overview.Exceptions {
		if len(exceptions) >= 8 {
			break
		}
		if req.Focus == "org_unit" && strings.TrimSpace(req.OrgUnitName) != "" && item.OrgUnitName != req.OrgUnitName {
			continue
		}
		exceptions = append(exceptions, map[string]any{
			"employeeName":  item.EmployeeName,
			"orgUnitName":   item.OrgUnitName,
			"exceptionType": item.ExceptionType,
			"severity":      item.Severity,
			"statusLabel":   item.StatusLabel,
		})
	}
	orgs := make([]map[string]any, 0, minAttendanceInt(len(overview.OrgUnits), 8))
	for _, org := range overview.OrgUnits {
		if len(orgs) >= 8 {
			break
		}
		orgs = append(orgs, map[string]any{
			"orgUnitName":    org.OrgUnitName,
			"expected":       org.Expected,
			"checkedIn":      org.CheckedIn,
			"abnormal":       org.Abnormal,
			"attendanceRate": org.AttendanceRate,
			"riskLevel":      org.RiskLevel,
		})
	}
	return map[string]any{
		"day":        overview.Day,
		"focus":      req.Focus,
		"summary":    overview.Summary,
		"orgUnits":   orgs,
		"exceptions": exceptions,
		"boundary":   "No mobile, salary, performance, medical, or disciplinary data is delegated to the attendance analyst context.",
	}
}

func attendanceAnalysisInsights(overview *domain.AttendanceOverview, req domain.AttendanceAgentAnalysisRequest) []string {
	insights := []string{
		fmt.Sprintf("今日应到 %d 人，已签到 %d 人，到岗率 %.1f%%。", overview.Summary.Expected, overview.Summary.CheckedIn, overview.Summary.AttendanceRate),
		fmt.Sprintf("请假 %d 人、外出/出差 %d 人、迟到 %d 人、早退 %d 人。", overview.Summary.Leave, overview.Summary.FieldOrTrip, overview.Summary.Late, overview.Summary.EarlyLeave),
	}
	if overview.Summary.Abnormal == 0 {
		insights = append(insights, "当前没有需要立即升级的异常信号，仍建议保留当天审计快照。")
		return insights
	}
	insights = append(insights, fmt.Sprintf("发现 %d 名员工存在未签到、迟到、早退或缺签退信号，风险等级为 %s。", overview.Summary.Abnormal, overview.Summary.RiskLevel))
	if len(overview.OrgUnits) > 0 && overview.OrgUnits[0].Abnormal > 0 {
		top := overview.OrgUnits[0]
		insights = append(insights, fmt.Sprintf("异常最集中的组织是 %s：异常 %d 人，到岗率 %.1f%%。", top.OrgUnitName, top.Abnormal, top.AttendanceRate))
	}
	if req.Focus == "org_unit" && strings.TrimSpace(req.OrgUnitName) != "" {
		insights = append(insights, "当前分析已限定到指定组织，后续处置仍需要 HR 核对排班、请假和外勤记录。")
	}
	return insights
}

func attendanceRecommendedActions(overview *domain.AttendanceOverview, _ domain.AttendanceAgentAnalysisRequest) []string {
	if overview.Summary.Abnormal == 0 {
		return []string{
			"保留今日考勤快照和审计记录。",
			"下班后复查是否出现缺签退或补签记录。",
			"如需发布日报，先由 HR 确认口径。AI 不自动做人事裁决。",
		}
	}
	return []string{
		"优先核对未签到和缺签退人员是否已有请假、外勤或系统同步记录。",
		"对迟到/早退只生成提醒和复核清单，不自动判定旷工或绩效影响。",
		"将需要跟进的异常交给 HR 或部门负责人确认，并保留人工确认结果。",
	}
}

func attendanceAnalysisConfidence(overview *domain.AttendanceOverview) float64 {
	if overview.Summary.Expected == 0 {
		return 0.72
	}
	if overview.Summary.Abnormal == 0 {
		return 0.9
	}
	return 0.86
}

func minAttendanceInt(left, right int) int {
	if left < right {
		return left
	}
	return right
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
