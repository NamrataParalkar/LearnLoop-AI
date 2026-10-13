"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BrainCircuit, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Calendar, 
  Clock, 
  TrendingUp, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  GraduationCap, 
  UploadCloud, 
  RefreshCw, 
  Lock, 
  Layers, 
  Compass,
  FileText,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  Check,
  Target,
  BarChart2,
  Workflow,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { getApiUrl } from "@/lib/config";

function getMasteryBadge(val: number, nAnswers: number = 0, isLocked: boolean = false) {
  if (isLocked) {
    return {
      label: "Locked",
      badgeClass: "border-muted-foreground/30 text-muted-foreground bg-muted/20",
      barClass: "bg-muted-foreground/40",
      textClass: "text-muted-foreground"
    };
  }
  if (nAnswers === 0 || val === 0) {
    return {
      label: "Not started",
      badgeClass: "border-slate-500/30 text-slate-400 bg-slate-500/10",
      barClass: "bg-slate-500/30",
      textClass: "text-slate-400"
    };
  }
  if (val >= 80) {
    return {
      label: "Mastered",
      badgeClass: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-600 dark:text-emerald-400"
    };
  }
  if (val >= 50) {
    return {
      label: "Learning",
      badgeClass: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
      barClass: "bg-amber-500",
      textClass: "text-amber-600 dark:text-amber-400"
    };
  }
  return {
    label: "Weak",
    badgeClass: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10",
    barClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400"
  };
}

