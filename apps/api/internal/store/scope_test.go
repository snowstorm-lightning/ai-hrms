package store

import (
	"reflect"
	"testing"
)

func TestAssignmentScopeWhereGlobal(t *testing.T) {
	where, args := assignmentScopeWhere(Scope{Global: true}, "pa", 1)
	if where != "" {
		t.Fatalf("where = %q, want empty global filter", where)
	}
	if args != nil {
		t.Fatalf("args = %#v, want nil", args)
	}
}

func TestAssignmentScopeWhereEmptyNonGlobal(t *testing.T) {
	where, args := assignmentScopeWhere(Scope{}, "pa", 1)
	if where != "FALSE" {
		t.Fatalf("where = %q, want FALSE", where)
	}
	if args != nil {
		t.Fatalf("args = %#v, want nil", args)
	}
}

func TestAssignmentScopeWhereCombinesLegalEntityAndOrgUnit(t *testing.T) {
	scope := Scope{
		LegalEntityID: map[string]bool{"le-b": true, "le-a": true},
		OrgUnitID:     map[string]bool{"org-a": true},
	}

	where, args := assignmentScopeWhere(scope, "pa", 2)
	wantWhere := "(pa.legal_entity_id::text IN ($2,$3) OR pa.org_unit_id::text IN ($4))"
	wantArgs := []any{"le-a", "le-b", "org-a"}
	if where != wantWhere {
		t.Fatalf("where = %q, want %q", where, wantWhere)
	}
	if !reflect.DeepEqual(args, wantArgs) {
		t.Fatalf("args = %#v, want %#v", args, wantArgs)
	}
}

func TestAddDescendantsIncludesNestedChildren(t *testing.T) {
	target := map[string]bool{"root": true}
	children := map[string][]string{
		"root":    {"child-a", "child-b"},
		"child-a": {"grandchild-a"},
	}

	addDescendants(target, children, "root")

	for _, id := range []string{"root", "child-a", "child-b", "grandchild-a"} {
		if !target[id] {
			t.Fatalf("target[%q] = false, want true", id)
		}
	}
}

func TestAddDescendantsHandlesCycles(t *testing.T) {
	target := map[string]bool{"root": true}
	children := map[string][]string{
		"root":  {"child"},
		"child": {"root"},
	}

	addDescendants(target, children, "root")

	if !target["root"] || !target["child"] {
		t.Fatalf("target = %#v, want root and child", target)
	}
}
