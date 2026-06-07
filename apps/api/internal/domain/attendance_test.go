package domain

import (
	"testing"
	"time"
)

func TestBuildAttendanceOverviewAggregatesCoreSignals(t *testing.T) {
	day := "2026-05-29"
	generatedAt := time.Date(2026, 6, 6, 10, 0, 0, 0, time.UTC)
	inTime := time.Date(2026, 5, 29, 9, 2, 0, 0, time.FixedZone("CST", 8*60*60))
	outTime := time.Date(2026, 5, 29, 18, 15, 0, 0, time.FixedZone("CST", 8*60*60))

	overview := BuildAttendanceOverview(day, generatedAt, []AttendanceOverviewSource{
		{EmployeeID: "emp-normal", EmployeeName: "正常员工", OrgUnitName: "平台部", AttendanceID: "att-normal", AttendanceStatus: 1, AttendanceInTime: &inTime, AttendanceOutTime: &outTime, Day: day},
		{EmployeeID: "emp-late", EmployeeName: "迟到员工", OrgUnitName: "平台部", AttendanceID: "att-late", AttendanceStatus: 3, AttendanceInTime: &inTime, AttendanceOutTime: &outTime, Day: day},
		{EmployeeID: "emp-leave", EmployeeName: "请假员工", OrgUnitName: "平台部", AttendanceID: "att-leave", AttendanceStatus: 8, Day: day},
		{EmployeeID: "emp-missing", EmployeeName: "未签到员工", OrgUnitName: "交付部", Day: day},
		{EmployeeID: "emp-no-checkout", EmployeeName: "缺签退员工", OrgUnitName: "交付部", AttendanceID: "att-no-checkout", AttendanceStatus: 1, AttendanceInTime: &inTime, Day: day},
	})

	if overview.Summary.Expected != 5 {
		t.Fatalf("expected = %d, want 5", overview.Summary.Expected)
	}
	if overview.Summary.CheckedIn != 3 {
		t.Fatalf("checkedIn = %d, want 3", overview.Summary.CheckedIn)
	}
	if overview.Summary.NotCheckedIn != 1 {
		t.Fatalf("notCheckedIn = %d, want 1", overview.Summary.NotCheckedIn)
	}
	if overview.Summary.Leave != 1 {
		t.Fatalf("leave = %d, want 1", overview.Summary.Leave)
	}
	if overview.Summary.Late != 1 {
		t.Fatalf("late = %d, want 1", overview.Summary.Late)
	}
	if overview.Summary.Abnormal != 3 {
		t.Fatalf("abnormal = %d, want 3", overview.Summary.Abnormal)
	}
	if len(overview.Exceptions) != 3 {
		t.Fatalf("exceptions = %d, want 3", len(overview.Exceptions))
	}
}

func TestBuildAttendanceOverviewDoesNotMarkSameDayMissingCheckout(t *testing.T) {
	day := "2026-05-29"
	generatedAt := time.Date(2026, 5, 29, 10, 0, 0, 0, time.UTC)
	inTime := time.Date(2026, 5, 29, 9, 2, 0, 0, time.UTC)

	overview := BuildAttendanceOverview(day, generatedAt, []AttendanceOverviewSource{
		{EmployeeID: "emp-today", EmployeeName: "当天员工", OrgUnitName: "平台部", AttendanceID: "att-today", AttendanceStatus: 1, AttendanceInTime: &inTime, Day: day},
	})

	if overview.Summary.Abnormal != 0 {
		t.Fatalf("same-day missing checkout abnormal = %d, want 0", overview.Summary.Abnormal)
	}
	if len(overview.Exceptions) != 0 {
		t.Fatalf("same-day missing checkout exceptions = %d, want 0", len(overview.Exceptions))
	}
}
