import { SITE_CONFIG } from "@/lib/constants";

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export const env = {
  siteUrl: readOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? SITE_CONFIG.url,
  sanity: {
    projectId: readOptionalEnv("NEXT_PUBLIC_SANITY_PROJECT_ID"),
    dataset: readOptionalEnv("NEXT_PUBLIC_SANITY_DATASET"),
    token: readOptionalEnv("SANITY_API_READ_TOKEN"),
  },
  stripe: {
    secretKey: readOptionalEnv("STRIPE_SECRET_KEY"),
    publishableKey: readOptionalEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    webhookSecret: readOptionalEnv("STRIPE_WEBHOOK_SECRET"),
  },
  redis: {
    url: readOptionalEnv("UPSTASH_REDIS_REST_URL"),
    token: readOptionalEnv("UPSTASH_REDIS_REST_TOKEN"),
  },
  postgres: {
    connection:
      readOptionalEnv("POSTGRES_URL") ??
      readOptionalEnv("POSTGRES_PRISMA_URL") ??
      readOptionalEnv("POSTGRES_URL_NON_POOLING"),
  },
} as const;

export const isSanityConfigured = Boolean(
  env.sanity.projectId && env.sanity.dataset
);

export const isStripeConfigured = Boolean(env.stripe.secretKey);

export const isRedisConfigured = Boolean(env.redis.url && env.redis.token);

export const isPostgresConfigured = Boolean(env.postgres.connection);
