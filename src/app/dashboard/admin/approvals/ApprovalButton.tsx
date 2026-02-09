"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { approveRequest, rejectRequest } from "./actions";

interface ApprovalButtonProps {
    requestId: string;
    action: "approve" | "reject";
}

export function ApprovalButton({ requestId, action }: ApprovalButtonProps) {
    const [isPending, setIsPending] = useState(false);

    const handleClick = async () => {
        setIsPending(true);
        
        const result = action === "approve" 
            ? await approveRequest(requestId)
            : await rejectRequest(requestId);

        if (result?.error) {
            alert(`Error: ${result.error}`);
            setIsPending(false);
        }
    };

    if (action === "approve") {
        return (
            <button
                onClick={handleClick}
                disabled={isPending}
                className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
                <Check className="h-4 w-4 mr-1" />
                {isPending ? "..." : "Approve"}
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            disabled={isPending}
            className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
            <X className="h-4 w-4 mr-1" />
            {isPending ? "..." : "Reject"}
        </button>
    );
}
