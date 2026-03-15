import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, isRedisConfigured } from "@/lib/env";

type ActionName = "contact" | "newsletter" | "booking";

const redis = isRedisConfigured
  ? new Redis({
      url: env.redis.url!,
      token: env.redis.token!,
    })
  : null;

const rateLimiters: Record<ActionName, Ratelimit | null> = {
  contact: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "10 m"),
        prefix: "ab-entertainment-contact",
      })
    : null,
  newsletter: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "30 m"),
        prefix: "ab-entertainment-newsletter",
      })
    : null,
  booking: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(4, "15 m"),
        prefix: "ab-entertainment-booking",
      })
    : null,
};

export async function enforceRateLimit(action: ActionName, key: string) {
  const limiter = rateLimiters[action];

  if (!limiter) {
    return {
      success: true,
      limit: Number.POSITIVE_INFINITY,
      remaining: Number.POSITIVE_INFINITY,
      reset: 0,
    };
  }

  return limiter.limit(key);
}
