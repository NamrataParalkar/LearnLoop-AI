"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  GitBranch, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  RotateCcw, 
  GraduationCap,
  BrainCircuit,
  Search, 
  Clock, 
  TrendingUp, 
  Target, 
  ArrowUpRight, 
  ShieldCheck, 
  Activity, 
  History, 
  X, 
  Compass,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Lightbulb,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flame,
  Award,
  BookMarked,
  SlidersHorizontal,
  Eye,
  RefreshCw,
  BarChart2,
  Check,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUser } from "@/context/UserContext";
import { useCourse } from "@/context/CourseContext";
import { getApiUrl } from "@/lib/config";

// Types matching backend payload
interface PrerequisiteDetail {
  id: number;
  name: string;
  current_mastery: number;
  required_mastery: number;
  satisfied: boolean;
}

interface DependentDetail {
  id: number;
  name: string;
  current_mastery: number;
  is_locked: boolean;
}

interface ConceptMisconception {
  title: string;
  summary: string;
  confidence_level: string;
  wrong_count: number;
}

interface TutorPrompts {
  standard: string;
  analogy: string;
  first_principles: string;
  socratic: string;
}

interface GraphNode {
  id: number;
  name: string;
  description: string;
  topic_id: number;
  topic_name: string;
  parent_topic_id: number;
  parent_topic_name: string;
  subtopic_id: number;
  subtopic_name: string;
  layer: number;
  order_in_layer: number;
  x: number;
  y: number;
  p_known_pct: number;
  effective_mastery: number;
  retrievability_pct: number;
  stability_days: number;
  days_since_practice: number | null;
  last_practiced_at: string | null;
  n_observations: number;
  recent_accuracy_pct: number | null;
  recent_attempts_count: number;
  status: "locked" | "not_started" | "learning" | "mastered" | "revision_required" | "weak";
  is_locked: boolean;
  lock_reason: string | null;
  needs_revision: boolean;
  revision_reason: string | null;
  is_bottleneck: boolean;
  blocked_downstream_count: number;
  prerequisites: PrerequisiteDetail[];
  dependents: DependentDetail[];
  action_target_concept_id: number;
  action_label: string;
  tutor_prompts: TutorPrompts;
  misconceptions: ConceptMisconception[];
}

interface GraphEdge {
  from: number;
  to: number;
  from_name: string;
  to_name: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  satisfied: boolean;
}

interface LastActivity {
  date: string;
  concept_name: string;
  is_correct: boolean;
  type: string;
}

interface GraphSummary {
  total_concepts: number;
  mastered_count: number;
  learning_count: number;
  available_count: number;
  locked_count: number;
  revision_due_count: number;
  overall_mastery: number;
  course_completion_pct: number;
  last_activity: LastActivity | null;
}

interface NextRecommendation {
  action: "learn" | "practice" | "review";
  concept_id: number | null;
  concept_name: string | null;
  topic_id: number | null;
  topic_name: string | null;
  reason: string;
  priority_type?: string;
}

interface BottleneckItem {
  concept_id: number;
  concept_name: string;
  topic_id: number;
  topic_name: string;
  mastery_pct: number;
  downstream_blocked_count: number;
}

interface ConfidenceCalibration {
  total_quizzes: number;
  calibration_score: number;
  overconfident_count: number;
  underconfident_count: number;
  calibration_status: string;
  overconfidence_warnings?: any[];
  imposter_warnings?: any[];
}

interface ActiveMisconception {
  id: number;
  concept_id: number;
  concept_name: string;
  title: string;
  summary: string;
  confidence_level: string;
  wrong_count: number;
}

interface HierarchyTreeConcept {
  id: number;
  name: string;
  status: string;
  mastery: number;
}

interface HierarchyTreeSubtopic {
  id: number;
  name: string;
  concepts: HierarchyTreeConcept[];
}

interface HierarchyTreeItem {
  id: number;
  name: string;
  subtopics: HierarchyTreeSubtopic[];
}

interface KnowledgeIntelligence {
  bottlenecks: BottleneckItem[];
  forgetting_risk: GraphNode[];
  weak_concepts: GraphNode[];
  strong_concepts: GraphNode[];
  confidence_calibration: ConfidenceCalibration | null;
  active_misconceptions: ActiveMisconception[];
  hierarchy_tree: HierarchyTreeItem[];
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  user_id: number;
  user_name: string;
  course_id: number;
  course_title: string;
  summary: GraphSummary;
  next_recommendation: NextRecommendation | null;
  knowledge_intelligence: KnowledgeIntelligence;
}

