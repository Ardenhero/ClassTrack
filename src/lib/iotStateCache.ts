/**
 * iotStateCache.ts — In-memory IoT device state cache for serverless edge.
 *
 * Prevents redundant DB writes by tracking the last known `online` status
 * of each device. Includes a warm-up strategy for cold starts.
 */

// In-memory cache: deviceId → online status
const stateCache = new Map<string, boolean>();

/**
 * Warm the cache from the database on the first invocation.
 * Subsequent calls are no-ops if the cache is already populated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function warmCache(supabase: any): Promise<void> {
    if (stateCache.size > 0) return; // Already warm

    const { data } = await supabase
        .from("iot_devices")
        .select("id, online");

    if (data) {
        data.forEach((d: { id: string; online: boolean }) => {
            stateCache.set(d.id, d.online);
        });
    }
    console.log(`[iotStateCache] Warmed with ${stateCache.size} devices`);
}

/**
 * Update a device's cached state.
 */
export function updateStateCache(id: string, online: boolean): void {
    stateCache.set(id, online);
}

/**
 * Check if a device's online status has actually changed.
 * Returns true only if the new value differs from the cached value.
 * Also returns true if the device is not yet in the cache (first observation).
 */
export function hasStateChanged(id: string, newOnline: boolean): boolean {
    if (!stateCache.has(id)) return true; // Unknown device — treat as changed
    return stateCache.get(id) !== newOnline;
}

/**
 * Get the current cache size (for diagnostics).
 */
export function getCacheSize(): number {
    return stateCache.size;
}
