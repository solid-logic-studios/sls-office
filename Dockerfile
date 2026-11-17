# syntax=docker/dockerfile:1
FROM node:24-alpine3.24 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# The clips to render, from the Themes' lines. Unchanged lines give an identical file, so the voices stage stays cached.
RUN pnpm voice-lines /app/voice-lines.json

# Renders the spoken lines once, on the build host (glibc for the Piper binary), so the clips do not depend on the
# target architecture. Piper is build-time only and is not in the image.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS voices
ARG BUILDARCH
# The Piper release and its SHA-256 per architecture. Keep in step with voices/models.json (a test checks).
ARG PIPER_VERSION=2023.11.14-2
ARG PIPER_SHA256_X86_64=a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992
ARG PIPER_SHA256_AARCH64=fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl opus-tools \
    && rm -rf /var/lib/apt/lists/*
RUN case "$BUILDARCH" in \
      amd64) arch=x86_64; sha="$PIPER_SHA256_X86_64" ;; \
      arm64) arch=aarch64; sha="$PIPER_SHA256_AARCH64" ;; \
      *) echo "Unsupported build architecture: $BUILDARCH" >&2; exit 1 ;; \
    esac \
    && curl -fsSL -o /tmp/piper.tar.gz "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_${arch}.tar.gz" \
    && echo "${sha}  /tmp/piper.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/piper.tar.gz -C /opt \
    && rm /tmp/piper.tar.gz
WORKDIR /voices
# Models: this layer runs again only when the pins or the fetch scripts change.
COPY voices/models.json scripts/voice-support.ts scripts/fetch-voices.ts ./
RUN node fetch-voices.ts --out /models
# Clips: render again only when the list of lines, the pins or any voices-stage script change.
COPY --from=build /app/voice-lines.json ./
COPY scripts/render-voices.ts ./
RUN node render-voices.ts --piper /opt/piper/piper --models /models --lines voice-lines.json --out /out/voices

FROM busybox:1.38.0-musl AS runtime
LABEL org.opencontainers.image.source="https://github.com/solid-logic-studios/sls-office" \
      org.opencontainers.image.title="sls-office" \
      org.opencontainers.image.description="SLS Office: the lab as an animated pixel-art dashboard, served as a static site"
# Root-owned, read-only content. Mount snapshot.json at /srv/office/snapshot.json (read-only is fine).
COPY --from=build /app/dist /srv/office
COPY --from=voices /out/voices /srv/office/voices
COPY docker/httpd.conf /etc/httpd.conf
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
CMD ["httpd", "-f", "-v", "-p", "8080", "-h", "/srv/office", "-c", "/etc/httpd.conf"]
