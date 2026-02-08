"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import { useState } from "react";

interface AttendanceChartProps {
    data: { day: string; count: number; date: string }[];
}

export function AttendanceChart({ data }: AttendanceChartProps) {
    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-900">Attendance Analytics</h3>
                <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
                    Last 7 Days
                </div>
            </div>

            <div className="flex-1 flex items-end justify-between space-x-2 px-2 min-h-[150px]">
                {data.map((item) => {
                    const heightPercentage = Math.round((item.count / maxCount) * 100);
                    return (
                        <div key={item.date} className="flex flex-col items-center flex-1 group h-full justify-end">
                            <div className="relative w-full max-w-[30px] flex items-end h-full">
                                <div
                                    className={`w-full rounded-t-xl transition-all duration-500 ease-out group-hover:bg-nwu-red/80 relative cursor-pointer ${item.count > 0 ? 'bg-nwu-red' : 'bg-gray-100'}`}
                                    style={{ height: `${heightPercentage}%`, minHeight: item.count > 0 ? '4px' : '4px' }}
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                        {item.count} Students
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-gray-400 mt-2 font-medium">{item.day}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
