package httpx

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type Envelope struct {
	Success bool   `json:"success"`
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type Page[T any] struct {
	Total int64 `json:"total"`
	Rows  []T   `json:"rows"`
}

func OK(w http.ResponseWriter, data any) {
	Write(w, http.StatusOK, Envelope{Success: true, Code: 2001, Message: "操作成功", Data: data})
}

func Created(w http.ResponseWriter, data any) {
	Write(w, http.StatusCreated, Envelope{Success: true, Code: 2001, Message: "操作成功", Data: data})
}

func Error(w http.ResponseWriter, status, code int, message string) {
	Write(w, status, Envelope{Success: false, Code: code, Message: message})
}

func Write(w http.ResponseWriter, status int, payload Envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func Decode(r *http.Request, target any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}

func PageParams(r *http.Request) (int, int) {
	page := intParam(r, "page", 1)
	size := intParam(r, "size", 10)
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 10
	}
	return page, size
}

func intParam(r *http.Request, key string, fallback int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
