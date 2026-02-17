"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Lightbulb,
    Fan,
    Snowflake,
    Loader2,
    WifiOff,
    ChevronDown,
    RotateCcw,
    Power,
    Shield,
    ShieldOff,
    Zap,
} from "lucide-react";

interface Endpoint {
    id: string;
    device_id: string;
    endpoint_kind: string;
    endpoint_index: number;
    role: string;
    zone_name: string | null;
    label: string;
    dp_code: string;
    current_state: boolean;
    online: boolean;
}

interface SessionInfo {
    class_id: string;
    class_name: string;
    room_id: string;
    room_name: string;
    is_active_now: boolean;
    is_prep_window: boolean;
    start_time: string;
    end_time: string;
}

interface SessionState {
    auto_on_done: boolean;
    manual_override: boolean;
}

interface RoomControlsResponse {
    room_id: string;
    room_name: string;
    session: SessionInfo;
    session_state: SessionState;
    groups: {
        LIGHT_GROUP: Endpoint[];
        FAN_GROUP: Endpoint[];
        AC_GROUP: Endpoint[];
    };
    all_endpoints: Endpoint[];
    error?: string;
    reason?: string;
}

interface IoTSwitchesProps {
    profileId?: string | null;
}

const GROUP_CONFIG = {
    LIGHT_GROUP: {
        label: "Lights",
        icon: Lightbulb,
        type: "LIGHTS" as const,
        gradient: "from-amber-400 to-yellow-500",
        bgActive: "bg-amber-400/20 border-amber-400/50",
        bgInactive: "bg-zinc-800/50 border-zinc-700/50",
        glowActive: "shadow-amber-400/30",
        iconColor: "text-amber-400",
    },
    FAN_GROUP: {
        label: "Fans",
        icon: Fan,
        type: "FANS" as const,
        gradient: "from-sky-400 to-blue-500",
        bgActive: "bg-sky-400/20 border-sky-400/50",
        bgInactive: "bg-zinc-800/50 border-zinc-700/50",
        glowActive: "shadow-sky-400/30",
        iconColor: "text-sky-400",
    },
    AC_GROUP: {
        label: "AC",
        icon: Snowflake,
        type: "ACS" as const,
        gradient: "from-cyan-400 to-teal-500",
        bgActive: "bg-cyan-400/20 border-cyan-400/50",
        bgInactive: "bg-zinc-800/50 border-zinc-700/50",
        glowActive: "shadow-cyan-400/30",
        iconColor: "text-cyan-400",
    },
};

