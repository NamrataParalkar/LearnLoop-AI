"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/config";
import { useUser } from "./UserContext";

export interface CourseTeacher {
  id: number;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
}

export interface LessonItem {
  id: number;
  module_id: number;
  title: string;
  description?: string;
  content_text?: string;
  video_url?: string;
  resource_url?: string;
  duration_minutes: number;
  display_order: number;
  is_preview: boolean;
  is_published: boolean;
  is_completed?: boolean;
}

export interface ModuleItem {
  id: number;
  title: string;
  description?: string;
  display_order: number;
  lessons: LessonItem[];
}

export interface CourseItem {
  id: number;
  title: string;
  short_summary?: string;
  description: string;
  category: string;
  level: string;
  status?: string; // draft, published, archived
  is_published: boolean;
  prerequisites?: string[];
  learning_objectives?: string[];
  thumbnail?: string;
  estimated_duration_hours?: number;
  teacher_id?: number | null;
  teacher?: CourseTeacher | null;
  rating?: number;
  reviews_count?: number;
  created_at?: string;
  updated_at?: string;
  curriculum?: ModuleItem[];
  stats?: {
    sources_count: number;
    topics_count: number;
    modules_count?: number;
    lessons_count?: number;
    enrollments_count?: number;
    progress_percentage?: number;
  };
  user_enrollment?: {
    is_enrolled: boolean;
    enrollment_id?: number;
    completed_lessons?: number;
    progress_percentage?: number;
  };
}

// Backward compatibility alias
export type Course = CourseItem;

export interface MyLearningItem {
  enrollment_id: number;
  status: string;
  enrolled_at: string;
  last_accessed_at?: string;
  completed_at?: string;
  last_lesson_id?: number;
  course: {
    id: number;
    title: string;
    short_summary?: string;
    category: string;
    level: string;
    teacher: {
      id?: number;
      name: string;
    };
  };
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percentage: number;
    is_completed: boolean;
  };
}

interface CourseContextType {
  // Legacy / convenience properties
  courseId: number;
  setCourseId: (id: number) => void;
  activeCourse: CourseItem | null;

  // Rich course ecosystem properties
  courses: CourseItem[];
  myLearning: MyLearningItem[];
  selectedCourseId: string;
  selectedCourse: CourseItem | null;
  setSelectedCourseId: (id: string) => void;
  loading: boolean;
  refreshCourses: () => Promise<void>;
  refreshMyLearning: () => Promise<void>;
  createCourse: (data: Partial<CourseItem>) => Promise<CourseItem | null>;
  updateCourse: (id: number, data: Partial<CourseItem>) => Promise<CourseItem | null>;
  deleteCourse: (id: number) => Promise<boolean>;
  enrollCourse: (courseId: number) => Promise<boolean>;
  unenrollCourse: (courseId: number) => Promise<boolean>;
  toggleLessonCompletion: (courseId: number, lessonId: number) => Promise<any>;
}

const CourseContext = createContext<CourseContextType>({
  courseId: 1,
  setCourseId: () => {},
  activeCourse: null,
  courses: [],
  myLearning: [],
  selectedCourseId: "1",
  selectedCourse: null,
  setSelectedCourseId: () => {},
  loading: false,
  refreshCourses: async () => {},
  refreshMyLearning: async () => {},
  createCourse: async () => null,
  updateCourse: async () => null,
  deleteCourse: async () => false,
  enrollCourse: async () => false,
  unenrollCourse: async () => false,
  toggleLessonCompletion: async () => null,
});

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [myLearning, setMyLearning] = useState<MyLearningItem[]>([]);
  const [selectedCourseId, setSelectedCourseIdState] = useState<string>("1");
  const [loading, setLoading] = useState(false);

  const getHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      "X-User-Id": userId || "1",
    };
  }, [userId]);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl("/api/courses"), {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || (Array.isArray(data) ? data : []);
        setCourses(items);
        if (items.length > 0) {
          setSelectedCourseIdState(prev => {
            if (items.some((c: CourseItem) => String(c.id) === prev)) {
              return prev;
            }
            return String(items[0].id);
          });
        }
      }
    } catch (err) {
      console.warn("Course fetch warning:", err);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const fetchMyLearning = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/my-learning"), {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMyLearning(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("MyLearning fetch error:", err);
    }
  }, [getHeaders]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("learnloop_active_course_id") : null;
    if (saved) {
      setSelectedCourseIdState(saved);
    }
    fetchCourses();
    fetchMyLearning();
  }, [fetchCourses, fetchMyLearning]);

  const setSelectedCourseId = (id: string) => {
    setSelectedCourseIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("learnloop_active_course_id", id);
      window.dispatchEvent(new CustomEvent("learnloop_course_changed", { detail: id }));
    }
  };

  const setCourseId = (id: number) => {
    setSelectedCourseId(id.toString());
  };

  const createCourse = async (payload: Partial<CourseItem>) => {
    try {
      const res = await fetch(getApiUrl("/api/courses"), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newCourse = await res.json();
        setCourses(prev => [newCourse, ...prev]);
        setSelectedCourseId(String(newCourse.id));
        return newCourse;
      }
    } catch (err) {
      console.error("Create course failed:", err);
    }
    return null;
  };

  const updateCourse = async (id: number, payload: Partial<CourseItem>) => {
    try {
      const res = await fetch(getApiUrl(`/api/courses/${id}`), {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setCourses(prev => prev.map(c => c.id === id ? updated : c));
        return updated;
      }
    } catch (err) {
      console.error("Update course failed:", err);
    }
    return null;
  };

  const deleteCourse = async (id: number) => {
    try {
      const res = await fetch(getApiUrl(`/api/courses/${id}`), {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        setCourses(prev => {
          const filtered = prev.filter(c => c.id !== id);
          if (String(id) === selectedCourseId && filtered.length > 0) {
            setSelectedCourseId(String(filtered[0].id));
          }
          return filtered;
        });
        return true;
      }
    } catch (err) {
      console.error("Delete course failed:", err);
    }
    return false;
  };

  const enrollCourse = async (courseId: number) => {
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/enroll`), {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.ok) {
        await fetchCourses();
        await fetchMyLearning();
        return true;
      }
    } catch (err) {
      console.error("Enrollment failed:", err);
    }
    return false;
  };

  const unenrollCourse = async (courseId: number) => {
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/enroll`), {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        await fetchCourses();
        await fetchMyLearning();
        return true;
      }
    } catch (err) {
      console.error("Unenrollment failed:", err);
    }
    return false;
  };

  const toggleLessonCompletion = async (courseId: number, lessonId: number) => {
    try {
      const res = await fetch(getApiUrl(`/api/courses/${courseId}/lessons/${lessonId}/complete`), {
        method: "POST",
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMyLearning();
        return data;
      }
    } catch (err) {
      console.error("Toggle completion error:", err);
    }
    return null;
  };

  const selectedCourse = courses.find(c => String(c.id) === selectedCourseId) || courses[0] || null;
  const courseId = parseInt(selectedCourseId, 10) || 1;

  return (
    <CourseContext.Provider
      value={{
        courseId,
        setCourseId,
        activeCourse: selectedCourse,
        courses,
        myLearning,
        selectedCourseId,
        selectedCourse,
        setSelectedCourseId,
        loading,
        refreshCourses: fetchCourses,
        refreshMyLearning: fetchMyLearning,
        createCourse,
        updateCourse,
        deleteCourse,
        enrollCourse,
        unenrollCourse,
        toggleLessonCompletion,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  return useContext(CourseContext);
}
