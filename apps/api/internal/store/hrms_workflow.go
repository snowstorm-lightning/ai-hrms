package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/rbac"
	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalidWorkflowAction = errors.New("invalid workflow action")
	ErrWorkflowCapability    = errors.New("workflow capability required")
)

type workflowTransition struct {
	Action          string
	Label           string
	FromStatuses    []string
	NextStatus      string
	Variant         string
	RequiresComment bool
}

var workflowTransitions = []workflowTransition{
	{Action: "submit", Label: "提交", FromStatuses: []string{"draft"}, NextStatus: "submitted", Variant: "primary"},
	{Action: "start_review", Label: "开始复核", FromStatuses: []string{"submitted", "pending", "waiting_human_review", "open", "scheduled", "planned", "active"}, NextStatus: "in_review", Variant: "default"},
	{Action: "approve", Label: "批准", FromStatuses: []string{"submitted", "pending", "waiting_human_review", "open", "scheduled", "planned", "active", "in_review"}, NextStatus: "approved", Variant: "primary"},
	{Action: "reject", Label: "驳回", FromStatuses: []string{"submitted", "pending", "waiting_human_review", "open", "scheduled", "planned", "active", "in_review"}, NextStatus: "rejected", Variant: "danger", RequiresComment: true},
	{Action: "cancel", Label: "取消已批准", FromStatuses: []string{"approved"}, NextStatus: "cancelled", Variant: "default", RequiresComment: true},
}

func (s *Store) GetHRWorkflow(ctx context.Context, scope Scope, principal rbac.Principal, resource, id string) (*domain.HRWorkflow, error) {
	record, err := s.GetHRRecord(ctx, scope, resource, id)
	if err != nil {
		return nil, err
	}
	actions := workflowActionsForRecord(principal, *record)
	tasks, err := s.ListApprovalTasksForRecord(ctx, scope, resource, id)
	if err != nil {
		return nil, err
	}
	events, err := s.ListWorkflowEvents(ctx, scope, resource, id)
	if err != nil {
		return nil, err
	}
	return &domain.HRWorkflow{
		Record:        *record,
		Actions:       actions,
		Events:        events,
		ApprovalTasks: tasks,
	}, nil
}

