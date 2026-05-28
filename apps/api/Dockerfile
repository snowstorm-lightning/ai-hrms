ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-alpine AS build

WORKDIR /src

COPY go.work go.work.sum ./
COPY apps/api/go.mod apps/api/go.mod
RUN cd apps/api && go mod download

COPY apps/api apps/api
RUN cd apps/api && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/ai-hrms-api ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

RUN addgroup -S app && adduser -S -G app app
COPY --from=build /out/ai-hrms-api /usr/local/bin/ai-hrms-api

USER app
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1

CMD ["ai-hrms-api"]
