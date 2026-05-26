package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"ai-hrms/apps/api/internal/domain"
)

func (s *Store) ListEmployees(ctx context.Context, scope Scope, page, size int) ([]domain.Employee, int64, error) {
	where, args := assignmentScopeWhere(scope, "pa", 1)
	if where == "FALSE" {
		return []domain.Employee{}, 0, nil
	}

	countSQL := `
		SELECT count(*)
		FROM employees e
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
	query := employeeSelectSQL()
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY e.created_at DESC, e.name LIMIT $" + itoa(len(queryArgs)-1) + " OFFSET $" + itoa(len(queryArgs))
	rows, err := s.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	employees, err := scanEmployees(rows)
	return employees, total, err
}

func (s *Store) GetEmployee(ctx context.Context, scope Scope, id string) (*domain.Employee, error) {
	where, args := assignmentScopeWhere(scope, "pa", 2)
	if where == "FALSE" {
		return nil, ErrNotFound
	}
	query := employeeSelectSQL() + " WHERE e.id = $1"
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
	employees, err := scanEmployees(rows)
	if err != nil {
		return nil, err
	}
	if len(employees) == 0 {
		return nil, ErrNotFound
	}
	return &employees[0], nil
}

func employeeSelectSQL() string {
	return `
		SELECT e.id::text, e.user_id::text, e.employee_no, e.name, e.mobile, e.status,
			e.sex, e.date_of_birth, e.highest_degree_of_education, e.national_area,
			e.passport_no, e.id_number, e.native_place, e.nation, e.english_name,
			e.marital_status, e.birthday, e.zodiac, e.age, e.constellation,
			e.blood_type, e.domicile, e.political_outlook, e.qq, e.wechat,
			e.place_of_residence, e.postal_address, e.personal_mailbox,
			e.emergency_contact, e.emergency_contact_number, e.bank_card_number,
			e.opening_bank, e.graduate_school, e.major, e.home_company, e.title,
			e.resume, e.is_there_any_competition_restriction, e.remarks,
			pa.id::text, pa.legal_entity_id::text, le.name, pa.org_unit_id::text, ou.name,
			pa.position_title, pa.is_primary, pa.start_date, pa.end_date, pa.allocation_ratio, pa.employment_type
		FROM employees e
		LEFT JOIN employee_assignments pa ON pa.employee_id = e.id AND pa.is_primary AND pa.end_date IS NULL
		LEFT JOIN legal_entities le ON le.id = pa.legal_entity_id
		LEFT JOIN org_units ou ON ou.id = pa.org_unit_id
	`
}

func scanEmployees(rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}) ([]domain.Employee, error) {
	var employees []domain.Employee
	for rows.Next() {
		var item domain.Employee
		var assignment domain.Assignment
		var assignmentID *string
		err := rows.Scan(
			&item.ID, &item.UserID, &item.EmployeeNo, &item.Name, &item.Mobile, &item.Status,
			&item.Sex, &item.DateOfBirth, &item.HighestDegreeOfEducation, &item.NationalArea,
			&item.PassportNo, &item.IDNumber, &item.NativePlace, &item.Nation, &item.EnglishName,
			&item.MaritalStatus, &item.Birthday, &item.Zodiac, &item.Age, &item.Constellation,
			&item.BloodType, &item.Domicile, &item.PoliticalOutlook, &item.QQ, &item.Wechat,
			&item.PlaceOfResidence, &item.PostalAddress, &item.PersonalMailbox,
			&item.EmergencyContact, &item.EmergencyContactNumber, &item.BankCardNumber,
			&item.OpeningBank, &item.GraduateSchool, &item.Major, &item.HomeCompany, &item.Title,
			&item.Resume, &item.IsThereAnyCompetitionRestriction, &item.Remarks,
			&assignmentID, &assignment.LegalEntityID, &assignment.LegalEntityName,
			&assignment.OrgUnitID, &assignment.OrgUnitName, &assignment.PositionTitle,
			&assignment.IsPrimary, &assignment.StartDate, &assignment.EndDate, &assignment.AllocationRatio, &assignment.EmploymentType,
		)
		if err != nil {
			return nil, err
		}
		if assignmentID != nil {
			assignment.ID = *assignmentID
			item.PrimaryAssignment = &assignment
		}
		employees = append(employees, item)
	}
	return employees, rows.Err()
}

func assignmentScopeWhere(scope Scope, alias string, start int) (string, []any) {
	if scope.Global {
		return "", nil
	}
	parts := []string{}
	args := []any{}
	if cond, condArgs := whereIn(alias+".legal_entity_id::text", scope.legalIDs(), start); cond != "" {
		parts = append(parts, cond)
		args = append(args, condArgs...)
	}
	if cond, condArgs := whereIn(alias+".org_unit_id::text", scope.orgIDs(), start+len(args)); cond != "" {
		parts = append(parts, cond)
		args = append(args, condArgs...)
	}
	if len(parts) == 0 {
		return "FALSE", nil
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}

func (s *Store) CreateEmployee(ctx context.Context, employee domain.Employee) (*domain.Employee, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO employees (user_id, employee_no, name, mobile, status, sex, highest_degree_of_education, national_area, id_number, native_place, nation, birthday, zodiac, constellation, blood_type, domicile, political_outlook, qq, wechat, place_of_residence, postal_address, bank_card_number, graduate_school, major, home_company, is_there_any_competition_restriction, remarks)
		VALUES ($1,$2,$3,$4,COALESCE(NULLIF($5,''),'active'),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
		RETURNING id::text
	`, employee.UserID, employee.EmployeeNo, employee.Name, employee.Mobile, employee.Status, employee.Sex, employee.HighestDegreeOfEducation, employee.NationalArea, employee.IDNumber, employee.NativePlace, employee.Nation, employee.Birthday, employee.Zodiac, employee.Constellation, employee.BloodType, employee.Domicile, employee.PoliticalOutlook, employee.QQ, employee.Wechat, employee.PlaceOfResidence, employee.PostalAddress, employee.BankCardNumber, employee.GraduateSchool, employee.Major, employee.HomeCompany, employee.IsThereAnyCompetitionRestriction, employee.Remarks).Scan(&id)
	if err != nil {
		return nil, err
	}

	if employee.PrimaryAssignment != nil {
		_, err = tx.Exec(ctx, `
			INSERT INTO employee_assignments (employee_id, legal_entity_id, org_unit_id, position_title, is_primary, start_date, employment_type)
			VALUES ($1, $2, $3, $4, true, COALESCE($5, current_date), COALESCE(NULLIF($6,''),'full_time'))
		`, id, employee.PrimaryAssignment.LegalEntityID, employee.PrimaryAssignment.OrgUnitID, employee.PrimaryAssignment.PositionTitle, dateOrNil(employee.PrimaryAssignment.StartDate), employee.PrimaryAssignment.EmploymentType)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetEmployee(ctx, Scope{Global: true}, id)
}

