# Single-URL deployment: build frontend, then run backend serving it.
# Build stage: frontend
FROM node:20-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:deploy

# Run stage: backend + static frontend
FROM python:3.11-slim
WORKDIR /app
ENV PORT=8000
COPY backend/ ./backend/
COPY --from=frontend /app/backend/static ./backend/static
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]