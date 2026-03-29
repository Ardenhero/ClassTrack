import { formatInTimeZone, toZonedTime } from "date-fns-tz";


export const MANILA_TZ = 'Asia/Manila';
export const MANILA_OFFSET = '+08:00';

/**
 * Format a Date object in the Manila timezone.
 * Replaces standard format() to avoid server-side date shifts.
 */
export const formatInManila = (date: Date | string | number, formatStr: string): string => {
    const d = date instanceof Date ? date : new Date(date);
    // CRITICAL: formatInTimeZone expects a RAW date (UTC or server local).
    // If you pass a zoned date from toZonedTime, it will shift it AGAIN.
    return formatInTimeZone(d, MANILA_TZ, formatStr);
};

/**
 * Get the current time adjusted to Manila timezone.
 */
export const getNowManila = (): Date => {
    return toZonedTime(new Date(), MANILA_TZ);
};

/**
 * Format a timestamp (ISO or Date) as a Manila date string (yyyy-MM-dd).
 */
export const toManilaDateString = (timestamp: string | Date | number): string => {
    return formatInManila(timestamp, 'yyyy-MM-dd');
};

/**
 * Get a Date object for a Manila date and time string (yyyy-MM-ddTHH:mm:ss).
 * Robustly handles different time formats and ensures correct offset.
 */
export const getManilaDateTime = (dateStr: string, timeStr: string): Date => {
    if (!dateStr || !timeStr) return new Date(NaN);
    
    // Robustly parse time: HH:mm[:ss] [AM|PM]
    const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*([AP]M)?$/i);
    if (!timeMatch) return new Date(`${dateStr}T${timeStr}${MANILA_OFFSET}`); // Fallback to original

    const hStr = timeMatch[1];
    const mStr = timeMatch[2];
    const sStr = timeMatch[3];
    const ampm = timeMatch[4];
    
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const s = sStr ? parseInt(sStr, 10) : 0;

    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }

    const finalTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return new Date(`${dateStr}T${finalTime}${MANILA_OFFSET}`);
};

/**
 * Get the UTC ISO string for the start of the day (Midnight) in Manila.
 */
export const getManilaStartOfDay = (date: Date = new Date()): string => {
    // Use the raw date to get the string, then create the midnight object
    const dateStr = formatInManila(date, 'yyyy-MM-dd');
    const d = getManilaDateTime(dateStr, "00:00:00");
    return d.toISOString();
};

/**
 * Check if the current absolute time is before the end of a class (with grace period).
 */
export const isClassStillOngoing = (dateStr: string, endTimeStr: string, graceMinutes: number = 30): boolean => {
    const classEndTime = getManilaDateTime(dateStr, endTimeStr);
    if (isNaN(classEndTime.getTime())) return false; // Safety
    
    const realNow = new Date();
    // A class is ongoing if NOW is BEFORE (EndTime + Grace)
    return realNow.getTime() < (classEndTime.getTime() + graceMinutes * 60000);
};

/**
 * Check if the current absolute time is within a class window (with buffers).
 */
export const isClassActive = (dateStr: string, startTimeStr: string, endTimeStr: string, startBuffer: number = 20, endBuffer: number = 30): boolean => {
    const startTime = getManilaDateTime(dateStr, startTimeStr);
    const endTime = getManilaDateTime(dateStr, endTimeStr);
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return false;
    
    const realNow = new Date();
    const effectiveStart = startTime.getTime() - startBuffer * 60000;
    const effectiveEnd = endTime.getTime() + endBuffer * 60000;

    const nowMs = realNow.getTime();
    return nowMs >= effectiveStart && nowMs <= effectiveEnd;
};