func (s *Store) ListEmployeeAssignments(ctx context.Context, scope Scope, employeeID string) ([]domain.Assignment, error) {
	if _, err := s.GetEmployee(ctx, scope, employeeID); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT ea.id::text, ea.legal_entity_id::text, le.name, ea.org_unit_id::text, ou.name,
			ea.position_title, ea.is_primary, ea.start_date, ea.end_date, ea.allocation_ratio,
			ea.employment_type
		FROM employee_assignments ea
		LEFT JOIN legal_entities le ON le.id = ea.legal_entity_id
		LEFT JOIN org_units ou ON ou.id = ea.org_unit_id
		WHERE ea.employee_id = $1
		ORDER BY ea.end_date NULLS FIRST, ea.is_primary DESC, ea.start_date DESC
	`, employeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var assignments []domain.Assignment
	for rows.Next() {
		var item domain.Assignment
		if err := rows.Scan(&item.ID, &item.LegalEntityID, &item.LegalEntityName,
			&item.OrgUnitID, &item.OrgUnitName, &item.PositionTitle, &item.IsPrimary,
			&item.StartDate, &item.EndDate, &item.AllocationRatio, &item.EmploymentType); err != nil {
			return nil, err
		}
		assignments = append(assignments, item)
	}
	return assignments, rows.Err()
}

func (s *Store) ReplaceEmployeeAssignments(ctx context.Context, scope Scope, employeeID string, assignments []domain.Assignment) ([]domain.Assignment, error) {
	if _, err := s.GetEmployee(ctx, scope, employeeID); err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	primaryCurrent := 0
	for i := range assignments {
		if assignments[i].EmploymentType == "" {
			assignments[i].EmploymentType = "full_time"
		}
		if assignments[i].StartDate.IsZero() {
			assignments[i].StartDate = time.Now()
		}
		if assignments[i].IsPrimary && assignments[i].EndDate == nil {
			primaryCurrent++
		}
	}
	if primaryCurrent > 1 {
		return nil, errors.New("only one current primary assignment is allowed")
	}
	if primaryCurrent == 0 && len(assignments) > 0 {
		assignments[0].IsPrimary = true
	}

	if _, err := tx.Exec(ctx, `DELETE FROM employee_assignments WHERE employee_id = $1`, employeeID); err != nil {
		return nil, err
	}
	for _, assignment := range assignments {
		_, err := tx.Exec(ctx, `
			INSERT INTO employee_assignments (
				employee_id, legal_entity_id, org_unit_id, position_title, is_primary,
				start_date, end_date, allocation_ratio, employment_type
			)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE(NULLIF($9,''),'full_time'))
		`, employeeID, assignment.LegalEntityID, assignment.OrgUnitID, assignment.PositionTitle,
			assignment.IsPrimary, assignment.StartDate, assignment.EndDate, assignment.AllocationRatio,
			assignment.EmploymentType)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListEmployeeAssignments(ctx, scope, employeeID)
}

func (s *Store) UpdateEmployee(ctx context.Context, id string, employee domain.Employee) (*domain.Employee, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE employees
		SET name=$2, mobile=$3, status=$4, sex=$5, highest_degree_of_education=$6,
			national_area=$7, id_number=$8, native_place=$9, nation=$10, birthday=$11,
			zodiac=$12, constellation=$13, blood_type=$14, domicile=$15,
			political_outlook=$16, qq=$17, wechat=$18, place_of_residence=$19,
			postal_address=$20, bank_card_number=$21, graduate_school=$22, major=$23,
			home_company=$24, is_there_any_competition_restriction=$25, remarks=$26,
			updated_at=now()
		WHERE id=$1
	`, id, employee.Name, employee.Mobile, employee.Status, employee.Sex, employee.HighestDegreeOfEducation, employee.NationalArea, employee.IDNumber, employee.NativePlace, employee.Nation, employee.Birthday, employee.Zodiac, employee.Constellation, employee.BloodType, employee.Domicile, employee.PoliticalOutlook, employee.QQ, employee.Wechat, employee.PlaceOfResidence, employee.PostalAddress, employee.BankCardNumber, employee.GraduateSchool, employee.Major, employee.HomeCompany, employee.IsThereAnyCompetitionRestriction, employee.Remarks)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	if employee.PrimaryAssignment != nil {
		tag, err = tx.Exec(ctx, `
			UPDATE employee_assignments
			SET legal_entity_id=$2, org_unit_id=$3, position_title=$4,
				start_date=COALESCE($5, start_date, current_date),
				employment_type=COALESCE(NULLIF($6,''), employment_type, 'full_time')
			WHERE employee_id=$1 AND is_primary AND end_date IS NULL
		`, id, employee.PrimaryAssignment.LegalEntityID, employee.PrimaryAssignment.OrgUnitID, employee.PrimaryAssignment.PositionTitle, dateOrNil(employee.PrimaryAssignment.StartDate), employee.PrimaryAssignment.EmploymentType)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO employee_assignments (employee_id, legal_entity_id, org_unit_id, position_title, is_primary, start_date, employment_type)
				VALUES ($1, $2, $3, $4, true, COALESCE($5, current_date), COALESCE(NULLIF($6,''),'full_time'))
			`, id, employee.PrimaryAssignment.LegalEntityID, employee.PrimaryAssignment.OrgUnitID, employee.PrimaryAssignment.PositionTitle, dateOrNil(employee.PrimaryAssignment.StartDate), employee.PrimaryAssignment.EmploymentType)
			if err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetEmployee(ctx, Scope{Global: true}, id)
}

func dateOrNil(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value
}
