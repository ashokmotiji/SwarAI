# Build from monorepo root: docker build -f apps/voice-worker/Dockerfile .
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
COPY apps/voice-worker/pyproject.toml apps/voice-worker/README.md ./
COPY apps/voice-worker/src ./src
RUN pip install --no-cache-dir .
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "swarai_agent", "start"]
