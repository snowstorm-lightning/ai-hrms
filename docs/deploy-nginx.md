# AI-HRMS Nginx Reverse Proxy

These commands assume the Docker stack is already running with:

- API on `127.0.0.1:8020`
- Web on `127.0.0.1:8021`
- `VITE_API_BASE_URL=/api`
- `DOCKER_CORS_ALLOWED_ORIGINS=http://hrms.snowstormlightning.top,https://hrms.snowstormlightning.top`

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

Optional HTTPS with Certbot:

```bash
sudo certbot --nginx -d hrms.snowstormlightning.top
sudo nginx -t
sudo systemctl reload nginx
```

Smoke tests:

```bash
curl -I http://127.0.0.1:8021
curl -i http://127.0.0.1:8020/api/health
curl -I http://hrms.snowstormlightning.top
curl -i http://hrms.snowstormlightning.top/api/health
```
