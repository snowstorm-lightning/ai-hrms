# AI-HRMS Nginx Reverse Proxy

These commands assume the Docker stack is already running with:

- API on `127.0.0.1:8020`
- Web on `127.0.0.1:8021`
- `VITE_API_BASE_URL=/api`
- `DOCKER_CORS_ALLOWED_ORIGINS=https://hrms.snowstormlightning.top`

If production runs with `AI_HRMS_ENABLE_DEMO_SEED=false`, create the first
administrator before exposing the site:

```bash
read -rsp 'Bootstrap admin password: ' BOOTSTRAP_ADMIN_PASSWORD; echo
printf '%s' "$BOOTSTRAP_ADMIN_PASSWORD" | docker compose --env-file infra/.env -f infra/compose.yaml run --rm -T bootstrap-admin \
  --mobile '+8613800000000' \
  --name 'Platform Admin' \
  --password-stdin
unset BOOTSTRAP_ADMIN_PASSWORD
```

Create the Nginx site:

```bash
sudo tee /etc/nginx/sites-available/ai-hrms >/dev/null <<'NGINX'
server {
    listen 80;
    server_name hrms.snowstormlightning.top;

    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:8020;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

    location / {
        proxy_pass http://127.0.0.1:8021;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
```

Enable and reload:

```bash
sudo ln -sfn /etc/nginx/sites-available/ai-hrms /etc/nginx/sites-enabled/ai-hrms
sudo nginx -t
sudo systemctl reload nginx
```

Public deployments must use HTTPS. Use HTTP only for localhost/private smoke
tests, then terminate TLS at Nginx and redirect HTTP to HTTPS:

```bash
sudo certbot --nginx -d hrms.snowstormlightning.top
sudo nginx -t
sudo systemctl reload nginx
```

Smoke tests:

```bash
curl -I http://127.0.0.1:8021
curl -i http://127.0.0.1:8020/api/health
curl -I https://hrms.snowstormlightning.top
curl -i https://hrms.snowstormlightning.top/api/health
```
