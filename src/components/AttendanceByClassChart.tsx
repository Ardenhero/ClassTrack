"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface ClassAttendanceData {
    className: string;
    present: number;
    late: number;
    absent: number;
    percentage?: number;
}

interface AttendanceByClassChartProps {
    data: ClassAttendanceData[];
}

export function AttendanceByClassChart({ data }: AttendanceByClassChartProps) {
    // Add percentage calculation if not already provided in the mapped data
    const chartData = data.map(item => ({
        ...item,
        percentage: item.percentage ?? Math.round(((item.present + item.late) / (item.present + item.late + item.absent || 1)) * 100)
    }));

    return (
        <div className="w-full h-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis
                        type="number"
                        domain={[0, 100]}
                        hide
                    />
                    <YAxis
                        type="category"
                        dataKey="className"
                        axisLine={false}
                        tickLine={false}
                        width={100}
                        tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                        tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 17)}...` : value}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
                                        <p className="font-bold text-xs mb-1 dark:text-gray-100">{d.className}</p>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color }} />
                                            <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                                Performance: <span className="text-gray-900 dark:text-gray-100">{d.percentage}%</span>
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar
                        dataKey="percentage"
                        name="Performance"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        isAnimationActive={false}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={
                                    entry.percentage >= 90 ? '#10b981' :
                                        entry.percentage >= 75 ? '#3b82f6' :
                                            entry.percentage >= 50 ? '#f59e0b' :
                                                '#ef4444'
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
