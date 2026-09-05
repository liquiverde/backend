# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.14.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm >=10 blocks lifecycle scripts for native deps (argon2, @prisma/*) by
# default pending explicit approval; --frozen-lockfile hard-fails instead of
# prompting in a non-interactive shell. Install scripts skipped, then
# explicitly rebuild just the packages that need their native/postinstall
# step (mirrors what `pnpm approve-builds` would allow).
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild argon2 @prisma/client @prisma/engines

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.14.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` never connects to the DB, but prisma.config.ts's env()
# lookup requires DATABASE_URL to resolve at config-load time — a
# placeholder here is not a secret and never reaches the runtime image.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm prisma generate
RUN pnpm build
RUN pnpm prune --prod --ignore-scripts

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.14.0 --activate
RUN addgroup -S liquiverde && adduser -S liquiverde -G liquiverde
COPY --from=build --chown=liquiverde:liquiverde /app/node_modules ./node_modules
COPY --from=build --chown=liquiverde:liquiverde /app/dist ./dist
COPY --from=build --chown=liquiverde:liquiverde /app/prisma ./prisma
# prisma/seed.ts imports the scoring engine and config factory straight
# from TS source (single source of truth with the running app, see
# seed.ts's top comment) and runs via ts-node, so src/ has to be present
# even though the compiled app itself only needs dist/.
COPY --from=build --chown=liquiverde:liquiverde /app/src ./src
COPY --from=build --chown=liquiverde:liquiverde /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=liquiverde:liquiverde /app/package.json ./package.json
# ts-node (used by `prisma db seed`, see prisma.config.ts) needs this to
# resolve the project's module settings correctly.
COPY --from=build --chown=liquiverde:liquiverde /app/tsconfig.json ./tsconfig.json
COPY --chown=liquiverde:liquiverde docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER liquiverde
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
