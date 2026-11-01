from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Result",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("student_id", models.CharField(db_index=True, max_length=50)),
                ("student_name", models.CharField(max_length=100)),
                ("subject", models.CharField(max_length=100)),
                ("marks", models.DecimalField(decimal_places=2, max_digits=5)),
                ("grade", models.CharField(max_length=5)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["student_id", "subject"],
                "constraints": [
                    models.UniqueConstraint(fields=("student_id", "subject"), name="unique_student_subject"),
                ],
            },
        ),
    ]
