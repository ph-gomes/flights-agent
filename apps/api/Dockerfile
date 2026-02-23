# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for layer-cache efficiency
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/

# Install all workspace deps (needed for turborepo build graph)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/types packages/types
COPY apps/api apps/api

WORKDIR /app/apps/api
RUN pnpm run build

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/

# Production deps only
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY packages/types/src packages/types/src

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main.js"]
