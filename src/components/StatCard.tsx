import { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    color?: "indigo" | "purple" | "white";
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, color = "white" }: StatCardProps) {
    return (
        <div className={cn(
            "p-6 rounded-xl border shadow-sm transition-all hover:shadow-md",
            color === "indigo" ? "bg-udemy-indigo text-white border-transparent" : "bg-white border-gray-100"
        )}>
            <div className="flex items-center justify-between">
                <div>
                    <p className={cn("text-sm font-medium", color === "indigo" ? "text-gray-300" : "text-gray-500")}>
                        {title}
                    </p>
                    <h3 className={cn("text-2xl font-bold mt-2", color === "indigo" ? "text-white" : "text-gray-900")}>
                        {value}
                    </h3>
                </div>
                <div className={cn(
                    "p-3 rounded-full",
                    color === "indigo" ? "bg-white/10" : "bg-nwu-red/10"
                )}>
                    <Icon className={cn("h-6 w-6", color === "indigo" ? "text-white" : "text-nwu-red")} />
                </div>
            </div>
            {trend && (
                <div className="mt-4 flex items-center text-xs">
                    <span className={cn(
                        "font-medium",
                        trendUp ? "text-green-500" : "text-red-500"
                    )}>
                        {trend}
                    </span>
                    <span className={cn("ml-2", color === "indigo" ? "text-gray-400" : "text-gray-400")}>
                        vs last week
                    </span>
                </div>
            )}
        </div>
    );
}
