"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  GitBranch, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  Layers, 
  RotateCcw, 
  ShieldAlert, 
  Check, 
  Info, 
  GraduationCap,
  TrendingUp,
  BrainCircuit,
  Compass,
  FileText,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useUser } from "@/context/UserContext";
import { getApiUrl } from "@/lib/config";

export default function LearningPathPage() {
  const { userId, currentUser } = useUser();
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const fetchGraph = () => {
    setLoading(true);
    setError(false);
    fetch(getApiUrl(`/api/learner/${userId}/learning-path-graph?course_id=1`))
      .then(res => {
        if (!res.ok) throw new Error("Failed to load learning path graph");
        return res.json();
      })
      .then(data => {
        setGraphData(data);
        if (data.nodes && data.nodes.length > 0) {
          // Select locked node if exists, or first node
          const locked = data.nodes.find((n: any) => n.is_locked);
          setSelectedNode(locked || data.nodes[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGraph();
  }, [userId]);

  if (error) {
    return <ErrorState onRetry={fetchGraph} />;
  }

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Group nodes by topic
  const topicsMap: Record<string, any[]> = {};
  nodes.forEach((n: any) => {
    const tname = n.topic_name || "General";
    if (!topicsMap[tname]) topicsMap[tname] = [];
    topicsMap[tname].push(n);
  });

  const masteredCount = nodes.filter((n: any) => n.effective_mastery >= 80).length;
  const lockedCount = nodes.filter((n: any) => n.is_locked).length;
  const learningCount = nodes.length - masteredCount - lockedCount;

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Adaptive Learning Path Graph</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Dynamic DAG dependency tree with prerequisite gating, real mastery levels, and unlock criteria.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-3 py-1 font-semibold border-primary/30 text-primary bg-primary/5">
            Student: {currentUser.name}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchGraph} className="h-8 text-xs gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Refresh Graph
          </Button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase">Total Concepts</CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">{nodes.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            Knowledge tree nodes
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase text-emerald-500">Mastered Nodes</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{masteredCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            ≥80% Bayesian Mastery
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase text-amber-500">In Progress</CardDescription>
            <CardTitle className="text-2xl font-black text-amber-600 dark:text-amber-400">{learningCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            Active learning frontier
          </CardContent>
        </Card>

        <Card className="border shadow-xs border-rose-500/30 bg-rose-500/[0.02]">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase text-rose-500 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Locked Nodes
            </CardDescription>
            <CardTitle className="text-2xl font-black text-rose-600 dark:text-rose-400">{lockedCount}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
            Gated by prerequisites
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : (
        /* 3. Main Graph + Inspector Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Interactive Graph Canvas */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border shadow-sm overflow-hidden bg-card/90">
              <CardHeader className="p-5 pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base font-bold">Curriculum Graph Canvas</CardTitle>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Mastered</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Learning</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Locked</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-8">
                {/* Render Topic Groups */}
                {Object.entries(topicsMap).map(([topicName, topicNodes], tIdx) => (
                  <div key={tIdx} className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <BrainCircuit className="h-3.5 w-3.5 text-primary" /> {topicName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{topicNodes.length} Concepts</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {topicNodes.map((node: any) => {
                        const isSelected = selectedNode?.id === node.id;
                        const isLocked = node.is_locked;
                        const isMastered = node.effective_mastery >= 80;

                        return (
                          <div
                            key={node.id}
                            onClick={() => setSelectedNode(node)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden select-none ${
                              isSelected
                                ? "ring-2 ring-primary border-primary shadow-md bg-primary/5"
                                : isLocked
                                ? "border-rose-500/30 bg-rose-500/[0.04] hover:border-rose-500/50"
                                : isMastered
                                ? "border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50"
                                : "border-border hover:border-primary/40 bg-card hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  {isLocked ? (
                                    <Lock className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                  ) : isMastered ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                                  )}
                                  <h4 className="font-semibold text-xs text-foreground line-clamp-1">{node.name}</h4>
                                </div>
                                <span className="text-[10px] text-muted-foreground capitalize mt-0.5 block">
                                  {isLocked ? "Gated by Prereqs" : `Status: ${node.status}`}
                                </span>
                              </div>

                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  isLocked
                                    ? "border-rose-500/40 text-rose-500 bg-rose-500/10"
                                    : isMastered
                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                    : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                }`}
                              >
                                {node.effective_mastery}%
                              </Badge>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isLocked ? "bg-rose-500" : isMastered ? "bg-emerald-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${node.effective_mastery}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Prerequisite Edges Flow */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-primary" /> Active Prerequisite Dependency Chains
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                    {edges.map((e: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg border bg-card text-[11px] space-y-1">
                        <div className="font-semibold text-foreground flex items-center gap-1 truncate">
                          <span>{e.from_name}</span>
                          <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{e.to_name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          Prereq Edge #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Right Col: Selected Node Inspector Drawer */}
          <div className="space-y-6">
            {selectedNode ? (
              <Card className={`border shadow-md overflow-hidden ${selectedNode.is_locked ? "border-rose-500/40" : "border-border"}`}>
                <CardHeader className={`p-5 pb-3 border-b ${selectedNode.is_locked ? "bg-rose-500/10" : "bg-muted/20"}`}>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        selectedNode.is_locked
                          ? "border-rose-500 text-rose-500 bg-rose-500/10"
                          : "border-primary text-primary bg-primary/10"
                      }`}
                    >
                      {selectedNode.is_locked ? "🔒 NODE LOCKED" : "UNLOCKED & AVAILABLE"}
                    </Badge>
                    <span className="text-xs font-bold">{selectedNode.effective_mastery}% Mastery</span>
                  </div>
                  <CardTitle className="text-lg font-bold mt-2 text-foreground">
                    {selectedNode.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Topic: {selectedNode.topic_name}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* DIFFERENTIATING FEATURE 7: LOCKED NODE EXPLICIT REASON */}
                  {selectedNode.is_locked && (
                    <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs space-y-2">
                      <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                        <Lock className="h-4 w-4" /> LOCK REASON:
                      </div>
                      <p className="text-foreground font-semibold leading-relaxed">
                        {selectedNode.lock_reason}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        To unlock this concept, practice its prerequisite concepts and achieve at least 60% mastery.
                      </p>
                    </div>
                  )}

                  {/* Prerequisites List */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-foreground">Prerequisite Requirements:</span>
                    {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 ? (
                      <div className="space-y-2">
                        {selectedNode.prerequisites.map((p: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg border bg-muted/20 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-foreground">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                Current: {p.current_mastery}% / Target: {p.required_mastery}%
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                p.satisfied
                                  ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                                  : "border-rose-500/40 text-rose-500 bg-rose-500/10"
                              }`}
                            >
                              {p.satisfied ? "Satisfied" : "Unsatisfied"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic p-2 bg-muted/10 rounded-lg border">
                        No prerequisite constraints for this concept.
                      </div>
                    )}
                  </div>

                  {/* Pedagogical Suggestions */}
                  <div className="space-y-2 text-xs">
                    <span className="font-bold text-foreground">Next Recommended Action:</span>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {selectedNode.is_locked
                        ? "Focus on mastering 'Permissioned blockchains' first. Once your mastery reaches 60%, this node will automatically unlock in your personalized graph."
                        : `Practice '${selectedNode.name}' with source-grounded flashcards or ask the AI Tutor to break down key formulas.`}
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="p-4 border-t bg-muted/10 flex flex-col gap-2">
                  {selectedNode.is_locked ? (
                    <Link href={`/quiz?concept_id=8`} className="w-full">
                      <Button size="sm" className="w-full gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white">
                        <Unlock className="h-3.5 w-3.5" /> Unlock via Prerequisite Practice
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/quiz?concept_id=${selectedNode.id}`} className="w-full">
                      <Button size="sm" className="w-full gap-1.5 text-xs">
                        <GraduationCap className="h-3.5 w-3.5" /> Practice {selectedNode.name}
                      </Button>
                    </Link>
                  )}
                  <Link href={`/tutor?q=Explain%20${encodeURIComponent(selectedNode.name)}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                      <Sparkles className="h-3.5 w-3.5" /> Ask AI Tutor
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ) : (
              <Card className="p-6 text-center text-muted-foreground text-xs">
                Select a concept from the curriculum canvas to inspect prerequisites and mastery.
              </Card>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
