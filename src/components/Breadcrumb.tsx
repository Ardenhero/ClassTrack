"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
    return (
        <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap gap-1">
            <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <Home className="h-4 w-4" />
            </Link>
            {items.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-gray-900 dark:text-white font-semibold">{item.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}
