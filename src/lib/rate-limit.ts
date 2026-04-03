import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash Redis is configured
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Create Redis client only if credentials are available
const redis = hasRedis
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null;

// ============================================
// UPSTASH REDIS RATE LIMITERS (Production)
// ============================================

// Rate limiter configurations using Upstash
export const rateLimiters = {
    // General API rate limit: 300 requests per minute (increased for shared WiFi)
    api: redis ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(300, "1 m"),
        analytics: true,
        prefix: "ratelimit:api",
    }) : null,

    // Auth rate limit: 10 attempts per minute (stricter for login)
    auth: redis ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
        prefix: "ratelimit:auth",
    }) : null,

    // Attendance API: 200 requests per minute (for IoT devices)
    attendance: redis ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(200, "1 m"),
        analytics: true,
        prefix: "ratelimit:attendance",
    }) : null,

    // Student mutations: 20 per minute
    mutations: redis ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
        prefix: "ratelimit:mutations",
    }) : null,

    // AI Chatbot: 10 requests per day per user (to prevent cost explosion)
    chat: redis ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 d"),
        analytics: true,
        prefix: "ratelimit:chat",
    }) : null,
};

export type RateLimitType = keyof typeof rateLimiters;

// ============================================
// IN-MEMORY FALLBACK (Development/No Redis)
// ============================================

export class RateLimiter {
    private tokens: Map<string, { count: number; lastRefill: number }>;
    private capacity: number;
    private refillRate: number;

    constructor(capacity: number, refillTimeMs: number) {
        this.tokens = new Map();
        this.capacity = capacity;
        this.refillRate = capacity / refillTimeMs;
    }

    check(key: string): { success: boolean; remaining: number } {
        const now = Date.now();
        const state = this.tokens.get(key) || { count: this.capacity, lastRefill: now };

        const elapsed = now - state.lastRefill;
        const refill = Math.floor(elapsed * this.refillRate);

        if (refill > 0) {
            state.count = Math.min(this.capacity, state.count + refill);
            state.lastRefill = now;
        }

        if (state.count > 0) {
            state.count--;
            this.tokens.set(key, state);
            return { success: true, remaining: state.count };
        }

        return { success: false, remaining: 0 };
    }
}

// Global fallback instance for general APIs (300/min)
export const globalLimiter = new RateLimiter(300, 60 * 1000);

// Specific fallback for AI Chatbot (10/day)
export const chatFallbackLimiter = new RateLimiter(10, 24 * 60 * 60 * 1000);

// ============================================
// UNIFIED RATE LIMIT CHECK
// ============================================

/**
 * Check rate limit for an identifier (usually IP address)
 * Uses Upstash Redis if available, otherwise falls back to in-memory
 */
export async function checkRateLimit(
    identifier: string,
    type: RateLimitType = "api"
): Promise<{ success: boolean; remaining: number; reset: number; limit: number }> {
    const limiter = rateLimiters[type];

    // If Upstash Redis is configured, use it
    if (limiter) {
        try {
            // Add a more generous timeout to avoid hanging the middleware (especially in dev)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Rate limit timeout")), 1000)
            );

            const result = (await Promise.race([
                limiter.limit(identifier),
                timeoutPromise
            ])) as { success: boolean; remaining: number; reset: number; limit: number };

            return {
                success: result.success,
                remaining: result.remaining,
                reset: result.reset,
                limit: result.limit,
            };
        } catch (error) {
            console.error("Upstash rate limit check failed or timed out:", error);
            // Fallback to in-memory on error or timeout
        }
    }

    // Fallback to in-memory rate limiter based on type
    const isChat = type === "chat";
    const limiterToUse = isChat ? chatFallbackLimiter : globalLimiter;
    const fallbackLimit = isChat ? 10 : 300;

    const result = limiterToUse.check(identifier);
    return {
        success: result.success,
        remaining: result.remaining,
        reset: Date.now() + (isChat ? 24 * 60 * 60 * 1000 : 60000),
        limit: fallbackLimit,
    };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
    // Vercel provides this header
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    const realIP = request.headers.get("x-real-ip");
    if (realIP) return realIP;

    const cfConnectingIP = request.headers.get("cf-connecting-ip");
    if (cfConnectingIP) return cfConnectingIP;

    return "unknown";
}

/**
 * Check if Upstash Redis is configured
 */
export function isRedisConfigured(): boolean {
    return hasRedis;
}
