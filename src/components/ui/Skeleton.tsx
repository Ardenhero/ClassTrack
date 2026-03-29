"use client";

import { cn } from "@/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    variant?: "text" | "circular" | "rectangular" | "rounded";
}

export function Skeleton({
    className,
    variant = "rectangular",
    ...props
}: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse bg-gray-200 dark:bg-gray-800",
                variant === "text" && "h-4 w-full rounded",
                variant === "circular" && "rounded-full",
                variant === "rectangular" && "rounded-none",
                variant === "rounded" && "rounded-2xl",
                className
            )}
            aria-hidden="true"
            {...props}
        />
    );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full space-y-4">
            <div className="flex space-x-4">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" variant="text" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex space-x-4">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-12 flex-1" variant="rounded" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12" variant="rounded" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" variant="text" />
                    <Skeleton className="h-3 w-16" variant="text" />
                </div>
            </div>
            <Skeleton className="h-20 w-full" variant="rounded" />
        </div>
    );
}
