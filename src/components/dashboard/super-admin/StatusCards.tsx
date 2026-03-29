import { Monitor, Users, Cpu, Activity } from "lucide-react";

interface StatusCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description: string;
    color: string;
    trend?: string;
}

export function StatusCards({ stats }: { stats: { totalKiosks: number, totalPopulation: number, totalDevices: number, isOperational: boolean } }) {
    const cards: StatusCardProps[] = [
        {
            title: "Active Kiosks",
            value: `${stats.totalKiosks.toLocaleString()} KIOSK`,
            icon: Monitor,
            description: "Total provisioned kiosks",
            color: "bg-blue-500",
            trend: "Infrastructure Map"
        },
        {
            title: "Total System Population",
            value: stats.totalPopulation.toLocaleString(),
            icon: Users,
            description: "Admins + Instructors + Students",
            color: "bg-purple-500",
            trend: "Database Load"
        },
        {
            title: "Connected IoT Devices",
            value: stats.totalDevices.toLocaleString(),
            icon: Cpu,
            description: "Tuya switches, lights & sensors",
            color: "bg-green-500",
            trend: "Real-time Hub"
        },
        {
            title: "System Health Status",
            value: stats.isOperational ? "OPERATIONAL" : "MAINTENANCE",
            icon: Activity,
            description: "API & Database status",
            color: stats.isOperational ? "bg-emerald-500" : "bg-red-500",
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map((card, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)]">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-2xl ${card.color} text-white`}>
                            <card.icon className="h-6 w-6" />
                        </div>
                        {card.trend && (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {card.trend}
                            </span>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{card.value}</h3>
                        <p className="text-xs text-gray-400 mt-1">{card.description}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
