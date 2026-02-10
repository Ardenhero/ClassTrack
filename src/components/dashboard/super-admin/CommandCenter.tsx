"use client";

import { Building2, Users, Radio, Activity } from "lucide-react";
import { StatusCards } from "./StatusCards";
import { SecurityAuditFeed } from "./SecurityAuditFeed";
import { TrafficAnalytics } from "./TrafficAnalytics";

export function CommandCenter({ stats, logs, trafficData }: { stats: any, logs: any[], trafficData: any[] }) {
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
