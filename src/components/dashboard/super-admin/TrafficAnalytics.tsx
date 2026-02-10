"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Activity } from "lucide-react";

export function TrafficAnalytics({ data }: { data: any[] }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center">
                        <Activity className="h-5 w-5 mr-2 text-nwu-red" />
                        University Pulse: System Load
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Total student check-ins per hour across all colleges</p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                        <span className="h-2 w-2 rounded-full bg-nwu-red mr-2"></span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Traffic</span>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#991b1b" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#991b1b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="hour"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '16px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                fontSize: '12px'
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#991b1b"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorTraffic)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="text-xs text-gray-500">
                    <span className="font-bold text-nwu-red">Tip:</span> 8:00 AM rush detected as peak load period.
                </div>
                <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                    Infrastructure Stable
                </div>
            </div>
        </div>
    );
}