export default function LearningPathPage() {
  const { userId, currentUser } = useUser();
  const { courseId, setCourseId, courses, activeCourse } = useCourse();

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  // View Mode: Canvas Roadmap vs Topic Hierarchy List
  const [viewMode, setViewMode] = useState<"canvas" | "list">("canvas");

  // Canvas Navigation State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [zoom, setZoom] = useState<number>(0.85);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Knowledge Intelligence Active Tab
  const [intelTab, setIntelTab] = useState<string>("bottlenecks");

  const inspectorRef = useRef<HTMLDivElement>(null);

  // Fetch Graph from Backend
  const fetchGraph = useCallback((isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    setErrorMessage("");

    const targetCourse = courseId || 1;
    fetch(getApiUrl(`/api/learner/${userId}/learning-path-graph?course_id=${targetCourse}`))
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load graph (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((data: GraphData) => {
        setGraphData(data);
        if (data.nodes && data.nodes.length > 0) {
          setSelectedNodeId(prev => {
            if (prev && data.nodes.some(n => n.id === prev)) return prev;
            if (data.next_recommendation?.concept_id) {
              const recNode = data.nodes.find(n => n.id === data.next_recommendation!.concept_id);
              if (recNode) return recNode.id;
            }
            const activeNode = data.nodes.find(n => n.status === "revision_required" || n.is_locked || n.status === "learning");
            return activeNode ? activeNode.id : data.nodes[0].id;
          });
        } else {
          setSelectedNodeId(null);
        }
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        console.error("Learning Path Graph fetch error:", err);
        setError(true);
        setErrorMessage(err.message || "Failed to communicate with backend service.");
        setLoading(false);
        setRefreshing(false);
      });
  }, [userId, courseId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const nodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const edges = useMemo(() => graphData?.edges || [], [graphData]);
  const summary = graphData?.summary;
  const nextRec = graphData?.next_recommendation;
  const intel = graphData?.knowledge_intelligence;

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Set of ancestor prerequisite IDs and descendant dependent IDs for focus highlighting
  const upstreamPrereqIds = useMemo(() => {
    if (!selectedNode) return new Set<number>();
    return new Set(selectedNode.prerequisites.map(p => p.id));
  }, [selectedNode]);

  const downstreamDependentIds = useMemo(() => {
    if (!selectedNode) return new Set<number>();
    return new Set(selectedNode.dependents.map(d => d.id));
  }, [selectedNode]);

  // Available topics for filtering
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach(n => {
      if (n.parent_topic_name) set.add(n.parent_topic_name);
      else if (n.topic_name) set.add(n.topic_name);
    });
    return Array.from(set);
  }, [nodes]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = n.name.toLowerCase().includes(q);
        const matchesTopic = n.topic_name.toLowerCase().includes(q) || n.parent_topic_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesTopic) return false;
      }
      if (selectedTopic !== "all") {
        if (n.parent_topic_name !== selectedTopic && n.topic_name !== selectedTopic) {
          return false;
        }
      }
      if (statusFilter === "mastered" && n.status !== "mastered") return false;
      if (statusFilter === "learning" && n.status !== "learning" && n.status !== "weak") return false;
      if (statusFilter === "available" && (n.is_locked || n.status === "mastered")) return false;
      if (statusFilter === "revision" && !n.needs_revision && n.status !== "revision_required") return false;
      if (statusFilter === "locked" && !n.is_locked) return false;
      if (statusFilter === "bottlenecks" && !n.is_bottleneck) return false;

      return true;
    });
  }, [nodes, searchQuery, selectedTopic, statusFilter]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  // Filtered edges
  const filteredEdges = useMemo(() => {
    return edges.filter(e => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));
  }, [edges, filteredNodeIds]);

  // Grouped by Topic for list view
  const groupedTopics = useMemo(() => {
    const map: Record<string, GraphNode[]> = {};
    filteredNodes.forEach(n => {
      const t = n.parent_topic_name || n.topic_name || "General";
      if (!map[t]) map[t] = [];
      map[t].push(n);
    });
    return map;
  }, [filteredNodes]);

  // Node Selection Handler
  const handleSelectNode = (nodeId: number, autoPan = true) => {
    setSelectedNodeId(nodeId);
    if (autoPan && canvasRef.current) {
      const target = nodes.find(n => n.id === nodeId);
      if (target) {
        const cWidth = canvasRef.current.clientWidth || 800;
        const cHeight = canvasRef.current.clientHeight || 550;
        setPan({
          x: cWidth / 2 - target.x * zoom - 130 * zoom,
          y: cHeight / 2 - target.y * zoom - 65 * zoom
        });
      }
    }
    if (window.innerWidth < 1024 && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Canvas Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".node-interactive-card")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Zoom Controls
  const handleZoomIn = () => setZoom(prev => Math.min(1.8, Number((prev + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom(prev => Math.max(0.4, Number((prev - 0.15).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(0.85);
    setPan({ x: 30, y: 30 });
  };

  const handleFitToScreen = () => {
    if (!nodes.length || !canvasRef.current) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + 270));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + 150));

    const graphWidth = maxX - minX + 80;
    const graphHeight = maxY - minY + 80;
    const containerWidth = canvasRef.current.clientWidth || 850;
    const containerHeight = canvasRef.current.clientHeight || 550;

    const scale = Math.min(containerWidth / graphWidth, containerHeight / graphHeight, 1.1);
    const fitScale = Math.max(0.45, Math.min(1.2, scale));

    setZoom(fitScale);
    setPan({
      x: (containerWidth - graphWidth * fitScale) / 2 - minX * fitScale + 30,
      y: (containerHeight - graphHeight * fitScale) / 2 - minY * fitScale + 30
    });
  };

  if (error) {
    return (
      <ErrorState 
        onRetry={() => fetchGraph()} 
        title="Learning Path Graph Offline" 
        description={errorMessage || "Unable to reach the learner model and prerequisite graph."} 
      />
    );
  }

  const courseTitle = graphData?.course_title || activeCourse?.title || "Curriculum Knowledge Graph";

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* 1. Header Bar with Course Switcher, User Badge & Live Sync */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <GitBranch className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                  Adaptive Learning Path
                </h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-primary/30 text-primary bg-primary/5">
                  Command Center
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Prerequisite dependency graph, cognitive readiness, and Bayesian knowledge tracing
              </p>
            </div>
          </div>
        </div>
        
        {/* Course Switcher & Refresh Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Course Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border">
            <BookMarked className="h-3.5 w-3.5 text-muted-foreground ml-2" />
            <select
              value={courseId}
              onChange={e => setCourseId(parseInt(e.target.value))}
              className="text-xs font-semibold bg-transparent border-0 text-foreground py-1 px-2 focus:outline-hidden cursor-pointer"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id} className="bg-background text-foreground">
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <Badge variant="outline" className="text-xs px-3 py-1 font-semibold border-primary/30 text-primary bg-primary/5 gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Learner: {currentUser?.name || "Student"}
          </Badge>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchGraph(true)} 
            disabled={loading || refreshing}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            {refreshing ? "Syncing..." : "Sync Model"}
          </Button>
        </div>
      </div>

      {loading && !graphData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : nodes.length === 0 ? (
        <EmptyState 
          icon={<Compass className="h-10 w-10 text-muted-foreground" />}
          title="No Concepts in this Course"
          description="The active course has no structured concepts or prerequisites indexed yet. Upload course materials in the Courses module to generate a knowledge DAG."
        />
      ) : (
        <>
          {/* 2. Top Summary Metric Cards (Separating Mastery vs Course Completion) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Concepts */}
            <Card className="border shadow-2xs bg-card/60">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Concepts</CardDescription>
                <CardTitle className="text-xl font-black text-foreground">{summary?.total_concepts || nodes.length}</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 text-[10px] text-muted-foreground">
                DAG knowledge nodes
              </CardContent>
            </Card>

            {/* Overall Concept Mastery */}
            <Card className="border shadow-2xs border-primary/20 bg-primary/[0.02]">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-primary">Concept Mastery</CardDescription>
                <CardTitle className="text-xl font-black text-primary">{summary?.overall_mastery || 0}%</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 text-[10px] text-muted-foreground">
                Bayesian BKT average
              </CardContent>
            </Card>

            {/* Course Completion */}
            <Card className="border shadow-2xs border-emerald-500/20 bg-emerald-500/[0.02]">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Curriculum Done</CardDescription>
                <CardTitle className="text-xl font-black text-emerald-600 dark:text-emerald-400">{summary?.course_completion_pct || 0}%</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 text-[10px] text-muted-foreground">
                {summary?.mastered_count || 0} of {summary?.total_concepts || 0} mastered
              </CardContent>
            </Card>

            {/* Ready to Learn (Available) */}
            <Card className="border shadow-2xs border-sky-500/20 bg-sky-500/[0.02]">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Ready to Learn</CardDescription>
                <CardTitle className="text-xl font-black text-sky-600 dark:text-sky-400">{summary?.available_count || 0}</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 text-[10px] text-muted-foreground">
                Prerequisites satisfied
              </CardContent>
            </Card>

            {/* Locked by Prerequisites */}
            <Card className="border shadow-2xs border-rose-500/20 bg-rose-500/[0.02]">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Gated / Locked</CardDescription>
                <CardTitle className="text-xl font-black text-rose-600 dark:text-rose-400">{summary?.locked_count || 0}</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 text-[10px] text-muted-foreground">
                Requires prereqs &lt;60%
              </CardContent>
            </Card>

            {/* Revision Due (Memory Decay) */}
            <Card className="border shadow-2xs border-purple-500/20 bg-purple-500/[0.02]">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Revision Due</CardDescription>
                <CardTitle className="text-xl font-black text-purple-600 dark:text-purple-400">{summary?.revision_due_count || 0}</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-0 text-[10px] text-muted-foreground">
                Decayed retrievability
              </CardContent>
            </Card>
          </div>

          {/* Last Activity Status Ribbon if present */}
          {summary?.last_activity && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border bg-muted/20 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span>
                  Last learning activity: <strong className="text-foreground">{summary.last_activity.concept_name}</strong> ({summary.last_activity.date})
                </span>
                <Badge variant="outline" className={`text-[10px] font-semibold py-0 ${summary.last_activity.is_correct ? "text-emerald-500 border-emerald-500/30" : "text-amber-500 border-amber-500/30"}`}>
                  {summary.last_activity.is_correct ? "✓ Correct" : "Needs Review"}
                </Badge>
              </div>
              <span className="text-[11px] hidden sm:inline">Persisted cognitive assessment</span>
            </div>
          )}

          {/* 3. Authoritative "Your Next Best Step" Prominent Section */}
          {nextRec && nextRec.concept_id && (
            <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-card to-background shadow-xs overflow-hidden">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-[10px] uppercase font-bold tracking-wider bg-primary text-primary-foreground gap-1">
                      <Sparkles className="h-3 w-3" />
                      Your Next Best Step
                    </Badge>
                    {nextRec.priority_type === "bottleneck" && (
                      <Badge variant="outline" className="text-[10px] font-bold border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-1">
                        <Flame className="h-3 w-3" />
                        Prerequisite Bottleneck Unlock
                      </Badge>
                    )}
                    {nextRec.priority_type === "decay" && (
                      <Badge variant="outline" className="text-[10px] font-bold border-purple-500/50 text-purple-600 dark:text-purple-400 bg-purple-500/10 gap-1">
                        <Clock className="h-3 w-3" />
                        Retention Reinforcement
                      </Badge>
                    )}
                    <span className="text-xs font-semibold text-muted-foreground">
                      Module: <strong className="text-foreground">{nextRec.topic_name}</strong>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base md:text-lg font-black text-foreground">
                      {nextRec.concept_name}
                    </h3>
                    <p className="text-xs md:text-sm text-foreground/90 mt-1 leading-relaxed">
                      {nextRec.reason}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => handleSelectNode(nextRec.concept_id!)}
                  >
                    <Target className="h-3.5 w-3.5 text-primary" /> Focus in Graph
                  </Button>

                  <Link href={`/quiz?course_id=${courseId}&concept_id=${nextRec.concept_id}`}>
                    <Button size="sm" className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs">
                      <GraduationCap className="h-3.5 w-3.5" /> Practice Now
                    </Button>
                  </Link>

                  <Link href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(nextRec.concept_name || "")}&prompt=${encodeURIComponent(`Explain ${nextRec.concept_name} from first principles.`)}`}>
                    <Button size="sm" variant="secondary" className="text-xs gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Ask AI Tutor
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 4. Interactive Filters Bar & View Switcher */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl border bg-card/60 backdrop-blur-xs">
            {/* Left: Search & Topic Filter */}
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search concepts or topics..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-8 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Topic Filter */}
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                className="w-full sm:w-auto text-xs py-1.5 px-3 rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Modules ({availableTopics.length})</option>
                {availableTopics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Center: Status Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: "all", label: "All" },
                { id: "available", label: "Ready" },
                { id: "learning", label: "In Progress" },
                { id: "mastered", label: "Mastered" },
                { id: "revision", label: "Decay" },
                { id: "locked", label: "Locked" },
                { id: "bottlenecks", label: "Bottlenecks" },
              ].map(f => (
                <Button
                  key={f.id}
                  variant={statusFilter === f.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(f.id)}
                  className="h-7 text-[11px] px-2.5 py-0 whitespace-nowrap"
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* Right: View Toggle (Canvas Roadmap vs List) */}
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border shrink-0">
              <Button
                variant={viewMode === "canvas" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("canvas")}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <Layers className="h-3.5 w-3.5" />
                Roadmap Graph
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Topic Grid
              </Button>
            </div>
          </div>

          {/* 5. Main Canvas + Concept Inspector Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left 2 Cols: Interactive Graph Canvas or Topic Grid */}
            <div className="lg:col-span-2 space-y-6">
              
              {viewMode === "canvas" ? (
                /* Interactive Canvas Card */
                <Card className="border shadow-md overflow-hidden bg-slate-950/40 relative">
                  {/* Floating Toolbar */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-background/85 backdrop-blur-md p-1.5 rounded-xl border shadow-sm">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0" 
                      onClick={handleZoomIn}
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0" 
                      onClick={handleZoomOut}
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] font-mono px-1 text-muted-foreground">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-[10px] font-medium" 
                      onClick={handleResetZoom}
                      title="Reset View"
                    >
                      Reset
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-2 text-[10px] font-medium gap-1" 
                      onClick={handleFitToScreen}
                      title="Fit Graph to Screen"
                    >
                      <Maximize2 className="h-3 w-3" /> Fit
                    </Button>
                  </div>

                  {/* Canvas Legend Overlay */}
                  <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-2.5 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-xl border text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Mastered (≥80%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500" /> Available
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> In Progress
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-purple-500" /> Retention Decay
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" /> Locked (&lt;60% prereq)
                    </span>
                  </div>

                  {/* Interactive Surface */}
                  <div 
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="relative w-full h-[620px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
                    style={{
                      backgroundImage: "radial-gradient(circle, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
                      backgroundSize: "24px 24px"
                    }}
                  >
                    {/* Transform Container */}
                    <div 
                      className="absolute top-0 left-0 transition-transform duration-75 origin-top-left"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        width: "1800px",
                        height: "1000px"
                      }}
                    >
                      {/* SVG Prerequisite Edges */}
                      <svg 
                        className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
                        style={{ overflow: "visible" }}
                      >
                        <defs>
                          {/* Marker for satisfied edge */}
                          <marker 
                            id="arrow-satisfied" 
                            viewBox="0 0 10 10" 
                            refX="7" 
                            refY="5" 
                            markerWidth="6" 
                            markerHeight="6" 
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
                          </marker>
                          {/* Marker for unsatisfied / blocking edge */}
                          <marker 
                            id="arrow-unsatisfied" 
                            viewBox="0 0 10 10" 
                            refX="7" 
                            refY="5" 
                            markerWidth="6" 
                            markerHeight="6" 
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
                          </marker>
                          {/* Marker for focused upstream */}
                          <marker 
                            id="arrow-focused" 
                            viewBox="0 0 10 10" 
                            refX="7" 
                            refY="5" 
                            markerWidth="6" 
                            markerHeight="6" 
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                          </marker>
                        </defs>

                        {filteredEdges.map((edge, idx) => {
                          const src = nodes.find(n => n.id === edge.from);
                          const tgt = nodes.find(n => n.id === edge.to);
                          if (!src || !tgt) return null;

                          const startX = src.x + 260;
                          const startY = src.y + 65;
                          const endX = tgt.x;
                          const endY = tgt.y + 65;

                          const dx = Math.max(40, (endX - startX) * 0.5);
                          const c1X = startX + dx;
                          const c1Y = startY;
                          const c2X = endX - dx;
                          const c2Y = endY;
                          const pathD = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;

                          const midX = (startX + endX) / 2;
                          const midY = (startY + endY) / 2;

                          // Focus styling
                          const isFocusedEdge = selectedNodeId && (edge.to === selectedNodeId || edge.from === selectedNodeId);
                          const isUnrelated = selectedNodeId && !isFocusedEdge;

                          let strokeColor = edge.satisfied ? "#10b981" : "#f43f5e";
                          let markerId = edge.satisfied ? "url(#arrow-satisfied)" : "url(#arrow-unsatisfied)";
                          let strokeWidth = edge.satisfied ? 2 : 1.75;
                          let strokeDash = edge.satisfied ? "none" : "5,4";
                          let opacity = 0.8;

                          if (isFocusedEdge) {
                            strokeWidth = 3;
                            opacity = 1;
                            if (edge.to === selectedNodeId) {
                              strokeColor = "#10b981"; // required prereq incoming
                            } else {
                              strokeColor = "#38bdf8"; // downstream unlock
                              markerId = "url(#arrow-focused)";
                            }
                          } else if (isUnrelated) {
                            opacity = 0.15;
                          }

                          return (
                            <g key={idx}>
                              <path 
                                d={pathD}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                                strokeDasharray={strokeDash}
                                markerEnd={markerId}
                                opacity={opacity}
                                className="transition-all duration-300"
                              />
                              {!edge.satisfied && (
                                <g transform={`translate(${midX - 10}, ${midY - 10})`}>
                                  <rect width="20" height="20" rx="4" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="1" opacity={opacity} />
                                  <text x="5" y="14" fill="#f43f5e" fontSize="11" fontFamily="sans-serif">🔒</text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </svg>

                      {/* HTML Concept Nodes positioned at (x, y) */}
                      {filteredNodes.map(node => {
                        const isSelected = selectedNode?.id === node.id;
                        const isUpstreamPrereq = upstreamPrereqIds.has(node.id);
                        const isDownstreamUnlock = downstreamDependentIds.has(node.id);
                        const isDimmed = selectedNodeId !== null && !isSelected && !isUpstreamPrereq && !isDownstreamUnlock;

                        const isLocked = node.is_locked;
                        const isMastered = node.status === "mastered";
                        const isRevision = node.status === "revision_required" || node.needs_revision;
                        const isAvailable = !isLocked && !isMastered && node.status !== "learning";

                        let borderClasses = "border-border/80 bg-card/95 hover:border-primary/50 shadow-sm";
                        let statusColor = "bg-amber-500";
                        let statusText = "In Progress";

                        if (isSelected) {
                          borderClasses = "border-primary ring-3 ring-primary/40 shadow-xl bg-card";
                        } else if (isUpstreamPrereq) {
                          borderClasses = "border-emerald-500/70 ring-2 ring-emerald-500/30 bg-emerald-500/[0.04]";
                        } else if (isDownstreamUnlock) {
                          borderClasses = "border-sky-500/70 ring-2 ring-sky-500/30 bg-sky-500/[0.04]";
                        } else if (isLocked) {
                          borderClasses = "border-rose-500/30 bg-rose-500/[0.02] hover:border-rose-500/50";
                          statusColor = "bg-rose-500";
                          statusText = "Locked";
                        } else if (isRevision) {
                          borderClasses = "border-purple-500/40 bg-purple-500/[0.03] hover:border-purple-500/60";
                          statusColor = "bg-purple-500";
                          statusText = "Decay Alert";
                        } else if (isMastered) {
                          borderClasses = "border-emerald-500/40 bg-emerald-500/[0.02] hover:border-emerald-500/60";
                          statusColor = "bg-emerald-500";
                          statusText = "Mastered";
                        } else if (isAvailable) {
                          borderClasses = "border-sky-500/40 bg-sky-500/[0.02] hover:border-sky-500/60";
                          statusColor = "bg-sky-500";
                          statusText = "Ready";
                        }

                        return (
                          <div
                            key={node.id}
                            onClick={() => handleSelectNode(node.id, false)}
                            className={`node-interactive-card absolute p-3.5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md select-none ${borderClasses} ${
                              isDimmed ? "opacity-25 grayscale-[30%] hover:opacity-80 transition-opacity" : "opacity-100"
                            }`}
                            style={{
                              left: `${node.x}px`,
                              top: `${node.y}px`,
                              width: "260px",
                              minHeight: "135px"
                            }}
                          >
                            {/* Card Header & Badges */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block truncate">
                                  {node.parent_topic_name || node.topic_name}
                                </span>
                                <h4 className="font-bold text-xs text-foreground truncate mt-0.5" title={node.name}>
                                  {node.name}
                                </h4>
                              </div>

                              <Badge
                                variant="outline"
                                className={`text-[10px] font-black shrink-0 ${
                                  isLocked
                                    ? "border-rose-500/40 text-rose-500 bg-rose-500/10"
                                    : isRevision
                                    ? "border-purple-500/40 text-purple-500 bg-purple-500/10"
                                    : isMastered
                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                    : "border-primary/40 text-primary bg-primary/10"
                                }`}
                              >
                                {node.effective_mastery}%
                              </Badge>
                            </div>

                            {/* Relationship Indicators if in focus */}
                            {isUpstreamPrereq && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 mb-1.5 border-emerald-500 text-emerald-500 bg-emerald-500/10">
                                ↖ Required Prerequisite
                              </Badge>
                            )}
                            {isDownstreamUnlock && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 mb-1.5 border-sky-500 text-sky-500 bg-sky-500/10">
                                ↘ Unlocks After ≥60%
                              </Badge>
                            )}

                            {/* Progress bar */}
                            <div className="space-y-1 my-2">
                              <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    isLocked 
                                      ? "bg-rose-500" 
                                      : isRevision 
                                      ? "bg-purple-500" 
                                      : isMastered 
                                      ? "bg-emerald-500" 
                                      : isAvailable
                                      ? "bg-sky-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.max(6, node.effective_mastery)}%` }}
                                />
                              </div>
                            </div>

                            {/* Status and Tags Footer */}
                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40">
                              <div className="flex items-center gap-1.5">
                                {isLocked ? (
                                  <Lock className="h-3 w-3 text-rose-500 shrink-0" />
                                ) : isRevision ? (
                                  <Clock className="h-3 w-3 text-purple-500 shrink-0" />
                                ) : isMastered ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                ) : (
                                  <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                                )}
                                <span className="text-muted-foreground truncate">{statusText}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                {node.is_bottleneck && (
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500 text-amber-500 bg-amber-500/10" title="Blocks downstream concepts">
                                    Bottleneck
                                  </Badge>
                                )}
                                {node.misconceptions && node.misconceptions.length > 0 && (
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-rose-500 text-rose-500 bg-rose-500/10" title="Active misconception">
                                    !
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ) : (
                /* Topic Hierarchy List View */
                <Card className="border shadow-xs overflow-hidden bg-card/90">
                  <CardHeader className="p-4 md:p-5 pb-3 border-b bg-muted/20">
                    <CardTitle className="text-sm md:text-base font-bold">Curriculum Topics & Knowledge Breakdown</CardTitle>
                    <CardDescription className="text-xs">
                      Structured by curriculum hierarchy. Select any concept to inspect prerequisites and cognitive diagnostics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 space-y-6">
                    {Object.entries(groupedTopics).map(([topicName, topicNodes], tIdx) => {
                      const topicMastery = Math.round(
                        topicNodes.reduce((acc, curr) => acc + curr.effective_mastery, 0) / topicNodes.length
                      );

                      return (
                        <div key={tIdx} className="space-y-3">
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                              <BrainCircuit className="h-4 w-4 text-primary" />
                              {topicName}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{topicNodes.length} Concepts</span>
                              <Badge variant="outline" className="text-[10px] font-bold">
                                Avg Mastery: {topicMastery}%
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {topicNodes.map(node => (
                              <div
                                key={node.id}
                                onClick={() => handleSelectNode(node.id)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer select-none space-y-2 ${
                                  selectedNode?.id === node.id 
                                    ? "border-primary ring-2 ring-primary/30 bg-primary/[0.04]" 
                                    : "border-border hover:border-primary/40 bg-card"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-xs text-foreground truncate">{node.name}</h4>
                                  <Badge variant="outline" className="text-[10px] font-bold">
                                    {node.effective_mastery}%
                                  </Badge>
                                </div>
                                <Progress value={node.effective_mastery} className="h-1.5" />
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span>{node.is_locked ? "🔒 Locked" : node.status === "mastered" ? "✓ Mastered" : "Active"}</span>
                                  <span>{node.prerequisites.length} Prereqs</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

            </div>

            {/* Right Col: Selected Concept Intelligence Side Panel / Drawer */}
            <div ref={inspectorRef} className="space-y-6 sticky top-20">
              {selectedNode ? (
                <Card className={`border shadow-md overflow-hidden ${selectedNode.is_locked ? "border-rose-500/40" : "border-border"}`}>
                  {/* Drawer Header */}
                  <CardHeader className={`p-5 pb-3 border-b ${selectedNode.is_locked ? "bg-rose-500/10" : "bg-muted/20"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          selectedNode.is_locked
                            ? "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                            : selectedNode.needs_revision
                            ? "border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                            : selectedNode.status === "mastered"
                            ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            : "border-primary text-primary bg-primary/10"
                        }`}
                      >
                        {selectedNode.is_locked 
                          ? "🔒 GATED BY PREREQUISITES" 
                          : selectedNode.needs_revision 
                          ? "⏳ MEMORY DECAY ALERT" 
                          : selectedNode.status === "mastered"
                          ? "✓ CONCEPT MASTERED"
                          : "UNLOCKED & AVAILABLE"}
                      </Badge>
                      <span className="text-xs font-black">{selectedNode.effective_mastery}% Mastery</span>
                    </div>

                    <CardTitle className="text-base md:text-lg font-bold mt-2 text-foreground leading-snug">
                      {selectedNode.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {courseTitle} &gt; {selectedNode.parent_topic_name} &gt; {selectedNode.subtopic_name}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {/* Concept Description */}
                    <p className="text-xs text-foreground/85 leading-relaxed bg-muted/20 p-2.5 rounded-lg border">
                      {selectedNode.description}
                    </p>

                    {/* Locked Node Explicit Blocker Explanation */}
                    {selectedNode.is_locked && (
                      <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs space-y-1.5">
                        <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                          <Lock className="h-3.5 w-3.5" /> PREREQUISITE REQUIREMENT UNMET
                        </div>
                        <p className="text-foreground font-semibold leading-relaxed">
                          {selectedNode.lock_reason}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Cognitive graph rules require at least 60% Bayesian mastery on all prerequisite concepts.
                        </p>
                      </div>
                    )}

                    {/* Memory Decay Warning */}
                    {selectedNode.needs_revision && !selectedNode.is_locked && (
                      <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs space-y-1.5">
                        <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 text-xs">
                          <Clock className="h-3.5 w-3.5" /> RETENTION DECAY DETECTED
                        </div>
                        <p className="text-foreground font-medium leading-relaxed">
                          {selectedNode.revision_reason}
                        </p>
                      </div>
                    )}

                    {/* Bayesian Knowledge Tracing & Memory Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg border bg-muted/10 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">BKT Prior P(L)</span>
                        <div className="text-sm font-bold text-foreground">{selectedNode.p_known_pct}%</div>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/10 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Retrievability R(t)</span>
                        <div className="text-sm font-bold text-foreground">{selectedNode.retrievability_pct}%</div>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/10 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Memory Stability</span>
                        <div className="text-sm font-bold text-foreground">{selectedNode.stability_days} days</div>
                      </div>
                      <div className="p-2.5 rounded-lg border bg-muted/10 space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Practice Attempts</span>
                        <div className="text-sm font-bold text-foreground">
                          {selectedNode.recent_attempts_count} {selectedNode.recent_attempts_count === 1 ? "quiz" : "quizzes"}
                          {selectedNode.recent_accuracy_pct !== null && (
                            <span className="text-muted-foreground font-normal ml-1">({selectedNode.recent_accuracy_pct}% acc)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prerequisites Breakdown with Quick Jump and Practice Actions */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5 text-primary" /> Prerequisites:
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground">Threshold: ≥60%</span>
                      </div>

                      {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 ? (
                        <div className="space-y-2">
                          {selectedNode.prerequisites.map((p, idx) => (
                            <div 
                              key={idx} 
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                                p.satisfied ? "bg-muted/10 border-border" : "bg-rose-500/[0.04] border-rose-500/30"
                              }`}
                            >
                              <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                <div className="font-semibold text-foreground truncate">{p.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Current: <strong className={p.satisfied ? "text-emerald-500" : "text-rose-500"}>{p.current_mastery}%</strong> / Req: {p.required_mastery}%
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] ${
                                    p.satisfied
                                      ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                                      : "border-rose-500/40 text-rose-500 bg-rose-500/10"
                                  }`}
                                >
                                  {p.satisfied ? "Satisfied" : "Unmet"}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0" 
                                  title={`Inspect ${p.name}`}
                                  onClick={() => handleSelectNode(p.id)}
                                >
                                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground italic p-2 bg-muted/10 rounded-lg border">
                          Foundational concept: no prerequisite dependencies.
                        </div>
                      )}
                    </div>

                    {/* Downstream Concepts Unlocked */}
                    {selectedNode.dependents && selectedNode.dependents.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-foreground">
                          Unlocks Downstream Concepts:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNode.dependents.map(dep => (
                            <Badge 
                              key={dep.id} 
                              variant="outline" 
                              className={`text-[10px] cursor-pointer hover:bg-muted ${
                                dep.is_locked ? "border-rose-500/40 text-rose-500" : "border-emerald-500/40 text-emerald-500"
                              }`}
                              onClick={() => handleSelectNode(dep.id)}
                            >
                              {dep.name} ({dep.current_mastery}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Misconceptions on this concept if any */}
                    {selectedNode.misconceptions && selectedNode.misconceptions.length > 0 && (
                      <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-1.5 text-xs">
                        <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" /> Detected Misconception:
                        </span>
                        {selectedNode.misconceptions.map((m, mIdx) => (
                          <div key={mIdx} className="space-y-0.5">
                            <p className="font-semibold text-foreground">{m.title}</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{m.summary}</p>
                          </div>
                        ))}
                      </div>
                    )}

                  </CardContent>

                  {/* Multi-Modal Actions Footer: Quiz + AI Tutor with Style Dropdown */}
                  <CardFooter className="p-4 border-t bg-muted/10 flex flex-col gap-2.5">
                    {/* Primary Practice Action Button */}
                    {selectedNode.is_locked ? (
                      <Link 
                        href={`/quiz?course_id=${courseId}&concept_id=${selectedNode.action_target_concept_id}`} 
                        className="w-full"
                      >
                        <Button size="sm" className="w-full gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs">
                          <Unlock className="h-3.5 w-3.5" />
                          {selectedNode.action_label}
                        </Button>
                      </Link>
                    ) : (
                      <Link 
                        href={`/quiz?course_id=${courseId}&concept_id=${selectedNode.id}`} 
                        className="w-full"
                      >
                        <Button size="sm" className="w-full gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs">
                          <GraduationCap className="h-3.5 w-3.5" />
                          {selectedNode.action_label}
                        </Button>
                      </Link>
                    )}

                    {/* AI Tutor Deep Link with Pedagogical Explanation Styles */}
                    {(() => {
                      const stdPrompt = selectedNode.tutor_prompts?.standard || `Explain ${selectedNode.name} with source citations from the course material.`;
                      const analogyPrompt = selectedNode.tutor_prompts?.analogy || `Explain ${selectedNode.name} using an intuitive real-world analogy.`;
                      const principlesPrompt = selectedNode.tutor_prompts?.first_principles || `Explain ${selectedNode.name} starting from first principles and mathematical invariants.`;
                      const socraticPrompt = selectedNode.tutor_prompts?.socratic || `Teach me ${selectedNode.name} through Socratic dialogue and guided inquiry questions.`;

                      return (
                        <div className="w-full space-y-1.5">
                          <Link 
                            href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(selectedNode.name)}&prompt=${encodeURIComponent(stdPrompt)}`}
                            className="w-full block"
                          >
                            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                              Learn with AI Tutor
                            </Button>
                          </Link>

                          <div className="grid grid-cols-3 gap-1.5">
                            <Link 
                              href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(selectedNode.name)}&style=analogy&prompt=${encodeURIComponent(analogyPrompt)}`}
                              title="Explain using an intuitive real-world analogy"
                              className="w-full"
                            >
                              <Button variant="ghost" size="sm" className="w-full h-7 px-1 text-[10px] text-muted-foreground hover:text-foreground border border-border/50">
                                💡 Analogy
                              </Button>
                            </Link>
                            <Link 
                              href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(selectedNode.name)}&style=first_principles&prompt=${encodeURIComponent(principlesPrompt)}`}
                              title="Explain starting from first principles and mathematical invariants"
                              className="w-full"
                            >
                              <Button variant="ghost" size="sm" className="w-full h-7 px-1 text-[10px] text-muted-foreground hover:text-foreground border border-border/50">
                                📐 Principles
                              </Button>
                            </Link>
                            <Link 
                              href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(selectedNode.name)}&style=socratic&prompt=${encodeURIComponent(socraticPrompt)}`}
                              title="Teach through guided Socratic inquiry"
                              className="w-full"
                            >
                              <Button variant="ghost" size="sm" className="w-full h-7 px-1 text-[10px] text-muted-foreground hover:text-foreground border border-border/50">
                                🏛️ Socratic
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })()}

                  </CardFooter>
                </Card>
              ) : (
                <Card className="p-8 text-center text-muted-foreground text-xs border bg-card">
                  Select a concept node from the knowledge roadmap to inspect Bayesian mastery parameters, prerequisite requirements, and cognitive diagnostics.
                </Card>
              )}
            </div>

          </div>

          {/* 6. Knowledge Intelligence & Cognitive Analytics Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Knowledge Intelligence &amp; Cognitive Diagnostics
                </h2>
                <p className="text-xs text-muted-foreground">
                  Bayesian learner model analytics, bottleneck ranking, retention decay, and metacognitive calibration
                </p>
              </div>
            </div>

            <Tabs value={intelTab} onValueChange={setIntelTab} className="space-y-4">
              <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-muted/40 p-1 rounded-xl h-auto">
                <TabsTrigger value="bottlenecks" className="text-xs py-1.5 gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  Bottlenecks ({intel?.bottlenecks.length || 0})
                </TabsTrigger>
                <TabsTrigger value="retention" className="text-xs py-1.5 gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-purple-500" />
                  Forgetting Risk ({intel?.forgetting_risk.length || 0})
                </TabsTrigger>
                <TabsTrigger value="calibration" className="text-xs py-1.5 gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                  Calibration ({intel?.confidence_calibration?.calibration_score || 0}%)
                </TabsTrigger>
                <TabsTrigger value="misconceptions" className="text-xs py-1.5 gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  Misconceptions ({intel?.active_misconceptions.length || 0})
                </TabsTrigger>
                <TabsTrigger value="anchors" className="text-xs py-1.5 gap-1.5">
                  <Award className="h-3.5 w-3.5 text-emerald-500" />
                  Cognitive Anchors ({intel?.strong_concepts.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Prerequisite Bottlenecks */}
              <TabsContent value="bottlenecks" className="space-y-3">
                {intel?.bottlenecks && intel.bottlenecks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {intel.bottlenecks.map((b, idx) => (
                      <Card key={idx} className="border shadow-2xs hover:border-amber-500/50 transition-colors">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] font-bold border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                              Rank #{idx + 1} Bottleneck
                            </Badge>
                            <span className="text-xs font-black text-rose-500">
                              Blocks {b.downstream_blocked_count} concepts
                            </span>
                          </div>
                          <CardTitle className="text-sm font-bold mt-1 text-foreground">
                            {b.concept_name}
                          </CardTitle>
                          <CardDescription className="text-[11px]">
                            {b.topic_name}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-1 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span>Current Mastery</span>
                              <span className="font-bold">{b.mastery_pct}% (Need ≥60%)</span>
                            </div>
                            <Progress value={b.mastery_pct} className="h-1.5" />
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs flex-1 gap-1"
                              onClick={() => handleSelectNode(b.concept_id)}
                            >
                              <Target className="h-3 w-3" /> Focus
                            </Button>
                            <Link href={`/quiz?course_id=${courseId}&concept_id=${b.concept_id}`} className="flex-1">
                              <Button size="sm" className="text-xs w-full gap-1 bg-amber-600 hover:bg-amber-700 text-white">
                                <Unlock className="h-3 w-3" /> Unlock
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
                    No prerequisite bottlenecks detected! All foundational concepts meet the 60% readiness threshold.
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Forgetting Risk & Memory Decay */}
              <TabsContent value="retention" className="space-y-3">
                {intel?.forgetting_risk && intel.forgetting_risk.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {intel.forgetting_risk.map((node, idx) => (
                      <Card key={idx} className="border shadow-2xs border-purple-500/30 hover:border-purple-500/60 transition-colors">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] font-bold border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                              Decay Warning
                            </Badge>
                            <span className="text-xs font-black text-purple-500">
                              {node.retrievability_pct}% retention
                            </span>
                          </div>
                          <CardTitle className="text-sm font-bold mt-1 text-foreground">
                            {node.name}
                          </CardTitle>
                          <CardDescription className="text-[11px]">
                            {node.topic_name} • Last practiced {node.days_since_practice ?? "unknown"} days ago
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-1 space-y-3">
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Memory stability is {node.stability_days} days. An active review quiz will reinforce long-term consolidation.
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs flex-1 gap-1"
                              onClick={() => handleSelectNode(node.id)}
                            >
                              <Target className="h-3 w-3" /> Inspect
                            </Button>
                            <Link href={`/quiz?course_id=${courseId}&concept_id=${node.id}`} className="flex-1">
                              <Button size="sm" className="text-xs w-full gap-1 bg-purple-600 hover:bg-purple-700 text-white">
                                <RotateCcw className="h-3 w-3" /> Review
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
                    All concept memory traces are fresh and above the retention threshold.
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Confidence Calibration */}
              <TabsContent value="calibration" className="space-y-3">
                {intel?.confidence_calibration ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border p-4 space-y-2 bg-card">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Metacognitive Calibration</span>
                      <div className="text-2xl font-black text-foreground">
                        {intel.confidence_calibration.calibration_score}%
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {intel.confidence_calibration.calibration_status}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                        Measures the alignment between your self-reported confidence ratings and actual quiz accuracy.
                      </p>
                    </Card>

                    <Card className="border p-4 space-y-2 border-rose-500/20 bg-rose-500/[0.02]">
                      <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Overconfidence Danger Zone</span>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {intel.confidence_calibration.overconfident_count} mistakes
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Occurrences where you selected high confidence (≥4/5) but answered incorrectly. These represent cognitive blindspots.
                      </p>
                      <Link href={`/quiz?course_id=${courseId}`}>
                        <Button variant="outline" size="sm" className="text-xs w-full mt-2 gap-1.5">
                          <Target className="h-3.5 w-3.5 text-rose-500" /> Calibrate via Quiz
                        </Button>
                      </Link>
                    </Card>

                    <Card className="border p-4 space-y-2 border-sky-500/20 bg-sky-500/[0.02]">
                      <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">Underconfidence / Imposter Gap</span>
                      <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                        {intel.confidence_calibration.underconfident_count} questions
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Instances where you knew the correct answer but doubted yourself with low confidence ratings.
                      </p>
                    </Card>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
                    Complete confidence-rated quizzes to calibrate your metacognitive judgment.
                  </div>
                )}
              </TabsContent>

              {/* Tab 4: Active Misconceptions */}
              <TabsContent value="misconceptions" className="space-y-3">
                {intel?.active_misconceptions && intel.active_misconceptions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {intel.active_misconceptions.map((misc, idx) => (
                      <Card key={idx} className="border border-rose-500/30 bg-rose-500/[0.02] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-bold border-rose-500 text-rose-500 bg-rose-500/10">
                            {misc.wrong_count} repeated error{misc.wrong_count === 1 ? "" : "s"}
                          </Badge>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {misc.concept_name}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-foreground">{misc.title}</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{misc.summary}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <Link href={`/tutor?course_id=${courseId}&concept=${encodeURIComponent(misc.concept_name)}&prompt=${encodeURIComponent(`Explain the difference between correct principles and this misconception: ${misc.title}`)}`} className="flex-1">
                            <Button variant="outline" size="sm" className="text-xs w-full gap-1">
                              <Sparkles className="h-3 w-3 text-primary" /> Remediate with Tutor
                            </Button>
                          </Link>
                          <Link href={`/quiz?course_id=${courseId}&concept_id=${misc.concept_id}`} className="flex-1">
                            <Button size="sm" className="text-xs w-full gap-1 bg-rose-600 hover:bg-rose-700 text-white">
                              <GraduationCap className="h-3 w-3" /> Practice Concept
                            </Button>
                          </Link>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
                    No active misconceptions detected across this course.
                  </div>
                )}
              </TabsContent>

              {/* Tab 5: Strong Concepts (Cognitive Anchors) */}
              <TabsContent value="anchors" className="space-y-3">
                {intel?.strong_concepts && intel.strong_concepts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {intel.strong_concepts.map((node, idx) => (
                      <Card key={idx} className="border border-emerald-500/30 bg-emerald-500/[0.02] p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-bold border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                            Cognitive Anchor
                          </Badge>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {node.effective_mastery}%
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-foreground truncate">{node.name}</h4>
                        <p className="text-[10px] text-muted-foreground truncate">{node.topic_name}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs h-7 gap-1"
                          onClick={() => handleSelectNode(node.id)}
                        >
                          <Target className="h-3 w-3" /> Focus in Roadmap
                        </Button>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
                    Concepts with ≥80% Bayesian mastery will appear here as your cognitive foundation.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* 7. Curriculum Prerequisite Dependency Chains Overview */}
          <Card className="border shadow-2xs bg-muted/10">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Authoritative Directed Prerequisite Relationships
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {edges.length} directed relationship{edges.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {edges.map((e, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleSelectNode(e.to)}
                    className="p-2.5 rounded-lg border bg-card text-[11px] space-y-1 hover:border-primary/40 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                      <span className="truncate" title={e.from_name}>{e.from_name}</span>
                      <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate text-primary" title={e.to_name}>{e.to_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Edge #{idx + 1}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-[9px] px-1.5 py-0 ${
                          e.satisfied 
                            ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" 
                            : "border-rose-500/40 text-rose-500 bg-rose-500/10"
                        }`}
                      >
                        {e.satisfied ? "Met (≥60%)" : "Unsatisfied"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </>
      )}

    </div>
  );
}
