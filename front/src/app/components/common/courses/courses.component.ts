import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CourseService } from '../../../services/course.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-courses',
  templateUrl: './courses.component.html',
  styleUrls: ['./courses.component.scss']
})
export class CoursesComponent implements OnInit {

  courses: any[] = [];
  loading = true;
  apiUrl = environment.apiUrl;

  enrollSuccess = '';
  enrollError = '';
  enrollingId = '';

  constructor(
    public router: Router,
    private courseService: CourseService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    this.courseService.getAllCourses({ limit: 8 }).subscribe({
      next: (data) => {
        this.courses = data.courses;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  goToCourse(courseId: string): void {
    this.router.navigate(['/courses-details', courseId]);
  }

  enrollCourse(courseId: string): void {
    this.enrollingId = courseId;
    this.enrollSuccess = '';
    this.enrollError = '';

    this.http.post(`${this.apiUrl}/enrollments/${courseId}/enroll`, {}).subscribe({
      next: () => {
        this.enrollingId = '';
        this.enrollSuccess = 'Enrolled successfully ! 🎉';
        setTimeout(() => this.enrollSuccess = '', 3000);
      },
      error: (err) => {
        this.enrollingId = '';
        this.enrollError = err.error?.message || 'Error enrolling';
        setTimeout(() => this.enrollError = '', 3000);
      }
    });
  }
}