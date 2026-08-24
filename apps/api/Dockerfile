FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace manifests first so the install layer caches
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/habitron/package.json ./packages/habitron/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @habits-coach/api...

# Sources: the API runs TypeScript directly with tsx, and the coach loads its
# persona and skills from packages/coach-skills at runtime.
COPY packages/shared ./packages/shared
COPY packages/habitron ./packages/habitron
COPY packages/coach-skills ./packages/coach-skills
COPY apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["pnpm", "start"]