func (s *Store) ApplyHRWorkflowAction(ctx context.Context, scope Scope, principal rbac.Principal, resource, id string, input domain.WorkflowActionInput) (*domain.WorkflowActionResult, error) {
	record, err := s.GetHRRecord(ctx, scope, resource, id)
	if err != nil {
		return nil, err
	}
	action := strings.TrimSpace(input.Action)
	transition, ok := workflowTransitionFor(action, record.Status)
	if !ok {
		return nil, ErrInvalidWorkflowAction
	}
	if transition.RequiresComment && strings.TrimSpace(input.Comment) == "" {
		return nil, ErrInvalidWorkflowAction
	}
	capability := workflowCapabilityForResource(resource)
	if capability != "" && !principal.HasCapability(capability) {
		return nil, ErrWorkflowCapability
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	nextHumanReview := record.HumanReviewRequired
	if transition.NextStatus == "approved" || transition.NextStatus == "rejected" || transition.NextStatus == "cancelled" {
		nextHumanReview = false
	}
	if transition.NextStatus == "submitted" || transition.NextStatus == "in_review" {
		nextHumanReview = true
	}

	cfg := hrResourceByName[resource]
	tag, err := tx.Exec(ctx, `
		UPDATE `+cfg.Table+`
		SET status = $2, human_review_required = $3, updated_at = now()
		WHERE id = $1
	`, id, transition.NextStatus, nextHumanReview)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	var eventID string
	var eventCreatedAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO hr_workflow_events (
			resource, record_id, actor_user_id, action, from_status, to_status,
			comment, scope_type, scope_id, risk_level
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id::text, created_at
	`, resource, id, principal.UserID, action, record.Status, transition.NextStatus, strings.TrimSpace(input.Comment), record.ScopeType, record.ScopeID, record.RiskLevel).Scan(&eventID, &eventCreatedAt); err != nil {
		return nil, err
	}

	if err := updateApprovalTaskForWorkflow(ctx, tx, principal.UserID, *record, action, transition.NextStatus, input.Comment); err != nil {
		return nil, err
	}
	if err := s.applyWorkflowSideEffects(ctx, tx, *record, action, transition.NextStatus); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	updated, err := s.GetHRRecord(ctx, scope, resource, id)
	if err != nil {
		return nil, err
	}
	workflow, err := s.GetHRWorkflow(ctx, scope, principal, resource, id)
	if err != nil {
		return nil, err
	}
	event := &domain.WorkflowEvent{
		ID:          eventID,
		Resource:    resource,
		RecordID:    id,
		ActorUserID: &principal.UserID,
		Action:      action,
		FromStatus:  record.Status,
		ToStatus:    transition.NextStatus,
		Comment:     strings.TrimSpace(input.Comment),
		CreatedAt:   eventCreatedAt,
	}
	return &domain.WorkflowActionResult{Record: *updated, Workflow: *workflow, Event: event}, nil
}

func workflowTransitionFor(action, currentStatus string) (workflowTransition, bool) {
	for _, transition := range workflowTransitions {
		if transition.Action != action {
			continue
		}
		for _, status := range transition.FromStatuses {
			if status == currentStatus {
				return transition, true
			}
		}
	}
	return workflowTransition{}, false
}

func workflowActionsForRecord(principal rbac.Principal, record domain.HRRecord) []domain.WorkflowAction {
	capability := workflowCapabilityForResource(record.Resource)
	hasCapability := capability == "" || principal.HasCapability(capability)
	actions := make([]domain.WorkflowAction, 0, len(workflowTransitions))
	for _, transition := range workflowTransitions {
		_, valid := workflowTransitionFor(transition.Action, record.Status)
		if !valid {
			continue
		}
		enabled := hasCapability
		reason := ""
		if !enabled {
			reason = "缺少权限：" + capability
		}
		actions = append(actions, domain.WorkflowAction{
			Action:          transition.Action,
			Label:           transition.Label,
			NextStatus:      transition.NextStatus,
			Variant:         transition.Variant,
			RequiresComment: transition.RequiresComment,
			Enabled:         enabled,
			Reason:          reason,
		})
	}
	return actions
}

func workflowCapabilityForResource(resource string) string {
	switch resource {
	case "leave-applications":
		return "leave.approve"
	case "attendance-requests", "shift-assignments":
		return "attendance.manage"
	case "job-requisitions", "job-openings", "job-applicants", "interviews", "job-offers":
		return "recruitment.manage"
	case "training-events", "performance-goals", "appraisal-cycles", "appraisals":
		return "performance.review"
	case "salary-slips":
		return "payroll.read_sensitive"
	case "expense-claims":
		return "employee.write"
	default:
		return "employee.write"
	}
}

func updateApprovalTaskForWorkflow(ctx context.Context, tx pgx.Tx, actorUserID string, record domain.HRRecord, action, nextStatus, comment string) error {
	switch nextStatus {
	case "submitted", "in_review":
		_, err := tx.Exec(ctx, `
			INSERT INTO hr_approval_tasks (
				resource, record_id, record_type, title, status, action,
				requested_by_user_id, scope_type, scope_id, risk_level, comment
			)
			VALUES ($1,$2,$3,$4,'open','review',$5,$6,$7,$8,$9)
			ON CONFLICT (resource, record_id) WHERE status = 'open'
			DO UPDATE SET
				title = EXCLUDED.title,
				record_type = EXCLUDED.record_type,
				action = 'review',
				risk_level = EXCLUDED.risk_level,
				comment = EXCLUDED.comment,
				updated_at = now()
		`, record.Resource, record.ID, record.RecordType, record.Title, actorUserID, record.ScopeType, record.ScopeID, record.RiskLevel, strings.TrimSpace(comment))
		return err
	case "approved", "rejected", "cancelled":
		taskStatus := nextStatus
		if nextStatus == "cancelled" {
			taskStatus = "cancelled"
		}
		_, err := tx.Exec(ctx, `
			UPDATE hr_approval_tasks
			SET status = $3, action = $4, assigned_to_user_id = COALESCE(assigned_to_user_id, $5),
				comment = $6, completed_at = now(), updated_at = now()
			WHERE resource = $1 AND record_id = $2 AND status = 'open'
		`, record.Resource, record.ID, taskStatus, action, actorUserID, strings.TrimSpace(comment))
		return err
	default:
		return nil
	}
}

func (s *Store) applyWorkflowSideEffects(ctx context.Context, tx pgx.Tx, record domain.HRRecord, action, nextStatus string) error {
	if record.Resource == "leave-applications" {
		return applyLeaveWorkflowSideEffect(ctx, tx, record, nextStatus)
	}
	if record.Resource == "attendance-requests" && nextStatus == "approved" {
		return applyAttendanceRequestSideEffect(ctx, tx, record.ID)
	}
	return nil
}

func applyLeaveWorkflowSideEffect(ctx context.Context, tx pgx.Tx, record domain.HRRecord, nextStatus string) error {
	switch nextStatus {
	case "approved":
		_, err := tx.Exec(ctx, `
			INSERT INTO leave_ledger_entries (
				employee_id, leave_type_id, leave_application_id, transaction_type,
				days, posting_date, from_date, to_date, source_type, source_id,
				scope_type, scope_id
			)
			SELECT
				employee_id, leave_type_id, id, 'leave_approved',
				-ABS(total_leave_days), COALESCE(from_date, current_date),
				from_date, to_date, 'leave_application', id, scope_type, scope_id
			FROM leave_applications
			WHERE id = $1
			  AND employee_id IS NOT NULL
			  AND total_leave_days <> 0
			ON CONFLICT DO NOTHING
		`, record.ID)
		return err
	case "cancelled":
		_, err := tx.Exec(ctx, `
			INSERT INTO leave_ledger_entries (
				employee_id, leave_type_id, leave_application_id, transaction_type,
				days, posting_date, from_date, to_date, source_type, source_id,
				scope_type, scope_id
			)
			SELECT
				employee_id, leave_type_id, id, 'leave_cancelled',
				ABS(total_leave_days), current_date,
				from_date, to_date, 'leave_application_cancel', id, scope_type, scope_id
			FROM leave_applications
			WHERE id = $1
			  AND employee_id IS NOT NULL
			  AND total_leave_days <> 0
			ON CONFLICT DO NOTHING
		`, record.ID)
		return err
	default:
		return nil
	}
}

func applyAttendanceRequestSideEffect(ctx context.Context, tx pgx.Tx, id string) error {
	var employeeID string
	var fromDate *time.Time
	var requestType, reason string
	err := tx.QueryRow(ctx, `
		SELECT employee_id::text, from_date, request_type, reason
		FROM attendance_requests
		WHERE id = $1 AND employee_id IS NOT NULL
	`, id).Scan(&employeeID, &fromDate, &requestType, &reason)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	day := time.Now().Format("2006-01-02")
	if fromDate != nil {
		day = fromDate.Format("2006-01-02")
	}
	status := 22
	switch requestType {
	case "field_work":
		status = 5
	case "business_trip":
		status = 6
	}
	remarks := strings.TrimSpace(reason)
	if remarks == "" {
		remarks = "补卡/外勤申请审批通过"
	}
	remarks += "（审批通过后写入考勤汇总，仅供人工复核）"
	return upsertAttendanceRecord(ctx, tx, employeeID, day, status, remarks, nil, nil)
}

func upsertAttendanceRecord(ctx context.Context, tx pgx.Tx, employeeID, day string, status int, remarks string, inTime, outTime *time.Time) error {
	var existingID string
	err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM attendance_records
		WHERE employee_id = $1 AND day = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, employeeID, day).Scan(&existingID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if existingID == "" {
		_, err = tx.Exec(ctx, `
			INSERT INTO attendance_records (
				employee_id, attendance_status, attendance_in_time, attendance_out_time, day, remarks
			)
			VALUES ($1,$2,$3,$4,$5,$6)
		`, employeeID, status, inTime, outTime, day, remarks)
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE attendance_records
		SET attendance_status = $2,
			attendance_in_time = COALESCE(attendance_in_time, $3),
			attendance_out_time = COALESCE($4, attendance_out_time),
			remarks = CASE WHEN remarks = '' THEN $5 ELSE remarks || '；' || $5 END
		WHERE id = $1
	`, existingID, status, inTime, outTime, remarks)
	return err
}

func (s *Store) ListWorkflowEvents(ctx context.Context, scope Scope, resource, id string) ([]domain.WorkflowEvent, error) {
	if _, err := s.GetHRRecord(ctx, scope, resource, id); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT e.id::text, e.resource, e.record_id::text, e.actor_user_id::text,
			COALESCE(u.username, ''), e.action, e.from_status, e.to_status,
			e.comment, e.created_at
		FROM hr_workflow_events e
		LEFT JOIN users u ON u.id = e.actor_user_id
		WHERE e.resource = $1 AND e.record_id = $2
		ORDER BY e.created_at DESC
	`, resource, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := []domain.WorkflowEvent{}
	for rows.Next() {
		var event domain.WorkflowEvent
		if err := rows.Scan(
			&event.ID, &event.Resource, &event.RecordID, &event.ActorUserID,
			&event.ActorName, &event.Action, &event.FromStatus, &event.ToStatus,
			&event.Comment, &event.CreatedAt,
		); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *Store) ListApprovalTasksForRecord(ctx context.Context, scope Scope, resource, id string) ([]domain.ApprovalTask, error) {
	if _, err := s.GetHRRecord(ctx, scope, resource, id); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, approvalTaskSelectSQL()+`
		WHERE t.resource = $1 AND t.record_id = $2
		ORDER BY t.status = 'open' DESC, t.created_at DESC
	`, resource, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanApprovalTasks(rows)
}

func approvalTaskSelectSQL() string {
	return `
		SELECT t.id::text, t.resource, t.record_id::text, t.record_type, t.title,
			t.status, t.action, t.assigned_to_user_id::text, COALESCE(assigned.username, ''),
			COALESCE(requested.username, ''), t.scope_type, t.scope_id::text, t.risk_level,
			t.comment, t.completed_at, t.created_at, t.updated_at
		FROM hr_approval_tasks t
		LEFT JOIN users assigned ON assigned.id = t.assigned_to_user_id
		LEFT JOIN users requested ON requested.id = t.requested_by_user_id
	`
}

func scanApprovalTasks(rows pgx.Rows) ([]domain.ApprovalTask, error) {
	tasks := []domain.ApprovalTask{}
	for rows.Next() {
		var task domain.ApprovalTask
		if err := rows.Scan(
			&task.ID, &task.Resource, &task.RecordID, &task.RecordType, &task.Title,
			&task.Status, &task.Action, &task.AssignedToUserID, &task.AssignedToName,
			&task.RequestedByName, &task.ScopeType, &task.ScopeID, &task.RiskLevel,
			&task.Comment, &task.CompletedAt, &task.CreatedAt, &task.UpdatedAt,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *Store) ListLeaveBalances(ctx context.Context, scope Scope, employeeID string) ([]domain.LeaveBalance, error) {
	where, args := assignmentScopeWhere(scope, "pa", 1)
	if where == "FALSE" {
		return []domain.LeaveBalance{}, nil
	}
	conditions := []string{}
	if where != "" {
		conditions = append(conditions, where)
	}
	if strings.TrimSpace(employeeID) != "" {
		args = append(args, employeeID)
		conditions = append(conditions, fmt.Sprintf("e.id = $%d", len(args)))
	}
	query := `
		SELECT e.id::text, e.name, COALESCE(lt.id::text, ''), COALESCE(lt.code, ''), COALESCE(lt.name, ''),
			la.period_start::text, la.period_end::text,
			COALESCE(SUM(la.allocated_days), 0)::float8,
			COALESCE(ledger.delta, 0)::float8
		FROM leave_allocations la
		JOIN employees e ON e.id = la.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
		LEFT JOIN leave_types lt ON lt.id = la.leave_type_id
		LEFT JOIN LATERAL (
			SELECT SUM(le.days) AS delta
			FROM leave_ledger_entries le
			WHERE le.employee_id = la.employee_id
			  AND (le.leave_type_id = la.leave_type_id OR (le.leave_type_id IS NULL AND la.leave_type_id IS NULL))
			  AND le.posting_date BETWEEN la.period_start AND la.period_end
		) ledger ON true
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += `
		GROUP BY e.id, e.name, lt.id, lt.code, lt.name, la.period_start, la.period_end, ledger.delta
		ORDER BY e.name, la.period_start DESC, lt.name
	`
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	balances := []domain.LeaveBalance{}
	for rows.Next() {
		var balance domain.LeaveBalance
		if err := rows.Scan(
			&balance.EmployeeID, &balance.EmployeeName, &balance.LeaveTypeID,
			&balance.LeaveTypeCode, &balance.LeaveTypeName, &balance.PeriodStart,
			&balance.PeriodEnd, &balance.AllocatedDays, &balance.LedgerDeltaDays,
		); err != nil {
			return nil, err
		}
		balance.UsedDays = -balance.LedgerDeltaDays
		if balance.UsedDays < 0 {
			balance.UsedDays = 0
		}
		balance.BalanceDays = balance.AllocatedDays + balance.LedgerDeltaDays
		balances = append(balances, balance)
	}
	return balances, rows.Err()
}

func (s *Store) ListEmployeeCheckins(ctx context.Context, scope Scope, employeeID string, page, size int) ([]domain.EmployeeCheckin, int64, error) {
	where, args := assignmentScopeWhere(scope, "pa", 1)
	if where == "FALSE" {
		return []domain.EmployeeCheckin{}, 0, nil
	}
	conditions := []string{}
	if where != "" {
		conditions = append(conditions, where)
	}
	if strings.TrimSpace(employeeID) != "" {
		args = append(args, employeeID)
		conditions = append(conditions, fmt.Sprintf("e.id = $%d", len(args)))
	}
	from := `
		FROM employee_checkins c
		JOIN employees e ON e.id = c.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
		LEFT JOIN org_units ou ON ou.id = pa.org_unit_id
	`
	if len(conditions) > 0 {
		from += " WHERE " + strings.Join(conditions, " AND ")
	}
	var total int64
	if err := s.pool.QueryRow(ctx, "SELECT count(*) "+from, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	rows, err := s.pool.Query(ctx, `
		SELECT c.id::text, c.employee_id::text, e.name, COALESCE(ou.name, ''),
			c.log_type, c.log_time, c.latitude::float8, c.longitude::float8,
			c.source, c.attendance_record_id::text, c.created_at
		`+from+`
		ORDER BY c.log_time DESC
		LIMIT $`+itoa(len(queryArgs)-1)+` OFFSET $`+itoa(len(queryArgs))+`
	`, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanEmployeeCheckins(rows)
	return items, total, err
}

func (s *Store) CreateEmployeeCheckin(ctx context.Context, scope Scope, actorUserID string, input domain.EmployeeCheckinInput) (*domain.EmployeeCheckin, error) {
	input.LogType = strings.ToUpper(strings.TrimSpace(input.LogType))
	if input.LogType != "IN" && input.LogType != "OUT" {
		return nil, ErrInvalidWorkflowAction
	}
	if strings.TrimSpace(input.EmployeeID) == "" {
		return nil, ErrInvalidWorkflowAction
	}
	if _, err := s.GetEmployee(ctx, scope, input.EmployeeID); err != nil {
		return nil, err
	}
	logTime := time.Now()
	if strings.TrimSpace(input.LogTime) != "" {
		parsed, err := time.Parse(time.RFC3339, input.LogTime)
		if err != nil {
			parsed, err = time.Parse("2006-01-02 15:04:05", input.LogTime)
		}
		if err != nil {
			return nil, ErrInvalidWorkflowAction
		}
		logTime = parsed
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = "web"
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	status := 1
	day := logTime.Format("2006-01-02")
	var inTime, outTime *time.Time
	if input.LogType == "IN" {
		inTime = &logTime
	} else {
		outTime = &logTime
	}
	if err := upsertAttendanceRecord(ctx, tx, input.EmployeeID, day, status, "员工自助打卡", inTime, outTime); err != nil {
		return nil, err
	}
	var attendanceID string
	if err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM attendance_records
		WHERE employee_id = $1 AND day = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, input.EmployeeID, day).Scan(&attendanceID); err != nil {
		return nil, err
	}
	var id string
	if err := tx.QueryRow(ctx, `
		INSERT INTO employee_checkins (
			employee_id, log_type, log_time, latitude, longitude, source,
			attendance_record_id, created_by_user_id
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id::text
	`, input.EmployeeID, input.LogType, logTime, input.Latitude, input.Longitude, source, attendanceID, actorUserID).Scan(&id); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	checkin, err := s.getEmployeeCheckin(ctx, scope, id)
	if err != nil {
		return nil, err
	}
	return checkin, nil
}

func (s *Store) getEmployeeCheckin(ctx context.Context, scope Scope, id string) (*domain.EmployeeCheckin, error) {
	where, args := assignmentScopeWhere(scope, "pa", 2)
	if where == "FALSE" {
		return nil, ErrNotFound
	}
	query := `
		SELECT c.id::text, c.employee_id::text, e.name, COALESCE(ou.name, ''),
			c.log_type, c.log_time, c.latitude::float8, c.longitude::float8,
			c.source, c.attendance_record_id::text, c.created_at
		FROM employee_checkins c
		JOIN employees e ON e.id = c.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
		LEFT JOIN org_units ou ON ou.id = pa.org_unit_id
		WHERE c.id = $1
	`
	queryArgs := []any{id}
	if where != "" {
		query += " AND " + where
		queryArgs = append(queryArgs, args...)
	}
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := scanEmployeeCheckins(rows)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNotFound
	}
	return &items[0], nil
}

func scanEmployeeCheckins(rows pgx.Rows) ([]domain.EmployeeCheckin, error) {
	items := []domain.EmployeeCheckin{}
	for rows.Next() {
		var item domain.EmployeeCheckin
		if err := rows.Scan(
			&item.ID, &item.EmployeeID, &item.EmployeeName, &item.OrgUnitName,
			&item.LogType, &item.LogTime, &item.Latitude, &item.Longitude,
			&item.Source, &item.AttendanceRecordID, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
