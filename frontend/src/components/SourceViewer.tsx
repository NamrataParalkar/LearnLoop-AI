"use client";

export default function SourceViewer({ citation }: { citation: any }) {
    
    const renderContent = () => {
        if (citation.source_type === "pdf") {
            // Note: In real app, we'd use react-pdf here.
            return (
                <div className="h-full flex flex-col bg-gray-100 rounded p-4 items-center justify-center text-center">
                    <p className="text-gray-500 mb-2">[PDF Viewer Placeholder]</p>
                    <p className="font-medium">Opening: {citation.source_title}</p>
                    <p className="text-sm">Jumped to {citation.location}</p>
                    
                    <div className="mt-6 p-4 bg-yellow-100 border border-yellow-300 text-left text-sm text-gray-800">
                        <strong className="block mb-1">Highlight:</strong>
                        {citation.excerpt}
                    </div>
                </div>
            );
        }
        
        if (citation.source_type === "video") {
            return (
                <div className="flex flex-col gap-4">
                    <video 
                        src={`http://localhost:8000${citation.media_url}`} 
                        controls 
                        autoPlay 
                        className="w-full rounded bg-black"
                    />
                    <div className="p-3 bg-gray-50 border rounded text-sm text-gray-700">
                        <strong>Transcript Snippet:</strong>
                        <p className="mt-1">{citation.excerpt}</p>
                    </div>
                </div>
            );
        }
        
        if (citation.source_type === "pptx") {
            return (
                <div className="flex flex-col gap-4">
                    <img src={`http://localhost:8000${citation.media_url}`} alt="Slide" className="w-full border rounded" />
                    <div className="p-3 bg-gray-50 border rounded text-sm text-gray-700">
                        <strong>Slide Text & Notes:</strong>
                        <p className="mt-1">{citation.excerpt}</p>
                    </div>
                </div>
            );
        }
        
        return <div>Unsupported media type</div>;
    };

    return (
        <div className="flex-1 overflow-y-auto">
            {renderContent()}
        </div>
    );
}
