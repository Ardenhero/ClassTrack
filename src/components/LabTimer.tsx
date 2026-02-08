"use client";

import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export function LabTimer() {
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRunning) {
            interval = setInterval(() => {
                setTime((prevTime) => prevTime + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const toggleTimer = () => setIsRunning(!isRunning);
    const resetTimer = () => {
        setIsRunning(false);
        setTime(0);
    };

    return (
        <div className="bg-gray-900 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between min-h-[250px] shadow-lg border border-gray-800">
            <div className="absolute top-0 right-0 w-64 h-64 bg-nwu-red opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex justify-between items-start relative z-10">
                <h3 className="font-bold text-lg">Lab Timer</h3>
                <div className="flex space-x-2">
                    {isRunning && <span className="h-2 w-2 rounded-full bg-red-500 mt-2 animate-pulse"></span>}
                </div>
            </div>

            <div className="relative z-10 text-center my-6">
                <div className="text-5xl font-mono font-bold tracking-wider tabular-nums">{formatTime(time)}</div>
                <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest">Session Duration</p>
            </div>

            <div className="flex justify-center space-x-4 relative z-10">
                <button
                    onClick={toggleTimer}
                    className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-gray-900 hover:scale-105 transition-transform shadow-md"
                >
                    {isRunning ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </button>
                <button
                    onClick={resetTimer}
                    className="h-12 w-12 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-gray-700 transition-colors border border-gray-700"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
