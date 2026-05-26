package store

import (
	"context"
	"encoding/json"

	"ai-hrms/apps/api/internal/domain"
)

type AuditInput struct {
	ActorUserID     string
	EventType       string
	ObjectType      string
	ObjectID        string
	ScopeType       string
	ScopeID         *string
	RequestID       string
	Source          string
	RiskLevel       string
	OldValueSummary map[string]any
	NewValueSummary map[string]any
}

func (s *Store) RecordAudit(ctx context.Context, input AuditInput) error {
	scopeType := input.ScopeType
	if scopeType == "" {
		scopeType = "global"
	}
	source := input.Source
	if source == "" {
		source = "api"
	}
	risk := input.RiskLevel
	if risk == "" {
		risk = "low"
	}
	oldSummary, err := json.Marshal(nonNilMap(input.OldValueSummary))
	if err != nil {
		return err
	}
	newSummary, err := json.Marshal(nonNilMap(input.NewValueSummary))
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO audit_events (
			actor_user_id, event_type, object_type, object_id, scope_type, scope_id,
			request_id, source, risk_level, old_value_summary, new_value_summary
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`, nullString(input.ActorUserID), input.EventType, input.ObjectType, input.ObjectID,
		scopeType, input.ScopeID, input.RequestID, source, risk, oldSummary, newSummary)
	return err
}

func (s *Store) ListAuditEvents(ctx context.Context, scope Scope, page, size int) ([]domain.AuditEvent, int64, error) {
	where := ""
	args := []any{}
	if !scope.Global {
		parts := []string{"scope_type = 'global'"}
		if cond, condArgs := whereIn("scope_id::text", scope.legalIDs(), 1); cond != "" {
			parts = append(parts, "(scope_type = 'legal_entity' AND "+cond+")")
			args = append(args, condArgs...)
		}
		if cond, condArgs := whereIn("scope_id::text", scope.orgIDs(), len(args)+1); cond != "" {
			parts = append(parts, "(scope_type = 'org_unit' AND "+cond+")")
			args = append(args, condArgs...)
		}
		where = "(" + stringsJoin(parts, " OR ") + ")"
	}

	countSQL := `SELECT count(*) FROM audit_events`
	if where != "" {
		countSQL += " WHERE " + where
	}
	var total int64
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	query := `
		SELECT id::text, actor_user_id::text, event_type, object_type, object_id,
			scope_type, scope_id::text, request_id, source, risk_level,
			old_value_summary, new_value_summary, created_at
		FROM audit_events
	`
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY created_at DESC LIMIT $" + itoa(len(queryArgs)-1) + " OFFSET $" + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var events []domain.AuditEvent
	for rows.Next() {
		var event domain.AuditEvent
		var oldRaw, newRaw []byte
		if err := rows.Scan(&event.ID, &event.ActorUserID, &event.EventType, &event.ObjectType, &event.ObjectID,
			&event.ScopeType, &event.ScopeID, &event.RequestID, &event.Source, &event.RiskLevel,
			&oldRaw, &newRaw, &event.CreatedAt); err != nil {
			return nil, 0, err
		}
		event.OldValueSummary = map[string]any{}
		event.NewValueSummary = map[string]any{}
		_ = json.Unmarshal(oldRaw, &event.OldValueSummary)
		_ = json.Unmarshal(newRaw, &event.NewValueSummary)
		events = append(events, event)
	}
	return events, total, rows.Err()
}

func nonNilMap(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	return value
}

func nullString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func stringsJoin(values []string, sep string) string {
	if len(values) == 0 {
		return ""
	}
	out := values[0]
	for _, value := range values[1:] {
		out += sep + value
	}
	return out
}