export function IoTSwitches({ profileId }: IoTSwitchesProps) {
    const [data, setData] = useState<RoomControlsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [controlling, setControlling] = useState<string | null>(null);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
    const [showSessionPicker, setShowSessionPicker] = useState(false);

    // Fetch room controls for the current session
    const fetchRoomControls = useCallback(async () => {
        if (!profileId) {
            setError("No profile selected");
            setLoading(false);
            return;
        }

        try {
            // First get active sessions
            const sessionRes = await fetch(
                `/api/iot/active-session?instructor_id=${profileId}`
            );
            const sessionData = await sessionRes.json();

            if (!sessionData.authorized) {
                setError(
                    sessionData.reason === "no_classes"
                        ? "No classes assigned"
                        : "No active class session right now"
                );
                setSessions([]);
                setData(null);
                setLoading(false);
                return;
            }

            setSessions(sessionData.sessions);

            // Use selected session or primary
            const targetSession = selectedSession || sessionData.primary;
            if (!targetSession) {
                setError("No session available");
                setLoading(false);
                return;
            }

            setSelectedSession(targetSession);

            // Fetch room controls
            const controlsRes = await fetch(
                `/api/iot/room-controls?instructor_id=${profileId}&room_id=${targetSession.room_id}`
            );
            const controlsData = await controlsRes.json();

            if (controlsRes.status === 403) {
                setError("Not authorized for this room");
                setData(null);
            } else if (controlsData.error) {
                setError(controlsData.error);
            } else {
                setData(controlsData);
                setError(null);
            }
        } catch (err) {
            console.error("[IoTSwitches] Fetch error:", err);
            setError("Failed to load room controls");
        } finally {
            setLoading(false);
        }
    }, [profileId, selectedSession]);

    useEffect(() => {
        fetchRoomControls();
        const interval = setInterval(fetchRoomControls, 15000); // Refresh every 15s
        return () => clearInterval(interval);
    }, [fetchRoomControls]);

    // Group control handler
    const handleGroupControl = async (
        groupType: "LIGHTS" | "FANS" | "ACS",
        action: "ON" | "OFF"
    ) => {
        if (!data || !selectedSession || !profileId) return;

        setControlling(groupType);
        try {
            const res = await fetch("/api/iot/group-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instructor_id: profileId,
                    room_id: data.room_id,
                    group_type: groupType,
                    action,
                    source: "web",
                }),
            });

            const result = await res.json();

            if (result.success) {
                // Update local state immediately
                setData((prev) => {
                    if (!prev) return prev;
                    const groupKey = `${groupType.replace("S", "")}_GROUP` as keyof typeof prev.groups;
                    // Map LIGHTS → LIGHT_GROUP, FANS → FAN_GROUP, ACS → AC_GROUP
                    const keyMap: Record<string, string> = {
                        LIGHTS: "LIGHT_GROUP",
                        FANS: "FAN_GROUP",
                        ACS: "AC_GROUP",
                    };
                    const key = keyMap[groupType] as keyof typeof prev.groups;
                    return {
                        ...prev,
                        groups: {
                            ...prev.groups,
                            [key]: prev.groups[key].map((ep) => ({
                                ...ep,
                                current_state: action === "ON",
                            })),
                        },
                        session_state: {
                            ...prev.session_state,
                            manual_override: action === "OFF" ? true : prev.session_state.manual_override,
                        },
                    };
                });
            }
        } catch (err) {
            console.error(`[IoTSwitches] Group control error:`, err);
        } finally {
            setControlling(null);
        }
    };

    // Resume auto mode
    const handleResumeAuto = async () => {
        if (!data || !selectedSession || !profileId) return;

        setControlling("resume");
        try {
            const res = await fetch("/api/iot/resume-auto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instructor_id: profileId,
                    room_id: data.room_id,
                    class_id: selectedSession.class_id,
                }),
            });

            if (res.ok) {
                setData((prev) =>
                    prev
                        ? {
                            ...prev,
                            session_state: {
                                auto_on_done: false,
                                manual_override: false,
                            },
                        }
                        : prev
                );
            }
        } catch (err) {
            console.error("[IoTSwitches] Resume auto error:", err);
        } finally {
            setControlling(null);
        }
    };

    // Determine if a group is "on" (any endpoint active)
    const isGroupOn = (endpoints: Endpoint[]) =>
        endpoints.some((ep) => ep.current_state);

    const isGroupOnline = (endpoints: Endpoint[]) =>
        endpoints.some((ep) => ep.online);

    // ========================================
    // RENDER
    // ========================================

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-zinc-400">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading room controls...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-6 text-center">
                <ShieldOff className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
                <p className="text-sm text-zinc-400">{error}</p>
                <p className="text-xs text-zinc-600 mt-1">
                    IoT controls available during scheduled classes only
                </p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-4">
            {/* Header: Room + Session Info */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <h3 className="font-semibold text-white text-sm">
                            {data.room_name} — Room Controls
                        </h3>
                    </div>
                    {selectedSession && (
                        <p className="text-xs text-zinc-400 mt-0.5 ml-6">
                            {selectedSession.class_name} •{" "}
                            {selectedSession.start_time?.slice(0, 5)} –{" "}
                            {selectedSession.end_time?.slice(0, 5)}
                            {selectedSession.is_prep_window && (
                                <span className="ml-1 text-amber-400">(Prep Window)</span>
                            )}
                        </p>
                    )}
                </div>

                {/* Session Picker */}
                {sessions.length > 1 && (
                    <div className="relative">
                        <button
                            onClick={() => setShowSessionPicker(!showSessionPicker)}
                            className="flex items-center gap-1 text-xs bg-zinc-700/50 hover:bg-zinc-700 px-2 py-1 rounded-lg text-zinc-300 transition-colors"
                        >
                            Switch Room
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showSessionPicker && (
                            <div className="absolute right-0 mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10 overflow-hidden">
                                {sessions.map((s) => (
                                    <button
                                        key={s.class_id}
                                        onClick={() => {
                                            setSelectedSession(s);
                                            setShowSessionPicker(false);
                                            setLoading(true);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors ${selectedSession?.class_id === s.class_id
                                            ? "bg-zinc-700/30 text-white"
                                            : "text-zinc-400"
                                            }`}
                                    >
                                        <div className="font-medium">{s.room_name}</div>
                                        <div className="text-zinc-500">{s.class_name}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Group Controls Grid */}
            <div className="grid grid-cols-3 gap-3">
                {Object.entries(GROUP_CONFIG).map(([groupKey, config]) => {
                    const endpoints = data.groups[groupKey as keyof typeof data.groups] || [];
                    const isOn = isGroupOn(endpoints);
                    const isOnline = isGroupOnline(endpoints);
                    const isLoading = controlling === config.type;
                    const Icon = config.icon;
                    const isEmpty = endpoints.length === 0;

                    return (
                        <button
                            key={groupKey}
                            onClick={() =>
                                !isEmpty &&
                                isOnline &&
                                !isLoading &&
                                handleGroupControl(config.type, isOn ? "OFF" : "ON")
                            }
                            disabled={isEmpty || !isOnline || isLoading}
                            className={`
                relative overflow-hidden rounded-xl border p-4 transition-all duration-300
                ${isEmpty
                                    ? "bg-zinc-900/30 border-zinc-800/50 opacity-40 cursor-not-allowed"
                                    : isOn
                                        ? `${config.bgActive} shadow-lg ${config.glowActive}`
                                        : `${config.bgInactive} hover:border-zinc-600/50`
                                }
                ${!isOnline && !isEmpty ? "opacity-50" : ""}
              `}
                        >
                            {/* Active glow effect */}
                            {isOn && (
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-5`}
                                />
                            )}

                            <div className="relative flex flex-col items-center gap-2">
                                {isLoading ? (
                                    <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
                                ) : !isOnline && !isEmpty ? (
                                    <WifiOff className="w-7 h-7 text-zinc-500" />
                                ) : (
                                    <Icon
                                        className={`w-7 h-7 transition-colors ${isOn ? config.iconColor : "text-zinc-500"
                                            } ${config.type === "FANS" && isOn ? "animate-spin" : ""}`}
                                        style={
                                            config.type === "FANS" && isOn
                                                ? { animationDuration: "1.5s" }
                                                : undefined
                                        }
                                    />
                                )}

                                <div className="text-center">
                                    <div
                                        className={`text-xs font-semibold ${isOn ? "text-white" : "text-zinc-400"
                                            }`}
                                    >
                                        {config.label}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">
                                        {isEmpty
                                            ? "Not configured"
                                            : `${endpoints.length} device${endpoints.length > 1 ? "s" : ""
                                            }`}
                                    </div>
                                </div>

                                {/* Status indicator */}
                                {!isEmpty && (
                                    <div
                                        className={`absolute top-0 right-0 w-2 h-2 rounded-full ${isOn
                                            ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                                            : "bg-zinc-600"
                                            }`}
                                    />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Master Controls Row */}
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        handleGroupControl("LIGHTS", "ON");
                        handleGroupControl("FANS", "ON");
                        handleGroupControl("ACS", "ON");
                    }}
                    disabled={controlling !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                    <Power className="w-3.5 h-3.5" />
                    All On
                </button>
                <button
                    onClick={() => {
                        handleGroupControl("LIGHTS", "OFF");
                        handleGroupControl("FANS", "OFF");
                        handleGroupControl("ACS", "OFF");
                    }}
                    disabled={controlling !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                    <Power className="w-3.5 h-3.5" />
                    All Off
                </button>
            </div>

            {/* Auto-On Status / Resume Auto Button */}
            {data.session_state && (
                <div className="flex items-center justify-between rounded-lg bg-zinc-800/40 border border-zinc-700/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Zap
                            className={`w-3.5 h-3.5 ${data.session_state.manual_override
                                ? "text-amber-400"
                                : data.session_state.auto_on_done
                                    ? "text-emerald-400"
                                    : "text-zinc-500"
                                }`}
                        />
                        <span className="text-[11px] text-zinc-400">
                            {data.session_state.manual_override
                                ? "Auto mode paused (manual override)"
                                : data.session_state.auto_on_done
                                    ? "Auto-on completed"
                                    : "Auto-on ready"}
                        </span>
                    </div>
                    {data.session_state.manual_override && (
                        <button
                            onClick={handleResumeAuto}
                            disabled={controlling === "resume"}
                            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Resume Auto
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
