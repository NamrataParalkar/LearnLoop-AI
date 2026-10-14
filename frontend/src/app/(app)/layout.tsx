import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { UserProvider } from "@/context/UserContext";
import { CourseProvider } from "@/context/CourseContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <CourseProvider>
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading LearnLoop...</div>}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </CourseProvider>
    </UserProvider>
  );
}
