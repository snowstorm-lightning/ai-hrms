package store

import (
	"context"
	"strings"

	"ai-hrms/apps/api/internal/domain"
)

func (s *Store) ListAttendance(ctx context.Context, scope Scope, page, size int) ([]domain.Attendance, int64, error) {
	where, args := assignmentScopeWhere(scope, "pa", 1)
	if where == "FALSE" {
		return []domain.Attendance{}, 0, nil
	}
	countSQL := `SELECT count(*) FROM attendance_records ar JOIN employees e ON e.id=ar.employee_id LEFT JOIN employee_assignments pa ON pa.employee_id=e.id AND pa.is_primary AND pa.end_date IS NULL`
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
		SELECT ar.id::text, ar.employee_id::text, e.name, e.mobile, COALESCE(ou.name, ''),
			ar.attendance_status, ar.attendance_in_time, ar.attendance_out_time,
			ar.attendance_in_place, ar.day, ar.remarks
		FROM attendance_records ar
		JOIN employees e ON e.id = ar.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id=e.id AND pa.is_primary AND pa.end_date IS NULL
		LEFT JOIN org_units ou ON ou.id = pa.org_unit_id
	`
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY ar.day DESC, e.name LIMIT $" + itoa(len(queryArgs)-1) + " OFFSET $" + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []domain.Attendance
	for rows.Next() {
		var item domain.Attendance
		if err := rows.Scan(&item.ID, &item.EmployeeID, &item.EmployeeName, &item.Mobile, &item.OrgUnitName, &item.AttendanceStatus, &item.AttendanceInTime, &item.AttendanceOutTime, &item.AttendanceInPlace, &item.Day, &item.Remarks); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateAttendance(ctx context.Context, scope Scope, item domain.Attendance) (*domain.Attendance, error) {
	if _, err := s.GetEmployee(ctx, scope, item.EmployeeID); err != nil {
		return nil, err
	}

	var saved domain.Attendance
	err := s.pool.QueryRow(ctx, `
		INSERT INTO attendance_records (employee_id, attendance_status, attendance_in_time, day, remarks)
		VALUES ($1, $2, now(), current_date::text, $3)
		RETURNING id::text, employee_id::text, attendance_status, attendance_in_time, attendance_out_time, attendance_in_place, day, remarks
	`, item.EmployeeID, item.AttendanceStatus, item.Remarks).Scan(&saved.ID, &saved.EmployeeID, &saved.AttendanceStatus, &saved.AttendanceInTime, &saved.AttendanceOutTime, &saved.AttendanceInPlace, &saved.Day, &saved.Remarks)
	return &saved, err
}

func (s *Store) CheckoutAttendance(ctx context.Context, scope Scope, id string) (*domain.Attendance, error) {
	where, args := assignmentScopeWhere(scope, "pa", 2)
	if where == "FALSE" {
		return nil, ErrNotFound
	}

	var saved domain.Attendance
	queryArgs := []any{id}
	query := `
		UPDATE attendance_records ar
		SET attendance_out_time = now()
		FROM employees e
		LEFT JOIN employee_assignments pa ON pa.employee_id=e.id AND pa.is_primary AND pa.end_date IS NULL
		WHERE ar.id = $1 AND e.id = ar.employee_id
	`
	if where != "" {
		query += " AND " + where
		queryArgs = append(queryArgs, args...)
	}
	query += `
		RETURNING ar.id::text, ar.employee_id::text, ar.attendance_status, ar.attendance_in_time, ar.attendance_out_time, ar.attendance_in_place, ar.day, ar.remarks
	`
	err := s.pool.QueryRow(ctx, query, queryArgs...).Scan(&saved.ID, &saved.EmployeeID, &saved.AttendanceStatus, &saved.AttendanceInTime, &saved.AttendanceOutTime, &saved.AttendanceInPlace, &saved.Day, &saved.Remarks)
	return &saved, notFound(err)
}

func (s *Store) ListMessages(ctx context.Context, scope Scope, page, size int) ([]domain.Message, int64, error) {
	where, args := messageScopeWhere(scope, 1)
	var total int64
	countSQL := `SELECT count(*) FROM messages m`
	if where != "" {
		countSQL += " WHERE " + where
	}
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	query := `
		SELECT m.id::text, m.title, m.category, m.content, COALESCE(u.username, ''),
			COALESCE(ou.name, ''), m.scope_type, m.scope_id::text, m.star, m.view_count, m.created_at
		FROM messages m
		LEFT JOIN users u ON u.id = m.author_user_id
		LEFT JOIN org_units ou ON ou.id = m.org_unit_id
	`
	if where != "" {
		query += " WHERE " + where
	}
	query += `
		ORDER BY m.created_at DESC
		LIMIT $` + itoa(len(queryArgs)-1) + ` OFFSET $` + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []domain.Message
	for rows.Next() {
		var item domain.Message
		if err := rows.Scan(&item.ID, &item.Title, &item.Category, &item.Content, &item.Author, &item.OrgUnitName, &item.ScopeType, &item.ScopeID, &item.Star, &item.View, &item.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateMessage(ctx context.Context, scope Scope, item domain.Message, userID string) (*domain.Message, error) {
	if item.ScopeType == "" {
		item.ScopeType, item.ScopeID = defaultMessageScope(scope)
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO messages (title, category, content, author_user_id, scope_type, scope_id, org_unit_id)
		VALUES ($1, COALESCE(NULLIF($2,''),'general'), $3, $4, $5, $6, CASE WHEN $5 = 'org_unit' THEN $6 ELSE NULL END)
		RETURNING id::text
	`, item.Title, item.Category, item.Content, userID, item.ScopeType, item.ScopeID).Scan(&id)
	if err != nil {
		return nil, err
	}
	items, _, err := s.ListMessages(ctx, Scope{Global: true}, 1, 100)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == id {
			return &item, nil
		}
	}
	return nil, ErrNotFound
}

