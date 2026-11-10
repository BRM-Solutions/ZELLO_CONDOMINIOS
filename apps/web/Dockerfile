# Contexto de build: raiz do repositorio (docker build -f apps/web/Dockerfile .)
FROM node:26-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @app/web...

FROM deps AS build
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @app/web build
RUN sed -e "s|__API_URL__|${VITE_API_URL}|g" -e "s|__SUPABASE_URL__|${VITE_SUPABASE_URL}|g" apps/web/nginx.conf > /tmp/default.conf

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
LABEL org.opencontainers.image.title="{{SLUG}}-web" org.opencontainers.image.description="{{PROJETO}} - Web"
COPY --from=build /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1
