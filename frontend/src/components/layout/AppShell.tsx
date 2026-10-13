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

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tutor", href: "/tutor", icon: MessageSquare },
  { name: "Practice", href: "/quiz", icon: GraduationCap },
  { name: "Learning Path", href: "/learning-path", icon: Map },
  { name: "Courses", href: "/courses", icon: BookOpen },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const [course, setCourse] = useState("1")
  const { userId, setUserId, currentUser } = useUser()

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
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Intro to Algorithms</SelectItem>
                <SelectItem value="2">Data Structures</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-[190px] bg-muted/50 border border-border" aria-label="Select Demo User">
                <div className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-medium text-xs">{currentUser?.name || "Select Student"}</span>
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                {DEMO_USERS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-medium text-xs text-foreground">{u.name}</span>
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
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
