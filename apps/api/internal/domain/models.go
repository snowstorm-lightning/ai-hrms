package domain

import "time"

type User struct {
	ID          string    `json:"id"`
	Mobile      string    `json:"mobile"`
	Username    string    `json:"username"`
	EnableState int       `json:"enableState"`
	CreatedAt   time.Time `json:"createdAt"`
	Roles       []string  `json:"roles,omitempty"`
}

type Role struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type RoleBinding struct {
	ID                 string    `json:"id"`
	UserID             string    `json:"userId"`
	RoleID             string    `json:"roleId,omitempty"`
	RoleCode           string    `json:"roleCode"`
	RoleName           string    `json:"roleName,omitempty"`
	ScopeType          string    `json:"scopeType"`
	ScopeID            *string   `json:"scopeId"`
	ScopeName          string    `json:"scopeName,omitempty"`
	IncludeDescendants bool      `json:"includeDescendants"`
	CreatedAt          time.Time `json:"createdAt,omitempty"`
}

type LegalEntity struct {
	ID                      string    `json:"id"`
	ParentID                *string   `json:"parentId"`
	Code                    string    `json:"code"`
	Name                    string    `json:"name"`
	LegalName               string    `json:"legalName"`
	UnifiedSocialCreditCode string    `json:"unifiedSocialCreditCode"`
	LegalRepresentative     string    `json:"legalRepresentative"`
	CompanyPhone            string    `json:"companyPhone"`
	Email                   string    `json:"email"`
	Area                    string    `json:"area"`
	Address                 string    `json:"address"`
	Status                  string    `json:"status"`
	CreatedAt               time.Time `json:"createdAt"`
}

type OrgUnit struct {
	ID            string    `json:"id"`
	ParentID      *string   `json:"parentId"`
	LegalEntityID *string   `json:"legalEntityId"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Type          string    `json:"type"`
	ManagerName   string    `json:"managerName"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Assignment struct {
	ID              string     `json:"id"`
	LegalEntityID   *string    `json:"legalEntityId"`
	LegalEntityName *string    `json:"legalEntityName"`
	OrgUnitID       *string    `json:"orgUnitId"`
	OrgUnitName     *string    `json:"orgUnitName"`
	PositionTitle   string     `json:"positionTitle"`
	IsPrimary       bool       `json:"isPrimary"`
	StartDate       time.Time  `json:"startDate"`
	EndDate         *time.Time `json:"endDate"`
	AllocationRatio *float64   `json:"allocationRatio"`
	EmploymentType  string     `json:"employmentType"`
}

type Employee struct {
	ID                               string       `json:"id"`
	UserID                           *string      `json:"userId"`
	EmployeeNo                       string       `json:"employeeNo"`
	Name                             string       `json:"name"`
	Mobile                           string       `json:"mobile"`
	Status                           string       `json:"status"`
	Sex                              string       `json:"sex"`
	DateOfBirth                      string       `json:"dateOfBirth"`
	HighestDegreeOfEducation         string       `json:"highestDegreeOfEducation"`
	NationalArea                     string       `json:"nationalArea"`
	PassportNo                       string       `json:"passportNo"`
	IDNumber                         string       `json:"idNumber"`
	NativePlace                      string       `json:"nativePlace"`
	Nation                           string       `json:"nation"`
	EnglishName                      string       `json:"englishName"`
	MaritalStatus                    string       `json:"maritalStatus"`
	Birthday                         string       `json:"birthday"`
	Zodiac                           string       `json:"zodiac"`
	Age                              string       `json:"age"`
	Constellation                    string       `json:"constellation"`
	BloodType                        string       `json:"bloodType"`
	Domicile                         string       `json:"domicile"`
	PoliticalOutlook                 string       `json:"politicalOutlook"`
	QQ                               string       `json:"qq"`
	Wechat                           string       `json:"wechat"`
	PlaceOfResidence                 string       `json:"placeOfResidence"`
	PostalAddress                    string       `json:"postalAddress"`
	PersonalMailbox                  string       `json:"personalMailbox"`
	EmergencyContact                 string       `json:"emergencyContact"`
	EmergencyContactNumber           string       `json:"emergencyContactNumber"`
	BankCardNumber                   string       `json:"bankCardNumber"`
	OpeningBank                      string       `json:"openingBank"`
	GraduateSchool                   string       `json:"graduateSchool"`
	Major                            string       `json:"major"`
	HomeCompany                      string       `json:"homeCompany"`
	Title                            string       `json:"title"`
	Resume                           string       `json:"resume"`
	IsThereAnyCompetitionRestriction string       `json:"isThereAnyCompetitionRestriction"`
	Remarks                          string       `json:"remarks"`
	PrimaryAssignment                *Assignment  `json:"primaryAssignment"`
	Assignments                      []Assignment `json:"assignments,omitempty"`
}

type Attendance struct {
	ID                string     `json:"id"`
	EmployeeID        string     `json:"employeeId"`
	EmployeeName      string     `json:"employeeName"`
	Mobile            string     `json:"mobile"`
	OrgUnitName       string     `json:"orgUnitName"`
	AttendanceStatus  int        `json:"attendanceStatus"`
	AttendanceInTime  *time.Time `json:"attendanceInTime"`
	AttendanceOutTime *time.Time `json:"attendanceOutTime"`
	AttendanceInPlace string     `json:"attendanceInPlace"`
	Day               string     `json:"day"`
	Remarks           string     `json:"remarks"`
}

type Message struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Category    string    `json:"category"`
	Content     string    `json:"content"`
	Author      string    `json:"author"`
	OrgUnitName string    `json:"orgUnitName"`
	ScopeType   string    `json:"scopeType"`
	ScopeID     *string   `json:"scopeId"`
	Star        int       `json:"star"`
	View        int       `json:"view"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Comment struct {
	ID          string    `json:"id"`
	MessageID   string    `json:"messageId"`
	Content     string    `json:"content"`
	Username    string    `json:"username"`
	OrgUnitName string    `json:"orgUnitName"`
	CreatedAt   time.Time `json:"createdAt"`
}
