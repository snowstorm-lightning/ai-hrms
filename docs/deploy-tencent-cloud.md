# Tencent Cloud CI/CD Deployment

This deployment path keeps builds on GitHub Actions and keeps the Tencent Cloud
CVM server as a runtime host only.

Flow:

1. GitHub Actions builds `api`, `web`, and `agent` Docker images.
2. GitHub Actions pushes the images to Tencent Cloud TCR.
3. GitHub Actions connects to the CVM over SSH.
4. The CVM pulls TCR images and restarts the stack with
   `infra/compose.prod.yaml`.

The CVM should not run `docker compose up --build` in production.

## Files

- `.github/workflows/ci.yml` runs the project harness on pull requests and
  pushes to `main`.
- `.github/workflows/deploy-tencent-cloud.yml` builds, pushes, and deploys.
- `infra/compose.prod.yaml` runs production from prebuilt images.
- `infra/deploy.sh` validates compose config, pulls images, starts services,
  and smoke-tests API/Web health.

## Tencent Cloud TCR

Create a TCR namespace and repositories for:

- `ai-hrms-api`
- `ai-hrms-web`
- `ai-hrms-agent`

Use the registry domain and namespace in GitHub variables and `infra/.env`.
For Tencent Cloud personal edition, the registry is commonly:

```dotenv
TCR_REGISTRY=ccr.ccs.tencentyun.com
TCR_NAMESPACE=<your-tcr-namespace>
```

Enterprise TCR instances use their own registry domain. Put only the registry
host in `TCR_REGISTRY`, without `https://`.

## GitHub Configuration

Add these GitHub repository variables:

```text
TCR_REGISTRY=ccr.ccs.tencentyun.com
TCR_NAMESPACE=<your-tcr-namespace>
DEPLOY_PATH=/opt/projects/ai-hrms
DEPLOY_BRANCH=<your-default-branch>
DEPLOY_PORT=22
VITE_API_BASE_URL=/api
VITE_DEMO_MODE=false
```

Add these GitHub repository secrets:

```text
TCR_USERNAME=<tcr-login-username>
TCR_PASSWORD=<tcr-login-password-or-token>
DEPLOY_HOST=<server-public-ip-or-domain>
DEPLOY_USER=<server-linux-user>
DEPLOY_SSH_KEY=<private-key-that-can-ssh-to-the-server>
```

The deploy workflow assumes the CVM has already run `docker login` for TCR.
This avoids sending TCR credentials to the server on every deploy.

## Server Preparation

Install Docker and Docker Compose v2 on the Tencent Cloud CVM.

If `/etc/docker/daemon.json` does not already contain custom settings, you can
configure the Tencent Cloud Docker Hub mirror as a fallback for DockerHub
images:

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com"
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
the CVM does not need a GitHub deploy key or a pre-existing clone. The workflow
does not upload local env files; create `infra/.env` on the server after the
first sync or create the directory and env file manually before the first run.

Log in to TCR once on the CVM:

```bash
docker login ccr.ccs.tencentyun.com
```

## Runtime Images

The application images are pushed by GitHub Actions:

```text
<TCR_REGISTRY>/<TCR_NAMESPACE>/ai-hrms-api:<sha>
<TCR_REGISTRY>/<TCR_NAMESPACE>/ai-hrms-web:<sha>
<TCR_REGISTRY>/<TCR_NAMESPACE>/ai-hrms-agent:<sha>
```

The production compose file also needs these runtime images:

- `pgvector/pgvector:pg17`
- `ghcr.io/ggml-org/llama.cpp:server` only if the optional `embedding` profile
  is enabled.

For Tencent Cloud production, mirror them into TCR from a machine that can pull
the source registries:

```bash
docker pull pgvector/pgvector:pg17
docker tag pgvector/pgvector:pg17 ccr.ccs.tencentyun.com/<namespace>/pgvector:pg17
docker push ccr.ccs.tencentyun.com/<namespace>/pgvector:pg17
```

Optional embedding image:

```bash
docker pull ghcr.io/ggml-org/llama.cpp:server
docker tag ghcr.io/ggml-org/llama.cpp:server ccr.ccs.tencentyun.com/<namespace>/llama-cpp:server
docker push ccr.ccs.tencentyun.com/<namespace>/llama-cpp:server
```

## Production Env

Create `infra/.env` on the CVM:

```bash
cd /opt/projects/ai-hrms
cp infra/.env.example infra/.env
```

Fill at least these values:

```dotenv
DOCKER_BIND_IP=127.0.0.1
API_PORT=8020
WEB_PORT=8021

TCR_REGISTRY=ccr.ccs.tencentyun.com
TCR_NAMESPACE=<your-tcr-namespace>
IMAGE_TAG=latest
AI_HRMS_POSTGRES_IMAGE=ccr.ccs.tencentyun.com/<your-tcr-namespace>/pgvector:pg17

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

## Smoke Tests

On the CVM:

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
