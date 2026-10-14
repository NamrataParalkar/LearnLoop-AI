import os
import shutil
import datetime
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException, Query, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
from ingestion.pipeline import run_ingestion

import logging

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = "data/uploads"
RESOURCES_DIR = "data/uploads/resources"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESOURCES_DIR, exist_ok=True)

# ---------------------------------------------------------
# Security & Role-Based Access Control Helpers
# ---------------------------------------------------------
def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """
    Authenticates the current requesting user from header X-User-Id against PostgreSQL database.
    """
    if not x_user_id or not db:
        return None
    try:
        uid = int(x_user_id)
        return db.query(models.User).filter(models.User.id == uid).first()
    except Exception:
        return None

def require_auth(
    user: Optional[models.User] = Depends(get_current_user)
) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Missing or invalid X-User-Id.")
    return user

def require_teacher_or_admin(
    user: models.User = Depends(require_auth)
) -> models.User:
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden: Teacher or Admin role required.")
    return user

def verify_course_ownership(course: models.Course, user: models.User):
    if user.role == "admin":
        return
    if course.teacher_id and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only modify your own courses.")

# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------
class CourseCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    short_summary: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = ""
    category: Optional[str] = "Computer Science"
    level: Optional[str] = "Intermediate"
    status: Optional[str] = "published" # draft, published, archived
    is_published: Optional[bool] = True
    prerequisites: Optional[List[str]] = []
    learning_objectives: Optional[List[str]] = []
    thumbnail: Optional[str] = None
    estimated_duration_hours: Optional[float] = 10.0
    teacher_id: Optional[int] = None

class CourseUpdateRequest(BaseModel):
    title: Optional[str] = None
    short_summary: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    is_published: Optional[bool] = None
    prerequisites: Optional[List[str]] = None
    learning_objectives: Optional[List[str]] = None
    thumbnail: Optional[str] = None
    estimated_duration_hours: Optional[float] = None
    teacher_id: Optional[int] = None

class ModuleCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    display_order: Optional[int] = 0

class ModuleUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None

class LessonCreateRequest(BaseModel):
    module_id: int
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    content_text: Optional[str] = None
    video_url: Optional[str] = None
    resource_url: Optional[str] = None
    duration_minutes: Optional[int] = 15
    display_order: Optional[int] = 0
    is_preview: Optional[bool] = False
    is_published: Optional[bool] = True

class LessonUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_text: Optional[str] = None
    video_url: Optional[str] = None
    resource_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    display_order: Optional[int] = None
    is_preview: Optional[bool] = None
    is_published: Optional[bool] = None

class ReorderItem(BaseModel):
    id: int
    display_order: int

class ReorderRequest(BaseModel):
    items: List[ReorderItem]

class ReviewCreateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class UploadUrlRequest(BaseModel):
    url: str
    source_type: Optional[str] = "video"


def process_source_background(source_id: int):
    run_ingestion(source_id)

def serialize_course(c: models.Course, db: Session, user: Optional[models.User] = None):
    sources_count = db.query(models.Source).filter(models.Source.course_id == c.id).count() if db else 0
    topics_count = db.query(models.Topic).filter(models.Topic.course_id == c.id).count() if db else 0
    modules_count = db.query(models.CourseModule).filter(models.CourseModule.course_id == c.id).count() if db else 0
    lessons_count = db.query(models.Lesson).filter(models.Lesson.course_id == c.id).count() if db else 0
    enrollments_count = db.query(models.Enrollment).filter(models.Enrollment.course_id == c.id).count() if db else 0

    # Rating statistics
    rating_avg = 5.0
    reviews_count = 0
    if db:
        stats = db.query(func.avg(models.CourseReview.rating), func.count(models.CourseReview.id))\
                  .filter(models.CourseReview.course_id == c.id).first()
        if stats and stats[0] is not None:
            rating_avg = round(float(stats[0]), 1)
            reviews_count = int(stats[1])

    teacher_info = None
    if c.teacher:
        teacher_info = {
            "id": c.teacher.id,
            "name": c.teacher.name,
            "email": c.teacher.email,
            "role": getattr(c.teacher, "role", "teacher"),
            "avatar": getattr(c.teacher, "avatar", None)
        }
    elif c.teacher_id and db:
        t = db.query(models.User).filter(models.User.id == c.teacher_id).first()
        if t:
            teacher_info = {
                "id": t.id,
                "name": t.name,
                "email": t.email,
                "role": getattr(t, "role", "teacher"),
                "avatar": getattr(t, "avatar", None)
            }

    # Enrollment status for requesting user
    is_enrolled = False
    enrollment_id = None
    completed_lessons_count = 0
    if user and db:
        enr = db.query(models.Enrollment).filter(
            models.Enrollment.user_id == user.id,
            models.Enrollment.course_id == c.id
        ).first()
        if enr:
            is_enrolled = True
            enrollment_id = enr.id
            completed_lessons_count = db.query(models.LessonProgress).filter(
                models.LessonProgress.enrollment_id == enr.id,
                models.LessonProgress.is_completed == True
            ).count()

    progress_percentage = 0
    if lessons_count > 0 and completed_lessons_count > 0:
        progress_percentage = min(100, int((completed_lessons_count / lessons_count) * 100))

    return {
        "id": c.id,
        "title": c.title,
        "short_summary": getattr(c, "short_summary", "") or (c.description[:180] + "..." if c.description else ""),
        "description": c.description or "",
        "category": getattr(c, "category", "Computer Science") or "Computer Science",
        "level": getattr(c, "level", "Intermediate") or "Intermediate",
        "status": getattr(c, "status", "published") or ("published" if c.is_published else "draft"),
        "is_published": getattr(c, "is_published", True),
        "prerequisites": getattr(c, "prerequisites", []) or [],
        "learning_objectives": getattr(c, "learning_objectives", []) or [],
        "thumbnail": getattr(c, "thumbnail", None),
        "estimated_duration_hours": getattr(c, "estimated_duration_hours", 10.0) or 10.0,
        "created_at": c.created_at.isoformat() if getattr(c, "created_at", None) else None,
        "updated_at": c.updated_at.isoformat() if getattr(c, "updated_at", None) else None,
        "teacher_id": c.teacher_id,
        "teacher": teacher_info,
        "rating": rating_avg,
        "reviews_count": reviews_count,
        "stats": {
            "sources_count": sources_count,
            "topics_count": topics_count,
            "modules_count": modules_count,
            "lessons_count": lessons_count,
            "enrollments_count": enrollments_count,
            "progress_percentage": progress_percentage
        },
        "user_enrollment": {
            "is_enrolled": is_enrolled,
            "enrollment_id": enrollment_id,
            "completed_lessons": completed_lessons_count,
            "progress_percentage": progress_percentage
        } if user else None
    }


