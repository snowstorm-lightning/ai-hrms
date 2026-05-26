package rbac

import "testing"

func TestPrincipalIsGlobal(t *testing.T) {
	principal := Principal{Bindings: []Binding{
		{RoleCode: "entity_hr", ScopeType: ScopeLegalEntity},
		{RoleCode: "group_admin", ScopeType: ScopeGlobal},
	}}

	if !principal.IsGlobal() {
		t.Fatal("IsGlobal() = false, want true")
	}
}

func TestPrincipalRoleCodesDeduplicatesInOrder(t *testing.T) {
	principal := Principal{Bindings: []Binding{
		{RoleCode: "entity_hr", ScopeType: ScopeLegalEntity},
		{RoleCode: "entity_hr", ScopeType: ScopeOrgUnit},
		{RoleCode: "employee", ScopeType: ScopeOrgUnit},
	}}

	roles := principal.RoleCodes()
	want := []string{"entity_hr", "employee"}
	if len(roles) != len(want) {
		t.Fatalf("RoleCodes() length = %d, want %d: %#v", len(roles), len(want), roles)
	}
	for i := range want {
		if roles[i] != want[i] {
			t.Fatalf("RoleCodes()[%d] = %q, want %q", i, roles[i], want[i])
		}
	}
}
