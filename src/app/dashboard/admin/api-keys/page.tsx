"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Loader2, Copy, Check, ShieldOff, ShieldCheck, Cpu, Wifi } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface APIKey {
    id: string;
    name: string;
    key_prefix: string;
    device_type: string;
    is_revoked: boolean;
    last_used_at: string | null;
    created_at: string;
    departments?: { name: string } | null;
}

export default function APIKeysPage() {
    const supabase = createClient();
    const [keys, setKeys] = useState<APIKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [form, setForm] = useState({
        name: "",
        device_type: "kiosk" as "kiosk" | "tuya" | "esp32",
    });

    const fetchKeys = useCallback(async () => {
        const { data } = await supabase
            .from("api_keys")
            .select("*, departments(name)")
            .order("created_at", { ascending: false });
        if (data) setKeys(data as unknown as APIKey[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchKeys();
    }, [fetchKeys]);

    const generateKey = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let key = "ct_";
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        const rawKey = generateKey();
        const keyPrefix = rawKey.slice(0, 11);
        // Simple hash (in prod you'd use a proper hash)
        const keyHash = btoa(rawKey);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("instructors")
            .select("id")
            .eq("auth_user_id", user.id)
            .single();

        if (!profile) return;

        const { error } = await supabase.from("api_keys").insert({
            name: form.name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            device_type: form.device_type,
            created_by: profile.id,
        });

        if (!error) {
            setNewKey(rawKey);
            setForm({ name: "", device_type: "kiosk" });
            fetchKeys();

            // Audit log — human-readable
            await supabase.from("audit_logs").insert({
                action: "api_key_created",
                entity_type: "api_key",
                entity_id: null,
                details: `Super Admin generated API key "${form.name}" for ${form.device_type} device`,
                performed_by: user.id,
            });
        }

        setCreating(false);
    };

    const handleRevoke = async (keyId: string) => {
        const { error } = await supabase
            .from("api_keys")
            .update({ is_revoked: true, revoked_at: new Date().toISOString() })
            .eq("id", keyId);

        if (!error) fetchKeys();
    };

    const handleCopy = () => {
        if (!newKey) return;
        navigator.clipboard.writeText(newKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const deviceIcon = (type: string) => {
        switch (type) {
            case "kiosk": return <Cpu className="h-4 w-4" />;
            case "tuya": return <Wifi className="h-4 w-4" />;
            default: return <Cpu className="h-4 w-4" />;
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Key className="h-7 w-7 text-nwu-red" />
                    API Key Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Generate and manage device authentication keys</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Key List */}
                <div className="lg:w-2/3">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700/50">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Active Keys</h2>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
                        ) : keys.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">No API keys provisioned yet.</div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {keys.map((k) => (
                                    <div key={k.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.is_revoked ? "bg-gray-100 text-gray-400" : "bg-nwu-red/10 text-nwu-red"}`}>
                                                {deviceIcon(k.device_type)}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${k.is_revoked ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>{k.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <code className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">{k.key_prefix}...</code>
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{k.device_type}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {k.is_revoked ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 uppercase">Revoked</span>
                                            ) : (
                                                <>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold border border-green-100 uppercase">Active</span>
                                                    <button
                                                        onClick={() => handleRevoke(k.id)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                        title="Revoke Key"
                                                    >
                                                        <ShieldOff className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Key Form */}
                <div className="lg:w-1/3">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700 sticky top-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-nwu-red rounded-2xl text-white">
                                <Plus className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Provision New Key</h2>
                                <p className="text-xs text-gray-500">For kiosks and IoT devices</p>
                            </div>
                        </div>

                        {newKey && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Key Generated — Copy Now</p>
                                    <div className="flex items-center gap-1">
                                        <button onClick={handleCopy} className="p-1 hover:bg-green-100 rounded transition-colors text-green-600" title="Copy key">
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <code className="text-xs font-mono text-green-900 bg-white p-2 rounded-lg block break-all border border-green-200">{newKey}</code>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-[10px] text-green-600 font-medium">⚠️ This key will be hidden once you dismiss.</p>
                                    <button
                                        onClick={() => setNewKey(null)}
                                        className="text-[10px] font-bold text-green-700 hover:text-green-900 underline transition-colors"
                                    >
                                        I&apos;ve copied it — dismiss
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Key Name</label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Room 201 Kiosk"
                                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/10 focus:border-nwu-red outline-none transition-all dark:bg-gray-900 text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Device Type</label>
                                <select
                                    value={form.device_type}
                                    onChange={(e) => setForm({ ...form, device_type: e.target.value as "kiosk" | "tuya" | "esp32" })}
                                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-nwu-red/10 focus:border-nwu-red outline-none transition-all dark:bg-gray-900 text-sm appearance-none"
                                >
                                    <option value="kiosk">ESP32 Kiosk (Attendance)</option>
                                    <option value="tuya">Tuya Smart Switch (IoT)</option>
                                    <option value="esp32">ESP32 General (Sensor)</option>
                                </select>
                            </div>

                            <button
                                disabled={creating}
                                type="submit"
                                className="w-full py-3 bg-nwu-red text-white rounded-xl font-bold shadow-lg shadow-nwu-red/20 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
                            >
                                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                Generate Key
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
