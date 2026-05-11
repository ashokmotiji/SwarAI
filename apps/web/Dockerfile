# Build from monorepo root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim AS base
WORKDIR /repo
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @swarsales/web build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY --from=base /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=base /repo/packages ./packages
COPY --from=base /repo/apps/web ./apps/web
COPY --from=base /repo/node_modules ./node_modules
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
