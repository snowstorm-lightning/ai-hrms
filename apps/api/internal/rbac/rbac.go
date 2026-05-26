package rbac

type ScopeType string

const (
	ScopeGlobal      ScopeType = "global"
	ScopeLegalEntity ScopeType = "legal_entity"
	ScopeOrgUnit     ScopeType = "org_unit"
)

type Binding struct {
	RoleCode           string
	ScopeType          ScopeType
	ScopeID            *string
	IncludeDescendants bool
}

type Principal struct {
	UserID       string
	Mobile       string
	Username     string
	Bindings     []Binding
	Capabilities []string
}

func (p Principal) IsGlobal() bool {
	for _, binding := range p.Bindings {
		if binding.ScopeType == ScopeGlobal {
			return true
		}
	}
	return false
}

func (p Principal) RoleCodes() []string {
	seen := map[string]bool{}
	var roles []string
	for _, binding := range p.Bindings {
		if !seen[binding.RoleCode] {
			seen[binding.RoleCode] = true
			roles = append(roles, binding.RoleCode)
		}
	}
	return roles
}

func (p Principal) HasCapability(code string) bool {
	for _, capability := range p.Capabilities {
		if capability == code {
			return true
		}
	}
	return false
}
