# Contexto de build: raiz do repositorio (docker build -f apps/api/Dockerfile .)
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
    pnpm install --frozen-lockfile --filter @app/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @app/api type-check && pnpm --filter @app/api build
RUN pnpm --filter @app/api deploy --prod /out

FROM node:26-alpine AS runtime
LABEL org.opencontainers.image.title="{{SLUG}}-api" org.opencontainers.image.description="{{PROJETO}} - API"
ENV NODE_ENV=production
ENV API_PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
