"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCourse, CourseItem } from "@/context/CourseContext";
import { useUser } from "@/context/UserContext";
import { getApiUrl } from "@/lib/config";
import {
  BookOpen,
  ArrowLeft,
  Clock,
  Layers,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  PlayCircle,
  FileText,
  Star,
  Award,
  ChevronRight,
  ChevronDown,
  Lock,
  Download,
  Share2,
  UserCheck,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const { enrollCourse, unenrollCourse, setSelectedCourseId } = useCourse();
  const { currentUser, isTeacher } = useUser();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [certificateData, setCertificateData] = useState<any>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl(`/api/courses/${courseId}`), {
        headers: { "X-User-Id": currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setCourse(data);
      } else {
        setErrorMsg("Failed to load course details.");
      }

      // Fetch reviews
      const revRes = await fetch(getApiUrl(`/api/courses/${courseId}/reviews`));
      if (revRes.ok) {
        const revData = await revRes.json();
        setReviews(revData);
      }
    } catch (err) {
      setErrorMsg("Error loading course.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchDetail();
    }
  }, [courseId, currentUser.id]);

  const handleEnroll = async () => {
    setEnrolling(true);
    const success = await enrollCourse(Number(courseId));
    setEnrolling(false);
    if (success) {
      fetchDetail();
    }
  };

  const handleUnenroll = async () => {
    if (!confirm("Are you sure you want to unenroll from this course?")) return;
    setEnrolling(true);
    await unenrollCourse(Number(courseId));
    setEnrolling(false);
    fetchDetail();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/reviews`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({ rating: newRating, comment: newComment }),
      });
      if (res.ok) {
        setNewComment("");
        fetchDetail();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleViewCertificate = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/certificate`), {
        headers: { "X-User-Id": currentUser.id },
      });
      if (res.ok) {
        const data = await res.json();
        setCertificateData(data);
        setCertModalOpen(true);
      } else {
        const err = await res.json();
        alert(err.detail || "Certificate requirement not yet completed.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading course syllabus...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Course Not Found</h2>
        <p className="text-sm text-muted-foreground">This course may be unpublished or does not exist.</p>
        <Button onClick={() => router.push("/courses")} variant="outline">
          Back to Catalogue
        </Button>
      </div>
    );
  }

  const isEnrolled = course.user_enrollment?.is_enrolled;
  const progressPct = course.user_enrollment?.progress_percentage || 0;
  const isCompleted = progressPct === 100;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/courses")}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 -ml-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalogue
        </Button>
      </div>

      {/* Hero Course Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/20 p-8 shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                {course.category}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs uppercase font-bold ${
                  course.level === "Beginner"
                    ? "text-emerald-400 bg-emerald-500/10"
                    : course.level === "Intermediate"
                    ? "text-indigo-400 bg-indigo-500/10"
                    : "text-amber-400 bg-amber-500/10"
                }`}
              >
                {course.level}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span className="font-bold">{course.rating || 5.0}</span>
                <span className="text-muted-foreground">({course.reviews_count || 0})</span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {course.title}
            </h1>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              {course.short_summary || course.description}
            </p>

            {/* Instructor Details */}
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-300">
              <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 font-bold">
                {course.teacher?.name?.[0] || "T"}
              </div>
              <div>
                <p className="font-semibold text-white">{course.teacher?.name || "Faculty Instructor"}</p>
                <p className="text-[11px] text-slate-400">{course.teacher?.role || "Teacher"} • LearnLoop AI Faculty</p>
              </div>
            </div>
          </div>

          {/* Action Callout Box */}
          <Card className="w-full lg:w-80 bg-slate-900/90 border-slate-700/80 shadow-2xl shrink-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Estimated Duration</span>
                <span className="font-semibold text-white flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  {course.estimated_duration_hours || 10} Hours
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              {isEnrolled ? (
                <div className="space-y-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Enrolled
                    </span>
                    <span>{progressPct}% Completed</span>
                  </div>
                  <Progress value={progressPct} className="h-2 bg-slate-800" />

                  {isCompleted && (
                    <Button
                      size="sm"
                      onClick={handleViewCertificate}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5"
                    >
                      <Award className="w-4 h-4" /> View Certificate
                    </Button>
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                {isEnrolled ? (
                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        const firstLesson = course.curriculum?.[0]?.lessons?.[0];
                        if (firstLesson) {
                          router.push(`/courses/${course.id}/lessons/${firstLesson.id}`);
                        } else {
                          setSelectedCourseId(String(course.id));
                          router.push("/tutor");
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2 shadow-lg shadow-indigo-600/30"
                    >
                      <PlayCircle className="w-4 h-4" /> Continue Learning
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnenroll}
                      disabled={enrolling}
                      className="w-full text-xs text-rose-400 hover:text-rose-300 border-slate-700 hover:bg-rose-500/10"
                    >
                      Unenroll
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2 shadow-lg shadow-indigo-600/30 h-11"
                  >
                    <BookOpen className="w-4 h-4" />
                    {enrolling ? "Enrolling..." : "Enroll in Course (Free)"}
                  </Button>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Full access to Socratic AI Tutor</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Interactive module quizzes & practice</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Official completion certificate</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content: Overview & Curriculum */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Syllabus & Modules */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detailed Description */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Course Overview & Objectives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>{course.description}</p>

              {course.learning_objectives && course.learning_objectives.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wider">
                    What You Will Master:
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {course.learning_objectives.map((obj: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {course.prerequisites && course.prerequisites.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wider">
                    Prerequisites:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {course.prerequisites.map((p: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Curriculum Builder & Modules Viewer */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Course Curriculum
                </CardTitle>
                <CardDescription className="text-xs">
                  {course.curriculum?.length || 0} Modules •{" "}
                  {course.curriculum?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0} Lessons
                </CardDescription>
              </div>

              {isTeacher && String(course.teacher_id) === String(currentUser.id) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/courses/${course.id}/edit`)}
                  className="text-xs"
                >
                  Manage Curriculum
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {course.curriculum?.map((mod: any, mIdx: number) => (
                <div key={mod.id} className="border border-border/80 rounded-xl overflow-hidden bg-card/60">
                  <div className="p-3.5 bg-muted/40 flex items-center justify-between border-b border-border/60">
                    <span className="font-semibold text-xs text-foreground">
                      {mod.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {mod.lessons?.length || 0} lessons
                    </span>
                  </div>

                  <div className="divide-y divide-border/40">
                    {mod.lessons?.map((les: any, lIdx: number) => {
                      const canAccess = isEnrolled || les.is_preview || isTeacher;
                      return (
                        <div
                          key={les.id}
                          onClick={() => {
                            if (canAccess) {
                              router.push(`/courses/${course.id}/lessons/${les.id}`);
                            } else {
                              handleEnroll();
                            }
                          }}
                          className={`p-3 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            canAccess
                              ? "hover:bg-muted/50 text-foreground"
                              : "opacity-70 hover:opacity-100 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {les.is_completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : canAccess ? (
                              <PlayCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                            ) : (
                              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium">{les.title}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {les.is_preview && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                Free Preview
                              </Badge>
                            )}
                            <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {les.duration_minutes}m
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Reviews & Ratings */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                Student Reviews & Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Review submit form for enrolled users */}
              {isEnrolled && (
                <form onSubmit={handleReviewSubmit} className="space-y-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Your Rating</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewRating(s)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              s <= newRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your experience with this course..."
                    className="w-full p-2 text-xs rounded-md bg-background border border-border resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <Button
                    type="submit"
                    size="sm"
                    disabled={reviewSubmitting}
                    className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {reviewSubmitting ? "Submitting..." : "Submit Review"}
                  </Button>
                </form>
              )}

              {/* Reviews list */}
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {reviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No reviews yet. Be the first enrolled student to review!
                  </p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="p-3 rounded-lg bg-card border border-border/70 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{rev.user?.name || "Student"}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= rev.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rev.comment && <p className="text-muted-foreground">{rev.comment}</p>}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* VERIFIABLE CERTIFICATE DIALOG */}
      <Dialog open={certModalOpen} onOpenChange={setCertModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-400">
              <Award className="w-5 h-5" /> Official Certificate of Completion
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This digital certificate verifies full completion and concept mastery in LearnLoop AI.
            </DialogDescription>
          </DialogHeader>

          {certificateData && (
            <div className="p-6 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-card to-background text-center space-y-4 my-2">
              <div className="inline-block p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Award className="w-8 h-8" />
              </div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">LearnLoop AI Academy</p>
              <h3 className="text-xl font-bold text-foreground">{certificateData.student_name}</h3>
              <p className="text-xs text-muted-foreground">has successfully completed all requirements for</p>
              <h4 className="text-base font-bold text-indigo-400">{certificateData.course_title}</h4>
              <p className="text-[11px] text-muted-foreground">
                Instructor: <strong>{certificateData.teacher_name}</strong>
              </p>
              <div className="pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Code: {certificateData.certificate_code}</span>
                <span>Date: {new Date(certificateData.issued_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download / Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
