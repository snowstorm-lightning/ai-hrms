package main

import (
	"context"
	"log"
	"time"

	"ai-hrms/apps/api/internal/config"
	"ai-hrms/apps/api/internal/store"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cfg := config.Load()
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Migrate(ctx); err != nil {
		log.Fatal(err)
	}
}
