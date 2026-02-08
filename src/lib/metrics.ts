import { logger } from "./logger";

export class PerformanceMonitor {
    static async track<T>(
        name: string,
        fn: () => Promise<T>,
        thresholdMs: number = 1000
    ): Promise<T> {
        const start = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - start;

            // Log generic info
            logger.info(`PERF: ${name}`, { duration: `${duration}ms` });

            // Log slow warning
            if (duration > thresholdMs) {
                logger.warn(`SLOW OP: ${name}`, { duration: `${duration}ms`, threshold: `${thresholdMs}ms` });
            }

            return result;
        } catch (error) {
            const duration = Date.now() - start;
            logger.error(`PERF ERROR: ${name}`, error, { duration: `${duration}ms` });
            throw error;
        }
    }
}
