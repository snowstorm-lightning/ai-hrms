package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
)

func (s *Store) BusinessRefVisible(ctx context.Context, scope Scope, actor rbac.Principal, ref domain.BusinessRef) (bool, error) {
	if ref.ID == "" || ref.Type == "" {
		return false, nil
	}
	switch ref.Type {
	case "employee", "user":
		_, err := s.GetEmployee(ctx, scope, ref.ID)
		if err == nil {
			return true, nil
		}
		if err == ErrNotFound {
			return false, nil
		}
		return false, err
	case "legal_entity":
		items, err := s.ListLegalEntities(ctx, scope)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "org_unit":
		items, err := s.ListOrgUnits(ctx, scope)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "rag_document":
		doc, err := s.GetRAGDocument(ctx, scope, actor, ref.ID)
		if err == nil && doc != nil {
			return true, nil
		}
		if err == ErrNotFound {
			return false, nil
		}
		return false, err
	case "learning":
		items, _, err := s.ListLearningCourses(ctx, scope, 1, 100)
		if err != nil {
			return false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				return true, nil
			}
		}
		return false, nil
	case "agent_run", "audit_event":
		if ref.Type == "agent_run" {
			var actorUserID *string
			err := s.pool.QueryRow(ctx, `SELECT actor_user_id::text FROM agent_runs WHERE id = $1`, ref.ID).Scan(&actorUserID)
			if err != nil {
				return false, nil
			}
			return scope.Global || (actorUserID != nil && *actorUserID == actor.UserID), nil
		}
		var actorUserID *string
		var scopeType string
		var scopeID *string
		err := s.pool.QueryRow(ctx, `SELECT actor_user_id::text, scope_type, scope_id::text FROM audit_events WHERE id = $1`, ref.ID).Scan(&actorUserID, &scopeType, &scopeID)
		if err != nil {
			return false, nil
		}
		return scope.Global || (actorUserID != nil && *actorUserID == actor.UserID) || auditScopeVisible(scope, scopeType, scopeID), nil
	default:
		return false, nil
	}
}

