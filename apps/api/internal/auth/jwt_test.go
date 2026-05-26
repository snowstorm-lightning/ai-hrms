package auth

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestCreateTokenRoundTrip(t *testing.T) {
	token, err := CreateToken("test-secret", "user-1")
	if err != nil {
		t.Fatalf("CreateToken() error = %v", err)
	}

	claims, err := ParseToken("test-secret", token)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
	if claims.UserID != "user-1" {
		t.Fatalf("UserID = %q, want user-1", claims.UserID)
	}
	if claims.Subject != claims.UserID {
		t.Fatalf("Subject = %q, want %q", claims.Subject, claims.UserID)
	}
	if claims.ExpiresAt == nil || claims.IssuedAt == nil {
		t.Fatal("expected issued-at and expiry claims")
	}
}

func TestParseTokenRejectsWrongSecret(t *testing.T) {
	token, err := CreateToken("right-secret", "user-1")
	if err != nil {
		t.Fatalf("CreateToken() error = %v", err)
	}

	if _, err := ParseToken("wrong-secret", token); err == nil {
		t.Fatal("ParseToken() error = nil, want error")
	}
}

func TestParseTokenRejectsUnexpectedSigningMethod(t *testing.T) {
	claims := Claims{UserID: "user-1", RegisteredClaims: jwt.RegisteredClaims{Subject: "user-1"}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS384, claims).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}

	if _, err := ParseToken("test-secret", token); err == nil {
		t.Fatal("ParseToken() error = nil, want signing method error")
	}
}

func TestParseTokenRejectsSubjectMismatch(t *testing.T) {
	claims := Claims{UserID: "user-1", RegisteredClaims: jwt.RegisteredClaims{Subject: "user-2"}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}

	if _, err := ParseToken("test-secret", token); err == nil {
		t.Fatal("ParseToken() error = nil, want subject mismatch error")
	}
}
