package domain

import (
	"sort"
	"strings"
	"time"
)

type AttendanceOverviewSource struct {
	EmployeeID              string
	EmployeeName            string
	Mobile                  string
	OrgUnitName             string
	AttendanceID            string
	AttendanceStatus        int
	AttendanceInTime        *time.Time
	AttendanceOutTime       *time.Time
	AttendanceInPlace       string
	Day                     string
	Remarks                 string
	ShiftType               string
	ShiftStartTime          string
	ShiftEndTime            string
	LeaveApplicationID      string
	LeaveType               string
	LeaveStatus             string
	AttendanceRequestID     string
	AttendanceRequestReason string
	AttendanceRequestStatus string
}

type AttendanceSummary struct {
	Expected       int     `json:"expected"`
	CheckedIn      int     `json:"checkedIn"`
	NotCheckedIn   int     `json:"notCheckedIn"`
	Leave          int     `json:"leave"`
	Late           int     `json:"late"`
	EarlyLeave     int     `json:"earlyLeave"`
	FieldOrTrip    int     `json:"fieldOrTrip"`
	Abnormal       int     `json:"abnormal"`
	AttendanceRate float64 `json:"attendanceRate"`
	RiskLevel      string  `json:"riskLevel"`
}

type AttendanceOrgUnitSummary struct {
	OrgUnitName    string  `json:"orgUnitName"`
	Expected       int     `json:"expected"`
	CheckedIn      int     `json:"checkedIn"`
	NotCheckedIn   int     `json:"notCheckedIn"`
	Leave          int     `json:"leave"`
	Late           int     `json:"late"`
	EarlyLeave     int     `json:"earlyLeave"`
	FieldOrTrip    int     `json:"fieldOrTrip"`
	Abnormal       int     `json:"abnormal"`
	AttendanceRate float64 `json:"attendanceRate"`
	RiskLevel      string  `json:"riskLevel"`
}

type AttendanceException struct {
	ID                      string     `json:"id"`
	EmployeeID              string     `json:"employeeId"`
	EmployeeName            string     `json:"employeeName"`
	Mobile                  string     `json:"mobile"`
	OrgUnitName             string     `json:"orgUnitName"`
	Day                     string     `json:"day"`
	AttendanceStatus        int        `json:"attendanceStatus"`
	StatusLabel             string     `json:"statusLabel"`
	ExceptionType           string     `json:"exceptionType"`
	Severity                string     `json:"severity"`
	Reason                  string     `json:"reason"`
	AttendanceInTime        *time.Time `json:"attendanceInTime"`
	AttendanceOutTime       *time.Time `json:"attendanceOutTime"`
	Remarks                 string     `json:"remarks"`
	ShiftType               string     `json:"shiftType"`
	ShiftStartTime          string     `json:"shiftStartTime"`
	ShiftEndTime            string     `json:"shiftEndTime"`
	LeaveApplicationID      string     `json:"leaveApplicationId"`
	LeaveType               string     `json:"leaveType"`
	LeaveStatus             string     `json:"leaveStatus"`
	AttendanceRequestID     string     `json:"attendanceRequestId"`
	AttendanceRequestReason string     `json:"attendanceRequestReason"`
	AttendanceRequestStatus string     `json:"attendanceRequestStatus"`
}

type AttendanceOverview struct {
	Day           string                     `json:"day"`
	GeneratedAt   time.Time                  `json:"generatedAt"`
	Summary       AttendanceSummary          `json:"summary"`
	OrgUnits      []AttendanceOrgUnitSummary `json:"orgUnits"`
	Exceptions    []AttendanceException      `json:"exceptions"`
	RecentRecords []Attendance               `json:"recentRecords"`
}

type AttendanceAgentAnalysisRequest struct {
	Day         string `json:"day"`
	Focus       string `json:"focus"`
	OrgUnitName string `json:"orgUnitName"`
}

type AttendanceAgentAnalysis struct {
	Run                *AgentRun           `json:"run"`
	ToolPreview        *ToolPreview        `json:"toolPreview,omitempty"`
	ExecutionDecision  *HarnessDecision    `json:"executionDecision,omitempty"`
	TrustPacket        *TrustPacket        `json:"trustPacket,omitempty"`
	Insights           []string            `json:"insights"`
	RecommendedActions []string            `json:"recommendedActions"`
	AuditPreview       []string            `json:"auditPreview"`
	Overview           *AttendanceOverview `json:"overview,omitempty"`
}

