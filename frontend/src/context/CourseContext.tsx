"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiUrl } from "@/lib/config";

export interface Course {
  id: number;
  title: string;
  description?: string;
}

interface CourseContextType {
  courseId: number;
  setCourseId: (id: number) => void;
  courses: Course[];
  activeCourse: Course | null;
  loading: boolean;
  refreshCourses: () => void;
}

const CourseContext = createContext<CourseContextType>({
  courseId: 1,
  setCourseId: () => {},
  courses: [],
  activeCourse: null,
  loading: true,
  refreshCourses: () => {},
});

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseIdState] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCourses = () => {
    setLoading(true);
    fetch(getApiUrl("/api/courses"))
      .then(res => {
        if (!res.ok) throw new Error("Failed to load courses");
        return res.json();
      })
      .then((data: Course[]) => {
        setCourses(data || []);
        if (data && data.length > 0) {
          const saved = typeof window !== "undefined" ? localStorage.getItem("learnloop_active_course_id") : null;
          const found = data.find((c: Course) => c.id.toString() === saved);
          if (found) {
            setCourseIdState(found.id);
          } else {
            setCourseIdState(data[0].id);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn("Course fetch warning:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const setCourseId = (id: number) => {
    setCourseIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("learnloop_active_course_id", id.toString());
      window.dispatchEvent(new CustomEvent("learnloop_course_changed", { detail: id }));
    }
  };

  const activeCourse = courses.find(c => c.id === courseId) || (courses.length > 0 ? courses[0] : null);

  return (
    <CourseContext.Provider value={{ courseId, setCourseId, courses, activeCourse, loading, refreshCourses: fetchCourses }}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  return useContext(CourseContext);
}
