"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { getApiUrl } from "@/lib/config";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Layers,
  FileText,
  Video,
  UploadCloud,
  CheckCircle2,
  Clock,
  Eye,
  Save,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CourseEditCurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const { currentUser, isTeacher } = useUser();

  const [course, setCourse] = useState<any>(null);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<number | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDuration, setLessonDuration] = useState(15);
  const [lessonIsPreview, setLessonIsPreview] = useState(false);

  // Edit Course Meta
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Computer Science");
  const [level, setLevel] = useState("Intermediate");
  const [status, setStatus] = useState("published");

  const [saving, setSaving] = useState(false);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [cRes, currRes] = await Promise.all([
        fetch(getApiUrl(`/api/courses/${courseId}`), {
          headers: { "X-User-Id": currentUser.id },
        }),
        fetch(getApiUrl(`/api/courses/${courseId}/curriculum`), {
          headers: { "X-User-Id": currentUser.id },
        }),
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setCourse(cData);
        setTitle(cData.title);
        setDescription(cData.description);
        setCategory(cData.category);
        setLevel(cData.level);
        setStatus(cData.status || "published");
      }
      if (currRes.ok) {
        const currData = await currRes.json();
        setCurriculum(currData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId, currentUser.id]);

  const handleSaveCourseMeta = async () => {
    setSaving(true);
    try {
      await fetch(getApiUrl(`/api/courses/${courseId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          level,
          status,
          is_published: status === "published",
        }),
      });
      fetchCourseData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/modules`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({
          title: moduleTitle,
          description: moduleDescription,
        }),
      });
      if (res.ok) {
        setModuleModalOpen(false);
        setModuleTitle("");
        setModuleDescription("");
        fetchCourseData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm("Are you sure you want to delete this module and all its lessons?")) return;
    try {
      await fetch(getApiUrl(`/api/courses/${courseId}/modules/${moduleId}`), {
        method: "DELETE",
        headers: { "X-User-Id": currentUser.id },
      });
      fetchCourseData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModuleId || !lessonTitle.trim()) return;
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/lessons`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUser.id,
        },
        body: JSON.stringify({
          module_id: targetModuleId,
          title: lessonTitle,
          description: lessonDescription,
          content_text: lessonContent,
          video_url: lessonVideoUrl,
          duration_minutes: lessonDuration,
          is_preview: lessonIsPreview,
        }),
      });
      if (res.ok) {
        setLessonModalOpen(false);
        setLessonTitle("");
        setLessonDescription("");
        setLessonContent("");
        setLessonVideoUrl("");
        fetchCourseData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;
    try {
      await fetch(getApiUrl(`/api/courses/${courseId}/lessons/${lessonId}`), {
        method: "DELETE",
        headers: { "X-User-Id": currentUser.id },
      });
      fetchCourseData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading curriculum builder...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/courses/${courseId}`)}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 -ml-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Course
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveCourseMeta}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course Settings Form (1 col) */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base font-bold">Course Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Difficulty Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Lifecycle Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background"
              >
                <option value="draft">Draft (Private)</option>
                <option value="published">Published (Public Catalogue)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Modules & Curriculum Builder (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" /> Curriculum Modules & Lessons
            </h3>
            <Button
              size="sm"
              onClick={() => setModuleModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Module
            </Button>
          </div>

          <div className="space-y-4">
            {curriculum.map((mod) => (
              <Card key={mod.id} className="border-border overflow-hidden">
                <div className="p-3.5 bg-muted/40 flex items-center justify-between border-b border-border">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-foreground">{mod.title}</span>
                    {mod.description && <p className="text-[11px] text-muted-foreground">{mod.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTargetModuleId(mod.id);
                        setLessonModalOpen(true);
                      }}
                      className="text-xs h-7 px-2"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Lesson
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteModule(mod.id)}
                      className="h-7 w-7 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  {mod.lessons?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      No lessons in this module yet. Click "+ Add Lesson".
                    </p>
                  ) : (
                    mod.lessons?.map((les: any) => (
                      <div
                        key={les.id}
                        className="p-2.5 rounded-lg border border-border/70 flex items-center justify-between bg-card text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-medium text-foreground">{les.title}</span>
                          {les.is_preview && (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400">
                              Preview
                            </Badge>
                          )}
                          {les.video_url && (
                            <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400">
                              Video
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-[11px]">{les.duration_minutes}m</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteLesson(les.id)}
                            className="h-6 w-6 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CREATE MODULE MODAL */}
      <Dialog open={moduleModalOpen} onOpenChange={setModuleModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Curriculum Module</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateModule} className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Module Title *</label>
              <input
                type="text"
                required
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="e.g. Module 2: Advanced Dynamic Programming"
                className="w-full p-2 text-xs rounded-md border border-border bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Description</label>
              <textarea
                rows={2}
                value={moduleDescription}
                onChange={(e) => setModuleDescription(e.target.value)}
                placeholder="Brief summary of topics covered in this module..."
                className="w-full p-2 text-xs rounded-md border border-border bg-background resize-none"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModuleModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Add Module
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE LESSON MODAL */}
      <Dialog open={lessonModalOpen} onOpenChange={setLessonModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Lesson to Module</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateLesson} className="space-y-3 mt-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Lesson Title *</label>
              <input
                type="text"
                required
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="e.g. Bellman-Ford Shortest Path Implementation"
                className="w-full p-2 rounded-md border border-border bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Video URL (YouTube or MP4)</label>
              <input
                type="text"
                value={lessonVideoUrl}
                onChange={(e) => setLessonVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full p-2 rounded-md border border-border bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Lesson Text / Markdown Guide</label>
              <textarea
                rows={4}
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                placeholder="Provide detailed textual explanations, code snippets, and study tips..."
                className="w-full p-2 rounded-md border border-border bg-background resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold">Duration (Minutes)</label>
                <input
                  type="number"
                  value={lessonDuration}
                  onChange={(e) => setLessonDuration(Number(e.target.value))}
                  className="w-full p-2 rounded-md border border-border bg-background"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="previewCheck"
                  checked={lessonIsPreview}
                  onChange={(e) => setLessonIsPreview(e.target.checked)}
                  className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="previewCheck" className="cursor-pointer font-medium">
                  Free Preview Lesson
                </label>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLessonModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Create Lesson
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