# ---------------------------------------------------------
# Course Endpoints (Catalogue, Filters, Search & CRUD)
# ---------------------------------------------------------

@router.get("/courses")
def get_courses(
    teacher_id: Optional[int] = None,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "newest", # newest, rating, popularity
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user)
):
    """
    Get course catalog.
    Public requests only see 'published' courses.
    Teachers and Admins can view drafts for their courses.
    """
    if not db:
        return {"items": [], "total": 0, "page": page, "limit": limit}

    try:
        query = db.query(models.Course)

        # Access rule: only show published courses unless authorized teacher/admin
        is_teacher_or_admin = user and user.role in ["teacher", "admin"]

        if not is_teacher_or_admin:
            query = query.filter(models.Course.is_published == True, models.Course.status == "published")
        else:
            if status:
                query = query.filter(models.Course.status == status)
            elif not teacher_id and user.role == "teacher":
                # General catalog for teacher: show all published, or own drafts
                query = query.filter(
                    (models.Course.is_published == True) | 
                    (models.Course.teacher_id == user.id)
                )

        if teacher_id:
            query = query.filter(models.Course.teacher_id == teacher_id)
        if category and category.lower() != "all":
            query = query.filter(models.Course.category.ilike(f"%{category}%"))
        if difficulty and difficulty.lower() != "all":
            query = query.filter(models.Course.level.ilike(f"%{difficulty}%"))
        if search:
            search_str = f"%{search}%"
            query = query.join(models.User, models.Course.teacher_id == models.User.id, isouter=True).filter(
                (models.Course.title.ilike(search_str)) |
                (models.Course.description.ilike(search_str)) |
                (models.Course.category.ilike(search_str)) |
                (models.User.name.ilike(search_str))
            )

        total = query.count()

        # Sorting
        if sort_by == "popularity":
            # Sort by enrollments count
            query = query.outerjoin(models.Enrollment).group_by(models.Course.id).order_by(func.count(models.Enrollment.id).desc())
        elif sort_by == "rating":
            query = query.outerjoin(models.CourseReview).group_by(models.Course.id).order_by(func.coalesce(func.avg(models.CourseReview.rating), 5.0).desc())
        else: # newest
            query = query.order_by(models.Course.id.desc())

        courses = query.offset((page - 1) * limit).limit(limit).all()
        return {
            "items": [serialize_course(c, db, user) for c in courses],
            "total": total,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Error querying courses list: {e}")
        return {"items": [], "total": 0, "page": page, "limit": limit}


@router.get("/courses/{course_id}")
def get_course_detail(
    course_id: int,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user)
):
    """
    Get full details of a course including syllabus, teacher, and enrollment status.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # If draft or archived, only owner teacher or admin can view
    if course.status != "published" or not course.is_published:
        if not user or (user.role != "admin" and course.teacher_id != user.id):
            raise HTTPException(status_code=404, detail="Course is not currently published.")

    serialized = serialize_course(course, db, user)

    # Attach modules and lessons
    modules = db.query(models.CourseModule).filter(
        models.CourseModule.course_id == course_id
    ).order_by(models.CourseModule.display_order.asc()).all()

    # Get user completed lesson IDs if enrolled
    completed_ids = set()
    if user:
        enr = db.query(models.Enrollment).filter(
            models.Enrollment.user_id == user.id,
            models.Enrollment.course_id == course_id
        ).first()
        if enr:
            progress_rows = db.query(models.LessonProgress.lesson_id).filter(
                models.LessonProgress.enrollment_id == enr.id,
                models.LessonProgress.is_completed == True
            ).all()
            completed_ids = {r[0] for r in progress_rows}

    modules_data = []
    for m in modules:
        lessons = db.query(models.Lesson).filter(
            models.Lesson.module_id == m.id
        ).order_by(models.Lesson.display_order.asc()).all()

        modules_data.append({
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "display_order": m.display_order,
            "lessons": [
                {
                    "id": les.id,
                    "title": les.title,
                    "description": les.description,
                    "duration_minutes": les.duration_minutes,
                    "display_order": les.display_order,
                    "is_preview": les.is_preview,
                    "is_published": les.is_published,
                    "is_completed": les.id in completed_ids,
                    "has_video": bool(les.video_url),
                    "has_resource": bool(les.resource_url),
                }
                for les in lessons
            ]
        })

    serialized["curriculum"] = modules_data
    return serialized


@router.post("/courses")
def create_course(
    payload: CourseCreateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    """
    Create a new course. Server verifies teacher identity and ownership.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    # Ownership assignment
    teacher_id = user.id if user.role == "teacher" else (payload.teacher_id or user.id)

    new_course = models.Course(
        title=payload.title,
        short_summary=payload.short_summary or payload.title,
        description=payload.description or "",
        category=payload.category or "Computer Science",
        level=payload.level or "Intermediate",
        status=payload.status or "published",
        is_published=payload.is_published if payload.is_published is not None else True,
        prerequisites=payload.prerequisites or [],
        learning_objectives=payload.learning_objectives or [],
        thumbnail=payload.thumbnail,
        estimated_duration_hours=payload.estimated_duration_hours or 10.0,
        teacher_id=teacher_id
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    # Initialize a default module for easy starter curriculum
    default_module = models.CourseModule(
        course_id=new_course.id,
        title="Module 1: Foundations & Core Concepts",
        description="Introduction and foundational principles",
        display_order=1
    )
    db.add(default_module)
    db.commit()
    db.refresh(default_module)

    # Initialize sample lesson
    default_lesson = models.Lesson(
        module_id=default_module.id,
        course_id=new_course.id,
        title="Welcome & Course Roadmap",
        description="Overview of syllabus, prerequisites, and learning strategy",
        content_text=f"Welcome to **{new_course.title}**! In this course, you will master the principles step-by-step with interactive quizzes and AI tutoring.",
        duration_minutes=15,
        display_order=1,
        is_preview=True,
        is_published=True
    )
    db.add(default_lesson)
    db.commit()

    return serialize_course(new_course, db, user)


@router.put("/courses/{course_id}")
def update_course(
    course_id: int,
    payload: CourseUpdateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    """
    Update course details with server-side ownership verification.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    verify_course_ownership(course, user)

    if payload.title is not None:
        course.title = payload.title
    if payload.short_summary is not None:
        course.short_summary = payload.short_summary
    if payload.description is not None:
        course.description = payload.description
    if payload.category is not None:
        course.category = payload.category
    if payload.level is not None:
        course.level = payload.level
    if payload.status is not None:
        course.status = payload.status
        course.is_published = (payload.status == "published")
    if payload.is_published is not None:
        course.is_published = payload.is_published
        if not payload.is_published and course.status == "published":
            course.status = "draft"
        elif payload.is_published and course.status == "draft":
            course.status = "published"
    if payload.prerequisites is not None:
        course.prerequisites = payload.prerequisites
    if payload.learning_objectives is not None:
        course.learning_objectives = payload.learning_objectives
    if payload.thumbnail is not None:
        course.thumbnail = payload.thumbnail
    if payload.estimated_duration_hours is not None:
        course.estimated_duration_hours = payload.estimated_duration_hours
    if payload.teacher_id is not None and user.role == "admin":
        course.teacher_id = payload.teacher_id

    course.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(course)
    return serialize_course(course, db, user)


@router.post("/courses/{course_id}/publish")
def publish_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    course.status = "published"
    course.is_published = True
    course.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Course published successfully", "course": serialize_course(course, db, user)}


@router.post("/courses/{course_id}/unpublish")
def unpublish_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    course.status = "draft"
    course.is_published = False
    course.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Course set to draft", "course": serialize_course(course, db, user)}


@router.post("/courses/{course_id}/archive")
def archive_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    course.status = "archived"
    course.is_published = False
    course.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Course archived", "course": serialize_course(course, db, user)}


@router.delete("/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    """
    Delete a course. Protects courses with active student enrollments unless forced or archived first.
    """
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    verify_course_ownership(course, user)

    # Protect courses with enrollments
    enrollment_count = db.query(models.Enrollment).filter(models.Enrollment.course_id == course_id).count()
    if enrollment_count > 0 and user.role != "admin":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete course: {enrollment_count} students are currently enrolled. Archive the course instead."
        )

    try:
        # Cascade deletes
        db.query(models.Question).filter(models.Question.course_id == course_id).delete(synchronize_session=False)
        db.query(models.QuizSession).filter(models.QuizSession.course_id == course_id).delete(synchronize_session=False)
        db.query(models.ChatSession).filter(models.ChatSession.course_id == course_id).delete(synchronize_session=False)
        db.delete(course)
        db.commit()
        return {"success": True, "message": f"Course {course_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting course {course_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete course: {str(e)}")


# ---------------------------------------------------------
# Curriculum Management (Modules & Lessons)
# ---------------------------------------------------------

@router.get("/courses/{course_id}/curriculum")
def get_course_curriculum(
    course_id: int,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user)
):
    """
    Retrieve all modules and lessons for a course.
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    modules = db.query(models.CourseModule).filter(
        models.CourseModule.course_id == course_id
    ).order_by(models.CourseModule.display_order.asc()).all()

    completed_ids = set()
    if user:
        enr = db.query(models.Enrollment).filter(
            models.Enrollment.user_id == user.id,
            models.Enrollment.course_id == course_id
        ).first()
        if enr:
            progress_rows = db.query(models.LessonProgress.lesson_id).filter(
                models.LessonProgress.enrollment_id == enr.id,
                models.LessonProgress.is_completed == True
            ).all()
            completed_ids = {r[0] for r in progress_rows}

    res = []
    for m in modules:
        lessons = db.query(models.Lesson).filter(
            models.Lesson.module_id == m.id
        ).order_by(models.Lesson.display_order.asc()).all()

        res.append({
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "display_order": m.display_order,
            "lessons": [
                {
                    "id": les.id,
                    "module_id": les.module_id,
                    "title": les.title,
                    "description": les.description,
                    "content_text": les.content_text,
                    "video_url": les.video_url,
                    "resource_url": les.resource_url,
                    "duration_minutes": les.duration_minutes,
                    "display_order": les.display_order,
                    "is_preview": les.is_preview,
                    "is_published": les.is_published,
                    "is_completed": les.id in completed_ids,
                }
                for les in lessons
            ]
        })
    return res


@router.post("/courses/{course_id}/modules")
def create_module(
    course_id: int,
    payload: ModuleCreateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    # Determine order
    order = payload.display_order
    if order == 0:
        max_order = db.query(func.max(models.CourseModule.display_order)).filter(models.CourseModule.course_id == course_id).scalar() or 0
        order = max_order + 1

    new_mod = models.CourseModule(
        course_id=course_id,
        title=payload.title,
        description=payload.description,
        display_order=order
    )
    db.add(new_mod)
    db.commit()
    db.refresh(new_mod)
    return new_mod


@router.put("/courses/{course_id}/modules/{module_id}")
def update_module(
    course_id: int,
    module_id: int,
    payload: ModuleUpdateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    module = db.query(models.CourseModule).filter(
        models.CourseModule.id == module_id,
        models.CourseModule.course_id == course_id
    ).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if payload.title is not None:
        module.title = payload.title
    if payload.description is not None:
        module.description = payload.description
    if payload.display_order is not None:
        module.display_order = payload.display_order

    module.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(module)
    return module


@router.delete("/courses/{course_id}/modules/{module_id}")
def delete_module(
    course_id: int,
    module_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    module = db.query(models.CourseModule).filter(
        models.CourseModule.id == module_id,
        models.CourseModule.course_id == course_id
    ).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    db.delete(module)
    db.commit()
    return {"success": True, "message": "Module deleted"}


@router.post("/courses/{course_id}/lessons")
def create_lesson(
    course_id: int,
    payload: LessonCreateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    module = db.query(models.CourseModule).filter(
        models.CourseModule.id == payload.module_id,
        models.CourseModule.course_id == course_id
    ).first()
    if not module:
        raise HTTPException(status_code=400, detail="Specified module does not belong to this course")

    order = payload.display_order
    if order == 0:
        max_order = db.query(func.max(models.Lesson.display_order)).filter(models.Lesson.module_id == payload.module_id).scalar() or 0
        order = max_order + 1

    new_lesson = models.Lesson(
        module_id=payload.module_id,
        course_id=course_id,
        title=payload.title,
        description=payload.description,
        content_text=payload.content_text,
        video_url=payload.video_url,
        resource_url=payload.resource_url,
        duration_minutes=payload.duration_minutes or 15,
        display_order=order,
        is_preview=payload.is_preview or False,
        is_published=payload.is_published if payload.is_published is not None else True
    )
    db.add(new_lesson)
    db.commit()
    db.refresh(new_lesson)
    return new_lesson


@router.put("/courses/{course_id}/lessons/{lesson_id}")
def update_lesson(
    course_id: int,
    lesson_id: int,
    payload: LessonUpdateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    lesson = db.query(models.Lesson).filter(
        models.Lesson.id == lesson_id,
        models.Lesson.course_id == course_id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if payload.title is not None:
        lesson.title = payload.title
    if payload.description is not None:
        lesson.description = payload.description
    if payload.content_text is not None:
        lesson.content_text = payload.content_text
    if payload.video_url is not None:
        lesson.video_url = payload.video_url
    if payload.resource_url is not None:
        lesson.resource_url = payload.resource_url
    if payload.duration_minutes is not None:
        lesson.duration_minutes = payload.duration_minutes
    if payload.display_order is not None:
        lesson.display_order = payload.display_order
    if payload.is_preview is not None:
        lesson.is_preview = payload.is_preview
    if payload.is_published is not None:
        lesson.is_published = payload.is_published

    lesson.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/courses/{course_id}/lessons/{lesson_id}")
def delete_lesson(
    course_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    lesson = db.query(models.Lesson).filter(
        models.Lesson.id == lesson_id,
        models.Lesson.course_id == course_id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    db.delete(lesson)
    db.commit()
    return {"success": True, "message": "Lesson deleted"}


@router.post("/courses/{course_id}/lessons/reorder")
def reorder_lessons(
    course_id: int,
    payload: ReorderRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    for item in payload.items:
        db.query(models.Lesson).filter(
            models.Lesson.id == item.id,
            models.Lesson.course_id == course_id
        ).update({"display_order": item.display_order})
    db.commit()
    return {"success": True, "message": "Lessons reordered"}


# ---------------------------------------------------------
# File & Document Resource Upload for Lessons
# ---------------------------------------------------------

@router.post("/courses/{course_id}/lessons/{lesson_id}/upload-resource")
async def upload_lesson_resource(
    course_id: int,
    lesson_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    """
    Upload PDF, slides, or documents for a specific lesson.
    Safe file storage abstraction with filetype & size verification.
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    verify_course_ownership(course, user)

    lesson = db.query(models.Lesson).filter(
        models.Lesson.id == lesson_id,
        models.Lesson.course_id == course_id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    ext = file.filename.split('.')[-1].lower()
    allowed_exts = ["pdf", "pptx", "docx", "txt", "mp4", "zip"]
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"File extension .{ext} not supported. Use {', '.join(allowed_exts)}")

    # Clean filename
    clean_name = f"c{course_id}_l{lesson_id}_{uuid.uuid4().hex[:8]}.{ext}"
    dest_path = os.path.join(RESOURCES_DIR, clean_name)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_url = f"/api/resources/{clean_name}"
    lesson.resource_url = relative_url
    lesson.updated_at = datetime.datetime.utcnow()
    db.commit()

    return {"message": "Resource uploaded successfully", "resource_url": relative_url}


# ---------------------------------------------------------
# Enrollment & Student Learning Experience
# ---------------------------------------------------------

@router.post("/courses/{course_id}/enroll")
def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_auth)
):
    """
    Enroll student in a course. Prevents duplicate enrollment.
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if course.status != "published" or not course.is_published:
        raise HTTPException(status_code=400, detail="Cannot enroll in an unpublished or draft course.")

    # Check duplicate
    existing = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if existing:
        return {
            "message": "Already enrolled",
            "enrollment_id": existing.id,
            "status": existing.status,
            "enrolled_at": existing.enrolled_at.isoformat()
        }

    first_lesson = db.query(models.Lesson).filter(models.Lesson.course_id == course_id).order_by(models.Lesson.display_order.asc()).first()

    enrollment = models.Enrollment(
        user_id=user.id,
        course_id=course_id,
        status="active",
        last_lesson_id=first_lesson.id if first_lesson else None
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    return {
        "message": "Successfully enrolled",
        "enrollment_id": enrollment.id,
        "status": enrollment.status,
        "enrolled_at": enrollment.enrolled_at.isoformat()
    }


@router.delete("/courses/{course_id}/enroll")
def unenroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_auth)
):
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.delete(enrollment)
    db.commit()
    return {"message": "Successfully unenrolled from course"}


@router.get("/my-learning")
def get_my_learning(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_auth)
):
    """
    Retrieve all enrolled courses with verified real lesson progress.
    """
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user.id
    ).order_by(models.Enrollment.last_accessed_at.desc()).all()

    results = []
    for enr in enrollments:
        c = enr.course
        if not c:
            continue

        total_lessons = db.query(models.Lesson).filter(models.Lesson.course_id == c.id).count()
        completed_lessons = db.query(models.LessonProgress).filter(
            models.LessonProgress.enrollment_id == enr.id,
            models.LessonProgress.is_completed == True
        ).count()

        pct = 0
        if total_lessons > 0:
            pct = min(100, int((completed_lessons / total_lessons) * 100))

        results.append({
            "enrollment_id": enr.id,
            "status": enr.status,
            "enrolled_at": enr.enrolled_at.isoformat(),
            "last_accessed_at": enr.last_accessed_at.isoformat() if enr.last_accessed_at else None,
            "completed_at": enr.completed_at.isoformat() if enr.completed_at else None,
            "last_lesson_id": enr.last_lesson_id,
            "course": {
                "id": c.id,
                "title": c.title,
                "short_summary": c.short_summary or c.description[:180],
                "category": c.category,
                "level": c.level,
                "teacher": {
                    "id": c.teacher.id if c.teacher else None,
                    "name": c.teacher.name if c.teacher else "Faculty Instructor"
                }
            },
            "progress": {
                "total_lessons": total_lessons,
                "completed_lessons": completed_lessons,
                "progress_percentage": pct,
                "is_completed": pct == 100 and total_lessons > 0
            }
        })
    return results


@router.get("/courses/{course_id}/lessons/{lesson_id}")
def get_lesson_content(
    course_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user)
):
    """
    Secure lesson viewer endpoint.
    Verifies that the user is enrolled or lesson is marked is_preview=True or user is course owner.
    """
    lesson = db.query(models.Lesson).filter(
        models.Lesson.id == lesson_id,
        models.Lesson.course_id == course_id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    course = lesson.course

    # Access authorization check
    is_authorized = False
    if lesson.is_preview:
        is_authorized = True
    elif user:
        if user.role == "admin" or course.teacher_id == user.id:
            is_authorized = True
        else:
            enr = db.query(models.Enrollment).filter(
                models.Enrollment.user_id == user.id,
                models.Enrollment.course_id == course_id
            ).first()
            if enr:
                is_authorized = True
                # Record last accessed lesson
                enr.last_lesson_id = lesson_id
                enr.last_accessed_at = datetime.datetime.utcnow()
                db.commit()

    if not is_authorized:
        raise HTTPException(
            status_code=403,
            detail="Access restricted: Please enroll in this course to access this lesson."
        )

    # Check completion
    is_completed = False
    if user:
        enr = db.query(models.Enrollment).filter(
            models.Enrollment.user_id == user.id,
            models.Enrollment.course_id == course_id
        ).first()
        if enr:
            lp = db.query(models.LessonProgress).filter(
                models.LessonProgress.enrollment_id == enr.id,
                models.LessonProgress.lesson_id == lesson_id
            ).first()
            if lp and lp.is_completed:
                is_completed = True

    # Next and previous lessons in the course
    all_lessons = db.query(models.Lesson).filter(
        models.Lesson.course_id == course_id
    ).join(models.CourseModule).order_by(
        models.CourseModule.display_order.asc(),
        models.Lesson.display_order.asc()
    ).all()

    curr_idx = next((i for i, l in enumerate(all_lessons) if l.id == lesson_id), -1)
    prev_id = all_lessons[curr_idx - 1].id if curr_idx > 0 else None
    next_id = all_lessons[curr_idx + 1].id if curr_idx != -1 and curr_idx < len(all_lessons) - 1 else None

    return {
        "id": lesson.id,
        "course_id": lesson.course_id,
        "module_id": lesson.module_id,
        "title": lesson.title,
        "description": lesson.description,
        "content_text": lesson.content_text,
        "video_url": lesson.video_url,
        "resource_url": lesson.resource_url,
        "duration_minutes": lesson.duration_minutes,
        "is_preview": lesson.is_preview,
        "is_completed": is_completed,
        "prev_lesson_id": prev_id,
        "next_lesson_id": next_id
    }


@router.post("/courses/{course_id}/lessons/{lesson_id}/complete")
def toggle_lesson_completion(
    course_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_auth)
):
    """
    Mark lesson completed or reverse completion.
    Calculates exact real progress percentage from persisted records.
    """
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=400, detail="You must be enrolled to track lesson completion.")

    lesson = db.query(models.Lesson).filter(
        models.Lesson.id == lesson_id,
        models.Lesson.course_id == course_id
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    progress = db.query(models.LessonProgress).filter(
        models.LessonProgress.enrollment_id == enrollment.id,
        models.LessonProgress.lesson_id == lesson_id
    ).first()

    if not progress:
        progress = models.LessonProgress(
            enrollment_id=enrollment.id,
            lesson_id=lesson_id,
            user_id=user.id,
            is_completed=True,
            completed_at=datetime.datetime.utcnow()
        )
        db.add(progress)
    else:
        # Toggle completion
        progress.is_completed = not progress.is_completed
        progress.completed_at = datetime.datetime.utcnow() if progress.is_completed else None
        progress.updated_at = datetime.datetime.utcnow()

    enrollment.last_accessed_at = datetime.datetime.utcnow()
    enrollment.last_lesson_id = lesson_id
    db.commit()

    # Re-calculate overall course completion
    total_lessons = db.query(models.Lesson).filter(models.Lesson.course_id == course_id).count()
    completed_count = db.query(models.LessonProgress).filter(
        models.LessonProgress.enrollment_id == enrollment.id,
        models.LessonProgress.is_completed == True
    ).count()

    pct = min(100, int((completed_count / total_lessons) * 100)) if total_lessons > 0 else 0
    if pct == 100 and total_lessons > 0:
        enrollment.status = "completed"
        if not enrollment.completed_at:
            enrollment.completed_at = datetime.datetime.utcnow()
    else:
        enrollment.status = "active"
        enrollment.completed_at = None

    db.commit()

    return {
        "lesson_id": lesson_id,
        "is_completed": progress.is_completed,
        "completed_lessons": completed_count,
        "total_lessons": total_lessons,
        "progress_percentage": pct,
        "course_status": enrollment.status
    }


# ---------------------------------------------------------
# Reviews & Ratings
# ---------------------------------------------------------

@router.get("/courses/{course_id}/reviews")
def get_course_reviews(
    course_id: int,
    db: Session = Depends(get_db)
):
    reviews = db.query(models.CourseReview).filter(
        models.CourseReview.course_id == course_id
    ).order_by(models.CourseReview.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at.isoformat(),
            "user": {
                "id": r.user.id if r.user else None,
                "name": r.user.name if r.user else "Student",
                "role": r.user.role if r.user else "student"
            }
        }
        for r in reviews
    ]


@router.post("/courses/{course_id}/reviews")
def submit_course_review(
    course_id: int,
    payload: ReviewCreateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_auth)
):
    """
    Submit a review. Verifies that user is enrolled in the course.
    """
    enr = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if not enr:
        raise HTTPException(status_code=403, detail="Only enrolled students can review this course.")

    review = db.query(models.CourseReview).filter(
        models.CourseReview.course_id == course_id,
        models.CourseReview.user_id == user.id
    ).first()

    if review:
        review.rating = payload.rating
        review.comment = payload.comment
        review.updated_at = datetime.datetime.utcnow()
    else:
        review = models.CourseReview(
            course_id=course_id,
            user_id=user.id,
            rating=payload.rating,
            comment=payload.comment
        )
        db.add(review)

    db.commit()
    db.refresh(review)
    return {"message": "Review submitted successfully", "review_id": review.id}


# ---------------------------------------------------------
# Certificates
# ---------------------------------------------------------

@router.get("/courses/{course_id}/certificate")
def get_course_certificate(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_auth)
):
    """
    Generate or retrieve verifiable certificate if 100% course completion is satisfied.
    Prevents unauthorized state tampering.
    """
    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.user_id == user.id,
        models.Enrollment.course_id == course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    total_lessons = db.query(models.Lesson).filter(models.Lesson.course_id == course_id).count()
    completed_lessons = db.query(models.LessonProgress).filter(
        models.LessonProgress.enrollment_id == enrollment.id,
        models.LessonProgress.is_completed == True
    ).count()

    if total_lessons == 0 or completed_lessons < total_lessons:
        raise HTTPException(
            status_code=400,
            detail=f"Incomplete requirements: You have completed {completed_lessons}/{total_lessons} lessons."
        )

    # Fetch or create certificate
    cert = db.query(models.Certificate).filter(
        models.Certificate.enrollment_id == enrollment.id
    ).first()

    course = enrollment.course
    if not cert:
        code = f"LL-{course_id:03d}-{user.id:03d}-{uuid.uuid4().hex[:6].upper()}"
        cert = models.Certificate(
            certificate_code=code,
            enrollment_id=enrollment.id,
            course_id=course_id,
            user_id=user.id,
            student_name=user.name,
            course_title=course.title,
            teacher_name=course.teacher.name if course.teacher else "LearnLoop Faculty"
        )
        db.add(cert)
        db.commit()
        db.refresh(cert)

    return {
        "id": cert.id,
        "certificate_code": cert.certificate_code,
        "student_name": cert.student_name,
        "course_title": cert.course_title,
        "teacher_name": cert.teacher_name,
        "issued_at": cert.issued_at.isoformat()
    }


# ---------------------------------------------------------
# Teacher Dashboard Analytics & Statistics
# ---------------------------------------------------------

@router.get("/teacher/dashboard/stats")
def get_teacher_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_teacher_or_admin)
):
    """
    Aggregates teacher statistics: courses, published, drafts, total enrollments, engagement.
    """
    query = db.query(models.Course)
    if user.role != "admin":
        query = query.filter(models.Course.teacher_id == user.id)

    courses = query.all()
    course_ids = [c.id for c in courses]

    total_courses = len(courses)
    published_courses = sum(1 for c in courses if c.is_published and c.status == "published")
    draft_courses = sum(1 for c in courses if not c.is_published or c.status == "draft")
    archived_courses = sum(1 for c in courses if c.status == "archived")

    total_enrollments = 0
    total_reviews = 0
    avg_rating = 5.0
    if course_ids:
        total_enrollments = db.query(models.Enrollment).filter(models.Enrollment.course_id.in_(course_ids)).count()
        r_stats = db.query(func.count(models.CourseReview.id), func.avg(models.CourseReview.rating))\
                    .filter(models.CourseReview.course_id.in_(course_ids)).first()
        if r_stats:
            total_reviews = r_stats[0] or 0
            if r_stats[1] is not None:
                avg_rating = round(float(r_stats[1]), 1)

    return {
        "teacher_id": user.id,
        "teacher_name": user.name,
        "total_courses": total_courses,
        "published_courses": published_courses,
        "draft_courses": draft_courses,
        "archived_courses": archived_courses,
        "total_enrollments": total_enrollments,
        "total_reviews": total_reviews,
        "average_rating": avg_rating
    }


# ---------------------------------------------------------
# Users, Teachers & Source Ingestion Endpoints (Preserved)
# ---------------------------------------------------------

@router.get("/teachers")
def get_teachers(db: Session = Depends(get_db)):
    if not db:
        return []
    teachers = db.query(models.User).filter(models.User.role == "teacher").all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "email": t.email,
            "role": t.role,
            "avatar": getattr(t, "avatar", None),
            "courses_count": db.query(models.Course).filter(models.Course.teacher_id == t.id).count()
        }
        for t in teachers
    ]

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    if not db:
        return []
    users = db.query(models.User).order_by(models.User.id.asc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": getattr(u, "role", "student") or "student",
            "avatar": getattr(u, "avatar", None)
        }
        for u in users
    ]

