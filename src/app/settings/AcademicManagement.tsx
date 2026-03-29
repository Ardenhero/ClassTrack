"use client";

import { useState, useEffect } from "react";
import { createAcademicYear, setActiveAcademicYear, deactivateAllAcademicYears, deleteAcademicYear, createAcademicTerm, setActiveAcademicTerm, deactivateAllAcademicTerms, deleteAcademicTerm, assignLegacyClassesToTerm } from "./actions";
import { Calendar, Plus, Check, Library, Trash2, ChevronDown, ChevronRight, Archive, LayoutGrid } from "lucide-react";

interface AcademicManagementProps {
    years: { id: string; name: string; is_active: boolean }[];
    terms: {
        id: string;
        name: string;
        is_active: boolean;
        start_date: string;
        end_date: string;
        academic_year_id: string;
        academic_years: { name: string } | null;
    }[];
    legacyCount: number;
    isSuperAdmin?: boolean;
}

export function AcademicManagement({ years, terms, legacyCount, isSuperAdmin = false }: AcademicManagementProps) {
    const [newYearName, setNewYearName] = useState("");
    const [isPending, setIsPending] = useState(false);
    const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

    // Term form state
    const [selectedYearId, setSelectedYearId] = useState("");
    const [termName, setTermName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Initialize with active year expanded
    useEffect(() => {
        const activeYearWithActiveTerm = years.find(y =>
            terms.some(t => t.academic_year_id === y.id && t.is_active)
        );
        if (activeYearWithActiveTerm) {
            setExpandedYears(new Set([activeYearWithActiveTerm.id]));
        } else if (years.length > 0) {
            const activeYear = years.find(y => y.is_active);
            if (activeYear) setExpandedYears(new Set([activeYear.id]));
            else setExpandedYears(new Set([years[0].id])); // Expand latest by default
        }
    }, [years, terms]);

    const toggleYear = (yearId: string) => {
        const next = new Set(expandedYears);
        if (next.has(yearId)) next.delete(yearId);
        else next.add(yearId);
        setExpandedYears(next);
    };

    async function handleCreateYear() {
        if (!newYearName.trim()) return;
        setIsPending(true);
        const res = await createAcademicYear(newYearName);
        if (res.error) alert(res.error);
        else setNewYearName("");
        setIsPending(false);
    }

    async function handleCreateTerm() {
        if (!selectedYearId || !termName) return;
        setIsPending(true);
        const res = await createAcademicTerm({
            academic_year_id: selectedYearId,
            name: termName,
            start_date: startDate,
            end_date: endDate
        });
        if (res.error) alert(res.error);
        else {
            setTermName("");
            setStartDate("");
            setEndDate("");
        }
        setIsPending(false);
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Forms - ONLY for Super Admin */}
            {isSuperAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Create Year Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            New Academic Year
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="e.g. 2026-2027"
                                value={newYearName}
                                onChange={(e) => setNewYearName(e.target.value)}
                                className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                            />
                            <button
                                onClick={handleCreateYear}
                                disabled={isPending || !newYearName.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold text-sm"
                            >
                                <Plus className="h-4 w-4" /> Create
                            </button>
                        </div>
                    </div>

                    {/* Create Term Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2">
                            <Library className="h-4 w-4 text-purple-500" />
                            New Semester
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={selectedYearId}
                                onChange={(e) => setSelectedYearId(e.target.value)}
                                className="col-span-2 px-4 py-2 text-sm rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none font-bold"
                            >
                                <option value="">Select Academic Year</option>
                                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                            </select>
                            <input
                                type="text"
                                placeholder="Semester Name"
                                value={termName}
                                onChange={(e) => setTermName(e.target.value)}
                                className="col-span-2 px-4 py-2 text-sm rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none font-bold"
                            />
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter ml-1">Start Date</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter ml-1">End Date</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none font-bold"
                                />
                            </div>
                            <button
                                onClick={handleCreateTerm}
                                disabled={isPending || !selectedYearId || !termName || !startDate || !endDate}
                                className="col-span-2 mt-2 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 font-bold text-sm"
                            >
                                <Plus className="h-4 w-4" /> Create Semester
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Legacy Data Repair */}
            {legacyCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30 p-5 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600">
                            <Check className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight">Legacy Data Management</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-400/60 font-medium">
                                found {legacyCount} classes without an assigned semester. Align them with the active term to enable history tracking.
                            </p>
                        </div>
                    </div>
                    {terms.some(t => t.is_active) ? (
                        <button
                            disabled={isPending}
                            onClick={async () => {
                                const activeTerm = terms.find(t => t.is_active);
                                if (!activeTerm) return;
                                setIsPending(true);
                                if (confirm(`Link all ${legacyCount} legacy classes to the active semester (${activeTerm.name})?`)) {
                                    const res = await assignLegacyClassesToTerm(activeTerm.id);
                                    if (res.error) alert(res.error);
                                }
                                setIsPending(false);
                            }}
                            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-amber-600/20 uppercase tracking-widest"
                        >
                            Sync Now
                        </button>
                    ) : (
                        <div className="px-4 py-2 rounded-xl bg-amber-100/50 dark:bg-amber-900/20 text-[10px] font-black text-amber-600 uppercase tracking-widest border border-amber-200/50">
                            Awaiting Active Term
                        </div>
                    )}
                </div>
            )}

            {/* Main Academic Records - Grouped Accordion */}
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-black uppercase text-gray-500 tracking-[0.2em] flex items-center gap-3">
                        <LayoutGrid className="h-5 w-5 text-gray-400" />
                        Academic History
                    </h2>
                    <div className="flex gap-4">
                        {isSuperAdmin && (
                            <>
                                <button
                                    onClick={() => deactivateAllAcademicTerms()}
                                    className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-all"
                                >
                                    Deactivate All Terms
                                </button>
                                <button
                                    onClick={() => deactivateAllAcademicYears()}
                                    className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-all"
                                >
                                    Deactivate All Years
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {years.map((year) => {
                    const yearTerms = terms.filter(t => t.academic_year_id === year.id);
                    const isExpanded = expandedYears.has(year.id);

                    return (
                        <div key={year.id} className="group transition-all duration-300">
                            <div
                                className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${year.is_active
                                        ? "bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20"
                                        : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                    }`}
                                onClick={() => toggleYear(year.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl transition-colors ${year.is_active ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{year.name}</h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            {yearTerms.length} Semester{yearTerms.length !== 1 ? 's' : ''} • {year.is_active ? 'Currently Active' : 'Historical Record'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {year.is_active && (
                                        <span className="hidden md:flex px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            ACTIVE YEAR
                                        </span>
                                    )}
                                    <div className="flex items-center gap-2">
                                        {(isSuperAdmin && !year.is_active) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveAcademicYear(year.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 px-3 py-1 text-[10px] font-black bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all uppercase tracking-widest"
                                            >
                                                Set Active
                                            </button>
                                        )}
                                        {isSuperAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Delete this Academic Year? All linked semesters will remain but lose their parent reference.")) {
                                                        deleteAcademicYear(year.id);
                                                    }
                                                }}
                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Content */}
                            {isExpanded && (
                                <div className="mt-3 ml-6 pl-6 border-l-2 border-gray-100 dark:border-gray-800 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                    {yearTerms.length === 0 ? (
                                        <div className="py-4 text-xs text-gray-400 italic">No semesters created for this year.</div>
                                    ) : (
                                        yearTerms.map(term => (
                                            <div key={term.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${term.is_active
                                                    ? "bg-purple-50/50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/20"
                                                    : "bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800"
                                                }`}>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm uppercase">{year.name} {term.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-medium">{term.start_date} — {term.end_date}</p>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {term.is_active ? (
                                                        <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                            ACTIVE SEMESTER
                                                        </div>
                                                    ) : (
                                                        isSuperAdmin && (
                                                            <button
                                                                onClick={() => setActiveAcademicTerm(term.id)}
                                                                className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[9px] font-black text-gray-500 uppercase tracking-widest rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all"
                                                            >
                                                                Activate
                                                            </button>
                                                        )
                                                    )}
                                                    {isSuperAdmin && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm("Delete this Semester? This will remove all filtering for classes linked to this term.")) {
                                                                    deleteAcademicTerm(term.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {years.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                        <Archive className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No academic records found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
