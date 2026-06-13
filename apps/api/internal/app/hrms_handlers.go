package app

import (
	"errors"
	"net/http"
	"sort"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/httpx"
	"ai-hrms/apps/api/internal/store"
)

func (s *Server) workbenchOverview(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	overview, err := s.store.WorkbenchOverview(r.Context(), scope)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, overview)
}

func (s *Server) workbenchWorkItems(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	rows, total, err := s.store.WorkbenchWorkItems(r.Context(), scope, page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.HRWorkItem]{Total: total, Rows: rows})
}

func (s *Server) listHRRecords(resource string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, ok := s.scope(r)
		if !ok {
			httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
			return
		}
		page, size := httpx.PageParams(r)
		rows, total, err := s.store.ListHRRecords(r.Context(), scope, resource, page, size)
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		httpx.OK(w, httpx.Page[domain.HRRecord]{Total: total, Rows: rows})
	}
}

func (s *Server) createHRRecord(resource string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, ok := s.scope(r)
		if !ok {
			httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
			return
		}
		var input domain.HRRecordInput
		if err := httpx.Decode(r, &input); err != nil {
			httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
			return
		}
		record, err := s.store.CreateHRRecord(r.Context(), scope, resource, input)
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID: principal(r).UserID,
			EventType:   "hr." + resource + ".created",
			ObjectType:  record.RecordType,
			ObjectID:    record.ID,
			ScopeType:   record.ScopeType,
			ScopeID:     record.ScopeID,
			RequestID:   requestID(r),
			Source:      "api",
			RiskLevel:   record.RiskLevel,
			NewValueSummary: map[string]any{
				"record": hrRecordAuditSummary(*record),
			},
		})
		httpx.Created(w, record)
	}
}

func (s *Server) updateHRRecord(resource string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, ok := s.scope(r)
		if !ok {
			httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
			return
		}
		id := r.PathValue("id")
		var input domain.HRRecordInput
		if err := httpx.Decode(r, &input); err != nil {
			httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
			return
		}
		before, err := s.store.GetHRRecord(r.Context(), scope, resource, id)
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		record, err := s.store.UpdateHRRecord(r.Context(), scope, resource, id, input)
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID: principal(r).UserID,
			EventType:   "hr." + resource + ".updated",
			ObjectType:  record.RecordType,
			ObjectID:    record.ID,
			ScopeType:   record.ScopeType,
			ScopeID:     record.ScopeID,
			RequestID:   requestID(r),
			Source:      "api",
			RiskLevel:   record.RiskLevel,
			OldValueSummary: map[string]any{
				"record": hrRecordAuditSummary(*before),
			},
			NewValueSummary: map[string]any{
				"record": hrRecordAuditSummary(*record),
			},
		})
		httpx.OK(w, record)
	}
}

func (s *Server) deleteHRRecord(resource string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, ok := s.scope(r)
		if !ok {
			httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
			return
		}
		id := r.PathValue("id")
		record, err := s.store.DeleteHRRecord(r.Context(), scope, resource, id)
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID: principal(r).UserID,
			EventType:   "hr." + resource + ".deleted",
			ObjectType:  record.RecordType,
			ObjectID:    record.ID,
			ScopeType:   record.ScopeType,
			ScopeID:     record.ScopeID,
			RequestID:   requestID(r),
			Source:      "api",
			RiskLevel:   record.RiskLevel,
			OldValueSummary: map[string]any{
				"record": hrRecordAuditSummary(*record),
			},
		})
		httpx.OK(w, map[string]bool{"deleted": true})
	}
}

func (s *Server) getHRWorkflow(resource string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, ok := s.scope(r)
		if !ok {
			httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
			return
		}
		workflow, err := s.store.GetHRWorkflow(r.Context(), scope, principal(r), resource, r.PathValue("id"))
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		httpx.OK(w, workflow)
	}
}

func (s *Server) applyHRWorkflowAction(resource string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scope, ok := s.scope(r)
		if !ok {
			httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
			return
		}
		var input domain.WorkflowActionInput
		if err := httpx.Decode(r, &input); err != nil {
			httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
			return
		}
		result, err := s.store.ApplyHRWorkflowAction(r.Context(), scope, principal(r), resource, r.PathValue("id"), input)
		if err != nil {
			s.respondHRErr(w, err)
			return
		}
		_ = s.store.RecordAudit(r.Context(), store.AuditInput{
			ActorUserID: principal(r).UserID,
			EventType:   "hr." + resource + ".workflow." + input.Action,
			ObjectType:  result.Record.RecordType,
			ObjectID:    result.Record.ID,
			ScopeType:   result.Record.ScopeType,
			ScopeID:     result.Record.ScopeID,
			RequestID:   requestID(r),
			Source:      "api",
			RiskLevel:   result.Record.RiskLevel,
			NewValueSummary: map[string]any{
				"record": hrRecordAuditSummary(result.Record),
				"action": input.Action,
				"event":  result.Event,
			},
		})
		httpx.OK(w, result)
	}
}

func (s *Server) listLeaveBalances(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	items, err := s.store.ListLeaveBalances(r.Context(), scope, r.URL.Query().Get("employeeId"))
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, items)
}

func (s *Server) listEmployeeCheckins(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	page, size := httpx.PageParams(r)
	items, total, err := s.store.ListEmployeeCheckins(r.Context(), scope, r.URL.Query().Get("employeeId"), page, size)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	httpx.OK(w, httpx.Page[domain.EmployeeCheckin]{Total: total, Rows: items})
}

func (s *Server) createEmployeeCheckin(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	var input domain.EmployeeCheckinInput
	if err := httpx.Decode(r, &input); err != nil {
		httpx.Error(w, http.StatusBadRequest, 4001, "请求格式错误")
		return
	}
	checkin, err := s.store.CreateEmployeeCheckin(r.Context(), scope, principal(r).UserID, input)
	if err != nil {
		s.respondHRErr(w, err)
		return
	}
	_ = s.store.RecordAudit(r.Context(), store.AuditInput{
		ActorUserID: principal(r).UserID,
		EventType:   "hr.employee_checkin.created",
		ObjectType:  "Employee Checkin",
		ObjectID:    checkin.ID,
		ScopeType:   "global",
		RequestID:   requestID(r),
		Source:      "api",
		RiskLevel:   "low",
		NewValueSummary: map[string]any{
			"employeeId": checkin.EmployeeID,
			"logType":    checkin.LogType,
			"logTime":    checkin.LogTime,
		},
	})
	httpx.Created(w, checkin)
}

func (s *Server) respondHRErr(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrInvalidHRResource) {
		httpx.Error(w, http.StatusBadRequest, 4001, "未知 HR 资源")
		return
	}
	if errors.Is(err, store.ErrInvalidWorkflowAction) {
		httpx.Error(w, http.StatusBadRequest, 4001, "无效的流程动作")
		return
	}
	if errors.Is(err, store.ErrWorkflowCapability) {
		httpx.Error(w, http.StatusForbidden, 4003, "缺少流程操作权限")
		return
	}
	s.respondErr(w, err)
}

func hrRecordAuditSummary(record domain.HRRecord) map[string]any {
	return map[string]any{
		"resource":            record.Resource,
		"module":              record.Module,
		"title":               record.Title,
		"status":              record.Status,
		"riskLevel":           record.RiskLevel,
		"humanReviewRequired": record.HumanReviewRequired,
		"payloadKeys":         mapKeys(record.Payload),
	}
}

func mapKeys(value map[string]any) []string {
	keys := make([]string, 0, len(value))
	for key := range value {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
