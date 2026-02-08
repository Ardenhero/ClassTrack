"use client";

import { useState, useEffect } from "react";
import { InstructorSelectionModal } from "./InstructorSelectionModal";

interface Instructor {
    id: string;
    name: string;
}

export function InstructorFlowWrapper({
    children,
    linkedInstructor
}: {
    children: React.ReactNode;
    linkedInstructor?: Instructor | null;
}) {
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // 1. If we have a linked instructor from server, auto-select it
        if (linkedInstructor) {
            sessionStorage.setItem("selected_instructor", JSON.stringify(linkedInstructor));
            return; // Don't show modal
        }

        // 2. Otherwise check session storage (legacy/manual selection)
        const saved = sessionStorage.getItem("selected_instructor");
        if (!saved) {
            setShowModal(true);
        }
    }, [linkedInstructor]);

    const handleSelect = (instructor: Instructor) => {
        sessionStorage.setItem("selected_instructor", JSON.stringify(instructor));
        setShowModal(false);
    };

    return (
        <>
            {showModal && <InstructorSelectionModal onSelect={handleSelect} />}
            {children}
        </>
    );
}
