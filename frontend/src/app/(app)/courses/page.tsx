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
  Users
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

  const teachersList = useMemo(() => {
    return users.filter(u => u.role === "teacher");
  }, [users]);

  // Fetch teacher stats if teacher
  useEffect(() => {
    if (isTeacher) {
      fetch(getApiUrl("/api/teacher/dashboard/stats"), {
        headers: { "X-User-Id": currentUser.id },
      })
        .then(res => res.json())
        .then(data => setTeacherStats(data))
        .catch(err => console.warn(err));
    }
  }, [isTeacher, currentUser.id, courses]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSearch = 
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.teacher?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === "All" || course.category === selectedCategory;
      const matchesDiff = selectedDifficulty === "All" || course.level === selectedDifficulty;

      if (activeTab === "my-courses" && isTeacher) {
        return matchesSearch && matchesCat && matchesDiff && String(course.teacher_id) === String(currentUser.id);
      }

      return matchesSearch && matchesCat && matchesDiff;
    });
  }, [courses, searchQuery, selectedCategory, selectedDifficulty, activeTab, isTeacher, currentUser.id]);

  const openCreateDialog = () => {
    setFormTitle("");
    setFormShortSummary("");
    setFormDescription("");
    setFormCategory("Computer Science");
    setFormLevel("Intermediate");
    setFormStatus("published");
    setFormDuration(10);
    setFormObjectives("Master core principles\nSolve real-world scenarios\nPass module verification");
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
    } else {
      setFormError("Failed to create course. Please try again.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCourse) return;
    if (!formTitle.trim()) {
      setFormError("Course title is required.");
      return;
    }

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
      refreshCourses();
    } else {
      setFormError("Failed to update course. Please try again.");
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
              <p className="text-2xl font-bold text-amber-400 flex items-center gap-1">
                <Star className="w-5 h-5 fill-amber-400" />
                {teacherStats.average_rating || 5.0}
              </p>
              <span className="text-[10px] text-muted-foreground">{teacherStats.total_reviews || 0} verified reviews</span>
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
              {isTeacher && (
                <TabsTrigger value="my-courses" className="text-xs font-semibold px-4 py-2 text-amber-400 data-[state=active]:text-amber-300">
                  Teacher Studio ({courses.filter(c => String(c.teacher_id) === String(currentUser.id)).length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {/* Search Box & Difficulty Filter */}
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
        </div>

        {/* Categories Chips */}
        {activeTab !== "my-learning" && (
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

      {/* MY LEARNING TAB VIEW */}
      {activeTab === "my-learning" ? (
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
                  <div className="h-1.5 w-full bg-indigo-600" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <Badge variant="outline">{item.course.category}</Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold text-indigo-400">
                        {item.course.level}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground line-clamp-1">
                      {item.course.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Instructor: <strong>{item.course.teacher.name}</strong>
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">{item.progress.progress_percentage}%</span>
                      </div>
                      <Progress value={item.progress.progress_percentage} className="h-2" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.progress.completed_lessons} of {item.progress.total_lessons} lessons completed
                    </p>
                  </CardContent>
                </div>

                <CardFooter className="pt-2 pb-4 flex items-center justify-between border-t border-border/60 bg-muted/20">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/courses/${item.course.id}`)}
                    className="text-xs"
                  >
                    Syllabus
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (item.last_lesson_id) {
                        router.push(`/courses/${item.course.id}/lessons/${item.last_lesson_id}`);
                      } else {
                        router.push(`/courses/${item.course.id}`);
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
                  >
                    Resume <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      ) : filteredCourses.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border bg-card/40">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No courses found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {searchQuery 
              ? `No courses matched your query "${searchQuery}".`
              : activeTab === "my-courses"
                ? "You haven't authored any courses yet."
                : "No courses currently available in this category."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); setSelectedDifficulty("All"); }}>
                Clear Filters
              </Button>
            )}
            {isTeacher && (
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={openCreateDialog}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Course
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isSelected = String(course.id) === selectedCourseId;
            const canManage = isTeacher && (String(course.teacher_id) === String(currentUser.id) || currentUser.role === "admin");
            const isEnrolled = course.user_enrollment?.is_enrolled;

            return (
              <Card 
                key={course.id}
                className={`group relative flex flex-col justify-between transition-all duration-200 border overflow-hidden ${
                  isSelected 
                    ? "border-indigo-500/80 bg-gradient-to-b from-indigo-950/20 to-card shadow-lg ring-1 ring-indigo-500/30" 
                    : "border-border/70 hover:border-border hover:shadow-md bg-card"
                }`}
              >
                <div>
                  <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[11px] font-medium bg-muted/40 border-border text-foreground">
                        {course.category}
                      </Badge>

                      <div className="flex items-center gap-2">
                        {course.status && course.status !== "published" && (
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400">
                            {course.status}
                          </Badge>
                        )}
                        <Badge 
                          variant="secondary" 
                          className={`text-[10px] uppercase font-bold ${
                            course.level === 'Beginner' ? 'text-emerald-400 bg-emerald-500/10' :
                            course.level === 'Intermediate' ? 'text-indigo-400 bg-indigo-500/10' :
                            'text-amber-400 bg-amber-500/10'
                          }`}
                        >
                          {course.level}
                        </Badge>
                      </div>
                    </div>

                    <CardTitle 
                      onClick={() => router.push(`/courses/${course.id}`)}
                      className="text-lg font-bold leading-snug group-hover:text-indigo-400 transition-colors line-clamp-1 cursor-pointer"
                    >
                      {course.title}
                    </CardTitle>

                    {/* Teacher Attributed Details */}
                    <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/40">
                      <div className="flex items-center gap-1.5 truncate">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-medium text-foreground truncate">
                          {course.teacher?.name || "Faculty Instructor"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{course.rating || 5.0}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pb-3">
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {course.short_summary || course.description}
                    </p>

                    {/* Meta stats */}
                    <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-muted/40 text-xs text-muted-foreground border border-border/50 text-center">
                      <div>
                        <span className="text-[10px] uppercase block">Modules</span>
                        <strong className="text-foreground">{course.stats?.modules_count || 1}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase block">Lessons</span>
                        <strong className="text-foreground">{course.stats?.lessons_count || 1}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase block">Duration</span>
                        <strong className="text-foreground">{course.estimated_duration_hours || 10}h</strong>
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Footer Actions */}
                <CardFooter className="pt-2 pb-4 flex items-center justify-between border-t border-border/60 bg-muted/20">
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/courses/${course.id}/edit`)}
                          title="Manage curriculum"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => openEditDialog(course, e)}
                          title="Edit course settings"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => openDeleteDialog(course, e)}
                          title="Delete course"
                          className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
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
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
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
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Learning Objectives (1 per line)</label>
              <textarea
                rows={2}
                value={formObjectives}
                onChange={(e) => setFormObjectives(e.target.value)}
                className="w-full p-2 text-xs rounded-md border border-border bg-background resize-none"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={formSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {formSubmitting ? "Creating..." : "Save & Continue to Builder"}
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
              Edit Course Properties
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3 mt-2 text-xs">
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
              <label className="font-semibold text-foreground">Detailed Description</label>
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
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
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
