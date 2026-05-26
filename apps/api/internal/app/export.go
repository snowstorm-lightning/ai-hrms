package app

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"ai-hrms/apps/api/internal/domain"
	"ai-hrms/apps/api/internal/httpx"
)

func (s *Server) exportEmployees(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	rows, _, err := s.store.ListEmployees(r.Context(), scope, 1, 10000)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	writeEmployeeCSV(w, rows)
}

func (s *Server) exportAttendance(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.scope(r)
	if !ok {
		httpx.Error(w, http.StatusInternalServerError, 5000, "解析权限失败")
		return
	}
	rows, _, err := s.store.ListAttendance(r.Context(), scope, 1, 10000)
	if err != nil {
		s.respondErr(w, err)
		return
	}
	writeAttendanceCSV(w, rows)
}

func writeCSV(w http.ResponseWriter, filename string, header []string, rows [][]string) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
	writer := csv.NewWriter(w)
	_ = writer.Write(header)
	_ = writer.WriteAll(rows)
	writer.Flush()
}

func writeEmployeeCSV(w http.ResponseWriter, employees []domain.Employee) {
	rows := make([][]string, 0, len(employees))
	for _, employee := range employees {
		legalEntityName := ""
		orgUnitName := ""
		position := ""
		if employee.PrimaryAssignment != nil {
			if employee.PrimaryAssignment.LegalEntityName != nil {
				legalEntityName = *employee.PrimaryAssignment.LegalEntityName
			}
			if employee.PrimaryAssignment.OrgUnitName != nil {
				orgUnitName = *employee.PrimaryAssignment.OrgUnitName
			}
			position = employee.PrimaryAssignment.PositionTitle
		}
		rows = append(rows, []string{
			employee.EmployeeNo,
			employee.Name,
			employee.Mobile,
			legalEntityName,
			orgUnitName,
			position,
			employee.Status,
			employee.HighestDegreeOfEducation,
			employee.IDNumber,
			employee.Remarks,
		})
	}
	writeCSV(w, "employees.csv", []string{"工号", "姓名", "手机号", "法人实体", "组织单元", "岗位", "状态", "学历", "身份证号", "备注"}, rows)
}

func writeAttendanceCSV(w http.ResponseWriter, records []domain.Attendance) {
	rows := make([][]string, 0, len(records))
	for _, record := range records {
		inTime := ""
		outTime := ""
		if record.AttendanceInTime != nil {
			inTime = record.AttendanceInTime.Format("2006-01-02 15:04:05")
		}
		if record.AttendanceOutTime != nil {
			outTime = record.AttendanceOutTime.Format("2006-01-02 15:04:05")
		}
		rows = append(rows, []string{
			record.Day,
			record.EmployeeName,
			record.Mobile,
			record.OrgUnitName,
			strconv.Itoa(record.AttendanceStatus),
			inTime,
			outTime,
			record.Remarks,
		})
	}
	writeCSV(w, "attendance.csv", []string{"日期", "员工", "手机号", "组织单元", "状态", "签到时间", "签退时间", "备注"}, rows)
}
