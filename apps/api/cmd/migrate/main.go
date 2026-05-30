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
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
	db, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Migrate(ctx, store.MigrationOptions{EnableDemoSeed: cfg.EnableDemoSeed}); err != nil {
		log.Fatal(err)
	}
}
