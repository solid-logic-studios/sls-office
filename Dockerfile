# syntax=docker/dockerfile:1
FROM node:24-alpine3.24 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM busybox:1.37.0-musl AS runtime
LABEL org.opencontainers.image.source="https://github.com/solid-logic-studios/sls-office" \
      org.opencontainers.image.title="sls-office" \
      org.opencontainers.image.description="SLS Office: the lab as an animated pixel-art dashboard, served as a static site"
# Root-owned, read-only content. Mount snapshot.json at /srv/office/snapshot.json (read-only is fine).
COPY --from=build /app/dist /srv/office
COPY docker/httpd.conf /etc/httpd.conf
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
CMD ["httpd", "-f", "-v", "-p", "8080", "-h", "/srv/office", "-c", "/etc/httpd.conf"]
