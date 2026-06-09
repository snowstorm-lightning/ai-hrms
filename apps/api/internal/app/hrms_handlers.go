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

func (s *Server) respondHRErr(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrInvalidHRResource) {
		httpx.Error(w, http.StatusBadRequest, 4001, "未知 HR 资源")
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
