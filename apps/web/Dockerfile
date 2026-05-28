ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build

WORKDIR /src

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/web apps/web

ARG VITE_API_BASE_URL=/api
ARG VITE_DEMO_MODE=false
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DEMO_MODE=${VITE_DEMO_MODE}

RUN npm run web:build

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1