func BuildAttendanceOverview(day string, generatedAt time.Time, rows []AttendanceOverviewSource) AttendanceOverview {
	if strings.TrimSpace(day) == "" {
		day = generatedAt.Format("2006-01-02")
	}
	overview := AttendanceOverview{
		Day:         day,
		GeneratedAt: generatedAt,
		Summary:     AttendanceSummary{Expected: len(rows)},
	}
	orgs := map[string]*AttendanceOrgUnitSummary{}
	summaryAbnormal := map[string]bool{}
	orgAbnormal := map[string]map[string]bool{}

	for _, row := range rows {
		row.Day = firstNonEmpty(row.Day, day)
		row.OrgUnitName = normalizeOrgUnitName(row.OrgUnitName)
		org := orgs[row.OrgUnitName]
		if org == nil {
			org = &AttendanceOrgUnitSummary{OrgUnitName: row.OrgUnitName}
			orgs[row.OrgUnitName] = org
			orgAbnormal[row.OrgUnitName] = map[string]bool{}
		}
		org.Expected++

		hasRecord := strings.TrimSpace(row.AttendanceID) != ""
		if hasRecord {
			overview.RecentRecords = append(overview.RecentRecords, Attendance{
				ID:                row.AttendanceID,
				EmployeeID:        row.EmployeeID,
				EmployeeName:      row.EmployeeName,
				Mobile:            row.Mobile,
				OrgUnitName:       row.OrgUnitName,
				AttendanceStatus:  row.AttendanceStatus,
				AttendanceInTime:  row.AttendanceInTime,
				AttendanceOutTime: row.AttendanceOutTime,
				AttendanceInPlace: row.AttendanceInPlace,
				Day:               row.Day,
				Remarks:           row.Remarks,
			})
		}

		if row.AttendanceInTime != nil {
			overview.Summary.CheckedIn++
			org.CheckedIn++
		}
		switch {
		case !hasRecord || row.AttendanceStatus == 2:
			overview.Summary.NotCheckedIn++
			org.NotCheckedIn++
			addAttendanceException(&overview, row, "absence", "high", "未发现当天有效签到记录，需确认是否请假、外勤或补卡。", summaryAbnormal, orgAbnormal[row.OrgUnitName])
		case attendanceStatusIsLeave(row.AttendanceStatus):
			overview.Summary.Leave++
			org.Leave++
		case attendanceStatusIsFieldOrTrip(row.AttendanceStatus):
			overview.Summary.FieldOrTrip++
			org.FieldOrTrip++
		}
		if row.AttendanceStatus == 3 {
			overview.Summary.Late++
			org.Late++
			addAttendanceException(&overview, row, "late", "medium", "迟到信号需要结合排班、交通和请假记录人工复核。", summaryAbnormal, orgAbnormal[row.OrgUnitName])
		}
		if row.AttendanceStatus == 4 {
			overview.Summary.EarlyLeave++
			org.EarlyLeave++
			addAttendanceException(&overview, row, "early_leave", "medium", "早退信号需要结合排班、外勤和请假记录人工复核。", summaryAbnormal, orgAbnormal[row.OrgUnitName])
		}
		if attendanceMissingCheckout(row, generatedAt) {
			addAttendanceException(&overview, row, "missing_checkout", "medium", "已有签到但未发现签退，需确认是否忘记签退或记录同步延迟。", summaryAbnormal, orgAbnormal[row.OrgUnitName])
		}
	}

	overview.Summary.Abnormal = len(summaryAbnormal)
	overview.Summary.AttendanceRate = attendanceRate(overview.Summary.CheckedIn, overview.Summary.Expected)
	overview.Summary.RiskLevel = attendanceRiskLevel(overview.Summary.Abnormal, overview.Summary.Expected)

	for _, org := range orgs {
		org.Abnormal = len(orgAbnormal[org.OrgUnitName])
		org.AttendanceRate = attendanceRate(org.CheckedIn, org.Expected)
		org.RiskLevel = attendanceRiskLevel(org.Abnormal, org.Expected)
		overview.OrgUnits = append(overview.OrgUnits, *org)
	}

	sort.Slice(overview.OrgUnits, func(i, j int) bool {
		if overview.OrgUnits[i].Abnormal != overview.OrgUnits[j].Abnormal {
			return overview.OrgUnits[i].Abnormal > overview.OrgUnits[j].Abnormal
		}
		return overview.OrgUnits[i].OrgUnitName < overview.OrgUnits[j].OrgUnitName
	})
	sort.Slice(overview.Exceptions, func(i, j int) bool {
		left, right := severityRank(overview.Exceptions[i].Severity), severityRank(overview.Exceptions[j].Severity)
		if left != right {
			return left > right
		}
		if overview.Exceptions[i].OrgUnitName != overview.Exceptions[j].OrgUnitName {
			return overview.Exceptions[i].OrgUnitName < overview.Exceptions[j].OrgUnitName
		}
		return overview.Exceptions[i].EmployeeName < overview.Exceptions[j].EmployeeName
	})
	sort.Slice(overview.RecentRecords, func(i, j int) bool {
		left, right := overview.RecentRecords[i].AttendanceInTime, overview.RecentRecords[j].AttendanceInTime
		if left == nil || right == nil {
			return right == nil
		}
		return left.After(*right)
	})

	return overview
}

