"use client";

import { useState, useEffect } from "react";

/**
 * useDebouncedValue — Returns a debounced version of the input value.
 *
 * The returned value only updates after the specified delay has passed
 * since the last change to the input value.
 *
 * @param value  The raw value to debounce.
 * @param delay  Delay in milliseconds (default: 300ms).
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
