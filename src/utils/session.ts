/**
 * Shared utility for signing and verifying student sessions using Web Crypto API.
 * This is compatible with Vercel Edge Runtime.
 */

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.QR_SIGNING_SECRET || 'classtrack-session-fallback-key-change-me';

/**
 * Convert string payload to HMAC signature
 */
async function getSignature(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SESSION_SECRET);
    const data = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Sign a session payload with HMAC-SHA256 to prevent cookie tampering
 */
export async function signSession(payload: string): Promise<string> {
    const signature = await getSignature(payload);
    return `${payload}.${signature}`;
}

/**
 * Verify and extract a signed session payload. Returns null if tampered.
 */
export async function verifySession(signed: string): Promise<string | null> {
    const lastDot = signed.lastIndexOf('.');
    if (lastDot === -1) return null;
    
    const payload = signed.substring(0, lastDot);
    const signature = signed.substring(lastDot + 1);
    const expected = await getSignature(payload);
    
    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expected.length) return null;
    
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    
    return result === 0 ? payload : null;
}
