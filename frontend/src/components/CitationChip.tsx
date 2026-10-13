"use client";

import { useState } from "react";

export default function CitationChip({ citation, onClick }: { citation: any, onClick: () => void }) {
    const [showTooltip, setShowTooltip] = useState(false);
    
    return (
        <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <button 
                onClick={onClick}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full border border-gray-300 transition-colors"
            >
                {citation.source_title} {citation.location && `• ${citation.location}`}
            </button>
            
            {showTooltip && (
                <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 whitespace-pre-wrap">
                    {citation.excerpt}
                </div>
            )}
        </div>
    );
}
