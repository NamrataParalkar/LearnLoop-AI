"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCourse, CourseItem } from "@/context/CourseContext";
import { useUser } from "@/context/UserContext";
import { getApiUrl } from "@/lib/config";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  GraduationCap, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Layers, 
  FileText, 
  FolderTree, 
  ArrowRight,
  Filter,
  Check,
  MoreVertical,
  X,
  UploadCloud,
  ExternalLink,
  ShieldAlert,
  Star,
  UserCheck,
  PlayCircle,
  Eye,
  SlidersHorizontal,
  Bookmark,
  Users,
  ChevronRight,
  ChevronDown,
  FileImage,
  FileAudio,
  Map,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const CATEGORIES = [
  "All",
  "Computer Science",
  "Artificial Intelligence",
  "System Design",
  "Web Development",
  "Physics & Computing"
];

const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];

export default function CoursesPage() {
  const router = useRouter();
  const { 
    courses, 
    myLearning, 
    selectedCourseId, 
    selectedCourse,
    setSelectedCourseId, 
    createCourse, 
    updateCourse, 
    deleteCourse, 
    enrollCourse,
    refreshCourses, 
    refreshMyLearning, 
    loading 
  } = useCourse();

  const { currentUser, isTeacher, users } = useUser();

  const [activeTab, setActiveTab] = useState<string>("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [sortBy, setSortBy] = useState("newest"); // newest, rating, popularity

  // Teacher dashboard stats
  const [teacherStats, setTeacherStats] = useState<any>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [targetCourse, setTargetCourse] = useState<CourseItem | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formShortSummary, setFormShortSummary] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Computer Science");
  const [formLevel, setFormLevel] = useState("Intermediate");
  const [formStatus, setFormStatus] = useState("published");
  const [formDuration, setFormDuration] = useState(10);
  const [formObjectives, setFormObjectives] = useState("");
  const [formPrereqs, setFormPrereqs] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Fetch teacher analytics if logged in user is a teacher
  useEffect(() => {
    if (isTeacher) {
      fetch(getApiUrl("/api/teacher/dashboard/stats"), {
        headers: { "X-User-Id": currentUser.id }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setTeacherStats(data);
        })
        .catch(err => console.warn("Failed fetching teacher stats:", err));
    }
  }, [isTeacher, currentUser.id]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // Teacher tab filters to owned courses
      if (activeTab === "my-courses") {
        if (String(course.teacher_id) !== String(currentUser.id)) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = course.title.toLowerCase().includes(q);
        const matchesDesc = (course.description || "").toLowerCase().includes(q);
        const matchesCat = (course.category || "").toLowerCase().includes(q);
        const matchesTeacher = course.teacher?.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesTeacher) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== "All") {
        if (!course.category?.toLowerCase().includes(selectedCategory.toLowerCase())) {
          return false;
        }
      }

      // Level filter
      if (selectedDifficulty !== "All") {
        if (!course.level?.toLowerCase().includes(selectedDifficulty.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [courses, activeTab, currentUser.id, searchQuery, selectedCategory, selectedDifficulty]);

  const openCreateDialog = () => {
    setFormTitle("");
    setFormShortSummary("");
    setFormDescription("");
    setFormCategory("Computer Science");
    setFormLevel("Intermediate");
    setFormStatus("published");
    setFormDuration(12);
    setFormObjectives("Master core principles\nImplement hands-on code\nPass milestone assessments");
    setFormPrereqs("Basic programming foundations");
    setFormError("");
    setIsCreateOpen(true);
  };

  const openEditDialog = (course: CourseItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetCourse(course);
    setFormTitle(course.title);
    setFormShortSummary(course.short_summary || "");
    setFormDescription(course.description || "");
    setFormCategory(course.category || "Computer Science");
    setFormLevel(course.level || "Intermediate");
    setFormStatus(course.status || "published");
    setFormDuration(course.estimated_duration_hours || 10);
    setFormObjectives((course.learning_objectives || []).join("\n"));
    setFormPrereqs((course.prerequisites || []).join("\n"));
    setFormError("");
    setIsEditOpen(true);
  };

  const openDeleteDialog = (course: CourseItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTargetCourse(course);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Course title is required.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    const res = await createCourse({
      title: formTitle.trim(),
      short_summary: formShortSummary.trim() || formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      level: formLevel,
      status: formStatus,
      is_published: formStatus === "published",
      estimated_duration_hours: Number(formDuration),
      learning_objectives: formObjectives.split("\n").map(s => s.trim()).filter(Boolean),
      prerequisites: formPrereqs.split("\n").map(s => s.trim()).filter(Boolean),
    });

    setFormSubmitting(false);
    if (res) {
      setIsCreateOpen(false);
      refreshCourses();
      router.push(`/courses/${res.id}/edit`);
    } else {
      setFormError("Failed creating course. Verify teacher authorization.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCourse) return;

    setFormSubmitting(true);
    setFormError("");

    const res = await updateCourse(targetCourse.id, {
      title: formTitle.trim(),
      short_summary: formShortSummary.trim(),
      description: formDescription.trim(),
      category: formCategory,
      level: formLevel,
      status: formStatus,
      is_published: formStatus === "published",
      estimated_duration_hours: Number(formDuration),
      learning_objectives: formObjectives.split("\n").map(s => s.trim()).filter(Boolean),
      prerequisites: formPrereqs.split("\n").map(s => s.trim()).filter(Boolean),
    });

    setFormSubmitting(false);
    if (res) {
      setIsEditOpen(false);
      setTargetCourse(null);
      refreshCourses();
    } else {
      setFormError("Failed updating course details.");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!targetCourse) return;
    setFormSubmitting(true);
    const success = await deleteCourse(targetCourse.id);
    setFormSubmitting(false);
    if (success) {
      setIsDeleteOpen(false);
      setTargetCourse(null);
      refreshCourses();
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Hero Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/20 p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Academic Course Discovery & Faculty Studio
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Explore & Master Industry-Standard Courses
            </h1>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Explore faculty-created courses with interactive Socratic AI tutoring, syllabus modules, video lectures, and verified certificate pathways.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isTeacher && (
              <Button
                onClick={openCreateDialog}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 gap-2 h-11 px-5"
              >
                <Plus className="w-4 h-4" />
                Create Course
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => router.push("/tutor")}
              className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 gap-2 h-11"
            >
              <FolderTree className="w-4 h-4 text-indigo-400" />
              Active Socratic Tutor
            </Button>
          </div>
        </div>

        {/* Quick Role & Mode Indicator */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Current Role:</span>
            <span className="font-semibold text-white flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${isTeacher ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {currentUser.name} ({currentUser.role.toUpperCase()})
            </span>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="hidden sm:inline text-slate-400">
              {isTeacher 
                ? "Full authoring, curriculum builder, and statistics permissions." 
                : "Real persistent enrollment and lesson completion tracking enabled."}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <span>Catalogue: <strong className="text-white">{courses.length}</strong></span>
            <span>My Enrolled: <strong className="text-white">{myLearning.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Teacher Dashboard Analytics Cards (Visible when Teacher is active) */}
      {isTeacher && teacherStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Authored</span>
              <p className="text-2xl font-bold text-foreground">{teacherStats.total_courses || 0}</p>
              <span className="text-[10px] text-muted-foreground">{teacherStats.published_courses || 0} published • {teacherStats.draft_courses || 0} drafts</span>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Enrollments</span>
              <p className="text-2xl font-bold text-indigo-400">{teacherStats.total_enrollments || 0}</p>
              <span className="text-[10px] text-muted-foreground">Active students across all courses</span>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Average Rating</span>
              <div className="flex items-center gap-1 text-2xl font-bold text-amber-400">
                <Star className="w-5 h-5 fill-amber-400" />
                {teacherStats.average_rating || 5.0}
              </div>
              <span className="text-[10px] text-muted-foreground">Based on {teacherStats.total_reviews || 0} reviews</span>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Action</span>
              <div className="pt-1">
                <Button size="sm" onClick={openCreateDialog} className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1">
                  <Plus className="w-3.5 h-3.5" /> New Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs & Filters Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-muted/60 p-1 border border-border">
              <TabsTrigger value="catalog" className="text-xs font-semibold px-4 py-2">
                All Courses ({courses.length})
              </TabsTrigger>
              <TabsTrigger value="my-learning" className="text-xs font-semibold px-4 py-2 text-indigo-400 data-[state=active]:text-indigo-300">
                My Learning ({myLearning.length})
              </TabsTrigger>
              <TabsTrigger value="hierarchy" className="text-xs font-semibold px-4 py-2 text-cyan-400 data-[state=active]:text-cyan-300 gap-1.5 flex items-center">
                <FolderTree className="w-3.5 h-3.5" />
                Curriculum Hierarchy
              </TabsTrigger>
              {isTeacher && (
                <TabsTrigger value="my-courses" className="text-xs font-semibold px-4 py-2 text-amber-400 data-[state=active]:text-amber-300">
                  Teacher Studio ({courses.filter(c => String(c.teacher_id) === String(currentUser.id)).length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {/* Search Box & Difficulty Filter */}
          {activeTab !== "hierarchy" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, teacher, topic..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Select value={selectedDifficulty} onValueChange={(v: string | null) => v && setSelectedDifficulty(v)}>
                <SelectTrigger className="w-[130px] text-xs h-9 bg-card">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => (
                    <SelectItem key={l} value={l} className="text-xs">{l === "All" ? "All Levels" : l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Categories Chips */}
        {activeTab !== "my-learning" && activeTab !== "hierarchy" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-muted-foreground flex items-center gap-1 shrink-0 font-medium mr-1">
              <Filter className="w-3.5 h-3.5" /> Category:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all font-medium ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CURRICULUM HIERARCHY TAB VIEW */}
      {activeTab === "hierarchy" ? (
        <CurriculumHierarchyView courseId={parseInt(selectedCourseId, 10) || 1} activeCourse={selectedCourse} />
      ) : activeTab === "my-learning" ? (
        /* MY LEARNING TAB VIEW */
        myLearning.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-border bg-card/40">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Bookmark className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">You haven't enrolled in any courses yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Browse our faculty-created course catalog, enroll in courses that interest you, and track your learning progress.
            </p>
            <div className="mt-6 flex justify-center">
              <Button size="sm" onClick={() => setActiveTab("catalog")} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Explore Catalogue
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myLearning.map((item) => (
              <Card key={item.enrollment_id} className="border-border hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-semibold text-primary">{item.course.category}</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                        Enrolled
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold line-clamp-1 text-foreground">
                      {item.course.title}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {item.course.short_summary || "Continue where you left off in your modules and lessons."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Course Mastery Progress</span>
                        <span className="font-bold text-foreground">{item.progress.progress_percentage}%</span>
                      </div>
                      <Progress value={item.progress.progress_percentage} className="h-2 bg-muted" />
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span>{item.progress.completed_lessons} of {item.progress.total_lessons} lessons completed</span>
                        {item.progress.is_completed && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2.5">
                      <span>Instructor: <strong className="text-foreground">{item.course.teacher?.name || "LearnLoop Faculty"}</strong></span>
                      <span>Level: <strong className="text-foreground">{item.course.level}</strong></span>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-border"
                    onClick={() => {
                      setSelectedCourseId(String(item.course.id));
                      setActiveTab("hierarchy");
                    }}
                  >
                    <FolderTree className="w-3.5 h-3.5 mr-1" />
                    Knowledge Tree
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-1.5"
                    onClick={() => {
                      setSelectedCourseId(String(item.course.id));
                      router.push(`/courses/${item.course.id}`);
                    }}
                  >
                    Continue Learning
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* COURSE CATALOG & MY COURSES GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = course.user_enrollment?.is_enrolled;
            const progress = course.user_enrollment?.progress_percentage || 0;
            const isOwner = String(course.teacher_id) === String(currentUser.id);

            return (
              <Card
                key={course.id}
                className={`border transition-all duration-200 flex flex-col justify-between hover:shadow-lg ${
                  isEnrolled ? 'border-primary/40 bg-card/80' : 'border-border bg-card'
                }`}
              >
                <div>
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                          {course.category}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {course.level}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isOwner && (
                          <Badge variant="outline" className={`text-[10px] ${course.status === 'published' ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400'}`}>
                            {course.status}
                          </Badge>
                        )}
                        <span className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          {course.rating || 5.0}
                        </span>
                      </div>
                    </div>

                    <CardTitle className="text-lg font-bold text-foreground leading-snug line-clamp-1">
                      {course.title}
                    </CardTitle>

                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {course.short_summary || course.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/50 text-[11px] text-muted-foreground">
                      <div className="flex flex-col items-center justify-center p-1.5 bg-muted/30 rounded">
                        <Layers className="w-3.5 h-3.5 text-indigo-400 mb-0.5" />
                        <span className="font-semibold text-foreground">{course.stats?.modules_count || 3}</span>
                        <span className="text-[9px]">Modules</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-1.5 bg-muted/30 rounded">
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                        <span className="font-semibold text-foreground">{course.stats?.lessons_count || 12}</span>
                        <span className="text-[9px]">Lessons</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-1.5 bg-muted/30 rounded">
                        <Users className="w-3.5 h-3.5 text-primary mb-0.5" />
                        <span className="font-semibold text-foreground">{course.stats?.enrollments_count || 0}</span>
                        <span className="text-[9px]">Students</span>
                      </div>
                    </div>

                    {isEnrolled && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">Your Completion</span>
                          <span className="font-bold text-emerald-400">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5 bg-muted" />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5 truncate max-w-[180px]">
                        <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{course.teacher?.name || "LearnLoop Faculty"}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        ~{course.estimated_duration_hours || 10}h
                      </span>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Faculty management actions */}
                    {(isOwner || currentUser.role === "admin") && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit Course"
                          onClick={(e) => openEditDialog(course, e)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-400 hover:text-rose-500"
                          title="Delete Course"
                          onClick={(e) => openDeleteDialog(course, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={isEnrolled ? "secondary" : "default"}
                      size="sm"
                      onClick={() => router.push(`/courses/${course.id}`)}
                      className={`text-xs gap-1.5 h-8 font-medium ${
                        isEnrolled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}
                    >
                      {isEnrolled ? "Enrolled • Details" : "View Syllabus"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE COURSE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Plus className="w-5 h-5 text-indigo-400" />
              Create Faculty Course
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new course to LearnLoop. You can save as Draft or Publish immediately to all students.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3 mt-2 text-xs">
            {formError && (
              <div className="p-2.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-md">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Course Title *</label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Modern Cryptography & Zero-Knowledge Proofs"
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Short Summary (max 300 chars)</label>
              <input
                type="text"
                value={formShortSummary}
                onChange={(e) => setFormShortSummary(e.target.value)}
                placeholder="A concise hook displayed on discovery cards..."
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Detailed Description & Syllabus</label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Comprehensive breakdown of topics, assignments, and practical goals..."
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-2 text-xs rounded-md border border-border bg-background"
                >
                  {CATEGORIES.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Difficulty</label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value)}
                  className="w-full p-2 text-xs rounded-md border border-border bg-background"
                >
                  {LEVELS.filter(l => l !== "All").map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Lifecycle</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full p-2 text-xs rounded-md border border-border bg-background"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft (Private)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Est. Duration (hours)</label>
                <input
                  type="number"
                  min={1}
                  value={formDuration}
                  onChange={(e) => setFormDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Prerequisites (one per line)</label>
                <textarea
                  rows={2}
                  value={formPrereqs}
                  onChange={(e) => setFormPrereqs(e.target.value)}
                  placeholder="Basic Python, Linear Algebra..."
                  className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background resize-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Key Learning Objectives (one per line)</label>
              <textarea
                rows={2}
                value={formObjectives}
                onChange={(e) => setFormObjectives(e.target.value)}
                placeholder="1. Grasp fundamental algorithms\n2. Design scalable architectures"
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background resize-none"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={formSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                {formSubmitting ? "Creating..." : "Create Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT COURSE DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              Edit Course Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify course metadata, publication visibility, and target curriculum goals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3 mt-2 text-xs">
            {formError && (
              <div className="p-2.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-md">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Course Title</label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Short Summary</label>
              <input
                type="text"
                value={formShortSummary}
                onChange={(e) => setFormShortSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Description</label>
              <textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-2 text-xs rounded-md border border-border bg-background"
                >
                  {CATEGORIES.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Difficulty</label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value)}
                  className="w-full p-2 text-xs rounded-md border border-border bg-background"
                >
                  {LEVELS.filter(l => l !== "All").map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Lifecycle</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full p-2 text-xs rounded-md border border-border bg-background"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft (Private)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={formSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {formSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500 text-base font-bold">
              <ShieldAlert className="w-5 h-5" />
              Delete Course Confirmation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to permanently delete <strong className="text-foreground">"{targetCourse?.title}"</strong>? 
              Courses with enrolled students cannot be deleted without first archiving.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={formSubmitting}
              onClick={handleDeleteSubmit}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {formSubmitting ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for Curriculum Hierarchy & Knowledge Grounding Explorer
function CurriculumHierarchyView({ courseId, activeCourse }: { courseId: number; activeCourse: any }) {
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
        if (d?.tree && d.tree.length > 0) {
          const expT: Record<number, boolean> = {};
          const expSt: Record<number, boolean> = {};
          d.tree.forEach((t: any) => {
            expT[t.id] = true;
            t.subtopics?.forEach((st: any) => {
              expSt[st.id] = true;
            });
          });
          setExpandedTopics(expT);
          setExpandedSubtopics(expSt);
          const firstConcept = d.tree[0]?.subtopics?.[0]?.concepts?.[0];
          if (firstConcept) {
            setSelectedConcept(firstConcept);
          }
        }
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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
          <FolderTree className="h-8 w-8 text-primary" />
          <p className="text-sm">Loading course knowledge hierarchy...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.tree || data.tree.length === 0) {
    return (
      <Card className="border-dashed p-12 text-center bg-card/40">
        <CardTitle className="text-lg">No Course Modules Found</CardTitle>
        <CardDescription className="mt-2">
          Upload course materials or sync syllabus for {activeCourse?.title || "this course"}.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              Course Structure
            </span>
            <span className="text-xs text-muted-foreground">Authoritative Ground Truth</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight mt-1 text-foreground">
            {activeCourse?.title || "Course Knowledge Tree"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse course modules, tagged source chunks, and jump directly to the adaptive roadmap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/learning-path">
            <Button className="gap-2 shadow-sm h-9 text-xs">
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
                        Source {chunk.source_id} {chunk.loc ? `• ${chunk.loc}` : ''}
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
