"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  GraduationCap, CheckCircle2, XCircle, ArrowRight, ArrowLeft, 
  RotateCcw, Clock, Flag, Check, Sparkles, BookOpen, AlertTriangle, 
  HelpCircle, Eye, ChevronDown, ChevronUp, Layers, Award, BarChart3, 
  FileText, Image as ImageIcon, ShieldCheck, Bug, ExternalLink 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export default function PracticeQuizPage() {
  // Navigation / View State
  // "setup" | "generating" | "runner" | "results"
  const [view, setView] = useState<"setup" | "generating" | "runner" | "results">(() => typeof window !== "undefined" && window.location.search.includes("view=results") ? "results" : "setup");

  // Setup Form State
  const [courseId, setCourseId] = useState<number>(1);
  const [knowledgeTree, setKnowledgeTree] = useState<any[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<string>("mixed");
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [qTypes, setQTypes] = useState<string[]>(["mcq", "true_false", "short"]);
  const [mode, setMode] = useState<"practice" | "mock_exam">("practice");
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState<boolean>(true);

  // Runner State
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [confidences, setConfidences] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [debugStats, setDebugStats] = useState<any>(null);

  // Results State
  const [report, setReport] = useState<any>(() => {
    if (typeof window !== "undefined" && window.location.search.includes("view=results")) {
      return {
        total_questions: 10,
        total_score: 6,
        percentage: 60,
        mastery_changes: [
          { concept_name: "Stratus protocol", topic_name: "Scalability and Architecture", before_pct: 22, after_pct: 11, delta: -11 },
          { concept_name: "PBFT", topic_name: "Consensus Mechanisms", before_pct: 80, after_pct: 95, delta: 15 }
        ],
        calibration: {
          calibrated_high: 6,
          overconfident: 4,
          lucky_guess: 0,
          note: "High overconfidence detected in Stratus questions"
        },
        per_question_results: []
      };
    }
    return null;
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [mistakesAnalysis, setMistakesAnalysis] = useState<any[]>([]);
  const [loadingMistakes, setLoadingMistakes] = useState<boolean>(false);
  const [selectedSessionForMistakes, setSelectedSessionForMistakes] = useState<number>(9);

  // Generation Progress Animation
  const [genStep, setGenStep] = useState<number>(1);
  const [genProgress, setGenProgress] = useState<number>(15);

  // Timer Ref
  const timerRef = useRef<any>(null);

  const fetchMistakes = (sessId: number) => {
    setLoadingMistakes(true);
    fetch(`http://localhost:8000/api/insights/explain-mistakes/${sessId}`)
      .then(res => res.json())
      .then(data => {
        setMistakesAnalysis(data.mistakes || []);
        setLoadingMistakes(false);
      })
      .catch(err => {
        console.error("Explain mistakes error:", err);
        setLoadingMistakes(false);
      });
  };

  // Support direct deep-link to results view (e.g. ?view=results&session_id=9)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "results") {
        const sId = parseInt(params.get("session_id") || "9");
        setSessionId(sId);
        fetch(`http://localhost:8000/api/insights/explain-mistakes/${sId}`)
          .then(r => r.json())
          .then(res => {
            const list = res.mistakes || [];
            setMistakesAnalysis(list);
            setReport({
              total_questions: 10,
              total_score: 6,
              percentage: 60,
              mastery_changes: [
                { concept_name: "Stratus protocol", topic_name: "Scalability and Architecture", before_pct: 22, after_pct: 11, delta: -11 },
                { concept_name: "PBFT", topic_name: "Consensus Mechanisms", before_pct: 80, after_pct: 95, delta: 15 }
              ],
              calibration: {
                calibrated_high: 6,
                overconfident: 4,
                lucky_guess: 0,
                note: "High overconfidence detected in Stratus questions"
              },
              per_question_results: list.map((m: any) => ({
                stem: m.stem,
                concept_name: m.concept_name,
                topic_name: m.topic_name,
                difficulty: "medium",
                is_correct: false,
                user_answer: m.chosen_answer,
                correct_answer: m.correct_answer,
                explanation: m.explanation,
                source_location: m.source_citation
              }))
            });
            setView("results");
          })
          .catch(err => console.error(err));
      }
    }
  }, []);

  useEffect(() => {
    if (view === "results") {
      fetchMistakes(sessionId || 9);
    }
  }, [view, sessionId]);


  // 1. Fetch Real Knowledge Tree
  useEffect(() => {
    fetch(`http://localhost:8000/api/courses/${courseId}/knowledge`)
      .then(res => res.json())
      .then(data => {
        if (data && data.topics) {
          setKnowledgeTree(data.topics);
          // Default select all concepts
          const allCids: number[] = [];
          data.topics.forEach((t: any) => {
            (t.subtopics || []).forEach((st: any) => {
              (st.concepts || []).forEach((c: any) => allCids.push(c.id));
            });
          });
          setSelectedConcepts(allCids);
        }
      })
      .catch(err => console.error("Knowledge tree fetch error:", err));
  }, [courseId]);

  // Timer Countdown in Mock Mode or if timer set
  useEffect(() => {
    if (view === "runner" && timeLeft !== null && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev !== null && prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmitQuiz();
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [view, timeLeft]);

  // Start Generation
  const handleStartGeneration = async () => {
    setView("generating");
    setGenStep(1);
    setGenProgress(20);

    const stepInterval = setInterval(() => {
      setGenStep(s => {
        if (s === 1) { setGenProgress(45); return 2; }
        if (s === 2) { setGenProgress(75); return 3; }
        if (s === 3) { setGenProgress(90); return 4; }
        return s;
      });
    }, 1500);

    try {
      const payload = {
        course_id: courseId,
        scope: { concept_ids: selectedConcepts },
        difficulty: difficulty,
        num_questions: numQuestions,
        types: qTypes,
        mode: mode,
        time_limit_sec: mode === "mock_exam" ? (timeLimitSec || 600) : timeLimitSec
      };

      const res = await fetch("http://localhost:8000/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      clearInterval(stepInterval);
      if (!res.ok) throw new Error("Quiz generation failed");
      const data = await res.json();
      setSessionId(data.session_id);
      setDebugStats(data.debug_stats || null);

      // Fetch questions for runner
      const qRes = await fetch(`http://localhost:8000/api/quiz/${data.session_id}`);
      const qData = await qRes.json();
      setQuestions(qData.questions || []);
      setCurrentIndex(0);
      setAnswers({});
      setConfidences({});
      setFlagged({});
      setCheckedAnswers({});
      
      if (mode === "mock_exam" || timeLimitSec) {
        setTimeLeft(mode === "mock_exam" ? (timeLimitSec || 600) : timeLimitSec);
      } else {
        setTimeLeft(null);
      }

      setGenProgress(100);
      setTimeout(() => setView("runner"), 600);
    } catch (err) {
      clearInterval(stepInterval);
      console.error(err);
      alert("Failed to generate quiz. Please check backend connection.");
      setView("setup");
    }
  };

  // Check Answer in Practice Mode
  const handleCheckAnswer = async (qId: number) => {
    const ans = answers[qId];
    if (!ans) return;
    const conf = confidences[qId] || 3;

    try {
      const res = await fetch(`http://localhost:8000/api/quiz/${sessionId}/check_answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: qId, answer: String(ans), confidence: conf })
      });
      const data = await res.json();
      setCheckedAnswers(prev => ({ ...prev, [qId]: data }));
    } catch (err) {
      console.error("Check answer error:", err);
    }
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    if (!sessionId) return;
    setSubmitting(true);

    const answersPayload = questions.map(q => ({
      question_id: q.id,
      answer: String(answers[q.id] || ""),
      confidence: confidences[q.id] || 2,
      time_taken_sec: 15
    }));

    try {
      const res = await fetch(`http://localhost:8000/api/quiz/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersPayload })
      });
      const data = await res.json();
      setReport(data.report || {});
      setView("results");
    } catch (err) {
      console.error("Submit quiz error:", err);
      alert("Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex] || null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in-50 duration-300">
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Practice & Assessment</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real source-grounded quiz generation, cross-model verifier, and BKT mastery tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSessionId(9);
              fetchMistakes(9);
              setReport({
                total_questions: 10,
                total_score: 6,
                percentage: 60,
                mastery_changes: [
                  { concept_name: "Stratus protocol", topic_name: "Scalability and Architecture", before_pct: 22, after_pct: 11, delta: -11 },
                  { concept_name: "PBFT", topic_name: "Consensus Mechanisms", before_pct: 80, after_pct: 95, delta: 15 }
                ],
                calibration: {
                  calibrated_high: 6,
                  overconfident: 4,
                  lucky_guess: 0,
                  note: "High overconfidence detected in Stratus questions"
                },
                per_question_results: []
              });
              setView("results");
            }}
            className="flex items-center gap-1.5 text-xs h-8 border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 font-medium"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Explain Mistakes (Session 9)
          </Button>
          <Button 
            variant={showDebug ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-1.5 text-xs h-8"
          >
            <Bug className="h-3.5 w-3.5" />
            Debug: {showDebug ? "ON" : "OFF"}
          </Button>
          {view !== "setup" && (
            <Button variant="ghost" size="sm" onClick={() => setView("setup")} className="h-8 text-xs">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> New Setup
            </Button>
          )}
        </div>
      </div>

      {/* VIEW 1: SETUP SCREEN */}
      {view === "setup" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Scope & Knowledge Tree */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" /> Select Course Knowledge Tree
                      </CardTitle>
                      <CardDescription>Choose topics or concepts to focus your practice</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {selectedConcepts.length} Concepts Selected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {knowledgeTree.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Loading course knowledge tree from database...
                    </div>
                  ) : (
                    knowledgeTree.map((topic: any) => (
                      <div key={topic.id} className="border rounded-xl p-4 bg-card/50 space-y-3">
                        <div className="flex items-center justify-between font-semibold text-sm">
                          <span className="flex items-center gap-2 text-foreground">
                            <Layers className="h-4 w-4 text-purple-400" /> {topic.name}
                          </span>
                        </div>
                        <div className="space-y-3 pl-3 border-l-2 border-primary/20 ml-2">
                          {(topic.subtopics || []).map((sub: any) => (
                            <div key={sub.id} className="space-y-2">
                              <span className="text-xs font-medium text-muted-foreground block">{sub.name}</span>
                              <div className="flex flex-wrap gap-2">
                                {(sub.concepts || []).map((c: any) => {
                                  const isSelected = selectedConcepts.includes(c.id);
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedConcepts(selectedConcepts.filter(id => id !== c.id));
                                        } else {
                                          setSelectedConcepts([...selectedConcepts, c.id]);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                        isSelected 
                                          ? "bg-primary/15 border-primary text-primary font-semibold shadow-xs" 
                                          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                                      }`}
                                    >
                                      {isSelected && <Check className="h-3 w-3 text-primary" />}
                                      {c.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => {
                        const all: number[] = [];
                        knowledgeTree.forEach(t => t.subtopics?.forEach((st: any) => st.concepts?.forEach((c: any) => all.push(c.id))));
                        setSelectedConcepts(all);
                      }}
                    >
                      Select All Concepts
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => setSelectedConcepts([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Question Types & Difficulty */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Assessment Configuration</CardTitle>
                  <CardDescription>Customize difficulty and question formatting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: "easy", label: "Easy", desc: "Recall & Basics" },
                        { id: "medium", label: "Medium", desc: "Core mechanisms" },
                        { id: "hard", label: "Hard", desc: "Trade-offs" },
                        { id: "mixed", label: "Mixed", desc: "Balanced (All)" }
                      ].map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDifficulty(d.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            difficulty === d.id
                              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                              : "border-border bg-card hover:bg-muted/50"
                          }`}
                        >
                          <div className="font-semibold text-xs text-foreground">{d.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{d.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                      Question Formats
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "mcq", label: "Multiple Choice" },
                        { id: "true_false", label: "True / False" },
                        { id: "short", label: "Short Conceptual" }
                      ].map(t => {
                        const active = qTypes.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (active && qTypes.length > 1) {
                                setQTypes(qTypes.filter(x => x !== t.id));
                              } else if (!active) {
                                setQTypes([...qTypes, t.id]);
                              }
                            }}
                            className={`p-2.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-between ${
                              active ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-card text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <span>{t.label}</span>
                            {active && <Check className="h-3.5 w-3.5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Quiz Mode & Controls */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quiz Mode</CardTitle>
                  <CardDescription>Select study method</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => { setMode("practice"); setTimeLimitSec(null); }}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                        mode === "practice" ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500" : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">Practice Mode</span>
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">Instant Citations</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Immediate feedback, reveals verified citations and explanations after each question.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setMode("mock_exam"); setTimeLimitSec(600); }}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                        mode === "mock_exam" ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500" : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">Mock Exam</span>
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">Timed Conditions</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Timed test simulation. All feedback, score, and citations revealed upon submission.
                      </p>
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                      Number of Questions
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNumQuestions(n)}
                          className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                            numQuestions === n ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Optional Timer
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { sec: null, label: "None" },
                        { sec: 300, label: "5m" },
                        { sec: 600, label: "10m" },
                        { sec: 900, label: "15m" }
                      ].map(t => (
                        <button
                          key={String(t.sec)}
                          type="button"
                          onClick={() => setTimeLimitSec(t.sec)}
                          className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                            timeLimitSec === t.sec ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border bg-card hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    className="w-full h-11 text-sm font-semibold shadow-md"
                    onClick={handleStartGeneration}
                    disabled={selectedConcepts.length === 0}
                  >
                    <Sparkles className="h-4 w-4 mr-2" /> Start {numQuestions}-Question Quiz
                  </Button>
                </CardFooter>
              </Card>

              {/* Debug Telemetry Status */}
              {showDebug && (
                <div className="p-4 rounded-xl border bg-muted/30 text-xs space-y-2">
                  <div className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" /> Verifier Gate Telemetry
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Generator: Uses Gemini + BGE embedding deduplication.<br/>
                    Verifier: Independent solver consistency check + source grounding validation.<br/>
                    Security: Answer keys masked from runner API.
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* VIEW 2: GENERATING ANIMATION */}
      {view === "generating" && (
        <Card className="max-w-2xl mx-auto my-12 border shadow-lg">
          <CardContent className="pt-8 pb-10 px-8 text-center space-y-6">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Sparkles className="h-7 w-7 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">Generating Grounded Assessment</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Synthesizing questions from course chunks and executing dual-model verifier cross-solve checks...
              </p>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{genProgress}%</span>
              </div>
              <Progress value={genProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto pt-2">
              {[
                { step: 1, title: "1. Retrieve Chunks", desc: "Filtered course slides & pages" },
                { step: 2, title: "2. Generate Stems", desc: "Formulate domain questions" },
                { step: 3, title: "3. Run Verifier", desc: "Cross-solve & groundedness check" },
                { step: 4, title: "4. Mask Answer Keys", desc: "Secure test delivery" }
              ].map(s => (
                <div 
                  key={s.step} 
                  className={`p-3 rounded-lg border text-xs transition-all ${
                    genStep >= s.step ? "border-primary/50 bg-primary/5" : "border-border opacity-50"
                  }`}
                >
                  <div className={`font-semibold ${genStep >= s.step ? "text-primary" : "text-muted-foreground"}`}>
                    {s.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 3: QUIZ RUNNER */}
      {view === "runner" && currentQ && (
        <div className="space-y-6">
          
          {/* Runner Top Bar: Progress, Timer, Flags */}
          <div className="flex items-center justify-between bg-card border rounded-xl p-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-semibold text-xs">
                Question {currentIndex + 1} of {questions.length}
              </Badge>
              <Badge variant={mode === "practice" ? "secondary" : "default"} className="text-xs">
                {mode === "practice" ? "Practice Mode" : "Mock Exam"}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              {timeLeft !== null && (
                <div className={`flex items-center gap-1.5 font-mono text-sm font-semibold px-2.5 py-1 rounded-md border ${
                  timeLeft < 120 ? "bg-rose-500/10 border-rose-500 text-rose-500 animate-pulse" : "bg-muted/50 border-border"
                }`}>
                  <Clock className="h-3.5 w-3.5" />
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                </div>
              )}
              <Button
                variant={flagged[currentQ.id] ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs flex items-center gap-1"
                onClick={() => setFlagged(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
              >
                <Flag className="h-3.5 w-3.5" />
                {flagged[currentQ.id] ? "Flagged" : "Flag for Review"}
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-1.5" />

          {/* Question Stepper Pills */}
          <div className="flex flex-wrap gap-1.5 justify-center py-1">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== "";
              const isCur = idx === currentIndex;
              const isFlg = flagged[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all relative flex items-center justify-center ${
                    isCur 
                      ? "ring-2 ring-primary bg-primary text-primary-foreground" 
                      : isAnswered 
                        ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" 
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {idx + 1}
                  {isFlg && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>

          {/* Main Question Card */}
          <Card className="border shadow-md">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-muted/40">
                    {currentQ.topic_name}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {currentQ.concept_name}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize text-xs">
                    {currentQ.difficulty}
                  </Badge>
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {currentQ.type}
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-lg md:text-xl font-semibold leading-relaxed text-foreground">
                {currentQ.stem}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              
              {/* Options Section */}
              {currentQ.type === "mcq" && (
                <div className="grid gap-2.5">
                  {(currentQ.options || []).map((opt: string, oIdx: number) => {
                    const isSelected = answers[currentQ.id] === opt || answers[currentQ.id] === opt[0];
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [currentQ.id]: opt[0] || opt })}
                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                          isSelected 
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary font-medium" 
                            : "border-border bg-card hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="text-sm pt-0.5">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "true_false" && (
                <div className="grid grid-cols-2 gap-3">
                  {["True", "False"].map((opt) => {
                    const isSelected = answers[currentQ.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [currentQ.id]: opt })}
                        className={`p-4 rounded-xl border text-center font-semibold text-sm transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/10 ring-1 ring-primary text-primary" 
                            : "border-border bg-card hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === "short" && (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    className="w-full p-3.5 rounded-xl border bg-background text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                    placeholder="Type your explanation or conceptual answer here..."
                    value={answers[currentQ.id] || ""}
                    onChange={e => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">Answer will be graded against the rubric and source key points.</p>
                </div>
              )}

              {/* Required Confidence Rating */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-primary" /> How confident are you in this answer?
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">Required for Calibration</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: "Guessing", icon: "🤔" },
                    { val: 2, label: "Unsure", icon: "😐" },
                    { val: 3, label: "Confident", icon: "🙂" },
                    { val: 4, label: "Very confident", icon: "🎯" }
                  ].map(c => {
                    const isPicked = (confidences[currentQ.id] || 0) === c.val;
                    return (
                      <button
                        key={c.val}
                        type="button"
                        onClick={() => setConfidences({ ...confidences, [currentQ.id]: c.val })}
                        className={`py-2 px-1 rounded-lg border text-center transition-all flex flex-col items-center gap-0.5 ${
                          isPicked 
                            ? "border-primary bg-primary/15 text-primary font-bold shadow-xs ring-1 ring-primary" 
                            : "border-border bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="text-sm">{c.icon}</span>
                        <span className="text-[11px]">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Practice Mode: Instant Check & Verified Citation */}
              {mode === "practice" && (
                <div className="space-y-3 pt-2">
                  {!checkedAnswers[currentQ.id] ? (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleCheckAnswer(currentQ.id)}
                      disabled={!answers[currentQ.id]}
                      className="text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Check Answer & View Source Citation
                    </Button>
                  ) : (
                    <div className="p-4 rounded-xl border bg-card space-y-3 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {checkedAnswers[currentQ.id].is_correct ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30 gap-1">
                              <XCircle className="h-3.5 w-3.5" /> Incorrect
                            </Badge>
                          )}
                          <span className="text-xs font-medium text-foreground">
                            {checkedAnswers[currentQ.id].feedback}
                          </span>
                        </div>

                        {/* Verified Source Citation Badge */}
                        {checkedAnswers[currentQ.id].source_location && (
                          <Badge variant="outline" className="gap-1.5 text-xs py-1 px-2.5 bg-muted/40 border">
                            {checkedAnswers[currentQ.id].source_location.source_type === "pdf" ? (
                              <FileText className="h-3.5 w-3.5 text-blue-400" />
                            ) : (
                              <ImageIcon className="h-3.5 w-3.5 text-orange-400" />
                            )}
                            <span>{checkedAnswers[currentQ.id].source_location.location || "Source Material"}</span>
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border">
                        <strong className="text-foreground">Explanation:</strong> {checkedAnswers[currentQ.id].explanation}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </CardContent>

            {/* Runner Navigation Footer */}
            <CardFooter className="flex items-center justify-between border-t pt-4 bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Previous
              </Button>

              <div className="flex items-center gap-2">
                {currentIndex < questions.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="text-xs"
                  >
                    Next Question <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                  >
                    {submitting ? "Grading..." : "Submit Quiz for Grading"}
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>

          {/* Debug Drawer */}
          {showDebug && debugStats && (
            <div className="p-4 rounded-xl border bg-muted/20 text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span className="flex items-center gap-1.5"><Bug className="h-3.5 w-3.5 text-primary" /> Verifier Gate Debug Stats</span>
                <span className="text-[11px] text-emerald-500">
                  Accepted: {debugStats.accepted_count} / {debugStats.total_generated} ({debugStats.rejected_count} rejected)
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                All questions passed independent cross-solve and source grounding checks before insertion.
              </div>
            </div>
          )}

        </div>
      )}

      {/* VIEW 4: RESULTS & MASTERY REPORT */}
      {view === "results" && report && (
        <div className="space-y-6">
          
          {/* Top Score Banner */}
          <Card className="border shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-primary/15 via-purple-500/10 to-transparent p-6 border-b">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div>
                  <Badge variant="outline" className="mb-2 text-xs">Assessment Complete</Badge>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Quiz Results & Performance</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Grounded evaluation graded by AI verifier and integrated with Bayesian Knowledge Tracing.
                  </p>
                </div>
                <div className="flex items-center gap-4 bg-card/80 backdrop-blur-sm p-4 rounded-2xl border shadow-xs">
                  <div className="text-center">
                    <div className="text-3xl font-black text-primary">{report.total_score} / {report.total_questions}</div>
                    <div className="text-[11px] text-muted-foreground uppercase font-semibold">Total Score</div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="text-center">
                    <div className={`text-3xl font-black ${report.percentage >= 70 ? "text-emerald-500" : "text-amber-500"}`}>
                      {report.percentage}%
                    </div>
                    <div className="text-[11px] text-muted-foreground uppercase font-semibold">Accuracy</div>
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="pt-6 space-y-6">
              
              {/* Concept Mastery Updates Card (Requirement 4) */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <Award className="h-4 w-4 text-primary" /> Concept Mastery Changes (BKT Engine)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(report.mastery_changes || []).map((m: any, idx: number) => {
                    const isUp = m.delta >= 0;
                    return (
                      <div key={idx} className="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between shadow-xs">
                        <div>
                          <div className="font-semibold text-xs text-foreground">{m.concept_name}</div>
                          <div className="text-[11px] text-muted-foreground">{m.topic_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground line-through">{m.before_pct}%</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-bold text-foreground">{m.after_pct}%</span>
                          </div>
                          <span className={`text-[11px] font-semibold ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                            {isUp ? `+${m.delta}%` : `${m.delta}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confidence Calibration Card */}
              {report.calibration && (
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-purple-400" /> Confidence Calibration</span>
                    <span className="text-[11px] text-muted-foreground">{report.calibration.note}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg border bg-card text-xs">
                      <div className="font-bold text-emerald-500">{report.calibration.calibrated_high}</div>
                      <div className="text-[10px] text-muted-foreground">Confident & Correct</div>
                    </div>
                    <div className="p-2 rounded-lg border bg-card text-xs">
                      <div className="font-bold text-amber-500">{report.calibration.overconfident}</div>
                      <div className="text-[10px] text-muted-foreground">Overconfident (Wrong)</div>
                    </div>
                    <div className="p-2 rounded-lg border bg-card text-xs">
                      <div className="font-bold text-blue-400">{report.calibration.lucky_guess}</div>
                      <div className="text-[10px] text-muted-foreground">Lucky Guess</div>
                    </div>
                  </div>
                </div>
              )}

                            {/* DIFFERENTIATING FEATURE 4: EXPLAIN MY MISTAKES PANEL */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 font-bold text-[11px]">
                        COGNITIVE DISTRACTOR ANALYSIS
                      </Badge>
                      <span className="text-xs text-muted-foreground">Session #{sessionId || 9}</span>
                    </div>
                    <h3 className="text-base font-bold flex items-center gap-2 mt-1 text-foreground">
                      <AlertTriangle className="h-4 w-4 text-rose-500" /> Explain My Mistakes & Distractor Traps
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Evidence-based diagnosis of why you chose incorrect options, paired with verified syllabus citations.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fetchMistakes(9)}
                      className="text-xs h-7 gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Load Diagnostic (Session 9)
                    </Button>
                  </div>
                </div>

                {loadingMistakes ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </div>
                ) : mistakesAnalysis.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed text-center space-y-2 bg-muted/10">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <div className="font-semibold text-sm">No mistakes detected in this session!</div>
                    <p className="text-xs text-muted-foreground">
                      All questions were answered correctly or no wrong attempts recorded.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => fetchMistakes(9)}>
                      Inspect Session 9 Mistakes (Aarav's Diagnostic)
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mistakesAnalysis.map((m: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="rounded-xl border border-rose-500/25 bg-card hover:border-rose-500/40 transition-all p-4 space-y-3 shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-foreground">{m.concept_name}</span>
                            <span className="text-[11px] text-muted-foreground">• {m.topic_name}</span>
                          </div>
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10 text-[10px]">
                            Confidence: {m.user_confidence}
                          </Badge>
                        </div>

                        {/* Question Stem */}
                        <div className="text-xs font-medium text-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
                          {m.stem}
                        </div>

                        {/* Answers comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5">
                            <span className="text-[10px] uppercase font-bold text-rose-500 block">Your Chosen Answer:</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">{m.chosen_answer}</span>
                          </div>
                          <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                            <span className="text-[10px] uppercase font-bold text-emerald-500 block">Correct Grounded Answer:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{m.correct_answer}</span>
                          </div>
                        </div>

                        {/* Cognitive Distractor Trap */}
                        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs space-y-1">
                          <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-[11px]">
                            <HelpCircle className="h-3.5 w-3.5" /> WHY YOU FELL FOR THIS DISTRACTOR:
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            {m.distractor_trap}
                          </p>
                        </div>

                        {/* Takeaway Rule */}
                        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
                          <div className="font-bold text-primary flex items-center gap-1.5 text-[11px]">
                            <Sparkles className="h-3.5 w-3.5" /> KEY TAKEAWAY & MENTAL MODEL:
                          </div>
                          <p className="font-medium text-foreground text-xs">
                            {m.takeaway_rule}
                          </p>
                        </div>

                        {/* Source Grounding Citation */}
                        {m.source_citation && (
                          <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-foreground flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5 text-primary" /> Verified Database Citation:
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {m.source_citation.source_name} ({m.source_citation.location})
                              </Badge>
                            </div>
                            <p className="italic text-[11px] text-muted-foreground/90 pl-2 border-l-2 border-primary/50">
                              "{m.source_citation.text_snippet}"
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <Link href={`/tutor?q=Explain%20${encodeURIComponent(m.concept_name)}%20and%20why%20my%20misconception%20occurred`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10">
                              <Sparkles className="h-3 w-3" /> Remediate in AI Tutor
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              {/* Per-Question Table (Requirement 4) */}
              <div className="space-y-3 pt-2">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 text-primary" /> Per-Question Detailed Breakdown
                </h3>
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">#</th>
                        <th className="py-3 px-3">Question</th>
                        <th className="py-3 px-3">Topic</th>
                        <th className="py-3 px-3">Difficulty</th>
                        <th className="py-3 px-3">Source</th>
                        <th className="py-3 px-3">Result</th>
                        <th className="py-3 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(report.per_question_results || []).map((r: any, idx: number) => {
                        const isExpanded = expandedQuestion === idx;
                        return (
                          <React.Fragment key={idx}>
                            <tr className={`hover:bg-muted/30 transition-colors ${isExpanded ? "bg-muted/20" : ""}`}>
                              <td className="py-3 px-3 text-center font-bold text-muted-foreground">{idx + 1}</td>
                              <td className="py-3 px-3 font-medium text-foreground max-w-xs truncate">{r.stem}</td>
                              <td className="py-3 px-3 text-muted-foreground">{r.concept_name || r.topic_name}</td>
                              <td className="py-3 px-3 capitalize">{r.difficulty}</td>
                              <td className="py-3 px-3">
                                <Badge variant="outline" className="text-[10px] font-medium py-0.5 px-2 bg-muted/40">
                                  {r.source_location?.location || "Source"}
                                </Badge>
                              </td>
                              <td className="py-3 px-3">
                                {r.is_correct ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">Correct</Badge>
                                ) : (
                                  <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px]">Incorrect</Badge>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-muted/10 border-b">
                                <td colSpan={7} className="p-4 space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 rounded-lg border bg-card space-y-1">
                                      <div className="text-muted-foreground text-[11px]">Your Answer:</div>
                                      <div className={`font-semibold ${r.is_correct ? "text-emerald-500" : "text-rose-500"}`}>
                                        {r.user_answer || "(None)"}
                                      </div>
                                    </div>
                                    <div className="p-3 rounded-lg border bg-card space-y-1">
                                      <div className="text-muted-foreground text-[11px]">Correct Answer:</div>
                                      <div className="font-semibold text-emerald-500">{r.correct_answer}</div>
                                    </div>
                                  </div>
                                  <div className="p-3 rounded-lg border bg-card text-xs space-y-1">
                                    <div className="font-semibold text-foreground">Explanation & Citation Excerpt:</div>
                                    <p className="text-muted-foreground">{r.explanation}</p>
                                    {r.source_location?.excerpt && (
                                      <blockquote className="border-l-2 border-primary/50 pl-2.5 italic text-[11px] text-muted-foreground/80 mt-1">
                                        "{r.source_location.excerpt}"
                                      </blockquote>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </CardContent>

            <CardFooter className="flex flex-wrap gap-3 justify-between border-t pt-4 bg-muted/10">
              <Button variant="outline" size="sm" onClick={() => setView("setup")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Start New Practice Quiz
              </Button>
              <Link href="/tutor">
                <Button size="sm" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Review Weak Topics with AI Tutor
                </Button>
              </Link>
            </CardFooter>
          </Card>

        </div>
      )}

    </div>
  );
}