func addAttendanceException(overview *AttendanceOverview, row AttendanceOverviewSource, exceptionType, severity, reason string, summaryAbnormal map[string]bool, orgAbnormal map[string]bool) {
	id := row.AttendanceID
	if strings.TrimSpace(id) == "" {
		id = "missing-" + row.EmployeeID
	}
	overview.Exceptions = append(overview.Exceptions, AttendanceException{
		ID:                      id + "-" + exceptionType,
		EmployeeID:              row.EmployeeID,
		EmployeeName:            row.EmployeeName,
		Mobile:                  row.Mobile,
		OrgUnitName:             row.OrgUnitName,
		Day:                     row.Day,
		AttendanceStatus:        row.AttendanceStatus,
		StatusLabel:             AttendanceStatusLabel(row.AttendanceStatus),
		ExceptionType:           exceptionType,
		Severity:                severity,
		Reason:                  attendanceContextReason(reason, row),
		AttendanceInTime:        row.AttendanceInTime,
		AttendanceOutTime:       row.AttendanceOutTime,
		Remarks:                 row.Remarks,
		ShiftType:               row.ShiftType,
		ShiftStartTime:          row.ShiftStartTime,
		ShiftEndTime:            row.ShiftEndTime,
		LeaveApplicationID:      row.LeaveApplicationID,
		LeaveType:               row.LeaveType,
		LeaveStatus:             row.LeaveStatus,
		AttendanceRequestID:     row.AttendanceRequestID,
		AttendanceRequestReason: row.AttendanceRequestReason,
		AttendanceRequestStatus: row.AttendanceRequestStatus,
	})
	summaryAbnormal[row.EmployeeID] = true
	orgAbnormal[row.EmployeeID] = true
}

func attendanceContextReason(reason string, row AttendanceOverviewSource) string {
	context := []string{}
	if row.LeaveApplicationID != "" {
		context = append(context, "关联请假："+firstNonEmpty(row.LeaveType, row.LeaveStatus))
	}
	if row.AttendanceRequestID != "" {
		context = append(context, "关联补卡/外勤："+firstNonEmpty(row.AttendanceRequestReason, row.AttendanceRequestStatus))
	}
	if row.ShiftType != "" {
		context = append(context, "排班："+strings.TrimSpace(row.ShiftType+" "+row.ShiftStartTime+"-"+row.ShiftEndTime))
	}
	if len(context) == 0 {
		return reason
	}
	return reason + " 已发现上下文：" + strings.Join(context, "；") + "。"
}

func AttendanceStatusLabel(status int) string {
	switch status {
	case 1:
		return "正常"
	case 2:
		return "旷工"
	case 3:
		return "迟到"
	case 4:
		return "早退"
	case 5:
		return "外出"
	case 6:
		return "出差"
	case 7:
		return "年假"
	case 8:
		return "事假"
	case 9:
		return "病假"
	case 22:
		return "补签"
	default:
		return "未签到"
	}
}

func attendanceStatusIsLeave(status int) bool {
	return status == 7 || status == 8 || status == 9
}

func attendanceStatusIsFieldOrTrip(status int) bool {
	return status == 5 || status == 6
}

func attendanceMissingCheckout(row AttendanceOverviewSource, generatedAt time.Time) bool {
	if strings.TrimSpace(row.AttendanceID) == "" || row.AttendanceInTime == nil || row.AttendanceOutTime != nil {
		return false
	}
	if attendanceStatusIsLeave(row.AttendanceStatus) || attendanceStatusIsFieldOrTrip(row.AttendanceStatus) || row.AttendanceStatus == 2 {
		return false
	}
	return row.Day < generatedAt.Format("2006-01-02")
}

func attendanceRate(checkedIn, expected int) float64 {
	if expected == 0 {
		return 0
	}
	return float64(checkedIn) * 100 / float64(expected)
}

func attendanceRiskLevel(abnormal, expected int) string {
	if abnormal == 0 || expected == 0 {
		return "low"
	}
	ratio := float64(abnormal) / float64(expected)
	if abnormal >= 5 || ratio >= 0.2 {
		return "high"
	}
	return "medium"
}

func normalizeOrgUnitName(value string) string {
	if strings.TrimSpace(value) == "" {
		return "未分配"
	}
	return value
}

func firstNonEmpty(left, right string) string {
	if strings.TrimSpace(left) != "" {
		return left
	}
	return right
}

func severityRank(value string) int {
	switch value {
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}
