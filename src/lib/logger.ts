import { env } from "./env";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: unknown;
}

class Logger {
    private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
        if (env.NODE_ENV === "production") {
            // Structured JSON logging for production
            const entry: LogEntry = {
                timestamp: new Date().toISOString(),
                level,
                message,
                context,
            };

            if (error) {
                entry.error = error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error;
            }

            console.log(JSON.stringify(entry));
        } else {
            // Pretty printing for development
            const timestamp = new Date().toLocaleTimeString();
            const prefix = `[${timestamp}] ${level.toUpperCase()}:`;

            switch (level) {
                case "info":
                    console.log(prefix, message, context || "");
                    break;
                case "warn":
                    console.warn(prefix, message, context || "");
                    break;
                case "error":
                    console.error(prefix, message, context || "");
                    if (error) console.error(error);
                    break;
                case "debug":
                    console.debug(prefix, message, context || "");
                    break;
            }
        }
    }

    info(message: string, context?: Record<string, unknown>) {
        this.log("info", message, context);
    }

    warn(message: string, context?: Record<string, unknown>) {
        this.log("warn", message, context);
    }

    error(message: string, error?: unknown, context?: Record<string, unknown>) {
        this.log("error", message, context, error);
    }

    debug(message: string, context?: Record<string, unknown>) {
        this.log("debug", message, context);
    }
}

export const logger = new Logger();
