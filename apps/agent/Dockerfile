FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

COPY apps/agent/pyproject.toml apps/agent/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/agent/src src
RUN uv sync --frozen --no-dev

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PATH="/app/.venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN useradd --create-home --shell /usr/sbin/nologin app
COPY --from=build --chown=app:app /app /app

USER app
EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=2).read()" || exit 1

CMD ["uvicorn", "ai_hrms_agent.main:app", "--host", "0.0.0.0", "--port", "8090"]
