import { AppShell } from "@/components/layout/AppShell";
import { UserProvider } from "@/context/UserContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
