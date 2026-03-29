"use client";

/**
 * globalSyncChannel.ts — BroadcastChannel for same-device, cross-tab sync.
 *
 * Replaces router.refresh() storms with targeted SWR key invalidation.
 * Includes a 15-second throttle per burst to prevent refresh floods.
 */

type SyncHandler = (swrKey: string) => void;

let channel: BroadcastChannel | null = null;
let lastBroadcastAt = 0;

const THROTTLE_MS = 15_000; // 15 seconds per burst

/**
 * Get or create the singleton BroadcastChannel.
 */
function getChannel(): BroadcastChannel | null {
    if (typeof window === "undefined") return null;
    if (!("BroadcastChannel" in window)) return null;

    if (!channel) {
        channel = new BroadcastChannel("classtrack-sync");
    }
    return channel;
}

/**
 * Post a sync event to other tabs. Throttled to once every 15 seconds.
 *
 * @param swrKey  The SWR cache key to invalidate across tabs.
 */
export function postSyncEvent(swrKey: string): void {
    const now = Date.now();
    if (now - lastBroadcastAt < THROTTLE_MS) return; // Throttled
    lastBroadcastAt = now;

    const ch = getChannel();
    if (ch) {
        ch.postMessage({ type: "swr-invalidate", swrKey, timestamp: now });
    }
}

/**
 * Listen for sync events from other tabs.
 *
 * @param handler  Callback invoked with the SWR key to invalidate.
 * @returns  Cleanup function to remove the listener.
 */
export function onSyncEvent(handler: SyncHandler): () => void {
    const ch = getChannel();
    if (!ch) return () => {};

    const listener = (event: MessageEvent) => {
        if (event.data?.type === "swr-invalidate" && event.data?.swrKey) {
            handler(event.data.swrKey);
        }
    };

    ch.addEventListener("message", listener);
    return () => ch.removeEventListener("message", listener);
}

/**
 * Post sync events for multiple SWR keys at once.
 * Respects the same 15-second throttle.
 */
export function postMultiSyncEvent(swrKeys: string[]): void {
    const now = Date.now();
    if (now - lastBroadcastAt < THROTTLE_MS) return;
    lastBroadcastAt = now;

    const ch = getChannel();
    if (ch) {
        swrKeys.forEach(swrKey => {
            ch.postMessage({ type: "swr-invalidate", swrKey, timestamp: now });
        });
    }
}
