package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"ai-hrms/apps/api/internal/config"
	"ai-hrms/apps/api/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "bootstrap-admin":
		runBootstrapAdmin(os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}
}

func runBootstrapAdmin(args []string) {
	fs := flag.NewFlagSet("bootstrap-admin", flag.ExitOnError)
	mobile := fs.String("mobile", "", "admin mobile/login")
	name := fs.String("name", "", "admin display name")
	passwordStdin := fs.Bool("password-stdin", false, "read admin password from stdin")
	_ = fs.Parse(args)

	if strings.TrimSpace(*mobile) == "" || strings.TrimSpace(*name) == "" || !*passwordStdin {
		fmt.Fprintln(os.Stderr, "bootstrap-admin requires --mobile, --name, and --password-stdin")
		fs.Usage()
		os.Exit(2)
	}
	passwordBytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		log.Fatal(err)
	}
	password := strings.TrimRight(string(passwordBytes), "\r\n")
	if len(password) < 12 {
		log.Fatal("bootstrap admin password must be at least 12 characters")
	}

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
	user, err := db.BootstrapAdmin(ctx, strings.TrimSpace(*mobile), strings.TrimSpace(*name), password)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Bootstrapped global group_admin user %s (%s)\n", user.Mobile, user.ID)
}

func usage() {
	fmt.Fprintln(os.Stderr, `Usage:
  ai-hrms-admin bootstrap-admin --mobile <login-mobile> --name <display-name> --password-stdin

Password must be provided on stdin and is never printed.`)
}
