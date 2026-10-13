import React from "react";

export function getMasteryColor(percent: number): string {
    if (percent >= 80) return "bg-green-500 text-green-900";
    if (percent >= 60) return "bg-yellow-400 text-yellow-900";
    if (percent >= 40) return "bg-orange-500 text-orange-900";
    if (percent > 0) return "bg-red-500 text-red-900";
    return "bg-gray-300 text-gray-700";
}

export function MasteryBar({ percent, label }: { percent: number, label?: string }) {
    const color = getMasteryColor(percent);
    
    return (
        <div className="flex items-center gap-3 w-full">
            <div className="flex-1 bg-gray-200 h-4 rounded-full overflow-hidden" aria-label={`Mastery: ${percent}%`}>
                <div className={`h-full ${color.split(' ')[0]}`} style={{ width: `${Math.max(percent, 0)}%` }} />
            </div>
            <div className="w-12 text-right text-sm font-bold">
                {percent}%
            </div>
            {label && <div className="text-sm text-gray-600 w-24">{label}</div>}
        </div>
    );
}

export function StatusChip({ status }: { status: string }) {
    const colors: Record<string, string> = {
        mastered: "bg-green-100 text-green-800 border-green-300",
        learning: "bg-yellow-100 text-yellow-800 border-yellow-300",
        weak: "bg-orange-100 text-orange-800 border-orange-300",
        locked: "bg-red-50 text-red-700 border-red-200",
        not_started: "bg-gray-100 text-gray-700 border-gray-300"
    };
    
    return (
        <span className={`px-2 py-1 text-xs rounded border font-medium uppercase tracking-wide ${colors[status] || colors.not_started}`}>
            {status.replace("_", " ")}
        </span>
    );
}
