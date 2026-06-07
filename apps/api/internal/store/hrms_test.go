package store

import "testing"

func TestHRResourceNamesIncludePlannedWorkDomains(t *testing.T) {
	want := []string{
		"leave-applications",
		"attendance-requests",
		"shift-assignments",
		"expense-claims",
		"salary-slips",
		"job-requisitions",
		"job-openings",
		"job-applicants",
		"interviews",
		"job-offers",
		"training-events",
		"performance-goals",
		"appraisal-cycles",
		"appraisals",
	}
	if len(HRResourceNames()) != len(want) {
		t.Fatalf("HRResourceNames length = %d, want %d", len(HRResourceNames()), len(want))
	}
	for _, resource := range want {
		if !ValidHRResource(resource) {
			t.Fatalf("ValidHRResource(%q) = false, want true", resource)
		}
	}
}

func TestHRStatusNeedsAction(t *testing.T) {
	for _, status := range []string{"submitted", "pending", "draft", "scheduled", "planned", "open", "active", "in_review"} {
		if !hrStatusNeedsAction(status) {
			t.Fatalf("hrStatusNeedsAction(%q) = false, want true", status)
		}
	}
	for _, status := range []string{"approved", "completed", "closed", "rejected"} {
		if hrStatusNeedsAction(status) {
			t.Fatalf("hrStatusNeedsAction(%q) = true, want false", status)
		}
	}
}