func auditScopeVisible(scope Scope, scopeType string, scopeID *string) bool {
	if scopeID == nil {
		return scopeType == "global"
	}
	switch scopeType {
	case "legal_entity":
		return containsString(scope.legalIDs(), *scopeID)
	case "org_unit":
		return containsString(scope.orgIDs(), *scopeID)
	default:
		return false
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func (s *Store) ResolveBusinessRefs(ctx context.Context, scope Scope, actor rbac.Principal, refs []domain.BusinessRef) ([]domain.ContextItem, error) {
	items := make([]domain.ContextItem, 0, len(refs))
	for _, ref := range refs {
		item, ok, err := s.resolveBusinessRef(ctx, scope, actor, ref)
		if err != nil {
			return nil, err
		}
		if ok {
			items = append(items, item)
		}
	}
	return items, nil
}

func (s *Store) resolveBusinessRef(ctx context.Context, scope Scope, actor rbac.Principal, ref domain.BusinessRef) (domain.ContextItem, bool, error) {
	label := ref.Label
	if label == "" {
		label = ref.Type + ":" + ref.ID
	}
	base := domain.ContextItem{
		Type:       ref.Type,
		ID:         ref.ID,
		Label:      label,
		Source:     "postgres.business_ref",
		Provenance: ref.Type + "/" + ref.ID,
	}
	switch ref.Type {
	case "employee", "user":
		employee, err := s.GetEmployee(ctx, scope, ref.ID)
		if err != nil {
			if err == ErrNotFound {
				return base, false, nil
			}
			return base, false, err
		}
		position := "未绑定主岗位"
		orgUnit := ""
		if employee.PrimaryAssignment != nil {
			position = employee.PrimaryAssignment.PositionTitle
			if employee.PrimaryAssignment.OrgUnitName != nil {
				orgUnit = *employee.PrimaryAssignment.OrgUnitName
			}
		}
		base.Label = employee.Name
		base.Summary = fmt.Sprintf("员工 %s，状态=%s，主岗位=%s。", employee.Name, employee.Status, position)
		base.Metadata = map[string]any{"employeeNo": employee.EmployeeNo, "orgUnit": orgUnit}
		return base, true, nil
	case "legal_entity":
		items, err := s.ListLegalEntities(ctx, scope)
		if err != nil {
			return base, false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				base.Label = item.Name
				base.Summary = fmt.Sprintf("法人实体 %s，区域=%s，状态=%s。", item.Name, item.Area, item.Status)
				base.Metadata = map[string]any{"code": item.Code}
				return base, true, nil
			}
		}
	case "org_unit":
		items, err := s.ListOrgUnits(ctx, scope)
		if err != nil {
			return base, false, err
		}
		for _, item := range items {
			if item.ID == ref.ID {
				base.Label = item.Name
				base.Summary = fmt.Sprintf("组织单元 %s，类型=%s，负责人=%s。", item.Name, item.Type, item.ManagerName)
				base.Metadata = map[string]any{"code": item.Code}
				return base, true, nil
			}
		}
	case "rag_document":
		doc, err := s.GetRAGDocument(ctx, scope, actor, ref.ID)
		if err != nil {
			if err == ErrNotFound {
				return base, false, nil
			}
			return base, false, err
		}
		base.Label = doc.Title
		base.Summary = fmt.Sprintf("知识资料 %s，trustLevel=%s，sensitivity=%s，status=%s。", doc.Title, doc.TrustLevel, doc.Sensitivity, doc.Status)
		base.RiskLevel = sensitivityRisk(doc.Sensitivity)
		base.Metadata = map[string]any{"trustLevel": doc.TrustLevel, "sensitivity": doc.Sensitivity, "version": doc.Version}
		return base, true, nil
	case "learning":
		courses, _, err := s.ListLearningCourses(ctx, scope, 1, 200)
		if err != nil {
			return base, false, err
		}
		for _, course := range courses {
			if course.ID == ref.ID {
				base.Label = course.Title
				base.Summary = fmt.Sprintf("学习课程 %s，课时=%d，状态=%s。", course.Title, course.LessonCount, course.Status)
				return base, true, nil
			}
		}
	case "agent_run":
		var run domain.AgentRun
		err := s.pool.QueryRow(ctx, `
			SELECT id::text, run_type, status, actor_user_id::text, provider, model, risk_level, summary, created_at
			FROM agent_runs
			WHERE id = $1
		`, ref.ID).Scan(&run.ID, &run.RunType, &run.Status, &run.ActorUserID, &run.Provider, &run.Model, &run.RiskLevel, &run.Summary, &run.CreatedAt)
		if err != nil {
			return base, false, nil
		}
		if !scope.Global && (run.ActorUserID == nil || *run.ActorUserID != actor.UserID) {
			return base, false, nil
		}
		base.Label = run.RunType
		base.Summary = fmt.Sprintf("Agent run %s，status=%s，riskLevel=%s，provider=%s/%s。%s", run.RunType, run.Status, run.RiskLevel, run.Provider, run.Model, run.Summary)
		base.RiskLevel = run.RiskLevel
		base.Metadata = map[string]any{"status": run.Status, "provider": run.Provider, "model": run.Model}
		return base, true, nil
	case "audit_event":
		var event domain.AuditEvent
		var oldRaw, newRaw []byte
		err := s.pool.QueryRow(ctx, `
			SELECT id::text, actor_user_id::text, event_type, object_type, object_id,
			       scope_type, scope_id::text, request_id, source, risk_level,
			       old_value_summary, new_value_summary, created_at
			FROM audit_events
			WHERE id = $1
		`, ref.ID).Scan(&event.ID, &event.ActorUserID, &event.EventType, &event.ObjectType, &event.ObjectID,
			&event.ScopeType, &event.ScopeID, &event.RequestID, &event.Source, &event.RiskLevel,
			&oldRaw, &newRaw, &event.CreatedAt)
		if err != nil {
			return base, false, nil
		}
		if !scope.Global && (event.ActorUserID == nil || *event.ActorUserID != actor.UserID) && !auditScopeVisible(scope, event.ScopeType, event.ScopeID) {
			return base, false, nil
		}
		event.OldValueSummary = map[string]any{}
		event.NewValueSummary = map[string]any{}
		_ = json.Unmarshal(oldRaw, &event.OldValueSummary)
		_ = json.Unmarshal(newRaw, &event.NewValueSummary)
		base.Label = event.EventType
		base.Summary = fmt.Sprintf("审计事件 %s，object=%s/%s，riskLevel=%s，source=%s。", event.EventType, event.ObjectType, event.ObjectID, event.RiskLevel, event.Source)
		base.RiskLevel = event.RiskLevel
		base.Metadata = map[string]any{"objectType": event.ObjectType, "objectId": event.ObjectID, "summary": event.NewValueSummary}
		return base, true, nil
	default:
		base.Summary = "未登记业务对象类型；只能作为页面选区上下文使用。"
		return base, true, nil
	}
	return base, false, nil
}

func sensitivityRisk(sensitivity string) string {
	switch strings.ToLower(sensitivity) {
	case "restricted", "sensitive", "secret":
		return "high"
	case "internal":
		return "medium"
	default:
		return "low"
	}
}

func (s *Store) CreateVisualCopilotEvent(ctx context.Context, userID string, req domain.VisualContextRequest, status, intent string, confidence float64, result map[string]any) (*domain.VisualCopilotEvent, error) {
	refs := collectBusinessRefs(req.Regions)
	regionsJSON, err := json.Marshal(req.Regions)
	if err != nil {
		return nil, err
	}
	domJSON, err := json.Marshal(map[string]any{
		"nodeCount": len(req.DOM),
		"viewport":  req.Viewport,
	})
	if err != nil {
		return nil, err
	}
	refsJSON, err := json.Marshal(refs)
	if err != nil {
		return nil, err
	}
	resultJSON, err := json.Marshal(nonNilMap(result))
	if err != nil {
		return nil, err
	}
	screenshotHash := ""
	if req.Screenshot != nil {
		if data, ok := req.Screenshot["dataBase64"].(string); ok && data != "" {
			sum := sha256.Sum256([]byte(data))
			screenshotHash = hex.EncodeToString(sum[:])
		}
	}
	var event domain.VisualCopilotEvent
	var regionsRaw, refsRaw []byte
	err = s.pool.QueryRow(ctx, `
		INSERT INTO visual_copilot_events (
			actor_user_id, route, instruction, regions, dom_summary, screenshot_hash,
			business_refs, intent, confidence, status, result
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING id::text, actor_user_id::text, route, instruction, regions, business_refs, intent, confidence, status, created_at
	`, userID, req.Route, req.Instruction, regionsJSON, domJSON, screenshotHash, refsJSON,
		intent, confidence, status, resultJSON).Scan(&event.ID, &event.ActorUserID, &event.Route,
		&event.Instruction, &regionsRaw, &refsRaw, &event.Intent, &event.Confidence, &event.Status,
		&event.CreatedAt)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(regionsRaw, &event.Regions)
	_ = json.Unmarshal(refsRaw, &event.BusinessRefs)
	return &event, nil
}

func (s *Store) ListVisualCopilotEvents(ctx context.Context, userID string, page, size int) ([]domain.VisualCopilotEvent, int64, error) {
	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM visual_copilot_events WHERE actor_user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, actor_user_id::text, route, instruction, regions, business_refs, intent, confidence, status, created_at
		FROM visual_copilot_events
		WHERE actor_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, size, (page-1)*size)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var events []domain.VisualCopilotEvent
	for rows.Next() {
		var event domain.VisualCopilotEvent
		var regionsRaw, refsRaw []byte
		if err := rows.Scan(&event.ID, &event.ActorUserID, &event.Route, &event.Instruction,
			&regionsRaw, &refsRaw, &event.Intent, &event.Confidence, &event.Status, &event.CreatedAt); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(regionsRaw, &event.Regions)
		_ = json.Unmarshal(refsRaw, &event.BusinessRefs)
		events = append(events, event)
	}
	return events, total, rows.Err()
}

func collectBusinessRefs(regions []domain.ScreenRegion) []domain.BusinessRef {
	seen := map[string]bool{}
	var refs []domain.BusinessRef
	for _, region := range regions {
		for _, ref := range region.BusinessRefs {
			key := ref.Type + ":" + ref.ID
			if !seen[key] {
				seen[key] = true
				refs = append(refs, ref)
			}
		}
	}
	return refs
}
