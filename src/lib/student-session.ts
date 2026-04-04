"use server";

import { cookies } from "next/headers";

/**
 * Edge-compatible utility to retrieve the student session from cookies.
 * This file avoids importing any Node.js built-ins like node:crypto.
 */
export async function getStudentSession() {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("student_session");

    if (!sessionCookie) return null;

    try {
        const session = JSON.parse(sessionCookie.value);
        // Basic validation: check if it's not too old (e.g., 30 days)
        if (Date.now() - session.timestamp > 1000 * 60 * 60 * 24 * 30) {
            return null;
        }
        return session;
    } catch {
        return null;
    }
}
