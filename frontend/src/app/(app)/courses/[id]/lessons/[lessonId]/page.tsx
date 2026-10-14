"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourse } from "@/context/CourseContext";
import { useUser } from "@/context/UserContext";
import { getApiUrl } from "@/lib/config";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  MessageSquare,
  BookOpen,
  Check,
  Lock,
  Layers,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function LessonViewerPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const lessonId = params?.lessonId as string;

  const { currentUser } = useUser();
  const { toggleLessonCompletion, setSelectedCourseId } = useCourse();

  const [lesson, setLesson] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lRes, cRes] = await Promise.all([
        fetch(getApiUrl(`/api/courses/${courseId}/lessons/${lessonId}`), {
          headers: { "X-User-Id": currentUser.id },
        }),
        fetch(getApiUrl(`/api/courses/${courseId}`), {
          headers: { "X-User-Id": currentUser.id },
        }),
      ]);

      if (lRes.ok) {
        const lData = await lRes.json();
        setLesson(lData);
      } else {
        const err = await lRes.json();
        setErrorMsg(err.detail || "Unable to view lesson.");
      }

      if (cRes.ok) {
        const cData = await cRes.json();
        setCourse(cData);
      }
    } catch (err) {
      setErrorMsg("Error loading lesson.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId && lessonId) {
      fetchData();
    }
  }, [courseId, lessonId, currentUser.id]);

  const handleToggle = async () => {
    if (!lesson) return;
    setToggling(true);
    const res = await toggleLessonCompletion(Number(courseId), Number(lessonId));
    setToggling(false);
    if (res) {
      setLesson((prev: any) => ({ ...prev, is_completed: res.is_completed }));
      // refresh course
      fetch(getApiUrl(`/api/courses/${courseId}`), {
        headers: { "X-User-Id": currentUser.id },
      })
        .then((r) => r.json())
        .then((cData) => setCourse(cData));
    }
  };

  const jumpToLesson = (targetLessonId: number) => {
    router.push(`/courses/${courseId}/lessons/${targetLessonId}`);
  };

  const askAiTutor = () => {
    setSelectedCourseId(String(courseId));
    router.push("/tutor");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading lesson content...</p>
      </div>
    );
  }

  if (errorMsg || !lesson) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <Lock className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">{errorMsg || "Please enroll to view this lesson."}</p>
        <Button onClick={() => router.push(`/courses/${courseId}`)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          Back to Course Details
        </Button>
      </div>
    );
  }

  const progressPct = course?.user_enrollment?.progress_percentage || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/courses/${courseId}`)}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Course Syllabus
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-xs text-foreground truncate max-w-xs">{course?.title}</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={askAiTutor}
            className="text-xs border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Ask AI Tutor about this Lesson
          </Button>

          <Button
            onClick={handleToggle}
            disabled={toggling}
            size="sm"
            className={`text-xs gap-1.5 font-medium ${
              lesson.is_completed
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {lesson.is_completed ? "Completed" : "Mark as Complete"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Lesson Content (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted">
                <Clock className="w-3 h-3 mr-1" /> {lesson.duration_minutes} Minutes
              </Badge>
              {lesson.is_completed && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs">
                  <Check className="w-3 h-3 mr-1" /> Complete
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {lesson.title}
            </h1>
            {lesson.description && (
              <p className="text-sm text-muted-foreground">{lesson.description}</p>
            )}
          </div>

          {/* Video Player or Embedded Media */}
          {lesson.video_url && (
            <Card className="overflow-hidden border-border bg-black/90">
              <div className="aspect-video w-full">
                {lesson.video_url.includes("youtube.com") || lesson.video_url.includes("youtu.be") ? (
                  <iframe
                    src={
                      lesson.video_url.includes("watch?v=")
                        ? lesson.video_url.replace("watch?v=", "embed/")
                        : lesson.video_url.replace("youtu.be/", "www.youtube.com/embed/")
                    }
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={lesson.video_url} controls className="w-full h-full" />
                )}
              </div>
            </Card>
          )}

          {/* Text Content */}
          <Card className="border-border p-6 bg-card text-foreground">
            <div className="prose dark:prose-invert max-w-none text-sm md:text-base leading-relaxed space-y-4">
              {lesson.content_text ? (
                lesson.content_text.split("\n\n").map((para: string, i: number) => (
                  <p key={i}>{para}</p>
                ))
              ) : (
                <p className="text-muted-foreground italic">
                  This lesson focuses on the video lecture and accompanying materials. Follow along above and refer to the downloadable resources.
                </p>
              )}
            </div>

            {/* Attached Resource */}
            {lesson.resource_url && (
              <div className="mt-8 pt-4 border-t border-border flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-medium text-foreground">Accompanying Course Slide / Document</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(getApiUrl(lesson.resource_url), "_blank")}
                  className="text-xs gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Resource
                </Button>
              </div>
            )}
          </Card>

          {/* Lesson Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              disabled={!lesson.prev_lesson_id}
              onClick={() => lesson.prev_lesson_id && jumpToLesson(lesson.prev_lesson_id)}
              className="text-xs gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Lesson
            </Button>

            <Button
              size="sm"
              disabled={!lesson.next_lesson_id}
              onClick={() => lesson.next_lesson_id && jumpToLesson(lesson.next_lesson_id)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
            >
              Next Lesson <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right Column: Course Outline & Progress (1 col) */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Course Progress</span>
                <span className="text-indigo-400">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2 mt-1.5" />
            </CardHeader>
            <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {course?.curriculum?.map((mod: any) => (
                <div key={mod.id} className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {mod.title}
                  </h4>
                  <div className="space-y-1 pl-1">
                    {mod.lessons?.map((les: any) => {
                      const isCurrent = Number(les.id) === Number(lessonId);
                      return (
                        <button
                          key={les.id}
                          onClick={() => jumpToLesson(les.id)}
                          className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            isCurrent
                              ? "bg-indigo-600 text-white font-semibold"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            {les.is_completed ? (
                              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-emerald-500'}`} />
                            ) : (
                              <PlayCircle className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate">{les.title}</span>
                          </div>
                          <span className="text-[10px] shrink-0 opacity-80">{les.duration_minutes}m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
