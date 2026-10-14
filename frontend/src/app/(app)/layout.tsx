import { AppShell } from "@/components/layout/AppShell";
import { UserProvider } from "@/context/UserContext";
import { CourseProvider } from "@/context/CourseContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <CourseProvider>
        <AppShell>{children}</AppShell>
      </CourseProvider>
    </UserProvider>
  );
}
