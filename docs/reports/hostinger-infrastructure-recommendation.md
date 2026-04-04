# Hostinger Infrastructure Recommendation

**Project:** AB Entertainment (abentertainment.com.au)
**Date:** 4 April 2026
**Version:** 1.0
**Status:** Proposed

---

## Table of Contents

1. [Current Architecture Assessment](#1-current-architecture-assessment)
2. [Recommended Architecture](#2-recommended-architecture)
3. [Docker Stack](#3-docker-stack)
4. [Migration Path](#4-migration-path)
5. [Cost Analysis](#5-cost-analysis)
6. [Growth Path](#6-growth-path)
7. [Security Hardening](#7-security-hardening)
8. [Backup Strategy](#8-backup-strategy)
9. [Monitoring](#9-monitoring)

---

## 1. Current Architecture Assessment

### Overview

The AB Entertainment website currently runs on a split architecture across two separate servers:

| Component | Host | IP | Role |
|-----------|------|----|------|
| Static frontend | Hostinger Shared Business | 82.180.172.143 | Serves `next export` HTML/CSS/JS via LiteSpeed |
| API + SSR backend | External VPS | 187.77.12.13 | Next.js Docker container + PostgreSQL |

**Domain routing:**
- `abentertainment.com.au` -> Hostinger shared hosting (static export in `out/` directory)
- `api.abentertainment.com.au` -> External VPS (Next.js API routes + PostgreSQL)

### Tech Stack

- **Framework:** Next.js 16.1.6 with React 19.2.3
- **Styling:** Tailwind CSS 4.0
- **3D:** Three.js 0.183.2 (via React Three Fiber 9.5.0)
- **Database:** PostgreSQL (on external VPS)
- **Containerization:** Docker with Node 22 Alpine
- **Deployment:** PHP webhook on Hostinger (`deploy-webhook.php`) triggers `git pull` on push to `main`

### Current Build Configuration

The project uses a dual-mode build controlled by the `NEXT_EXPORT` environment variable:

```typescript
// next.config.ts (current)
const isStaticExport = process.env.NEXT_EXPORT === 'true';
const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
};
```

When `NEXT_EXPORT=true`, the build produces a static `out/` directory. Without it, the build produces a standalone Node.js server (used by the Docker container on the external VPS).

### Current Deployment Flow (Hostinger Shared)

1. GitHub push to `main` triggers the PHP webhook at `deploy-webhook.php`
2. Webhook validates HMAC SHA-256 signature
3. Runs `git fetch origin main && git reset --hard origin/main && git clean -fd`
4. LiteSpeed serves the `out/` directory via `.htaccess` rewrite rules

### Limitations of Current Architecture

| Limitation | Impact | Severity |
|------------|--------|----------|
| **No SSR capability** on Hostinger shared hosting | Cannot use Next.js middleware, server components, or dynamic rendering. All pages must be pre-rendered at build time. | High |
| **No middleware support** | Cannot implement server-side auth checks, redirects based on request headers, A/B testing, or geo-routing. | High |
| **Split DNS / CORS complexity** | Frontend at one IP, API at another requires CORS headers, complicates cookie-based auth, and doubles DNS failure points. | Medium |
| **Cache staleness** | `.htaccess` serves pre-built HTML; no ISR (Incremental Static Regeneration) means content updates require a full rebuild and deploy. | Medium |
| **No image optimization** | `images.unoptimized: true` is required because shared hosting cannot run the Sharp-based optimizer. All images served at original size. | Medium |
| **PHP webhook fragility** | The deploy webhook relies on PHP `exec()` availability, a secret file on disk, and `git` CLI on the shared host. Any Hostinger update could break it. | Medium |
| **Two servers to maintain** | Security patches, monitoring, backups, and SSH access must be managed in two places. The external VPS at 187.77.12.13 is a separate billing relationship. | Low |
| **No WebSocket support** | Shared hosting LiteSpeed does not support persistent WebSocket connections, limiting real-time features. | Low |

### Current .htaccess Workarounds

The static export requires a complex `.htaccess` configuration to:
- Rewrite all requests into the `out/` subdirectory
- Block access to source files (`.ts`, `.tsx`, `.json`, `.env`)
- Block access to `src/`, `node_modules/`, `.git/`, `data/`, `scripts/`
- Handle 404s via a pre-rendered 404 page
- Apply cache headers and compression

This entire layer becomes unnecessary with a proper Nginx reverse proxy.

---

## 2. Recommended Architecture

### Product Selection

**Primary recommendation: Hostinger VPS KVM 2**

| Attribute | Spec |
|-----------|------|
| **Product** | VPS KVM 2 |
| **Price** | $6.99/mo (48-month promotional rate) |
| **CPU** | 2 vCPU |
| **RAM** | 8 GB |
| **Storage** | 100 GB NVMe SSD |
| **Bandwidth** | 8 TB/month |
| **Data center** | Singapore (closest to Australia, ~50ms latency to Sydney) |
| **OS** | Ubuntu 24.04 LTS |
| **Root access** | Full root via SSH |

**Why VPS KVM 2 over alternatives:**

| Option | Why not |
|--------|---------|
| Shared Business ($2.69/mo) | No Docker, no root, no SSR, limited Node.js. Current pain points remain. |
| Cloud Startup ($6.99/mo) | Same price as VPS KVM 2 but managed environment limits Docker and custom Nginx config. Less RAM (4 GB vs 8 GB). |
| VPS KVM 4 ($9.99/mo) | Overkill for current traffic. Reserve as a growth path (see Section 6). |

### Additional Services

| Service | Cost | Purpose |
|---------|------|---------|
| **Cloudflare Free Tier** | $0/mo | CDN, DDoS protection, SSL termination, caching, WAF |
| **Domain DNS** | Already owned | Transfer DNS management to Cloudflare for CDN integration |
| **GitHub Actions** | Free (public repo) / $0 (2,000 min/mo free for private) | CI/CD pipeline |

### Architecture Diagram

```
                    Internet
                       |
                  [Cloudflare]
                  CDN + WAF + SSL
                       |
              Singapore VPS KVM 2
              (82.xxx.xxx.xxx)
                       |
                  [Nginx :80/:443]
                  Reverse Proxy
                   /         \
      [Next.js :3000]    [Static Assets]
      SSR + API Routes    /_next/static/
           |
      [PostgreSQL :5432]
      localhost only
```

### Consolidated Benefits

- **Single server** for frontend, API, and database
- **Full SSR** with Next.js standalone mode (server components, middleware, ISR)
- **Next.js Image Optimization** via Sharp (already in devDependencies)
- **Single DNS entry** -- no more CORS between domains
- **Docker orchestration** with compose for reproducible deploys
- **8 GB RAM** comfortably runs Nginx + Next.js + PostgreSQL concurrently
- **Root access** for full control over security, monitoring, and tooling

---

## 3. Docker Stack

### Container Architecture

| Container | Image | Port | Memory Limit | Role |
|-----------|-------|------|--------------|------|
| `nginx` | `nginx:1.27-alpine` | 80, 443 (host) | 128 MB | Reverse proxy, SSL termination, static file serving |
| `app` | Custom (Node 22 Alpine) | 3000 (internal) | 2 GB | Next.js SSR, API routes |
| `db` | `postgres:17-alpine` | 5432 (internal) | 1 GB | PostgreSQL database |

### docker-compose.yml

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot-webroot:/var/www/certbot:ro
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128m
    networks:
      - frontend

  app:
    build:
      context: .
      dockerfile: Dockerfile
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://abent:${DB_PASSWORD}@db:5432/abentertainment
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2048m
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    volumes:
      - app-data:/app/data
    networks:
      - frontend
      - backend

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: abentertainment
      POSTGRES_USER: abent
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    expose:
      - "5432"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1024m
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U abent -d abentertainment"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    secrets:
      - db_password
    networks:
      - backend

secrets:
  db_password:
    file: ./.secrets/db_password

volumes:
  pgdata:
    driver: local
  app-data:
    driver: local
  certbot-webroot:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access -- DB isolated
```

### Nginx Configuration

File: `nginx/conf.d/abentertainment.conf`

```nginx
upstream nextjs {
    server app:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name abentertainment.com.au www.abentertainment.com.au;

    # Certbot ACME challenge (for initial SSL setup before Cloudflare)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name abentertainment.com.au www.abentertainment.com.au;

    # Cloudflare Origin Certificate (15-year validity)
    ssl_certificate     /etc/nginx/ssl/origin.pem;
    ssl_certificate_key /etc/nginx/ssl/origin-key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml image/svg+xml;
    gzip_min_length 1000;
    gzip_vary on;

    # Static assets -- long cache, served directly
    location /_next/static/ {
        proxy_pass http://nextjs;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Public assets
    location /images/ {
        proxy_pass http://nextjs;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # API routes -- no caching
    location /api/ {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        add_header Cache-Control "no-store";
    }

    # Everything else -- Next.js SSR
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Updated Dockerfile

The existing Dockerfile already supports standalone mode. One change needed: ensure the build runs without `NEXT_EXPORT=true`:

```dockerfile
FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Explicitly use standalone output (no NEXT_EXPORT)
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "--max-old-space-size=1024", "server.js"]
```

### next.config.ts Change

Update `next.config.ts` to use `standalone` output by default (the `NEXT_EXPORT` escape hatch can remain for local testing):

```typescript
import type { NextConfig } from 'next';

const isStaticExport = process.env.NEXT_EXPORT === 'true';

const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : 'standalone',
  trailingSlash: true,
  images: {
    // Enable optimization in standalone mode
    unoptimized: isStaticExport,
  },
  serverExternalPackages: ['three'],
  experimental: {
    inlineCss: true,
  },
};

export default nextConfig;
```

---

## 4. Migration Path

### Prerequisites

- SSH key pair generated for VPS access
- GitHub repository access token (for CI/CD)
- Current PostgreSQL database dump from the external VPS
- Cloudflare account created
- Hostinger VPS KVM 2 purchased (Singapore data center)

### Step-by-Step Migration

#### Phase 1: Provision and Configure VPS (Day 1)

**Step 1.1 -- Purchase and access VPS**
```bash
# After purchasing VPS KVM 2 from Hostinger panel:
# 1. Select Singapore data center
# 2. Select Ubuntu 24.04 LTS
# 3. Set root password
# 4. Note the assigned IP address

# SSH into the new VPS
ssh root@<new-vps-ip>
```

**Step 1.2 -- System setup**
```bash
# Update system
apt update && apt upgrade -y

# Create deploy user (never deploy as root)
adduser deploy
usermod -aG sudo deploy

# Set up SSH key access for deploy user
mkdir -p /home/deploy/.ssh
# Copy your public key
echo "ssh-ed25519 AAAA... your-key" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# Disable password authentication (see Section 7 for full hardening)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

**Step 1.3 -- Install Docker**
```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh

# Add deploy user to docker group
usermod -aG docker deploy

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

**Step 1.4 -- Create project directory structure**
```bash
su - deploy
mkdir -p ~/abentertainment/{nginx/conf.d,nginx/ssl,db/init,.secrets}

# Set restrictive permissions on secrets directory
chmod 700 ~/abentertainment/.secrets
```

#### Phase 2: Switch to SSR Build (Day 1-2)

**Step 2.1 -- Update next.config.ts**

Change `output` to default to `'standalone'` as shown in Section 3.

**Step 2.2 -- Test locally**
```bash
# Build in standalone mode
npm run build

# Verify .next/standalone/ directory was created
ls -la .next/standalone/

# Test locally
node .next/standalone/server.js
# Visit http://localhost:3000
```

**Step 2.3 -- Build and test Docker image**
```bash
docker build -t abentertainment:test .
docker run --rm -p 3000:3000 abentertainment:test
# Visit http://localhost:3000 -- verify all pages render
```

**Step 2.4 -- Audit for static-export assumptions**

Search the codebase for patterns that may break when switching from static to SSR:
- Hardcoded `api.abentertainment.com.au` URLs (replace with relative `/api/` paths)
- Client-side-only data fetching that should become server components
- Any reliance on the `out/` directory structure

#### Phase 3: Migrate PostgreSQL Data (Day 2)

**Step 3.1 -- Create database dump on current VPS**
```bash
# On the current external VPS (187.77.12.13)
ssh user@187.77.12.13

# Create a temporary migration user with read-only access
sudo -u postgres psql -c "CREATE ROLE migration_export WITH LOGIN PASSWORD 'temp_migration_pw';"
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE abentertainment TO migration_export;"
sudo -u postgres psql -d abentertainment -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO migration_export;"

# Dump using the restricted user
pg_dump -U migration_export -h localhost -d abentertainment \
  --format=custom --compress=9 --no-owner --no-privileges \
  -f /tmp/abent_migration.dump

# Verify dump integrity
pg_restore --list /tmp/abent_migration.dump | head -20
```

**Step 3.2 -- Transfer dump securely**
```bash
# From your local machine or directly between servers via SSH
scp -C user@187.77.12.13:/tmp/abent_migration.dump \
    deploy@<new-vps-ip>:/home/deploy/abentertainment/db/

# Or use rsync for resumable transfer
rsync -avzP user@187.77.12.13:/tmp/abent_migration.dump \
    deploy@<new-vps-ip>:/home/deploy/abentertainment/db/
```

**Step 3.3 -- Start the database container and restore**
```bash
# On the new VPS
cd ~/abentertainment

# Generate a strong database password
openssl rand -base64 32 > .secrets/db_password
chmod 600 .secrets/db_password

# Start only the database container
docker compose up -d db

# Wait for PostgreSQL to become healthy
docker compose exec db pg_isready -U abent

# Restore the dump
docker compose exec -T db pg_restore \
  -U abent -d abentertainment \
  --no-owner --no-privileges \
  < db/abent_migration.dump

# Verify
docker compose exec db psql -U abent -d abentertainment -c "\dt"
```

**Step 3.4 -- Clean up migration artifacts**
```bash
# On the old VPS: revoke the temporary migration user
ssh user@187.77.12.13
sudo -u postgres psql -c "REVOKE ALL ON DATABASE abentertainment FROM migration_export;"
sudo -u postgres psql -c "DROP ROLE migration_export;"

# On both servers: remove dump files
rm /tmp/abent_migration.dump        # old VPS
rm ~/abentertainment/db/abent_migration.dump  # new VPS
```

#### Phase 4: Deploy Full Stack (Day 2-3)

**Step 4.1 -- Clone repository and deploy**
```bash
# On the new VPS
cd ~/abentertainment

# Clone the repo (or push from local)
git clone git@github.com:Victordtesla24/abentertainment.git repo
# Copy config files into place
cp repo/docker-compose.yml .
cp repo/Dockerfile .
cp -r repo/nginx/ .

# Create .env file
cat > .env << 'EOF'
DB_PASSWORD=<contents of .secrets/db_password>
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
OPENAI_API_KEY=<your key>
EOF
chmod 600 .env

# Build and start all services
docker compose up -d --build

# Verify all containers are healthy
docker compose ps
docker compose logs --tail=20
```

**Step 4.2 -- Test before DNS cutover**

Add a temporary entry to your local `/etc/hosts`:
```
<new-vps-ip>  abentertainment.com.au
```
Visit `https://abentertainment.com.au` and test thoroughly:
- All pages render with SSR
- API routes return data
- Database queries work
- Three.js scenes load
- Forms submit correctly

#### Phase 5: DNS Cutover and Cloudflare Setup (Day 3)

**Step 5.1 -- Add site to Cloudflare**
1. Sign up at cloudflare.com (free plan)
2. Add site: `abentertainment.com.au`
3. Cloudflare will scan existing DNS records

**Step 5.2 -- Configure DNS records in Cloudflare**

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `abentertainment.com.au` | `<new-vps-ip>` | Proxied (orange cloud) | Auto |
| A | `www` | `<new-vps-ip>` | Proxied | Auto |
| CNAME | `api` | `abentertainment.com.au` | Proxied | Auto |

Note: `api.abentertainment.com.au` now points to the same server. API routes are handled by Next.js at `/api/*` on the consolidated VPS. The `api` subdomain can redirect or be kept for backwards compatibility.

**Step 5.3 -- Update nameservers**
- Log in to your domain registrar
- Replace existing nameservers with the Cloudflare-assigned pair
- Propagation: typically 1-24 hours

**Step 5.4 -- Configure Cloudflare SSL**
1. Go to SSL/TLS > Overview > Set mode to **Full (Strict)**
2. Go to SSL/TLS > Origin Server > Create Certificate
3. Download the origin certificate and private key
4. Place them on the VPS:

```bash
# On the VPS
scp origin.pem deploy@<new-vps-ip>:~/abentertainment/nginx/ssl/
scp origin-key.pem deploy@<new-vps-ip>:~/abentertainment/nginx/ssl/
chmod 600 ~/abentertainment/nginx/ssl/origin-key.pem
```

5. Restart Nginx:
```bash
docker compose restart nginx
```

**Step 5.5 -- Remove the old `.htaccess` and webhook**

Once DNS has fully propagated and the new VPS is confirmed working:
- The `.htaccess` file is no longer needed
- The `deploy-webhook.php` is replaced by GitHub Actions (see Step 6)
- The shared hosting plan can be cancelled at the end of its billing cycle

#### Phase 6: Configure CI/CD via GitHub Actions (Day 3-4)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/abentertainment
            docker compose pull app
            docker compose up -d --no-deps app
            docker image prune -f
```

**GitHub Secrets to configure:**

| Secret | Value |
|--------|-------|
| `VPS_HOST` | The new VPS IP address |
| `VPS_SSH_KEY` | Private SSH key for the `deploy` user |
| `OPENAI_API_KEY` | OpenAI API key (if needed at build time) |

---

## 5. Cost Analysis

### Current Monthly Costs

| Item | Cost/mo | Notes |
|------|---------|-------|
| Hostinger Shared Business | ~$2.69 | 48-month promotional rate; renews at ~$5.99/mo |
| External VPS (187.77.12.13) | ~$10-20 (est.) | Third-party VPS running Docker + PostgreSQL |
| Domain registration | ~$1.50 | Annual cost amortized monthly |
| **Total (estimated)** | **~$14-24/mo** | |

### Recommended Monthly Costs

| Item | Cost/mo | Notes |
|------|---------|-------|
| Hostinger VPS KVM 2 | $6.99 | 48-month promotional rate; renews at ~$13.99/mo |
| Cloudflare Free Tier | $0 | CDN, WAF, SSL, analytics |
| Domain registration | ~$1.50 | Unchanged |
| GitHub Actions | $0 | Free tier: 2,000 min/mo for private repos |
| **Total** | **~$8.49/mo** | |

### Savings

| Metric | Value |
|--------|-------|
| **Monthly savings** | $5.51-15.51/mo (estimated) |
| **Annual savings** | $66-186/year |
| **Consolidation** | 2 servers -> 1 server |
| **Operational overhead** | Halved (single server to patch, monitor, secure) |

### Price Lock Considerations

Hostinger promotional pricing requires a 48-month commitment for the $6.99/mo rate. The 12-month rate for VPS KVM 2 is approximately $10.99/mo. Even at the higher monthly rate, the consolidated architecture remains cheaper than the current split setup.

---

## 6. Growth Path

### When to Upgrade to VPS KVM 4

| Signal | Threshold | Action |
|--------|-----------|--------|
| **RAM usage** consistently above 70% | >5.6 GB sustained over 7 days | Upgrade to KVM 4 (16 GB RAM) |
| **CPU usage** consistently above 80% | >1.6 vCPU sustained during peak hours | Upgrade to KVM 4 (4 vCPU) |
| **Storage usage** above 75% | >75 GB used | Upgrade to KVM 4 (200 GB NVMe) |
| **Bandwidth** approaching limit | >6 TB/month | Upgrade to KVM 4 (16 TB/month) |
| **Response times** degrading | P95 latency > 500ms for SSR pages | Profile first, then upgrade if resource-bound |
| **Monthly unique visitors** | >50,000/month | Evaluate resource usage; upgrade if constrained |

### VPS KVM 4 Specifications

| Attribute | KVM 2 (current) | KVM 4 (upgrade) |
|-----------|-----------------|-----------------|
| Price | $6.99/mo | $9.99/mo |
| vCPU | 2 | 4 |
| RAM | 8 GB | 16 GB |
| NVMe | 100 GB | 200 GB |
| Bandwidth | 8 TB/mo | 16 TB/mo |

### Upgrade Process

Hostinger VPS upgrades can be done through the control panel without data loss:
1. Navigate to VPS management panel
2. Select "Change plan"
3. Choose KVM 4
4. The VPS will be briefly restarted (typically < 5 minutes)
5. Docker containers will auto-restart due to `restart: unless-stopped` policy

### Beyond KVM 4

If the site outgrows KVM 4, consider:
- **Horizontal scaling:** Separate the database to a managed PostgreSQL service (e.g., Supabase, Neon, or Hostinger Cloud Database) and run multiple app containers behind a load balancer
- **Container orchestration:** Docker Swarm on VPS or migration to a managed Kubernetes service
- **CDN offloading:** Use Cloudflare Workers or Pages for static content, reducing origin server load

### VPS KVM 2 Peak Load Validation

**Question:** Can VPS KVM 2 (2 vCPU, 8 GB RAM) handle AB Entertainment at peak load with full SSR?

**Workload profile:**
- Entertainment/events website for Australian market
- Estimated peak: 200-500 concurrent users (event announcement spikes)
- Pages: ~15 routes, Three.js 3D canvas on homepage, image-heavy gallery
- SSR page generation: ~50-100ms per request (Next.js standalone, no heavy DB queries)
- Database: PostgreSQL with <10 tables, read-heavy (event listings, gallery metadata)

**Memory budget at peak (8 GB total):**

| Component | Idle | Peak (500 concurrent) | Notes |
|-----------|------|-----------------------|-------|
| OS + system | 300 MB | 400 MB | Ubuntu 24.04 LTS |
| Nginx | 20 MB | 80 MB | Worker processes scale with connections |
| Next.js (Node.js) | 200 MB | 1.2 GB | V8 heap grows under load; SSR is CPU-bound |
| PostgreSQL | 150 MB | 500 MB | shared_buffers=256MB, connection pooling |
| Docker overhead | 100 MB | 150 MB | Container runtime |
| **Total** | **770 MB** | **2.33 GB** | **5.67 GB headroom** |

**CPU budget at peak:**
- Nginx: <5% (static asset serving, reverse proxy)
- Next.js SSR: 60-80% of 2 vCPU at 500 concurrent (SSR is CPU-bound)
- PostgreSQL: 10-15% (simple reads, indexed queries)
- **Verdict:** 2 vCPU handles 500 concurrent SSR requests comfortably. CPU becomes the bottleneck before RAM. At sustained >800 concurrent, consider KVM 4.

**Bandwidth validation:**
- Average page weight (with SSR + Cloudflare cache misses): ~800 KB
- 500 concurrent users × 3 pages/session × 800 KB = 1.2 GB per spike
- Monthly estimate (10,000 unique visitors/month, 5 pages avg): ~40 GB/month
- 8 TB/month limit provides >100x headroom

**Important caveat:** The 500-concurrent figure assumes Cloudflare CDN handles 80-90% of requests (static assets, cached HTML). Node.js SSR is single-threaded per request (~100ms each), so the origin server can sustain ~18-20 SSR renders/second on 2 vCPU. At peak, only 50-100 of the 500 concurrent users hit origin for fresh SSR — the rest are served from Cloudflare's edge cache.

**Verdict:** VPS KVM 2 is **well-suited** for AB Entertainment at current and foreseeable scale. The 8 GB RAM provides comfortable headroom (>5 GB free at peak). CPU is the limiting factor at origin, with a practical ceiling around 800 concurrent users (50-100 hitting origin) before upgrade to KVM 4 is warranted. Cloudflare CDN caching is load-bearing for this architecture — without it, the origin caps at ~20 concurrent SSR renders.

---

## 7. Security Hardening

### 7.1 Firewall (UFW)

```bash
# Install and enable UFW
apt install ufw -y

# Default policy: deny all incoming, allow all outgoing
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (rate-limited)
ufw limit 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Verify
ufw status verbose
```

**Important:** PostgreSQL port (5432) is NOT opened. The database is only accessible via Docker's internal `backend` network.

### 7.2 SSH Hardening

Edit `/etc/ssh/sshd_config`:

```
# Disable root login
PermitRootLogin no

# Key-only authentication
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey

# Disable unused auth methods
ChallengeResponseAuthentication no
UsePAM yes
KbdInteractiveAuthentication no

# Limit to deploy user
AllowUsers deploy

# Connection limits
MaxAuthTries 3
MaxSessions 3
LoginGraceTime 30

# Disable forwarding (unless needed)
AllowTcpForwarding no
X11Forwarding no
```

Restart: `systemctl restart sshd`

### 7.3 SSH Key Management

#### Access Control Matrix

| Key Owner | Access Level | Authorized For | Key Type |
|-----------|-------------|----------------|----------|
| Developer (you) | `deploy` user | Full deploy + admin | Ed25519 |
| GitHub Actions | `deploy` user | Deploy only (restricted shell optional) | Ed25519 |
| Emergency recovery | `root` user (Hostinger console) | Break-glass only | N/A (console) |

#### Key Rotation Schedule

| Action | Frequency | Procedure |
|--------|-----------|-----------|
| Rotate developer SSH key | Every 6 months | Generate new key, add to `authorized_keys`, test, remove old key |
| Rotate GitHub Actions deploy key | Every 6 months | Generate new key, update GitHub secret `VPS_SSH_KEY`, update `authorized_keys` |
| Audit `authorized_keys` | Monthly | `cat /home/deploy/.ssh/authorized_keys` -- verify each key is still needed |
| Review SSH auth logs | Weekly | `journalctl -u sshd --since "7 days ago" \| grep "Failed"` |

#### Emergency Key Revocation

If a key is compromised:
```bash
# 1. Immediately remove the compromised key
# SSH in with a non-compromised key, or use Hostinger VPS console
sed -i '/COMPROMISED_KEY_FINGERPRINT/d' /home/deploy/.ssh/authorized_keys

# 2. Restart SSH to drop existing sessions
systemctl restart sshd

# 3. Review recent access
journalctl -u sshd --since "30 days ago" | grep "Accepted"

# 4. If GitHub Actions key was compromised, also:
#    - Rotate the GitHub secret immediately
#    - Review recent deployments for unauthorized changes
#    - Consider rotating application secrets as well
```

### 7.4 Fail2Ban

```bash
apt install fail2ban -y

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Verify
fail2ban-client status sshd
```

### 7.5 PostgreSQL Security

The PostgreSQL container is already isolated by Docker's internal network (`backend` with `internal: true`), but additional hardening:

```bash
# In db/init/01-hardening.sql (mounted via docker-compose)

-- Revoke public schema access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO abent;

-- Create a read-only user for backups
-- Generate a random password: openssl rand -base64 24
CREATE ROLE backup_ro WITH LOGIN PASSWORD '<generate-random-password>';
GRANT CONNECT ON DATABASE abentertainment TO backup_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_ro;

-- Enable connection logging
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
```

**Network isolation:** The `backend` network in docker-compose is marked `internal: true`, meaning no container on that network can reach the internet. Only the `app` container, which is on both `frontend` and `backend` networks, can communicate with PostgreSQL.

### 7.6 Cloudflare Security Configuration

#### SSL/TLS
- **Mode:** Full (Strict) -- requires a valid origin certificate on the VPS
- **Minimum TLS version:** 1.2
- **Automatic HTTPS rewrites:** Enabled
- **Always Use HTTPS:** Enabled
- **HSTS:** Enabled (max-age: 6 months, include subdomains)

#### WAF Rules
```
# Cloudflare WAF custom rules (via dashboard or API)

Rule 1: Block non-AU traffic to /api/admin/*
  Expression: (http.request.uri.path matches "^/api/admin/") and (ip.geoip.country ne "AU")
  Action: Block

Rule 2: Rate-limit API endpoints
  Expression: (http.request.uri.path matches "^/api/")
  Action: Rate limit (100 requests per minute per IP)

Rule 3: Challenge suspicious bot traffic
  Expression: (cf.bot_management.score lt 30) and (not cf.bot_management.verified_bot)
  Action: Managed Challenge
```

#### Origin IP Privacy

With Cloudflare proxying enabled (orange cloud), the VPS IP is hidden from DNS lookups. Additional steps:
- Do not expose the origin IP in HTTP headers, error pages, or email headers
- Configure Nginx to only accept connections from Cloudflare IP ranges:

```nginx
# In nginx/conf.d/cloudflare-only.conf
# Cloudflare IPv4 ranges (update periodically from https://cloudflare.com/ips-v4)
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;
```

### 7.7 Secrets Management

#### Strategy

| Secret | Storage Method | Access |
|--------|---------------|--------|
| `DB_PASSWORD` | Docker secrets file (`.secrets/db_password`) | `db` container only via `POSTGRES_PASSWORD_FILE` |
| `NEXTAUTH_SECRET` | `.env` file (chmod 600) | `app` container via environment variable |
| `OPENAI_API_KEY` | `.env` file (chmod 600) | `app` container via environment variable |
| SSH private keys | `~/.ssh/` (chmod 600) | `deploy` user only |
| Cloudflare Origin key | `nginx/ssl/` (chmod 600) | `nginx` container via volume mount |
| GitHub Actions secrets | GitHub encrypted secrets | CI/CD pipeline only |

#### File Permissions

```bash
# On the VPS
chmod 600 ~/abentertainment/.env
chmod 600 ~/abentertainment/.secrets/db_password
chmod 600 ~/abentertainment/nginx/ssl/origin-key.pem
chmod 700 ~/abentertainment/.secrets/
chown -R deploy:deploy ~/abentertainment/.secrets/
```

#### Rotation Schedule

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| Database password | Every 6 months | Update `.secrets/db_password`, run `ALTER USER abent PASSWORD '...'` in psql, restart `app` container |
| NEXTAUTH_SECRET | Every 12 months | Update `.env`, restart `app` container (invalidates existing sessions) |
| OPENAI_API_KEY | As needed / on suspected compromise | Update in `.env` and GitHub secret, restart `app` container |
| Cloudflare Origin cert | Every 15 years (Cloudflare default) | Replace cert files, restart `nginx` container |

#### CI/CD Secrets Passing

GitHub Actions secrets are injected as environment variables at runtime, never written to disk or logged:

```yaml
# In the deploy step, secrets are passed via SSH, not baked into the image
- name: Deploy
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.VPS_HOST }}
    key: ${{ secrets.VPS_SSH_KEY }}
    script: |
      cd ~/abentertainment
      # Secrets live on the VPS in .env -- never transmitted from GitHub
      docker compose pull app
      docker compose up -d --no-deps app
```

Application secrets (API keys, database URL) are stored in the VPS `.env` file, not in the Docker image or GitHub repository. The CI/CD pipeline only handles the deployment action over SSH; it does not transmit secrets.

### 7.8 Database Migration Security

The migration process in Section 4 Phase 3 follows these security principles:

1. **Least-privilege dump user:** A temporary `migration_export` role is created with `SELECT`-only access, used for the dump, then immediately dropped
2. **Encrypted transfer:** `scp` and `rsync` use SSH encryption for the dump file in transit
3. **No plaintext passwords in commands:** Use `POSTGRES_PASSWORD_FILE` (Docker secrets) rather than passing passwords as environment variables visible in `docker inspect`
4. **Cleanup after restore:** Dump files are deleted from both origin and destination servers after successful restore
5. **Verification:** The dump is verified with `pg_restore --list` before restoration, and table structure is confirmed with `\dt` after

---

## 8. Backup Strategy

### Automated PostgreSQL Backups

Create a backup script on the VPS:

```bash
#!/usr/bin/env bash
# /home/deploy/abentertainment/scripts/backup-db.sh
set -euo pipefail

BACKUP_DIR="/home/deploy/backups/postgres"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/abent_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

# Dump via Docker
docker compose -f /home/deploy/abentertainment/docker-compose.yml \
  exec -T db pg_dump -U abent -d abentertainment \
  --format=custom --compress=9 \
  > "${BACKUP_FILE}"

# Verify the dump is not empty
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file is empty!" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Log size
SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete: ${BACKUP_FILE} (${SIZE})"

# Prune old backups
find "${BACKUP_DIR}" -name "abent_*.dump" -mtime +${RETENTION_DAYS} -delete

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pruned backups older than ${RETENTION_DAYS} days"
```

### Cron Schedule

```bash
# As the deploy user
crontab -e

# Daily backup at 03:00 UTC (14:00 AEST -- low traffic)
0 3 * * * /home/deploy/abentertainment/scripts/backup-db.sh >> /home/deploy/backups/backup.log 2>&1

# Weekly full-system docker volume backup (Sunday 04:00 UTC)
0 4 * * 0 docker run --rm -v abentertainment_pgdata:/data -v /home/deploy/backups/volumes:/backup alpine tar czf /backup/pgdata_$(date +\%Y\%m\%d).tar.gz -C /data . >> /home/deploy/backups/backup.log 2>&1
```

### Hostinger VPS Snapshots

Hostinger VPS provides weekly automatic snapshots of the entire VPS disk. These serve as a disaster-recovery fallback:

| Feature | Detail |
|---------|--------|
| Frequency | Weekly (automatic) |
| Retention | Last 2 snapshots |
| Restoration | Full VPS restore via Hostinger panel |
| Use case | Complete disaster recovery (OS + Docker + data) |

### Backup Verification

Periodically test that backups can actually be restored:

```bash
# Monthly verification: restore to a temporary database
docker compose exec db createdb -U abent abent_test_restore
docker compose exec -T db pg_restore \
  -U abent -d abent_test_restore \
  --no-owner --no-privileges \
  < /home/deploy/backups/postgres/abent_LATEST.dump

# Verify table count matches
docker compose exec db psql -U abent -d abent_test_restore -c "\dt" | tail -1

# Clean up
docker compose exec db dropdb -U abent abent_test_restore
```

### Off-Site Backup (Optional)

For additional safety, sync backups to a cloud storage provider:

```bash
# Example using rclone to Backblaze B2 or S3-compatible storage
rclone sync /home/deploy/backups/postgres remote:abent-backups/postgres \
  --max-age 14d \
  --transfers 1
```

---

## 9. Monitoring

### Container Health Checks

All three containers include Docker health checks (defined in `docker-compose.yml`):

| Container | Health Check | Interval |
|-----------|-------------|----------|
| `app` | `wget --spider http://localhost:3000/api/health` | 30s |
| `db` | `pg_isready -U abent -d abentertainment` | 10s |
| `nginx` | Depends on `app` health | Inherited |

### Application Health Endpoint

Create `/api/health` in the Next.js app:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // Optionally check database connectivity
  try {
    // await db.query('SELECT 1');
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
```

### Uptime Monitoring

Use a free external uptime monitor to detect outages:

| Service | Free Tier | Check Interval | Alerts |
|---------|-----------|----------------|--------|
| **UptimeRobot** | 50 monitors | 5 minutes | Email, Slack, webhook |
| **Better Stack** (formerly Better Uptime) | 10 monitors | 3 minutes | Email, SMS, Slack |
| **Cloudflare Health Checks** | Included with free plan | 60 seconds | Email |

**Recommended monitors:**

| Monitor | URL | Expected |
|---------|-----|----------|
| Homepage | `https://abentertainment.com.au` | 200 OK |
| Health API | `https://abentertainment.com.au/api/health` | 200 OK + JSON |
| SSL expiry | `https://abentertainment.com.au` | Valid cert |

### Server Resource Monitoring

```bash
# Install lightweight monitoring (no external dependencies)
apt install -y htop iotop

# Docker stats (real-time)
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Cron-based resource logging
cat > /home/deploy/scripts/log-resources.sh << 'SCRIPT'
#!/usr/bin/env bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $(free -m | awk '/Mem:/{printf "RAM: %s/%sMB (%.1f%%)", $3, $2, $3/$2*100}') | $(df -h / | awk 'NR==2{printf "Disk: %s/%s (%s)", $3, $2, $5}') | $(uptime | awk -F'load average:' '{print "Load:" $2}')"
SCRIPT
chmod +x /home/deploy/scripts/log-resources.sh

# Log every 15 minutes
echo "*/15 * * * * /home/deploy/scripts/log-resources.sh >> /home/deploy/logs/resources.log 2>&1" | crontab -
```

### Log Management

```bash
# Docker logs are managed by Docker's json-file driver
# Configure log rotation in /etc/docker/daemon.json
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# View logs
docker compose logs -f app        # Next.js logs
docker compose logs -f nginx      # Access/error logs
docker compose logs -f db         # PostgreSQL logs
```

### Alerting Script

A simple alerting script that can be run via cron:

```bash
#!/usr/bin/env bash
# /home/deploy/scripts/alert-check.sh
set -euo pipefail

ALERT_EMAIL="admin@abentertainment.com.au"
HOSTNAME=$(hostname)

# Check if all containers are running
UNHEALTHY=$(docker compose -f /home/deploy/abentertainment/docker-compose.yml ps --format json | \
  python3 -c "import sys,json; [print(c['Name']) for c in json.loads(sys.stdin.read()) if c.get('Health','') not in ('healthy','')]" 2>/dev/null || true)

if [ -n "$UNHEALTHY" ]; then
  echo "ALERT: Unhealthy containers on ${HOSTNAME}: ${UNHEALTHY}" | \
    mail -s "[AB Entertainment] Container Health Alert" "${ALERT_EMAIL}"
fi

# Check disk usage
DISK_PCT=$(df / | awk 'NR==2{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 85 ]; then
  echo "ALERT: Disk usage at ${DISK_PCT}% on ${HOSTNAME}" | \
    mail -s "[AB Entertainment] Disk Space Alert" "${ALERT_EMAIL}"
fi

# Check RAM usage
RAM_PCT=$(free | awk '/Mem:/{printf "%.0f", $3/$2*100}')
if [ "$RAM_PCT" -gt 85 ]; then
  echo "ALERT: RAM usage at ${RAM_PCT}% on ${HOSTNAME}" | \
    mail -s "[AB Entertainment] Memory Alert" "${ALERT_EMAIL}"
fi
```

```bash
# Run every 5 minutes
echo "*/5 * * * * /home/deploy/scripts/alert-check.sh 2>/dev/null" >> /var/spool/cron/crontabs/deploy
```

---

## Appendix: Quick Reference Commands

```bash
# Deploy (manual)
cd ~/abentertainment && docker compose up -d --build

# View status
docker compose ps
docker compose logs --tail=50 -f

# Restart a single service
docker compose restart app

# Database console
docker compose exec db psql -U abent -d abentertainment

# View resource usage
docker stats

# Emergency rollback (if deploy breaks)
docker compose down
git checkout HEAD~1
docker compose up -d --build

# Backup now
/home/deploy/abentertainment/scripts/backup-db.sh

# View firewall status
sudo ufw status verbose

# Check fail2ban
sudo fail2ban-client status sshd

# Check SSL certificate
echo | openssl s_client -connect abentertainment.com.au:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Appendix: Migration Checklist

- [ ] Purchase Hostinger VPS KVM 2 (Singapore data center)
- [ ] Set up Ubuntu 24.04 LTS with SSH key access
- [ ] Install Docker and Docker Compose
- [ ] Configure UFW firewall
- [ ] Install and configure fail2ban
- [ ] Harden SSH configuration
- [ ] Update `next.config.ts` to default to `standalone` output
- [ ] Test SSR build locally
- [ ] Build and test Docker image locally
- [ ] Set up Docker Compose stack on VPS (Nginx + Next.js + PostgreSQL)
- [ ] Create PostgreSQL dump on old VPS
- [ ] Transfer dump securely via SCP
- [ ] Restore dump to new PostgreSQL container
- [ ] Clean up migration artifacts and temporary user
- [ ] Test site via `/etc/hosts` override
- [ ] Create Cloudflare account and add site
- [ ] Generate Cloudflare Origin Certificate
- [ ] Configure DNS records in Cloudflare
- [ ] Update domain nameservers to Cloudflare
- [ ] Configure Cloudflare SSL (Full Strict), WAF, and rate limiting
- [ ] Set up GitHub Actions CI/CD workflow
- [ ] Configure GitHub repository secrets
- [ ] Verify automated deployment works
- [ ] Set up database backup cron job
- [ ] Set up resource monitoring and alerting
- [ ] Configure external uptime monitoring (UptimeRobot or similar)
- [ ] Configure Docker log rotation
- [ ] Test backup restoration procedure
- [ ] Cancel old shared hosting plan (after DNS propagation confirmed)
- [ ] Decommission old external VPS (after verification period)
