package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"ai-hrms/apps/api/internal/domain"
	"github.com/jackc/pgx/v5"
)

type hrResourceConfig struct {
	Resource           string
	Table              string
	Module             string
	ModuleLabel        string
	RecordType         string
	DefaultTitle       string
	DefaultStatus      string
	DefaultRisk        string
	DefaultHumanReview bool
}

var hrResourceConfigs = []hrResourceConfig{
	{Resource: "leave-applications", Table: "leave_applications", Module: "employee_ops", ModuleLabel: "员工事务", RecordType: "Leave Application", DefaultTitle: "请假申请", DefaultStatus: "submitted", DefaultRisk: "medium", DefaultHumanReview: true},
	{Resource: "attendance-requests", Table: "attendance_requests", Module: "employee_ops", ModuleLabel: "员工事务", RecordType: "Attendance Request", DefaultTitle: "补卡/外勤申请", DefaultStatus: "submitted", DefaultRisk: "medium", DefaultHumanReview: true},
	{Resource: "shift-assignments", Table: "shift_assignments", Module: "employee_ops", ModuleLabel: "员工事务", RecordType: "Shift Assignment", DefaultTitle: "排班分配", DefaultStatus: "active", DefaultRisk: "low", DefaultHumanReview: false},
	{Resource: "expense-claims", Table: "expense_claims", Module: "employee_ops", ModuleLabel: "员工事务", RecordType: "Expense Claim", DefaultTitle: "报销申请", DefaultStatus: "submitted", DefaultRisk: "medium", DefaultHumanReview: true},
	{Resource: "salary-slips", Table: "salary_slips", Module: "employee_ops", ModuleLabel: "员工事务", RecordType: "Salary Slip", DefaultTitle: "工资单", DefaultStatus: "draft", DefaultRisk: "high", DefaultHumanReview: true},
	{Resource: "job-requisitions", Table: "job_requisitions", Module: "recruitment_lifecycle", ModuleLabel: "招聘与生命周期", RecordType: "Job Requisition", DefaultTitle: "招聘需求", DefaultStatus: "submitted", DefaultRisk: "medium", DefaultHumanReview: true},
	{Resource: "job-openings", Table: "job_openings", Module: "recruitment_lifecycle", ModuleLabel: "招聘与生命周期", RecordType: "Job Opening", DefaultTitle: "职位发布", DefaultStatus: "open", DefaultRisk: "medium", DefaultHumanReview: true},
	{Resource: "job-applicants", Table: "job_applicants", Module: "recruitment_lifecycle", ModuleLabel: "招聘与生命周期", RecordType: "Job Applicant", DefaultTitle: "候选人", DefaultStatus: "active", DefaultRisk: "high", DefaultHumanReview: true},
	{Resource: "interviews", Table: "interviews", Module: "recruitment_lifecycle", ModuleLabel: "招聘与生命周期", RecordType: "Interview", DefaultTitle: "面试", DefaultStatus: "scheduled", DefaultRisk: "high", DefaultHumanReview: true},
	{Resource: "job-offers", Table: "job_offers", Module: "recruitment_lifecycle", ModuleLabel: "招聘与生命周期", RecordType: "Job Offer", DefaultTitle: "Offer", DefaultStatus: "draft", DefaultRisk: "high", DefaultHumanReview: true},
	{Resource: "training-events", Table: "training_events", Module: "growth_performance", ModuleLabel: "成长与绩效", RecordType: "Training Event", DefaultTitle: "培训活动", DefaultStatus: "planned", DefaultRisk: "medium", DefaultHumanReview: false},
	{Resource: "performance-goals", Table: "performance_goals", Module: "growth_performance", ModuleLabel: "成长与绩效", RecordType: "Performance Goal", DefaultTitle: "绩效目标", DefaultStatus: "active", DefaultRisk: "medium", DefaultHumanReview: false},
	{Resource: "appraisal-cycles", Table: "appraisal_cycles", Module: "growth_performance", ModuleLabel: "成长与绩效", RecordType: "Appraisal Cycle", DefaultTitle: "绩效周期", DefaultStatus: "draft", DefaultRisk: "high", DefaultHumanReview: true},
	{Resource: "appraisals", Table: "appraisals", Module: "growth_performance", ModuleLabel: "成长与绩效", RecordType: "Appraisal", DefaultTitle: "绩效评估", DefaultStatus: "submitted", DefaultRisk: "high", DefaultHumanReview: true},
}

