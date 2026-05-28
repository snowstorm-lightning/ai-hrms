# Infra

Docker Compose definitions live here.

`compose.yaml` runs the deployment-oriented stack:

- PostgreSQL with `pgvector` support.
- Go API on `127.0.0.1:${API_PORT:-8020}`.
- Built React web app served by container Nginx on `127.0.0.1:${WEB_PORT:-8021}`.
- Python agent service on the Docker network only.
- PostgreSQL on the Docker network only.

From the repo root:

```bash
cp infra/.env.example infra/.env
docker compose --env-file infra/.env -f infra/compose.yaml up -d --build
```

`POSTGRES_PASSWORD`, `DOCKER_DATABASE_URL`, `JWT_SECRET`, and
`DOCKER_CORS_ALLOWED_ORIGINS` are required. Keep `infra/.env` out of git.

For native development that needs host access to PostgreSQL, add the dev
override:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml -f infra/compose.dev.yaml up -d postgres
```

Redis is intentionally not included until a concrete cache, queue, rate-limit,
or fanout use case appears.