export default function DashboardPage() {
  const { userId } = useUser();
  const [data, setData] = useState<any>(null);
  const [misconceptions, setMisconceptions] = useState<any[]>([]);
  const [confidenceData, setConfidenceData] = useState<any>(null);
  const [whyWeakData, setWhyWeakData] = useState<any>(null);
  const [whyWeakTopicId, setWhyWeakTopicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({ 2: true, 3: true, 4: true });
  const [historyTab, setHistoryTab] = useState<"7d" | "30d" | "all">("30d");

  const fetchAllData = () => {
    setLoading(true);
    setError(false);
    
    Promise.all([
      fetch(getApiUrl(`/api/learner/${userId}/dashboard?course_id=1`)).then(r => r.json()),
      fetch(getApiUrl(`/api/insights/${userId}/misconceptions?course_id=1`)).then(r => r.json()),
      fetch(getApiUrl(`/api/insights/${userId}/confidence`)).then(r => r.json())
    ])
      .then(([dash, misc, conf]) => {
        setData(dash);
        setMisconceptions(misc.misconceptions || []);
        setConfidenceData(conf);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAllData();
  }, [userId]);

  const toggleTopic = (id: number) => {
    setExpandedTopics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleResolveMisconception = (conceptId: number) => {
    fetch(getApiUrl("/api/insights/misconceptions/resolve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: parseInt(userId), concept_id: conceptId })
    })
      .then(r => r.json())
      .then(() => {
        setMisconceptions(prev => prev.map(m => m.concept_id === conceptId ? { ...m, is_resolved: true } : m));
      })
      .catch(err => console.error(err));
  };

  const openWhyWeak = (topicId: number) => {
    setWhyWeakTopicId(topicId);
    fetch(getApiUrl(`/api/insights/${userId}/why-weak/${topicId}`))
      .then(r => r.json())
      .then(res => setWhyWeakData(res))
      .catch(err => console.error(err));
  };

  if (error) {
    return (
      <div className="p-6">
        <ErrorState onRetry={fetchAllData} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const isNew = data.is_new_student;
  const historyList = historyTab === "7d" ? data.history?.days_7 : historyTab === "30d" ? data.history?.days_30 : data.history?.all_time;

  return (
    <div className="space-y-8 animate-in fade-in duration-400">
      
      {/* 1. GREETING ROW & SUMMARY METRICS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {isNew ? `Welcome, ${data.user_name}!` : `Welcome back, ${data.user_name} 👋`}
            </h1>
            {isNew && (
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
                New Student
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isNew 
              ? "Get started with your personalized diagnostic assessment to establish your baseline mastery."
              : "Here is your learning progress across Blockchain Architecture & Consensus."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/learning-path">
            <Button variant="outline" size="sm" className="gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              Learning Path Graph
            </Button>
          </Link>
          <Link href="/courses">
            <Button variant="outline" size="sm" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Syllabus
            </Button>
          </Link>
          <Link href={isNew ? "/quiz?mode=diagnostic" : `/quiz?topic_id=${data.next_best_action?.quiz_params?.topic_id || 3}`}>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <GraduationCap className="h-4 w-4" />
              {isNew ? "Take Diagnostic" : "Practice Now"}
            </Button>
          </Link>
        </div>
      </div>

      {/* METRICS CARDS ROW */}
      {isNew ? (
        /* NEW STUDENT ONBOARDING CARD */
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-background to-secondary/30 shadow-sm overflow-hidden">
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                GETTING STARTED
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Calibrate Your Baseline Mastery
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You haven&apos;t answered any questions yet. Take a short 5-minute diagnostic quiz to assess your foundational knowledge in Consensus Mechanisms, Scalability, and Blockchain Types. We&apos;ll build your custom forgetting curve and learning schedule.
              </p>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Link href="/quiz?mode=diagnostic" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 bg-primary hover:bg-primary/90 shadow-md">
                  <GraduationCap className="h-5 w-5" />
                  Take Short Diagnostic
                </Button>
              </Link>
              <Link href="/tutor" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full gap-2">
                  <Compass className="h-5 w-5" />
                  Ask AI Tutor
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* REAL STUDENT SUMMARY ROW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall Mastery Gauge */}
          <Card className="bg-card border-border shadow-xs hover:border-primary/40 transition-colors">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Overall Mastery
              </CardTitle>
              <BrainCircuit className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {data.overall_mastery}%
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {data.overall_mastery >= 80 ? "Mastered" : data.overall_mastery >= 50 ? "Proficient" : "Developing"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                based on <span className="font-semibold text-foreground">{data.total_answers} answers</span>
              </p>
              <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-700 ease-out", getMasteryBadge(data.overall_mastery, data.total_answers).barClass)}
                  style={{ width: `${Math.min(100, Math.max(5, data.overall_mastery))}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Change since last week */}
          <Card className="bg-card border-border shadow-xs hover:border-primary/40 transition-colors">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Velocity & Growth
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {data.change_since_last_week || "+0%"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                change since last week
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Steady retention growth</span>
              </div>
            </CardContent>
          </Card>

          {/* Exam Countdown */}
          <Card className="bg-card border-border shadow-xs hover:border-primary/40 transition-colors">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Exam Countdown
              </CardTitle>
              <Calendar className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {data.days_until_exam !== null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {data.days_until_exam}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">days left</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exam: <span className="font-semibold text-foreground">{data.exam_date}</span>
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    <span>On schedule for review</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">No date set</div>
                  <p className="text-xs text-muted-foreground mt-1">Set an exam target date in settings</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Active Topics */}
          <Card className="bg-card border-border shadow-xs hover:border-primary/40 transition-colors">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Topic Coverage
              </CardTitle>
              <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {data.topics?.filter((t: any) => t.status === "Mastered").length || 0}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  of {data.topics?.length || 0} Mastered
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.all_concepts?.length || 0} total concepts tracked
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                <span>Real-time BKT tracking</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. NEXT BEST ACTION CARD */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-indigo-500 to-purple-600" />
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 gap-1 font-semibold text-xs py-0.5">
                <Sparkles className="h-3.5 w-3.5" />
                NEXT BEST ACTION
              </Badge>
              <span className="text-xs text-muted-foreground">Computed from real attempts</span>
            </div>
            {data.next_best_action?.action_type && (
              <Badge variant="secondary" className="capitalize text-xs">
                {data.next_best_action.action_type}
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg md:text-xl font-bold mt-2">
            {data.next_best_action?.title || "Personalized Recommendation"}
          </CardTitle>
          <CardDescription className="text-sm">
            {data.next_best_action?.reason}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-1 space-y-4">
          <div className="rounded-lg bg-muted/50 border border-border/80 p-3.5 text-sm flex items-start gap-3">
            <Compass className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider block mb-1">
                Evidence from your sessions
              </span>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {data.next_best_action?.evidence}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-5 pt-0 flex flex-wrap gap-3">
          <Link 
            href={
              data.next_best_action?.quiz_params?.mode === "diagnostic"
                ? "/quiz?mode=diagnostic"
                : `/quiz?topic_id=${data.next_best_action?.quiz_params?.topic_id || 3}&concept_id=${data.next_best_action?.quiz_params?.concept_id || 6}`
            }
          >
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <GraduationCap className="h-4 w-4" />
              {data.next_best_action?.cta_text || "Start personalized practice"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <Link href="/tutor">
            <Button variant="outline" className="gap-2">
              Ask AI Tutor
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* DIFFERENTIATING FEATURE 1: MISCONCEPTION DETECTION PANEL */}
      {!isNew && misconceptions.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  Active Misconception Detection
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Merged error patterns categorized by evidence strength (confirmed, likely, possible)
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/10 font-medium">
                {misconceptions.filter(m => !m.is_resolved).length} Unresolved
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {misconceptions.map((m) => {
              const confBadge = m.confidence_level === "confirmed" 
                ? "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 font-bold"
                : m.confidence_level === "likely"
                ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-semibold"
                : "border-slate-500/40 text-slate-400 bg-slate-500/10 font-medium";

              return (
                <div 
                  key={m.id} 
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    m.is_resolved ? "bg-muted/20 border-border/60 opacity-60" : "bg-card border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm md:text-base text-foreground">
                          {m.title}
                        </span>
                        <Badge variant="outline" className={cn("text-xs uppercase tracking-wider py-0", confBadge)}>
                          {m.confidence_level}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {m.concept_name}
                        </Badge>
                        {m.is_resolved && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10 text-xs">
                            Resolved ✓
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                        {m.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!m.is_resolved && (
                        <>
                          <Link href={`/quiz?course_id=1&topic_id=${m.topic_id}&concept_id=${m.concept_id}&mode=remediation`}>
                            <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                              <Target className="h-3.5 w-3.5" />
                              Remediation Quiz
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleResolveMisconception(m.concept_id)}
                            className="h-8 text-xs text-muted-foreground hover:text-emerald-500"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Resolve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Evidence List */}
                  {m.evidence_list && m.evidence_list.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Logged Evidence ({m.evidence_list.length} attempts):
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {m.evidence_list.map((ev: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>{ev.date} (Session #{ev.session_id})</span>
                              <span className="font-semibold text-rose-500">Confidence: {ev.confidence_level}</span>
                            </div>
                            <p className="font-medium text-foreground line-clamp-2">
                              {ev.question_stem}
                            </p>
                            <div className="flex gap-2 text-[11px]">
                              <span className="text-rose-500 font-semibold">Your Answer: {ev.chosen_answer}</span>
                              <span className="text-emerald-500 font-semibold">• Key: {ev.expected_answer}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* DIFFERENTIATING FEATURE 2: CONFIDENCE INSIGHTS & CALIBRATION CHART */}
      {!isNew && confidenceData && confidenceData.has_data && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-indigo-500" />
                  Confidence Insights & Metacognitive Calibration
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Analyzing overconfidence (danger zone) vs underconfidence (imposter gap)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Calibration Score:</span>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-500 bg-indigo-500/10 font-bold text-xs">
                  {confidenceData.calibration_score}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Overconfidence card */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Overconfidence (Danger Zone)
                  </span>
                  <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                    {confidenceData.overconfident_count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Questions answered wrong while reporting high confidence (3-4/4). Unconscious knowledge gaps requiring careful verification.
                </p>
              </div>

              {/* Underconfidence card */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4" />
                    Underconfidence (Imposter Gap)
                  </span>
                  <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                    {confidenceData.underconfident_count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Questions answered correctly while guessing or unsure. Intuition is stronger than self-perception.
                </p>
              </div>

              {/* Well calibrated */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Well Calibrated
                  </span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {confidenceData.well_calibrated_count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Questions where your stated confidence accurately predicted your test outcome.
                </p>
              </div>
            </div>

            {/* Interactive SVG Calibration Chart */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground">Calibration Curve: Stated Confidence vs Actual Accuracy</span>
                <div className="flex gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-border inline-block" /> Ideal (45°)</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-primary inline-block" /> Your Accuracy</span>
                </div>
              </div>

              <div className="relative w-full h-44">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 450 140" preserveAspectRatio="none">
                  {/* Grid */}
                  {[0, 25, 50, 75, 100].map((v, i) => {
                    const y = 120 - (v / 100) * 100;
                    return (
                      <g key={i}>
                        <line x1="40" y1={y} x2="430" y2={y} stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
                        <text x="32" y={y + 3} textAnchor="end" className="text-[10px] fill-muted-foreground">{v}%</text>
                      </g>
                    );
                  })}

                  {/* Ideal 45 degree line */}
                  <line x1="70" y1="95" x2="400" y2="20" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />

                  {/* Actual Accuracy Polyline */}
                  {(() => {
                    const pts = confidenceData.bins?.map((b: any, idx: number) => {
                      const x = 70 + idx * 110;
                      const y = 120 - (b.actual_pct / 100) * 100;
                      return { x, y, b };
                    }) || [];

                    const pathStr = pts.reduce((acc: string, curr: any, i: number) => {
                      return `${acc} ${i === 0 ? "M" : "L"} ${curr.x} ${curr.y}`;
                    }, "");

                    return (
                      <>
                        <path d={pathStr} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        {pts.map((p: any, idx: number) => (
                          <g key={idx}>
                            <circle cx={p.x} cy={p.y} r="5" fill="#6366f1" className="stroke-background stroke-2" />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-bold fill-foreground">
                              {p.b.actual_pct}%
                            </text>
                            <text x={p.x} y={135} textAnchor="middle" className="text-[10px] fill-muted-foreground">
                              {p.b.label}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <p className="text-xs text-muted-foreground pt-1 italic">
                {confidenceData.insight_summary}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. TOPIC PERFORMANCE (EXPANDABLE WITH CONCEPTS & "WHY AM I WEAK?") */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                Topic Performance
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Click any topic to expand its underlying concepts, practice directly, or inspect root causes.
              </CardDescription>
            </div>
            
            {/* Legend chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-medium">
                Mastered ≥80%
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-medium">
                Learning 50-79%
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 font-medium">
                Weak &lt;50%
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-500/30 text-slate-400 bg-slate-500/10 font-medium">
                Not started
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          {data.topics?.map((topic: any) => {
            const isExpanded = !!expandedTopics[topic.id];
            const badge = getMasteryBadge(topic.val, topic.total_answers, topic.status === "Locked");
            const isWeakTopic = topic.val < 50 && topic.total_answers > 0;

            return (
              <div 
                key={topic.id} 
                className="rounded-xl border border-border bg-card hover:border-primary/30 transition-all overflow-hidden"
              >
                {/* Topic Header Row */}
                <div 
                  className="p-4 select-none flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <div 
                    onClick={() => toggleTopic(topic.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1"
                  >
                    <button 
                      type="button"
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                      aria-label="Toggle topic details"
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-base">
                          {topic.name}
                        </span>
                        {topic.is_low_data && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px] py-0">
                            Low data ({topic.total_answers} answers)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {topic.concepts?.length || 0} concepts • {topic.total_answers} answers recorded
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 min-w-[280px] justify-between md:justify-end flex-wrap">
                    {/* DIFFERENTIATING FEATURE 3: "Why am I weak?" trigger button */}
                    {isWeakTopic && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhyWeak(topic.id);
                        }}
                        className="h-7 text-xs px-2.5 gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Why am I weak?
                      </Button>
                    )}

                    <div className="w-28 bg-secondary h-2 rounded-full overflow-hidden shrink-0">
                      <div 
                        className={cn("h-full transition-all duration-700", badge.barClass)}
                        style={{ width: `${Math.min(100, Math.max(0, topic.val))}%` }}
                      />
                    </div>
                    <span className={cn("text-base font-bold min-w-[42px] text-right", badge.textClass)}>
                      {topic.val}%
                    </span>
                    <Badge variant="outline" className={cn("text-xs font-semibold shrink-0 py-0.5", badge.badgeClass)}>
                      {topic.status}
                    </Badge>
                  </div>
                </div>

                {/* Expanded Concepts List */}
                {isExpanded && (
                  <div className="border-t border-border/60 bg-muted/20 px-4 py-3 divide-y divide-border/40">
                    {topic.concepts?.map((concept: any) => {
                      const cBadge = getMasteryBadge(concept.val, concept.n_answers, concept.status === "Locked");
                      return (
                        <div 
                          key={concept.id}
                          className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                {concept.name}
                              </span>
                              {concept.is_low_data && (
                                <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px] py-0">
                                  Low data ({concept.n_answers})
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Stability: {concept.stability_days}d</span>
                              {concept.last_practiced_days_ago !== null && (
                                <span>• Practiced {concept.last_practiced_days_ago === 0 ? "today" : `${concept.last_practiced_days_ago}d ago`}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="w-16 bg-secondary h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={cn("h-full", cBadge.barClass)}
                                  style={{ width: `${concept.val}%` }}
                                />
                              </div>
                              <span className={cn("text-xs font-bold", cBadge.textClass)}>
                                {concept.val}%
                              </span>
                            </div>

                            <Badge variant="outline" className={cn("text-[11px] font-medium py-0", cBadge.badgeClass)}>
                              {concept.status}
                            </Badge>

                            <div className="flex items-center gap-1.5 ml-2">
                              <Link href={`/quiz?course_id=1&topic_id=${topic.id}&concept_id=${concept.id}`}>
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                                  Practice
                                </Button>
                              </Link>
                              <Link href={`/tutor?q=${encodeURIComponent(`Explain ${concept.name} in simple terms with examples`)}`}>
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground">
                                  Ask tutor
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* DIFFERENTIATING FEATURE 3 MODAL: "WHY AM I WEAK?" ROOT CAUSE ANALYSIS & STEPPER */}
      {whyWeakTopicId && whyWeakData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10 font-bold text-xs">
                    ROOT CAUSE ANALYSIS
                  </Badge>
                  <span className="text-xs text-muted-foreground">Current Mastery: {whyWeakData.mastery_pct}%</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-1">
                  Why Am I Weak in {whyWeakData.topic_name}?
                </h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setWhyWeakTopicId(null); setWhyWeakData(null); }}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* 3 Evidence-backed Root Causes */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Evidence-Backed Root Causes:
              </span>
              {whyWeakData.root_causes?.map((rc: any) => (
                <div key={rc.id} className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground flex items-center gap-1.5">
                      <AlertTriangle className={cn("h-4 w-4", rc.severity === "critical" ? "text-rose-500" : "text-amber-500")} />
                      {rc.title}
                    </span>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {rc.severity} Severity
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                    {rc.evidence}
                  </p>
                </div>
              ))}
            </div>

            {/* Learning Path Stepper */}
            <div className="space-y-3 pt-2 border-t border-border">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Targeted Remediation Stepper:
              </span>
              <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
                {whyWeakData.stepper?.map((step: any) => (
                  <div key={step.step} className="flex items-start gap-4 pl-1 relative">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 z-10">
                      {step.step}
                    </div>
                    <div className="flex-1 p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-xs md:text-sm text-foreground">
                          {step.title}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {step.description} • ~{step.estimated_mins} mins
                        </p>
                      </div>
                      <Link href={step.action_url}>
                        <Button size="sm" className="h-7 text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                          {step.action_label}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="outline" onClick={() => { setWhyWeakTopicId(null); setWhyWeakData(null); }}>
                Close Analysis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MASTERY OVER TIME (LINE CHART) & 5. LEARNING HEATMAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* MASTERY OVER TIME LINE CHART */}
        <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Mastery Over Time
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  BKT probability progression from /history
                </CardDescription>
              </div>

              {/* 7d / 30d / all toggle */}
              <Tabs value={historyTab} onValueChange={(v: any) => setHistoryTab(v)} className="w-auto">
                <TabsList className="h-8 p-0.5 bg-muted">
                  <TabsTrigger value="7d" className="text-xs px-2.5 h-7">7 Days</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs px-2.5 h-7">30 Days</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs px-2.5 h-7">All Time</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col justify-center">
            {isNew || !historyList || historyList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Compass className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">No history points recorded yet</p>
                <p className="text-xs">Take your first practice quiz to see your mastery curve.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* SVG Line Chart */}
                <div className="relative w-full h-48">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="masteryFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal gridlines */}
                    {[0, 25, 50, 75, 100].map((level, idx) => {
                      const y = 160 - (level / 100) * 140;
                      return (
                        <g key={idx}>
                          <line x1="30" y1={y} x2="490" y2={y} stroke="currentColor" className="text-border/60" strokeDasharray="3 3" />
                          <text x="22" y={y + 4} textAnchor="end" className="text-[10px] fill-muted-foreground">{level}%</text>
                        </g>
                      );
                    })}

                    {/* Polyline / Points */}
                    {(() => {
                      const points = historyList.map((pt: any, i: number) => {
                        const x = historyList.length === 1 ? 260 : 40 + (i / (historyList.length - 1)) * 440;
                        const y = 160 - (pt.mastery / 100) * 140;
                        return { x, y, pt };
                      });

                      const pathD = points.reduce((acc: string, curr: any, i: number) => {
                        return `${acc} ${i === 0 ? "M" : "L"} ${curr.x} ${curr.y}`;
                      }, "");

                      const areaD = `${pathD} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;

                      return (
                        <>
                          <path d={areaD} fill="url(#masteryFill)" />
                          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p: any, idx: number) => (
                            <g key={idx} className="group cursor-pointer">
                              <circle cx={p.x} cy={p.y} r="5" fill="#6366f1" className="stroke-background stroke-2 transition-all hover:r-7" />
                              <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[11px] font-bold fill-foreground">
                                {p.pt.mastery}%
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* X-axis date labels */}
                <div className="flex justify-between px-6 text-[11px] text-muted-foreground pt-1">
                  {historyList.map((pt: any, idx: number) => (
                    <span key={idx} className="font-medium">
                      {pt.date.slice(5)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. LEARNING HEATMAP (TOPICS X LAST 14 DAYS) */}
        <Card className="border-border bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  14-Day Activity Heatmap
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Questions practiced per topic over the past 14 days
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <div className="overflow-x-auto">
              <div className="min-w-[420px] space-y-3">
                {/* Header dates */}
                <div className="grid grid-cols-[130px_repeat(14,1fr)] gap-1 text-[10px] text-muted-foreground font-medium text-center">
                  <div className="text-left pl-1">Topic</div>
                  {data.heatmap?.days?.map((d: any, idx: number) => (
                    <div key={idx} className="truncate">
                      {d.label.slice(0, 3)}
                    </div>
                  ))}
                </div>

                {/* Topic rows */}
                {data.heatmap?.topics?.map((ht: any) => (
                  <div key={ht.topic_id} className="grid grid-cols-[130px_repeat(14,1fr)] gap-1 items-center">
                    <div className="text-xs font-medium text-foreground truncate pr-2" title={ht.topic_name}>
                      {ht.topic_name}
                    </div>
                    {ht.cells?.map((cnt: number, cIdx: number) => {
                      const dayLabel = data.heatmap.days[cIdx]?.label || "";
                      let bgClass = "bg-muted/40 border-border/40 text-transparent";
                      if (cnt >= 5) bgClass = "bg-primary text-primary-foreground font-bold shadow-xs";
                      else if (cnt >= 3) bgClass = "bg-primary/70 text-primary-foreground font-medium";
                      else if (cnt >= 1) bgClass = "bg-primary/30 text-primary font-medium";

                      return (
                        <div
                          key={cIdx}
                          title={`${ht.topic_name}: ${cnt} questions on ${dayLabel}`}
                          className={cn(
                            "h-7 rounded-sm flex items-center justify-center text-[10px] border transition-transform hover:scale-110 cursor-default",
                            bgClass
                          )}
                        >
                          {cnt > 0 ? cnt : ""}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground mt-4 pt-2 border-t border-border/40">
              <span>Less</span>
              <div className="w-3 h-3 rounded-xs bg-muted/40 border border-border/40" />
              <div className="w-3 h-3 rounded-xs bg-primary/30" />
              <div className="w-3 h-3 rounded-xs bg-primary/70" />
              <div className="w-3 h-3 rounded-xs bg-primary" />
              <span>More questions</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. DUE FOR REVIEW LIST & 7. RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DUE FOR REVIEW LIST */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Due for Spaced Review
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Prioritized by forgetting curve and memory stability decay
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {isNew || !data.due_for_review || data.due_for_review.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500/80 mb-1" />
                <p className="font-semibold text-foreground text-sm">All caught up!</p>
                <p>No concepts currently due for memory reinforcement.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.due_for_review.slice(0, 4).map((item: any) => (
                  <div 
                    key={item.concept_id}
                    className="p-3.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {item.concept_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 border-border text-muted-foreground">
                          {item.topic_name}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last practiced <span className="text-foreground font-medium">{item.days_ago}</span> • Stability: {item.stability_days}d
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-amber-500 block">
                          {item.retention_pct}%
                        </span>
                        <span className="text-[10px] text-muted-foreground block">retention</span>
                      </div>
                      <Link href={`/quiz?course_id=1&concept_id=${item.concept_id}&mode=practice`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs px-3">
                          Review
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. RECENT ACTIVITY */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Real logged sessions from the learner assessment history
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {isNew || !data.recent_activity || data.recent_activity.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground/60 mb-1" />
                <p className="font-semibold text-foreground text-sm">No activity recorded</p>
                <p>Complete a practice session to see your logged history.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recent_activity.map((session: any) => (
                  <div 
                    key={session.session_id}
                    className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-xs md:text-sm">
                          {session.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {session.date_str} • Mode: <span className="capitalize">{session.mode}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-xs md:text-sm text-foreground block">
                        {session.score} / {session.total_questions}
                      </span>
                      <span className={cn(
                        "text-[10px] font-semibold",
                        session.accuracy_pct >= 80 ? "text-emerald-500" : session.accuracy_pct >= 50 ? "text-amber-500" : "text-rose-500"
                      )}>
                        {session.accuracy_pct}% score
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 8. SMALL "UPLOAD MATERIAL" LINK (NO UPLOAD WIDGET) */}
      <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span>Studying custom syllabus materials or lecture notes?</span>
        </div>
        <Link 
          href="/courses" 
          className="font-medium text-primary hover:underline flex items-center gap-1 group"
        >
          <span>Upload material on Courses page</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

    </div>
  );
}
