# Cloud Registry CI/CD Deployment

This deployment path keeps builds on GitHub Actions and keeps the cloud server
as a runtime host only.

Flow:

1. GitHub Actions builds `api`, `web`, and `agent` Docker images.
2. GitHub Actions pushes the images to a private container registry.
3. GitHub Actions connects to the cloud server over SSH.
4. The server pulls registry images and restarts the stack with
   `infra/compose.prod.yaml`.

The server should not run `docker compose up --build` in production.

## Files

- `.github/workflows/ci.yml` runs the project harness on pull requests and
  pushes to `main`.
- `.github/workflows/deploy-cloud-registry.yml` builds, pushes, and deploys.
- `infra/compose.prod.yaml` runs production from prebuilt images.
- `infra/deploy.sh` validates compose config, pulls images, starts services,
  and smoke-tests API/Web health.

## Private Registry

Create a private registry namespace and repositories for:

- `ai-hrms-api`
- `ai-hrms-web`
- `ai-hrms-agent`

Use the registry domain and namespace in GitHub variables and `infra/.env`.
For example:

```dotenv
IMAGE_REGISTRY=registry.example.com
IMAGE_NAMESPACE=<your-image-namespace>
```

Put only the registry host in `IMAGE_REGISTRY`, without `https://`.

## GitHub Configuration

Add these GitHub repository variables:

```text
IMAGE_REGISTRY=registry.example.com
IMAGE_NAMESPACE=<your-image-namespace>
DEPLOY_PATH=/opt/projects/ai-hrms
DEPLOY_BRANCH=<your-default-branch>
DEPLOY_PORT=22
VITE_API_BASE_URL=/api
VITE_DEMO_MODE=false
```

Add these GitHub repository secrets:

```text
REGISTRY_USERNAME=<registry-login-username>
REGISTRY_PASSWORD=<registry-login-password-or-token>
DEPLOY_HOST=<server-public-ip-or-domain>
DEPLOY_USER=<server-linux-user>
DEPLOY_SSH_KEY=<private-key-that-can-ssh-to-the-server>
```

The deploy workflow assumes the server has already run `docker login` for the
private registry. This avoids sending registry credentials to the server on
every deploy.

## Server Preparation

Install Docker and Docker Compose v2 on the cloud server.

If `/etc/docker/daemon.json` does not already contain custom settings, you can
configure a registry mirror as a fallback for public Docker Hub images:

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "registry-mirrors": [
    "https://mirror.example.com"
  ]
}
JSON
sudo systemctl restart docker
docker info
```

Create the deploy parent directory used by GitHub Actions:

```bash
sudo mkdir -p /opt/projects
sudo chown "$USER:$USER" /opt/projects
```

The deploy workflow syncs the repository files to `DEPLOY_PATH` over SSH, so
the server does not need a GitHub deploy key or a pre-existing clone. The workflow
does not upload local env files; create `infra/.env` on the server after the
first sync or create the directory and env file manually before the first run.

Log in to the private registry once on the server:

```bash
docker login registry.example.com
```

## Runtime Images

The application images are pushed by GitHub Actions:

```text
<IMAGE_REGISTRY>/<IMAGE_NAMESPACE>/ai-hrms-api:<sha>
<IMAGE_REGISTRY>/<IMAGE_NAMESPACE>/ai-hrms-web:<sha>
<IMAGE_REGISTRY>/<IMAGE_NAMESPACE>/ai-hrms-agent:<sha>
```

The production compose file also needs these runtime images:

- `pgvector/pgvector:pg17`
- `ghcr.io/ggml-org/llama.cpp:server` only if the optional `embedding` profile
  is enabled.

For production, mirror them into your private registry from a machine that can
pull the source registries:

```bash
docker pull pgvector/pgvector:pg17
docker tag pgvector/pgvector:pg17 registry.example.com/<namespace>/pgvector:pg17
docker push registry.example.com/<namespace>/pgvector:pg17
```

Optional embedding image:

```bash
docker pull ghcr.io/ggml-org/llama.cpp:server
docker tag ghcr.io/ggml-org/llama.cpp:server registry.example.com/<namespace>/llama-cpp:server
docker push registry.example.com/<namespace>/llama-cpp:server
```

## Production Env

Create `infra/.env` on the server:

```bash
cd /opt/projects/ai-hrms
cp infra/.env.example infra/.env
```

Fill at least these values:

```dotenv
DOCKER_BIND_IP=127.0.0.1
API_PORT=8020
WEB_PORT=8021

IMAGE_REGISTRY=registry.example.com
IMAGE_NAMESPACE=<your-image-namespace>
IMAGE_TAG=latest
AI_HRMS_POSTGRES_IMAGE=registry.example.com/<your-image-namespace>/pgvector:pg17

