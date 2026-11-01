from django.contrib import admin

from .models import Result


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("student_id", "student_name", "subject", "marks", "grade", "updated_at")
    search_fields = ("student_id", "student_name")
    list_filter = ("subject", "grade")
