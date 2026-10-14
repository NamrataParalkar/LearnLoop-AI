"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, FileText, FileImage, FileAudio, FolderTree, Map, GraduationCap, MessageSquare, ExternalLink, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getApiUrl } from "@/lib/config";
import { useCourse } from "@/context/CourseContext";

export default function CoursesPage() {
  const { courseId, activeCourse } = useCourse();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true });
  const [expandedSubtopics, setExpandedSubtopics] = useState<Record<number, boolean>>({ 2: true, 4: true, 6: true });
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [selectedChunk, setSelectedChunk] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    fetch(getApiUrl(`/api/courses/${courseId}/hierarchy`))
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [courseId]);

  const toggleTopic = (id: number) => {
    setExpandedTopics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSubtopic = (id: number) => {
    setExpandedSubtopics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
          <FolderTree className="h-8 w-8 text-primary" />
          <p className="text-sm">Loading course knowledge hierarchy...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.tree || data.tree.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border-dashed p-12 text-center">
          <CardTitle className="text-lg">No Course Modules Found</CardTitle>
          <CardDescription className="mt-2">
            Upload course materials or sync syllabus for {activeCourse?.title || "this course"}.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              Course Structure
            </span>
            <span className="text-xs text-muted-foreground">Authoritative Ground Truth</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1 text-foreground">
            {activeCourse?.title || "Course Knowledge Tree"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse course modules, tagged source chunks, and jump directly to the adaptive roadmap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/learning-path">
            <Button className="gap-2 shadow-sm">
              <Map className="h-4 w-4" />
              Open Learning Roadmap
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Knowledge Tree Panel */}
        <Card className="flex-1 overflow-hidden shadow-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FolderTree className="w-5 h-5 text-primary" />
                Curriculum Hierarchy
              </CardTitle>
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>Tagged Chunks: <strong className="text-foreground">{data.stats?.tagged_chunks || 0}</strong></span>
                <span>Untagged: <strong className="text-foreground">{data.stats?.untagged_chunks || 0}</strong></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
            {data.tree?.map((topic: any) => (
              <div key={topic.id} className="border rounded-lg overflow-hidden bg-card/60 transition-all">
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                  onClick={() => toggleTopic(topic.id)}
                >
                  <div className="flex items-center gap-2.5">
                    {expandedTopics[topic.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm text-foreground">{topic.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {topic.subtopics?.length || 0} Subtopics
                  </Badge>
                </div>
                
                {expandedTopics[topic.id] && (
                  <div className="pl-4 pr-3 pb-3 pt-1 space-y-2 border-t border-border/40 bg-background/50">
                    {topic.subtopics?.map((sub: any) => (
                      <div key={sub.id} className="border-l-2 border-primary/30 pl-3 py-1 space-y-1">
                        <div 
                          className="flex items-center justify-between py-1 cursor-pointer hover:text-primary transition-colors text-xs font-medium text-foreground select-none"
                          onClick={() => toggleSubtopic(sub.id)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedSubtopics[sub.id] ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span>{sub.name}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{sub.concepts?.length || 0} Concepts</span>
                        </div>
                        
                        {expandedSubtopics[sub.id] && (
                          <div className="pl-5 pt-1 space-y-1.5">
                            {sub.concepts?.map((concept: any) => (
                              <div 
                                key={concept.id}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border text-xs ${
                                  selectedConcept?.id === concept.id 
                                    ? 'bg-primary/10 border-primary/40 text-foreground font-medium shadow-sm' 
                                    : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setSelectedConcept(concept)}
                              >
                                <span className="truncate pr-2">{concept.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {concept.chunk_count} chunks
                                  </Badge>
                                </div>
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
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                  Prerequisite Dependencies
                </h3>
                <div className="space-y-1.5">
                  {data.prerequisites.slice(0, 6).map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-1.5 rounded border border-border/40">
                      <span className="font-medium text-foreground">{p.requires}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                      <span className="text-primary font-medium">{p.concept}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Concept Detail & Cross-Module Action Panel */}
        <Card className="flex-1 overflow-hidden shadow-sm flex flex-col">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-base font-semibold">
              {selectedConcept ? selectedConcept.name : "Concept Inspector"}
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedConcept ? "Grounded knowledge source chunks and direct module actions" : "Select any concept on the left to inspect its sources and actions"}
            </CardDescription>
          </CardHeader>

          {selectedConcept ? (
            <div className="flex-1 flex flex-col justify-between p-4 space-y-4 overflow-y-auto max-h-[700px]">
              {/* Quick Jump Action Bar */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-primary mr-auto">Fast Actions:</span>
                <Link href={`/learning-path?concept_id=${selectedConcept.id}`}>
                  <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs">
                    <Map className="w-3.5 h-3.5" />
                    Focus in Roadmap
                  </Button>
                </Link>
                <Link href={`/quiz?course_id=${courseId}&concept_id=${selectedConcept.id}`}>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Practice Quiz
                  </Button>
                </Link>
                <Link href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(selectedConcept.name)}`}>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ask AI Tutor
                  </Button>
                </Link>
              </div>

              {/* Chunks List */}
              <div className="space-y-3 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Associated Knowledge Chunks ({selectedConcept.chunks?.length || 0})
                </div>
                {selectedConcept.chunks?.map((chunk: any) => (
                  <div key={chunk.id} className="p-3.5 rounded-lg border bg-card/60 space-y-2 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <Badge 
                        variant="secondary"
                        className="text-[11px] cursor-pointer hover:bg-secondary/80 gap-1.5" 
                        onClick={() => setSelectedChunk(chunk)}
                      >
                        {chunk.type === 'text' && <FileText className="w-3 h-3 text-blue-500" />}
                        {chunk.type === 'figure' && <FileImage className="w-3 h-3 text-purple-500" />}
                        {chunk.type === 'transcript' && <FileAudio className="w-3 h-3 text-amber-500" />}
                        Source {chunk.source_id} {chunk.loc ? `(Loc: ${chunk.loc})` : ''}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={() => setSelectedChunk(chunk)}>
                        Full Text
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono line-clamp-3">
                      {chunk.text}...
                    </p>
                  </div>
                ))}
                {(!selectedConcept.chunks || selectedConcept.chunks.length === 0) && (
                  <div className="text-muted-foreground text-xs text-center py-12 border border-dashed rounded-lg">
                    No source chunks tagged for this concept yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
              <FolderTree className="h-10 w-10 text-muted-foreground/40 stroke-1" />
              <p className="text-sm">Click any concept in the curriculum tree to inspect its knowledge grounding and launch targeted study sessions.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Source Viewer Modal */}
      <Dialog open={!!selectedChunk} onOpenChange={() => setSelectedChunk(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Source Material Chunk #{selectedChunk?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-muted/30 border rounded-lg max-h-[60vh] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
            {selectedChunk?.text}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