var (
	hrResourceByName     = indexHRResourceConfigs()
	ErrInvalidHRResource = errors.New("invalid hr resource")
)

func indexHRResourceConfigs() map[string]hrResourceConfig {
	index := map[string]hrResourceConfig{}
	for _, cfg := range hrResourceConfigs {
		index[cfg.Resource] = cfg
	}
	return index
}

func HRResourceNames() []string {
	names := make([]string, 0, len(hrResourceConfigs))
	for _, cfg := range hrResourceConfigs {
		names = append(names, cfg.Resource)
	}
	return names
}

func ValidHRResource(resource string) bool {
	_, ok := hrResourceByName[resource]
	return ok
}

func (s *Store) ListHRRecords(ctx context.Context, scope Scope, resource string, page, size int) ([]domain.HRRecord, int64, error) {
	cfg, ok := hrResourceByName[resource]
	if !ok {
		return nil, 0, ErrInvalidHRResource
	}
	where, args := hrRecordScopeWhere(scope, "r", "pa", "record_ou", 1)
	var total int64
	countSQL := "SELECT count(*) " + hrRecordFromSQL(cfg)
	if where != "" {
		countSQL += " WHERE " + where
	}
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	query := hrRecordSelectSQL(cfg)
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY r.updated_at DESC, r.created_at DESC LIMIT $" + itoa(len(queryArgs)-1) + " OFFSET $" + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanHRRecords(rows, cfg)
	if err != nil {
		return nil, 0, err
	}
	return items, total, rows.Err()
}

func (s *Store) CreateHRRecord(ctx context.Context, scope Scope, resource string, input domain.HRRecordInput) (*domain.HRRecord, error) {
	cfg, ok := hrResourceByName[resource]
	if !ok {
		return nil, ErrInvalidHRResource
	}
	input = normalizeHRRecordInput(scope, cfg, input, true)
	payload, err := json.Marshal(nonNilMap(input.Payload))
	if err != nil {
		return nil, err
	}
	var id string
	if err := s.pool.QueryRow(ctx, `
		INSERT INTO `+cfg.Table+` (
			employee_id, org_unit_id, title, status, risk_level,
			human_review_required, scope_type, scope_id, payload
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id::text
	`, input.EmployeeID, input.OrgUnitID, input.Title, input.Status, input.RiskLevel, input.HumanReviewRequired, input.ScopeType, input.ScopeID, payload).Scan(&id); err != nil {
		return nil, err
	}
	return s.GetHRRecord(ctx, scope, resource, id)
}

