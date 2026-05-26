package store

import (
	"context"
	"strings"

	"ai-hrms/apps/api/internal/domain"
)

func (s *Store) ListLearningCourses(ctx context.Context, scope Scope, page, size int) ([]domain.LearningCourse, int64, error) {
	where, args := scopedObjectWhere(scope, "lc", 1)
	countSQL := `SELECT count(*) FROM learning_courses lc`
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
		SELECT lc.id::text, lc.title, lc.description, lc.status, lc.scope_type, lc.scope_id::text,
			lc.created_by_user_id::text, lc.created_at, count(ll.id)::int
		FROM learning_courses lc
		LEFT JOIN learning_lessons ll ON ll.course_id = lc.id
	`
	if where != "" {
		query += " WHERE " + where
	}
	query += `
		GROUP BY lc.id
		ORDER BY lc.created_at DESC, lc.title
		LIMIT $` + itoa(len(queryArgs)-1) + ` OFFSET $` + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var courses []domain.LearningCourse
	for rows.Next() {
		var course domain.LearningCourse
		if err := rows.Scan(&course.ID, &course.Title, &course.Description, &course.Status,
			&course.ScopeType, &course.ScopeID, &course.CreatedByUserID, &course.CreatedAt,
			&course.LessonCount); err != nil {
			return nil, 0, err
		}
		courses = append(courses, course)
	}
	return courses, total, rows.Err()
}

func (s *Store) CreateLearningCourse(ctx context.Context, course domain.LearningCourse, userID string) (*domain.LearningCourse, error) {
	if course.Status == "" {
		course.Status = "draft"
	}
	if course.ScopeType == "" {
		course.ScopeType = "global"
	}
	var saved domain.LearningCourse
	err := s.pool.QueryRow(ctx, `
		INSERT INTO learning_courses (title, description, status, scope_type, scope_id, created_by_user_id)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id::text, title, description, status, scope_type, scope_id::text, created_by_user_id::text, created_at
	`, course.Title, course.Description, course.Status, course.ScopeType, course.ScopeID, userID).Scan(
		&saved.ID, &saved.Title, &saved.Description, &saved.Status, &saved.ScopeType,
		&saved.ScopeID, &saved.CreatedByUserID, &saved.CreatedAt)
	return &saved, err
}

func (s *Store) ListLearningLessons(ctx context.Context, courseID string) ([]domain.LearningLesson, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, course_id::text, title, content, sort_order, rag_document_id::text
		FROM learning_lessons
		WHERE course_id = $1
		ORDER BY sort_order, created_at
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var lessons []domain.LearningLesson
	for rows.Next() {
		var lesson domain.LearningLesson
		if err := rows.Scan(&lesson.ID, &lesson.CourseID, &lesson.Title, &lesson.Content, &lesson.SortOrder, &lesson.RAGDocumentID); err != nil {
			return nil, err
		}
		lessons = append(lessons, lesson)
	}
	return lessons, rows.Err()
}

func (s *Store) ListLearningEnrollments(ctx context.Context, scope Scope, page, size int) ([]domain.LearningEnrollment, int64, error) {
	where, args := assignmentScopeWhere(scope, "pa", 1)
	if where == "FALSE" {
		return []domain.LearningEnrollment{}, 0, nil
	}
	countSQL := `
		SELECT count(*)
		FROM learning_enrollments le
		JOIN employees e ON e.id = le.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
	`
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
		SELECT le.id::text, le.employee_id::text, e.name, le.course_id::text,
			lc.title, le.status, le.due_date, le.created_at
		FROM learning_enrollments le
		JOIN employees e ON e.id = le.employee_id
		JOIN learning_courses lc ON lc.id = le.course_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
	`
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY le.created_at DESC LIMIT $" + itoa(len(queryArgs)-1) + " OFFSET $" + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var enrollments []domain.LearningEnrollment
	for rows.Next() {
		var enrollment domain.LearningEnrollment
		if err := rows.Scan(&enrollment.ID, &enrollment.EmployeeID, &enrollment.EmployeeName,
			&enrollment.CourseID, &enrollment.CourseTitle, &enrollment.Status,
			&enrollment.DueDate, &enrollment.CreatedAt); err != nil {
			return nil, 0, err
		}
		enrollments = append(enrollments, enrollment)
	}
	return enrollments, total, rows.Err()
}

func (s *Store) ListLearningRecommendations(ctx context.Context, scope Scope, page, size int) ([]domain.LearningRecommendation, int64, error) {
	where, args := assignmentScopeWhere(scope, "pa", 1)
	if where == "FALSE" {
		return []domain.LearningRecommendation{}, 0, nil
	}
	countSQL := `
		SELECT count(*)
		FROM learning_recommendations lr
		LEFT JOIN employees e ON e.id = lr.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
	`
	if where != "" {
		countSQL += " WHERE lr.employee_id IS NULL OR " + where
	}
	var total int64
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	query := `
		SELECT lr.id::text, lr.employee_id::text, lr.recommendation_type, lr.title,
			lr.reason, lr.status, lr.created_at
		FROM learning_recommendations lr
		LEFT JOIN employees e ON e.id = lr.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
	`
	if where != "" {
		query += " WHERE lr.employee_id IS NULL OR " + where
	}
	query += " ORDER BY lr.created_at DESC LIMIT $" + itoa(len(queryArgs)-1) + " OFFSET $" + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var recommendations []domain.LearningRecommendation
	for rows.Next() {
		var recommendation domain.LearningRecommendation
		if err := rows.Scan(&recommendation.ID, &recommendation.EmployeeID, &recommendation.RecommendationType,
			&recommendation.Title, &recommendation.Reason, &recommendation.Status,
			&recommendation.CreatedAt); err != nil {
			return nil, 0, err
		}
		recommendations = append(recommendations, recommendation)
	}
	return recommendations, total, rows.Err()
}

func scopedObjectWhere(scope Scope, alias string, start int) (string, []any) {
	if scope.Global {
		return "", nil
	}
	parts := []string{alias + ".scope_type = 'global'"}
	args := []any{}
	if cond, condArgs := whereIn(alias+".scope_id::text", scope.legalIDs(), start); cond != "" {
		parts = append(parts, "("+alias+".scope_type = 'legal_entity' AND "+cond+")")
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(alias+".scope_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, "("+alias+".scope_type = 'org_unit' AND "+cond+")")
		args = append(args, condArgs...)
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}
