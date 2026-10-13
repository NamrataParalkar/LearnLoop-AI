import { EmptyState } from "@/components/ui/empty-state"
import { BookOpen } from "lucide-react"

export default function CoursesPage() {
  return (
    <EmptyState
      icon={<BookOpen className="h-10 w-10 text-muted-foreground" />}
      title="My Courses"
      description="You haven't enrolled in any courses yet."
    />
  )
}