POSTGRES_PASSWORD=<openssl-rand-hex-24>
DOCKER_DATABASE_URL=postgres://ai_hrms:<same-postgres-password>@postgres:5432/ai_hrms?sslmode=disable
JWT_SECRET=<openssl-rand-hex-32>
AI_HRMS_ENV=production
AI_HRMS_ENABLE_DEMO_SEED=false

VITE_API_BASE_URL=/api
VITE_DEMO_MODE=false
DOCKER_CORS_ALLOWED_ORIGINS=https://<your-domain>

AGENT_BASE_URL=http://agent:8090
AGENT_TIMEOUT_SECONDS=30
AI_CHAT_PROVIDER=fake
AI_EMBEDDING_PROVIDER=fake
RAG_EMBEDDING_DIMENSIONS=8
```

Generate secrets with:

```bash
openssl rand -hex 24
openssl rand -hex 32
```

If real AI mode is enabled, also fill `DEEPSEEK_API_KEY` and embedding provider
settings in `infra/.env`.

Optional local embedding on the server is opt-in. First mirror
`ghcr.io/ggml-org/llama.cpp:server` to your private registry, set
`AI_HRMS_EMBEDDING_IMAGE`, then configure:

```dotenv
AI_HRMS_ENABLE_EMBEDDING=true
AI_EMBEDDING_PROVIDER=local-openai-compatible
LOCAL_EMBEDDING_API_KEY=<openssl-rand-hex-32>
OPENAI_COMPATIBLE_EMBEDDING_API_KEY=<same-as-LOCAL_EMBEDDING_API_KEY>
OPENAI_COMPATIBLE_EMBEDDING_BASE_URL=http://embedding:80/v1
OPENAI_COMPATIBLE_EMBEDDING_MODEL=Qwen3-Embedding-0.6B-Q8_0
RAG_EMBEDDING_DIMENSIONS=1024
AI_HRMS_AGENT_SERVICE_TOKEN=<openssl-rand-hex-32>
```

The first embedding start can take several minutes while the model cache is
initialized. Existing fake 8-dimensional RAG vectors must be rebuilt from
Knowledge Hub before vector search uses the 1024-dimensional local model.

## First Deploy

After the GitHub workflow has pushed images, run this once on the server if you
want to deploy manually before enabling automatic deploy:

```bash
cd /opt/projects/ai-hrms
IMAGE_TAG=latest ./infra/deploy.sh
```

The GitHub deploy workflow uses the commit SHA as `IMAGE_TAG` automatically.

## Nginx and HTTPS

Keep the Docker services bound to `127.0.0.1`. Put Nginx in front of them:

- Web: `http://127.0.0.1:8021`
- API: `http://127.0.0.1:8020/api`

Use `docs/deploy-nginx.md` as the base Nginx configuration, replace
`hrms.snowstormlightning.top` with your own domain, then run Certbot:

```bash
sudo certbot --nginx -d <your-domain>
sudo nginx -t
sudo systemctl reload nginx
```

## Create First Admin

When `AI_HRMS_ENABLE_DEMO_SEED=false`, create the first production admin before
opening the site to users:

```bash
cd /opt/projects/ai-hrms
read -rsp 'Bootstrap admin password: ' BOOTSTRAP_ADMIN_PASSWORD; echo
printf '%s' "$BOOTSTRAP_ADMIN_PASSWORD" | docker compose --env-file infra/.env -f infra/compose.prod.yaml run --rm -T bootstrap-admin \
  --mobile '+8613800000000' \
  --name 'Platform Admin' \
  --password-stdin
unset BOOTSTRAP_ADMIN_PASSWORD
```

Use a real organization-controlled mobile/login value and a strong one-time
password.

## Seed Sample Company Data

Production keeps `AI_HRMS_ENABLE_DEMO_SEED=false`, so it does not load frontend
mock data or demo login accounts. To populate the real database with the
fictional enterprise technology company dataset used by the product demo, run:

```bash
cd /opt/projects/ai-hrms
docker compose --env-file infra/.env -f infra/compose.prod.yaml run --rm seed-sample-company
```

The command is idempotent and only inserts or updates sample organization,
employee, RAG, learning, Agent, and audit records. It does not create passwords
or demo users.

## Smoke Tests

On the server:

```bash
curl -i http://127.0.0.1:8020/api/health
curl -I http://127.0.0.1:8021/health
curl -i https://<your-domain>/api/health
curl -I https://<your-domain>
```

## Rollback

Set `IMAGE_TAG` to an older pushed commit SHA and redeploy:

```bash
cd /opt/projects/ai-hrms
IMAGE_TAG=<previous-sha> ./infra/deploy.sh
```
