package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPageMarshalJSONUsesEmptyRowsArray(t *testing.T) {
	body, err := json.Marshal(Envelope{Success: true, Data: Page[string]{Total: 0}})
	if err != nil {
		t.Fatal(err)
	}
	if got := string(body); got != `{"success":true,"code":0,"message":"","data":{"total":0,"rows":[]}}` {
		t.Fatalf("body = %s", got)
	}
}

func TestOKUsesEmptyArrayForNilSlices(t *testing.T) {
	recorder := httptest.NewRecorder()
	var rows []string

	OK(recorder, rows)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	var payload Envelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	data, ok := payload.Data.([]any)
	if !ok {
		t.Fatalf("data type = %T, want []any", payload.Data)
	}
	if len(data) != 0 {
		t.Fatalf("data length = %d, want 0", len(data))
	}
}