func (s *Store) UpdateHRRecord(ctx context.Context, scope Scope, resource, id string, input domain.HRRecordInput) (*domain.HRRecord, error) {
	cfg, ok := hrResourceByName[resource]
	if !ok {
		return nil, ErrInvalidHRResource
	}
	if _, err := s.GetHRRecord(ctx, scope, resource, id); err != nil {
		return nil, err
	}
	input = normalizeHRRecordInput(scope, cfg, input, false)
	payload, err := json.Marshal(nonNilMap(input.Payload))
	if err != nil {
		return nil, err
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE `+cfg.Table+`
		SET employee_id=$2, org_unit_id=$3, title=$4, status=$5, risk_level=$6,
			human_review_required=$7, scope_type=$8, scope_id=$9, payload=$10, updated_at=now()
		WHERE id=$1
	`, id, input.EmployeeID, input.OrgUnitID, input.Title, input.Status, input.RiskLevel, input.HumanReviewRequired, input.ScopeType, input.ScopeID, payload)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetHRRecord(ctx, scope, resource, id)
}

func (s *Store) GetHRRecord(ctx context.Context, scope Scope, resource, id string) (*domain.HRRecord, error) {
	cfg, ok := hrResourceByName[resource]
	if !ok {
		return nil, ErrInvalidHRResource
	}
	where, args := hrRecordScopeWhere(scope, "r", "pa", "record_ou", 2)
	queryArgs := []any{id}
	queryArgs = append(queryArgs, args...)
	query := hrRecordSelectSQL(cfg) + " WHERE r.id = $1"
	if where != "" {
		query += " AND " + where
	}
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := scanHRRecords(rows, cfg)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNotFound
	}
	return &items[0], nil
}

func (s *Store) WorkbenchOverview(ctx context.Context, scope Scope) (*domain.WorkbenchOverview, error) {
	overview := &domain.WorkbenchOverview{
		GeneratedAt: time.Now(),
		Period:      time.Now().Format("2006-01"),
		ScopeLabel:  scopeLabel(scope),
	}
	moduleIndex := map[string]*domain.WorkbenchModuleSummary{}
	for _, cfg := range hrResourceConfigs {
		where, args := hrRecordScopeWhere(scope, "r", "pa", "record_ou", 1)
		query := `
			SELECT r.status, r.risk_level, r.human_review_required, count(*)
		` + hrRecordFromSQL(cfg)
		if where != "" {
			query += " WHERE " + where
		}
		query += " GROUP BY r.status, r.risk_level, r.human_review_required"
		rows, err := s.pool.Query(ctx, query, args...)
		if err != nil {
			return nil, err
		}
		module := moduleIndex[cfg.Module]
		if module == nil {
			module = &domain.WorkbenchModuleSummary{Module: cfg.Module, Label: cfg.ModuleLabel, StatusCount: map[string]int{}}
			moduleIndex[cfg.Module] = module
			overview.Modules = append(overview.Modules, *module)
		}
		for rows.Next() {
			var status, risk string
			var humanReview bool
			var count int64
			if err := rows.Scan(&status, &risk, &humanReview, &count); err != nil {
				rows.Close()
				return nil, err
			}
			module.Total += count
			module.StatusCount[status] += int(count)
			overview.Total += count
			if hrStatusNeedsAction(status) || humanReview {
				module.Pending += count
				overview.Pending += count
			}
			if risk == "high" || humanReview {
				module.HighRisk += count
				overview.HighRisk += count
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	for i := range overview.Modules {
		if module := moduleIndex[overview.Modules[i].Module]; module != nil {
			overview.Modules[i] = *module
		}
	}
	return overview, nil
}

func (s *Store) WorkbenchWorkItems(ctx context.Context, scope Scope, page, size int) ([]domain.HRWorkItem, int64, error) {
	selects := []string{}
	args := []any{}
	for _, cfg := range hrResourceConfigs {
		where, scopeArgs := hrRecordScopeWhere(scope, "r", "pa", "record_ou", len(args)+1)
		args = append(args, scopeArgs...)
		query := hrWorkItemSelectSQL(cfg)
		conditions := []string{"(r.human_review_required OR r.status IN ('submitted','pending','draft','scheduled','planned','open','active','in_review'))"}
		if where != "" {
			conditions = append(conditions, where)
		}
		query += " WHERE " + strings.Join(conditions, " AND ")
		selects = append(selects, query)
	}
	union := strings.Join(selects, " UNION ALL ")
	var total int64
	if err := s.pool.QueryRow(ctx, "SELECT count(*) FROM ("+union+") work_items", args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, size, (page-1)*size)
	rows, err := s.pool.Query(ctx, `
		SELECT * FROM (`+union+`) work_items
		ORDER BY
			CASE WHEN risk_level = 'high' THEN 3 WHEN risk_level = 'medium' THEN 2 ELSE 1 END DESC,
			created_at DESC
		LIMIT $`+itoa(len(queryArgs)-1)+` OFFSET $`+itoa(len(queryArgs))+`
	`, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []domain.HRWorkItem{}
	for rows.Next() {
		var item domain.HRWorkItem
		if err := rows.Scan(
			&item.ID, &item.Resource, &item.Module, &item.RecordType, &item.Title,
			&item.EmployeeID, &item.EmployeeName, &item.OrgUnitID, &item.OrgUnitName,
			&item.Status, &item.RiskLevel, &item.HumanReviewRequired, &item.Action, &item.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func hrRecordSelectSQL(cfg hrResourceConfig) string {
	return `
		SELECT r.id::text, r.employee_id::text, COALESCE(e.name, ''),
			r.org_unit_id::text, COALESCE(record_ou.name, employee_ou.name, ''),
			r.title, r.scope_type, r.scope_id::text, r.status, r.risk_level,
			r.human_review_required, r.payload, r.created_at, r.updated_at
	` + hrRecordFromSQL(cfg)
}

func hrWorkItemSelectSQL(cfg hrResourceConfig) string {
	return `
		SELECT r.id::text, '` + cfg.Resource + `' AS resource, '` + cfg.Module + `' AS module,
			'` + cfg.RecordType + `' AS record_type, r.title, r.employee_id::text,
			COALESCE(e.name, ''), r.org_unit_id::text, COALESCE(record_ou.name, employee_ou.name, ''),
			r.status, r.risk_level, r.human_review_required,
			CASE
				WHEN r.human_review_required THEN 'human_review'
				WHEN r.status IN ('submitted','pending','in_review') THEN 'approve'
				ELSE 'review'
			END AS action,
			r.created_at
	` + hrRecordFromSQL(cfg)
}

func hrRecordFromSQL(cfg hrResourceConfig) string {
	return `
		FROM ` + cfg.Table + ` r
		LEFT JOIN employees e ON e.id = r.employee_id
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
		LEFT JOIN org_units employee_ou ON employee_ou.id = pa.org_unit_id
		LEFT JOIN org_units record_ou ON record_ou.id = r.org_unit_id
	`
}

func scanHRRecords(rows pgx.Rows, cfg hrResourceConfig) ([]domain.HRRecord, error) {
	items := []domain.HRRecord{}
	for rows.Next() {
		var item domain.HRRecord
		var payloadRaw []byte
		if err := rows.Scan(
			&item.ID, &item.EmployeeID, &item.EmployeeName, &item.OrgUnitID, &item.OrgUnitName,
			&item.Title, &item.ScopeType, &item.ScopeID, &item.Status, &item.RiskLevel,
			&item.HumanReviewRequired, &payloadRaw, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.Resource = cfg.Resource
		item.Module = cfg.Module
		item.RecordType = cfg.RecordType
		item.Payload = map[string]any{}
		_ = json.Unmarshal(payloadRaw, &item.Payload)
		items = append(items, item)
	}
	return items, rows.Err()
}

func normalizeHRRecordInput(scope Scope, cfg hrResourceConfig, input domain.HRRecordInput, create bool) domain.HRRecordInput {
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" {
		input.Title = cfg.DefaultTitle
	}
	input.Status = strings.TrimSpace(input.Status)
	if input.Status == "" {
		input.Status = cfg.DefaultStatus
	}
	input.RiskLevel = strings.TrimSpace(input.RiskLevel)
	if input.RiskLevel == "" {
		input.RiskLevel = cfg.DefaultRisk
	}
	if create && cfg.DefaultHumanReview {
		input.HumanReviewRequired = true
	}
	input.ScopeType = strings.TrimSpace(input.ScopeType)
	if input.ScopeType == "" {
		input.ScopeType, input.ScopeID = defaultHRRecordScope(scope)
	}
	if input.ScopeType == "global" {
		input.ScopeID = nil
	}
	if input.Payload == nil {
		input.Payload = map[string]any{}
	}
	return input
}

func defaultHRRecordScope(scope Scope) (string, *string) {
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

func hrRecordScopeWhere(scope Scope, recordAlias, assignmentAlias, recordOrgAlias string, start int) (string, []any) {
	if scope.Global {
		return "", nil
	}
	parts := []string{recordAlias + ".scope_type = 'global'"}
	args := []any{}
	if cond, condArgs := whereIn(recordAlias+".scope_id::text", scope.legalIDs(), start); cond != "" {
		parts = append(parts, "("+recordAlias+".scope_type = 'legal_entity' AND "+cond+")")
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(recordAlias+".scope_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, "("+recordAlias+".scope_type = 'org_unit' AND "+cond+")")
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(assignmentAlias+".legal_entity_id::text", scope.legalIDs(), start+len(args)); cond != "" {
		parts = append(parts, cond)
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(assignmentAlias+".org_unit_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, cond)
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(recordOrgAlias+".legal_entity_id::text", scope.legalIDs(), start+len(args)); cond != "" {
		parts = append(parts, cond)
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(recordAlias+".org_unit_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, cond)
		args = append(args, condArgs...)
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}

func hrStatusNeedsAction(status string) bool {
	switch status {
	case "submitted", "pending", "draft", "scheduled", "planned", "open", "active", "in_review":
		return true
	default:
		return false
	}
}

func scopeLabel(scope Scope) string {
	if scope.Global {
		return "global"
	}
	if len(scope.OrgUnitID) > 0 && len(scope.LegalEntityID) > 0 {
		return "mixed scope"
	}
	if len(scope.OrgUnitID) > 0 {
		return "org_unit"
	}
	if len(scope.LegalEntityID) > 0 {
		return "legal_entity"
	}
	return "empty scope"
}
