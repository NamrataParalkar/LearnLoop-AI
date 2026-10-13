"use client";
/**
 * Courses Page
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, ChevronDown, FileText, FileImage, FileAudio, FolderTree } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CoursesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});
  const [expandedSubtopics, setExpandedSubtopics] = useState<Record<number, boolean>>({});
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [selectedChunk, setSelectedChunk] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/courses/1/hierarchy")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const toggleTopic = (id: number) => {
    setExpandedTopics(prev => ({...prev, [id]: !prev[id]}));
  };

  const toggleSubtopic = (id: number) => {
    setExpandedSubtopics(prev => ({...prev, [id]: !prev[id]}));
  };

  if (loading) return <div className="p-8 text-slate-400">Loading knowledge tree...</div>;
  if (!data) return <div className="p-8 text-rose-400">Failed to load courses.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto flex gap-6 h-[calc(100vh-4rem)]">
      
      {/* Knowledge Tree Panel */}
      <Card className="flex-1 overflow-y-auto bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <FolderTree className="w-5 h-5 text-indigo-400" />
            Knowledge Tree
          </CardTitle>
          <div className="text-sm text-slate-400 flex gap-4">
            <span>Tagged Chunks: {data.stats?.tagged_chunks || 0}</span>
            <span>Untagged Chunks: {data.stats?.untagged_chunks || 0}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.tree?.map((topic: any) => (
            <div key={topic.id} className="border border-slate-800/50 rounded-md p-2 bg-slate-950/20">
              <div 
                className="flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white"
                onClick={() => toggleTopic(topic.id)}
              >
                {expandedTopics[topic.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-semibold text-lg">{topic.name}</span>
              </div>
              
              {expandedTopics[topic.id] && (
                <div className="pl-6 mt-2 space-y-2 border-l border-slate-800 ml-2">
                  {topic.subtopics?.map((sub: any) => (
                    <div key={sub.id}>
                      <div 
                        className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white"
                        onClick={() => toggleSubtopic(sub.id)}
                      >
                        {expandedSubtopics[sub.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="font-medium">{sub.name}</span>
                      </div>
                      
                      {expandedSubtopics[sub.id] && (
                        <div className="pl-6 mt-2 space-y-1 border-l border-slate-800/50 ml-2">
                          {sub.concepts?.map((concept: any) => (
                            <div 
                              key={concept.id}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedConcept?.id === concept.id ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-slate-800/50 text-slate-400'}`}
                              onClick={() => setSelectedConcept(concept)}
                            >
                              <span>{concept.name}</span>
                              <Badge variant="outline" className="bg-slate-900 text-xs">
                                {concept.chunk_count} chunks
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {data.prerequisites && data.prerequisites.length > 0 && (
            <div className="mt-8 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Discovered Prerequisites</h3>
              <div className="space-y-2">
                {data.prerequisites.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="px-2 py-1 bg-slate-800 rounded">{p.requires}</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">{p.concept}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concept Detail Panel */}
      {selectedConcept ? (
        <Card className="flex-1 overflow-y-auto bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200">{selectedConcept.name}</CardTitle>
            <p className="text-sm text-slate-400">Associated Knowledge Chunks</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedConcept.chunks?.map((chunk: any) => (
              <div key={chunk.id} className="p-4 rounded-lg bg-slate-950/50 border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 cursor-pointer" onClick={() => setSelectedChunk(chunk)}>
                    {chunk.type === 'text' && <FileText className="w-3 h-3 mr-1" />}
                    {chunk.type === 'figure' && <FileImage className="w-3 h-3 mr-1" />}
                    {chunk.type === 'transcript' && <FileAudio className="w-3 h-3 mr-1" />}
                    Source {chunk.source_id} {chunk.loc ? `(Loc: ${chunk.loc})` : ''}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {chunk.text}...
                </p>
              </div>
            ))}
            {(!selectedConcept.chunks || selectedConcept.chunks.length === 0) && (
              <div className="text-slate-500 text-sm text-center py-8">No chunks tagged for this concept yet.</div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-slate-500">
          Select a concept to view its chunks
        </div>
      )}

      {/* Source Viewer Modal */}
      <Dialog open={!!selectedChunk} onOpenChange={() => setSelectedChunk(null)}>
        <DialogContent className="bg-slate-900 text-slate-200 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Source Viewer - Chunk {selectedChunk?.id}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 bg-slate-950 rounded-lg max-h-[60vh] overflow-y-auto font-mono text-sm">
            {selectedChunk?.text}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
