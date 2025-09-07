from .models import Progress, Enrollment
from catalog.models import Course

def course_total_duration(course: Course) -> int:
    return sum(l.duration_seconds or 0 for l in course.lessons.all())

def compute_enrollment_percent(enrollment: Enrollment) -> int:
    total = course_total_duration(enrollment.course)
    if not total:
        return 0
    # somme du temps visionné, plafonné par la durée de chaque leçon
    progresses = Progress.objects.filter(enrollment=enrollment).select_related("lesson")
    watched = 0
    for p in progresses:
        d = p.lesson.duration_seconds or 0
        watched += min(p.position_seconds or 0, d)
    return min(100, int(round(100 * watched / total)))

def last_progress(enrollment: Enrollment):
    return (Progress.objects
            .filter(enrollment=enrollment)
            .select_related("lesson")
            .order_by("-updated_at")
            .first())