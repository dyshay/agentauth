FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy package.json files for install
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/

# Build
RUN pnpm --filter @xagentauth/core build && pnpm --filter @xagentauth/server build

# --- Production image ---
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts and node_modules
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/server/package.json packages/server/
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy entrypoint
COPY docker/entrypoint.mjs /app/entrypoint.mjs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "/app/entrypoint.mjs"]