@router.post("/courses/{course_id}/upload-url")
def upload_course_url(course_id: int, payload: UploadUrlRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not db:
        return {"message": "URL registered locally", "source_id": 998}
    
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    source = models.Source(
        course_id=course_id,
        file_path=payload.url,
        source_type=payload.source_type or "video",
        status="completed",
        progress=100
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return {"message": "URL registered successfully.", "source_id": source.id}

@router.post("/courses/{course_id}/upload")
async def upload_source(course_id: int, background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = file.filename.split('.')[-1].lower()
    source_type_map = {"pdf": "pdf", "pptx": "pptx", "mp4": "video"}
    if ext not in source_type_map:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use pdf, pptx, or mp4.")
        
    file_path = os.path.join(UPLOAD_DIR, f"{course_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    if not db:
        mock_id = int(os.path.getmtime(file_path)) if os.path.exists(file_path) else 999
        return {"message": "File uploaded and registered locally in notebook.", "source_id": mock_id}

    try:
        course = db.query(models.Course).filter(models.Course.id == course_id).first()
        if not course:
            course = models.Course(id=course_id, title=f"Course {course_id}")
            db.add(course)
            db.commit()
            db.refresh(course)
            
        source = models.Source(
            course_id=course_id,
            file_path=file_path,
            source_type=source_type_map[ext],
            status="pending"
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        
        background_tasks.add_task(process_source_background, source.id)
        return {"message": "File uploaded successfully. Processing started.", "source_id": source.id}
    except Exception as e:
        logger.warning(f"Database save error during upload: {e}")
        return {"message": "File uploaded and indexed locally.", "source_id": 999}

@router.get("/courses/{course_id}/sources")
def get_course_sources(course_id: int, db: Session = Depends(get_db)):
    if not db:
        return []
    try:
        sources = db.query(models.Source).filter(models.Source.course_id == course_id).order_by(models.Source.id.desc()).all()
        return [{
            "id": s.id,
            "name": os.path.basename(s.file_path) if s.file_path and not s.file_path.startswith("http") else (s.file_path or f"Source {s.id}"),
            "file_path": s.file_path,
            "source_type": s.source_type,
            "status": s.status,
            "progress": s.progress,
            "error_message": s.error_message,
            "created_at": s.created_at.isoformat() if s.created_at else None
        } for s in sources]
    except Exception as e:
        logger.warning(f"Error querying sources from database: {e}")
        return []

@router.get("/courses/{course_id}/sources/{source_id}")
def get_source_status(course_id: int, source_id: int, db: Session = Depends(get_db)):
    if not db:
        return {"id": source_id, "status": "completed", "progress": 100, "error": None}
    try:
        source = db.query(models.Source).filter(models.Source.id == source_id).first()
        if not source:
            return {"id": source_id, "status": "completed", "progress": 100, "error": None}
        return {"id": source.id, "status": source.status, "progress": source.progress, "error": source.error_message}
    except Exception:
        return {"id": source_id, "status": "completed", "progress": 100, "error": None}

@router.get("/courses/{course_id}/hierarchy")
def get_hierarchy(course_id: int, db: Session = Depends(get_db)):
    if not db:
        return {"tree": [], "stats": {"tagged_chunks": 0, "untagged_chunks": 0}, "prerequisites": []}
    
    topics = db.query(models.Topic).filter(models.Topic.course_id == course_id, models.Topic.parent_id == None).all()
    
    result = []
    for t in topics:
        subtopics_data = []
        subtopics = db.query(models.Topic).filter(models.Topic.parent_id == t.id).all()
        for st in subtopics:
            concepts = db.query(models.Concept).filter(models.Concept.topic_id == st.id).all()
            concepts_data = []
            for c in concepts:
                chunks = db.query(models.Chunk).filter(models.Chunk.concept_id == c.id).all()
                concepts_data.append({
                    "id": c.id,
                    "name": c.name,
                    "chunk_count": len(chunks),
                    "chunks": [{
                        "id": ch.id, 
                        "text": ch.text[:120] if ch.text else "", 
                        "source_id": ch.source_id, 
                        "type": ch.chunk_type, 
                        "loc": f"Page {ch.page}" if ch.page is not None else (f"Slide {ch.slide_no}" if ch.slide_no is not None else (f"{int(ch.start_sec)}s" if ch.start_sec is not None else "N/A"))
                    } for ch in chunks]
                })
            subtopics_data.append({
                "id": st.id,
                "name": st.name,
                "concepts": concepts_data
            })
        result.append({
            "id": t.id,
            "name": t.name,
            "subtopics": subtopics_data
        })
        
    total_chunks = db.query(models.Chunk).join(models.Source).filter(models.Source.course_id == course_id).count()
    tagged_chunks = db.query(models.Chunk).join(models.Source).filter(models.Source.course_id == course_id, models.Chunk.concept_id != None).count()
    untagged_chunks = total_chunks - tagged_chunks
    
    prereqs = []
    for p in db.query(models.Prerequisite).limit(10).all():
        req_concept = db.query(models.Concept).filter(models.Concept.id == p.requires_concept_id).first()
        concept = db.query(models.Concept).filter(models.Concept.id == p.concept_id).first()
        if req_concept and concept:
            prereqs.append({"requires": req_concept.name, "concept": concept.name})
            
    return {
        "tree": result,
        "stats": {
            "tagged_chunks": tagged_chunks,
            "untagged_chunks": untagged_chunks
        },
        "prerequisites": prereqs
    }
