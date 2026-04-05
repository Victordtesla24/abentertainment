FROM node:22-alpine AS base

# Install ALL dependencies (including devDeps needed for build: postcss, tailwindcss, typescript)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Production-only deps for the runner stage
FROM base AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install git + openssh-client so the admin AI agent's codebase/git tools
# (git_status, git_diff, git_commit_and_push, write_codebase_file) can
# operate on the mounted /workspace repo from inside the container.
RUN apk add --no-cache git openssh-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure runtime-critical modules that standalone analysis may miss are present
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules/@types/bcryptjs ./node_modules/@types/bcryptjs

# Create data directory for JSON storage + .ssh dir for the agent's git push key
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
RUN mkdir -p /home/nextjs/.ssh && chown -R nextjs:nodejs /home/nextjs && chmod 700 /home/nextjs/.ssh

# Configure git identity for commits authored by the admin AI agent
USER nextjs
RUN git config --global user.name "AB Admin Agent" && \
    git config --global user.email "agent@abentertainment.com.au" && \
    git config --global --add safe.directory /workspace

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "--max-old-space-size=1024", "server.js"]
