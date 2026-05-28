# Co-Growth OS Demo 运行与部署

## 本地运行

安装依赖：

```bash
npm ci
```

启动纯前端 Demo：

```bash
VITE_DEMO_MODE=true npm run web:dev
```

登录：

- Demo mode 下登录页有“一键进入 Co-Growth Demo”。
- 也可使用 `123` / `password`。

访问：

```text
http://127.0.0.1:5173/co-growth
```

## 构建

```bash
VITE_DEMO_MODE=true npm run web:build
```

构建产物位于：

```text
apps/web/dist
```

## 公网部署

推荐使用 Vercel 或 Netlify 部署纯前端 Demo：

- Root directory：仓库根目录。
- Build command：`VITE_DEMO_MODE=true npm run web:build`
- Output directory：`apps/web/dist`
- 环境变量：`VITE_DEMO_MODE=true`

SPA fallback：

- Vercel 需要将所有路径 rewrite 到 `/index.html`。
- Netlify 需要 `_redirects` 或平台配置：`/* /index.html 200`。

GitHub Pages 注意：

- 如部署到子路径，需要配置 Vite `base`。
- BrowserRouter 在 GitHub Pages 刷新子路由可能 404，需额外 fallback；若无法配置 fallback，优先用 Vercel/Netlify。

## Demo 边界

`VITE_DEMO_MODE=true` 时：

- `/co-growth` 不依赖 Go、PostgreSQL 或外部 LLM。
- AI Coach 和 Agent Workflow Lab 使用 deterministic mock。
- 不调用外部模型，不发送个人敏感数据。
- 原有 API 模式保留；`VITE_DEMO_MODE=false` 时仍走 Go API。
