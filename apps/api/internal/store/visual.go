package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
)

func (s *Store) BusinessRefVisible(ctx context.Context, scope Scope, ref domain.BusinessRef) (bool, error) {
	if ref.ID == "" || ref.Type == "" {
		return false, nil
	}
	if scope.Global {
		return true, nil
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
		doc, err := s.GetRAGDocument(ctx, scope, nilPrincipal(), ref.ID)
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
	default:
		return false, nil
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

func nilPrincipal() rbac.Principal {
	return rbac.Principal{}
}
