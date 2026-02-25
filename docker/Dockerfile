FROM node:22-alpine AS base
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy entrypoint
COPY entrypoint.mjs ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "entrypoint.mjs"]
