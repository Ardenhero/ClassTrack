import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Security constants
const SALT_SIZE = 16;
const KEY_LEN = 64;

/**
 * Hash a password using scrypt
 */
export function hashPassword(password: string): string {
    const salt = randomBytes(SALT_SIZE).toString("hex");
    const derivedKey = scryptSync(password, salt, KEY_LEN);
    return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = scryptSync(password, salt, KEY_LEN);
    return timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}
