import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// Security constants
const SALT_SIZE = 16;
const KEY_LEN = 64;

/**
 * Hash a password or PIN using scrypt
 */
export function hashCredential(credential: string): string {
    const salt = randomBytes(SALT_SIZE).toString("hex");
    const derivedKey = scryptSync(credential, salt, KEY_LEN);
    return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a credential against a hash
 */
export function verifyCredential(credential: string, hash: string): boolean {
    if (!hash || !hash.includes(":")) return false;
    
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    
    const derivedKey = scryptSync(credential, salt, KEY_LEN);
    return timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}
