"use client";

import { StatusCards } from "./StatusCards";
import { SecurityAuditFeed, AuditLog } from "./SecurityAuditFeed";
import { TrafficAnalytics } from "./TrafficAnalytics";

export function CommandCenter({ stats, logs, trafficData }: { stats: { activeDepartments: number, totalPopulation: number, activeSessions: number, isOperational: boolean }, logs: AuditLog[], trafficData: { hour: string, count: number }[] }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* 1. Infrastructure Status Cards */}
            <StatusCards stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 2. University-Wide Traffic Analytics (Central Graph) */}
                <div className="lg:col-span-2">
                    <TrafficAnalytics data={trafficData} />
                </div>

                {/* 3. Live Security Audit Feed (Right Sidebar) */}
                <div className="lg:col-span-1">
                    <SecurityAuditFeed logs={logs} />
                </div>
            </div>
        </div>
    );
}
