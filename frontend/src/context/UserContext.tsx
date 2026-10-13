"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export interface DemoUser {
  id: string;
  name: string;
  subtitle: string;
  tag: string;
}

export const DEMO_USERS: DemoUser[] = [
  { id: "1", name: "Aarav Patel", subtitle: "Strong (Weak in Stratus)", tag: "Strong" },
  { id: "2", name: "Meera Sharma", subtitle: "Improving (35% → 65%)", tag: "Improving" },
  { id: "3", name: "New Student", subtitle: "No History (Diagnostic)", tag: "New" },
];

interface UserContextType {
  userId: string;
  setUserId: (id: string) => void;
  currentUser: DemoUser;
  users: DemoUser[];
}

const UserContext = createContext<UserContextType>({
  userId: "1",
  setUserId: () => {},
  currentUser: DEMO_USERS[0],
  users: DEMO_USERS,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string>("1");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("learnloop_active_user_id");
    if (saved && ["1", "2", "3"].includes(saved)) {
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

  return (
    <UserContext.Provider value={{ userId, setUserId, currentUser, users: DEMO_USERS }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
