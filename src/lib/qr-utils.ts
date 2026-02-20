import crypto from 'crypto';

// ============================================================================
// QR TOTP + AES Encryption Utilities for ClassTrack v3.2
// ============================================================================

const QR_SECRET = process.env.QR_SIGNING_SECRET || 'classtrack-v32-default-secret-change-me';
const TOTP_WINDOW_SECONDS = 60;
const AES_ALGORITHM = 'aes-256-gcm';

// Derive a 32-byte key from the secret
function getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(QR_SECRET).digest();
}

/**
 * Generate a TOTP nonce based on the current 60-second window.
 */
export function generateTOTP(): string {
    const timeStep = Math.floor(Date.now() / (TOTP_WINDOW_SECONDS * 1000));
    const hmac = crypto.createHmac('sha256', QR_SECRET);
    hmac.update(timeStep.toString());
    return hmac.digest('hex').substring(0, 12); // 12-char nonce
}

/**
 * Validate a TOTP nonce. Allows current window and 1 previous window (120s total tolerance).
 */
export function validateTOTP(nonce: string): boolean {
    const currentStep = Math.floor(Date.now() / (TOTP_WINDOW_SECONDS * 1000));

    for (let offset = 0; offset <= 1; offset++) {
        const step = currentStep - offset;
        const hmac = crypto.createHmac('sha256', QR_SECRET);
        hmac.update(step.toString());
        const expected = hmac.digest('hex').substring(0, 12);
        if (expected === nonce) return true;
    }
    return false;
}

/**
 * Encrypt a QR payload (JSON string) using AES-256-GCM.
 */
export function encryptPayload(payload: object): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

    const jsonStr = JSON.stringify(payload);
    let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Pack: iv:authTag:ciphertext (all hex)
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a QR payload string back to the original object.
 */
export function decryptPayload(encryptedStr: string): object | null {
    try {
        const [ivHex, authTagHex, ciphertext] = encryptedStr.split(':');
        if (!ivHex || !authTagHex || !ciphertext) return null;

        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch {
        return null;
    }
}

/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
