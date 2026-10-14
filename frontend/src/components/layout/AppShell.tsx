"use client"
import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  MessageSquare, 
  GraduationCap, 
  Map, 
  BookOpen, 
  Menu,
  Moon,
  Sun,
  User
} from "lucide-react"
import { useTheme } from "next-themes"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useUser, DEMO_USERS } from "@/context/UserContext"
import { useCourse } from "@/context/CourseContext"
import { Badge } from "@/components/ui/badge"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const { selectedCourseId, setSelectedCourseId, courses } = useCourse()
  const { userId, setUserId, currentUser, isTeacher } = useUser()

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Courses", href: "/courses", icon: BookOpen },
    { name: "Tutor", href: "/tutor", icon: MessageSquare },
    { name: "Practice", href: "/quiz", icon: GraduationCap },
    { name: "Learning Path", href: "/learning-path", icon: Map },
  ]

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4 py-4">
      <div className="px-6 py-2">
        <h2 className="text-xl font-bold tracking-tight text-primary">LearnLoop AI</h2>
      </div>
      <nav className="flex-1 space-y-1 px-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      {/* Mobile Header & Sidebar */}
      <div className="md:hidden flex items-center justify-between border-b bg-card p-4">
        <h2 className="text-xl font-bold text-primary">LearnLoop AI</h2>
        <Sheet>
          <SheetTrigger className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col border-r bg-card h-screen sticky top-0">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-1 items-center gap-4">
            <Select value={selectedCourseId} onValueChange={(v: string | null) => v && setSelectedCourseId(v)}>
              <SelectTrigger className="w-[230px] border-border/80 bg-muted/40 shadow-sm">
                <SelectValue placeholder="Select Course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <div className="flex flex-col text-left py-0.5 max-w-[200px]">
                      <span className="truncate font-medium text-xs text-foreground">{c.title}</span>
                      <span className="text-[10px] text-muted-foreground">{c.category} • {c.level}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-3">
            {isTeacher && (
              <Badge variant="outline" className="hidden sm:inline-flex bg-amber-500/10 text-amber-500 border-amber-500/30 text-[11px] font-semibold px-2 py-0.5">
                Instructor Mode
              </Badge>
            )}

            <Select value={userId} onValueChange={(v: string | null) => v && setUserId(v)}>
              <SelectTrigger className="w-[210px] bg-muted/50 border border-border" aria-label="Select User">
                <div className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate font-medium text-xs">{currentUser?.name || "Select User"}</span>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0 h-4 uppercase font-bold shrink-0">
                    {currentUser?.role}
                  </Badge>
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Students
                </div>
                {DEMO_USERS.filter(u => u.role === "student").map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-medium text-xs text-foreground">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground">{u.subtitle}</span>
                    </div>
                  </SelectItem>
                ))}
                
                <div className="border-t my-1" />
                <div className="px-2 py-1.5 text-[10px] font-bold text-amber-500/90 uppercase tracking-wider">
                  Teachers & Faculty
                </div>
                {DEMO_USERS.filter(u => u.role === "teacher").map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-medium text-xs text-foreground flex items-center gap-1.5">
                        {u.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{u.subtitle}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full relative")} aria-label="Toggle theme">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className={cn("flex-1 overflow-y-auto", pathname === "/tutor" ? "p-3 overflow-hidden h-[calc(100vh-4rem)]" : "p-6 md:p-8")}>
          {children}
        </main>
      </div>
    </div>
  )
}
