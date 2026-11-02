# ---- Stage 1: build the React app ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: serve static files with nginx ----
FROM nginx:1.27-alpine

# host:port of the Django backend, as reachable from this container.
ENV BACKEND_URL=backend:8000
# DNS server nginx uses to resolve BACKEND_URL (Docker's embedded DNS).
ENV NGINX_RESOLVER=127.0.0.11

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1
