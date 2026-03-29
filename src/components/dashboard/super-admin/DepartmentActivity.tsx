"use client";

import { Building2, Users, MonitorPlay } from "lucide-react";

interface DeptStat {
    id: string;
    name: string;
    code: string;
    students: number;
    sessions: number;
}

export function DepartmentActivity({ departments }: { departments: DeptStat[] }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col transform transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.05)]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center">
                        <Building2 className="h-5 w-5 mr-2 text-nwu-red" />
                        Departmental Hub
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Real-time engagement across university colleges</p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-100 dark:border-green-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">Active Now</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 max-h-[400px] pr-2 custom-scrollbar">
                {departments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                        <Building2 className="h-12 w-12 text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">No department activity detected</p>
                    </div>
                ) : (
                    departments.sort((a, b) => b.sessions - a.sessions || b.students - a.students).map((dept) => (
                        <div key={dept.id} className="group p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100/50 dark:border-gray-800/50 hover:bg-white dark:hover:bg-gray-800 hover:border-nwu-red/20 transition-all duration-300">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 rounded-xl bg-nwu-red/5 flex items-center justify-center text-nwu-red border border-nwu-red/10 font-bold text-xs">
                                        {dept.code}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{dept.name}</h4>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 font-medium">Institution Unit</p>
                                    </div>
                                </div>
                                {dept.sessions > 0 && (
                                    <div className="px-2 py-0.5 bg-nwu-red text-white text-[10px] font-black rounded-lg shadow-sm animate-in fade-in zoom-in">
                                        LIVE
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2">
                                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                        <Users className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none">Students</p>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{dept.students.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="p-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                                        <MonitorPlay className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none">Sessions</p>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">{dept.sessions}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Activity Bar */}
                            <div className="mt-3 w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                                <div 
                                    className="h-full bg-nwu-red/60 transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, (dept.sessions / 10) * 100)}%` }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800 flex justify-between items-center text-[10px]">
                <span className="text-gray-400 font-bold uppercase tracking-widest">Total Active Nodes: {departments.reduce((acc, d) => acc + d.sessions, 0)}</span>
                <span className="text-nwu-red font-black">Super Admin View</span>
            </div>
        </div>
    );
}
