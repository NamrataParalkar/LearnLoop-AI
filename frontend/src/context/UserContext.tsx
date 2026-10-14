"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "student" | "teacher" | "admin";

export interface DemoUser {
  id: string;
  name: string;
  subtitle: string;
  tag: string;
  role: UserRole;
  avatar?: string;
  email?: string;
}

export const DEMO_USERS: DemoUser[] = [
  // Students
  { id: "1", name: "Aarav Patel", subtitle: "Strong (Weak in Stratus)", tag: "Strong", role: "student", email: "aarav@learnloop.ai" },
  { id: "2", name: "Meera Sharma", subtitle: "Improving (35% → 65%)", tag: "Improving", role: "student", email: "meera@learnloop.ai" },
  { id: "3", name: "New Student", subtitle: "No History (Diagnostic)", tag: "New", role: "student", email: "student@learnloop.ai" },
  // Teachers
  { id: "101", name: "Prof. David Malan", subtitle: "Faculty • CS & Algorithms", tag: "Teacher", role: "teacher", email: "malan@learnloop.ai" },
  { id: "102", name: "Dr. Andrew Ng", subtitle: "Faculty • AI & Deep Learning", tag: "Teacher", role: "teacher", email: "andrew.ng@learnloop.ai" },
  { id: "103", name: "Prof. Barbara Liskov", subtitle: "Faculty • Systems Architecture", tag: "Teacher", role: "teacher", email: "liskov@learnloop.ai" },
];

interface UserContextType {
  userId: string;
  setUserId: (id: string) => void;
  currentUser: DemoUser;
  users: DemoUser[];
  isTeacher: boolean;
}

const UserContext = createContext<UserContextType>({
  userId: "1",
  setUserId: () => {},
  currentUser: DEMO_USERS[0],
  users: DEMO_USERS,
  isTeacher: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string>("1");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("learnloop_active_user_id");
    if (saved && DEMO_USERS.some(u => u.id === saved)) {
      setUserIdState(saved);
    }
  }, []);

  const setUserId = (id: string) => {
    setUserIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("learnloop_active_user_id", id);
      window.dispatchEvent(new CustomEvent("learnloop_user_changed", { detail: id }));
    }
  };

  const currentUser = DEMO_USERS.find(u => u.id === userId) || DEMO_USERS[0];
  const isTeacher = currentUser.role === "teacher";

  return (
    <UserContext.Provider value={{ userId, setUserId, currentUser, users: DEMO_USERS, isTeacher }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