func (s *Store) ListComments(ctx context.Context, scope Scope, messageID string) ([]domain.Comment, error) {
	if ok, err := s.messageVisible(ctx, scope, messageID); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrNotFound
	}
	rows, err := s.pool.Query(ctx, `
		SELECT c.id::text, c.message_id::text, c.content, COALESCE(u.username, ''), '', c.created_at
		FROM comments c
		LEFT JOIN users u ON u.id = c.author_user_id
		WHERE c.message_id = $1
		ORDER BY c.created_at
	`, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.Comment
	for rows.Next() {
		var item domain.Comment
		if err := rows.Scan(&item.ID, &item.MessageID, &item.Content, &item.Username, &item.OrgUnitName, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) CreateComment(ctx context.Context, scope Scope, messageID, userID string, item domain.Comment) (*domain.Comment, error) {
	if ok, err := s.messageVisible(ctx, scope, messageID); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrNotFound
	}
	var saved domain.Comment
	err := s.pool.QueryRow(ctx, `
		INSERT INTO comments (message_id, author_user_id, content)
		VALUES ($1, $2, $3)
		RETURNING id::text, message_id::text, content, created_at
	`, messageID, userID, item.Content).Scan(&saved.ID, &saved.MessageID, &saved.Content, &saved.CreatedAt)
	return &saved, err
}

func messageScopeWhere(scope Scope, start int) (string, []any) {
	if scope.Global {
		return "", nil
	}
	parts := []string{"m.scope_type = 'global'"}
	args := []any{}
	if cond, condArgs := whereIn("m.scope_id::text", scope.legalIDs(), start); cond != "" {
		parts = append(parts, "(m.scope_type = 'legal_entity' AND "+cond+")")
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn("m.scope_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, "(m.scope_type = 'org_unit' AND "+cond+")")
		args = append(args, condArgs...)
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}

func (s *Store) messageVisible(ctx context.Context, scope Scope, messageID string) (bool, error) {
	where, args := messageScopeWhere(scope, 2)
	query := `SELECT 1 FROM messages m WHERE m.id = $1`
	queryArgs := []any{messageID}
	if where != "" {
		query += " AND " + where
		queryArgs = append(queryArgs, args...)
	}
	var exists int
	err := s.pool.QueryRow(ctx, query, queryArgs...).Scan(&exists)
	err = notFound(err)
	if err == ErrNotFound {
		return false, nil
	}
	return err == nil, err
}

func defaultMessageScope(scope Scope) (string, *string) {
	if scope.Global {
		return "global", nil
	}
	orgIDs := scope.orgIDs()
	if len(orgIDs) > 0 {
		return "org_unit", &orgIDs[0]
	}
	legalIDs := scope.legalIDs()
	if len(legalIDs) > 0 {
		return "legal_entity", &legalIDs[0]
	}
	return "global", nil
}
