import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-elearning-school-demo',
  templateUrl: './elearning-school-demo.component.html',
  styleUrls: ['./elearning-school-demo.component.scss']
})
export class ElearningSchoolDemoComponent implements OnInit {

  courses: any[] = [];
  loading = true;
  apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadCourses();
  }

    isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  loadCourses(): void {
    this.http.get(`${this.apiUrl}/courses?limit=8&page=1`).subscribe({
      next: (data: any) => {
        this.courses = data.courses || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

    getCourseImage(category: string): string {
      const images: any = {
        'Development': 'assets/img/courses/courses-img1.jpg',
        'Business': 'assets/img/courses/courses-img2.jpg',
        'Finance': 'assets/img/courses/courses-img3.jpg',
        'IT & Software': 'assets/img/courses/courses-img4.jpg',
        'Design': 'assets/img/courses/courses-img5.jpg',
        'Marketing': 'assets/img/courses/courses-img6.jpg',
        'Data Science': 'assets/img/courses/courses-img7.jpg'
      };
      return images[category] || 'assets/img/courses/courses-img1.jpg';
    }


  getCourseColor(category: string): string {
    const colors: any = {
      'Development': '#0B0D12',
      'Business': '#1B2230',
      'Finance': '#232A36',
      'IT & Software': '#14181F',
      'Design': '#2B1810',
      'Marketing': '#3A1C0E',
      'Data Science': '#1E2633'
    };
    return colors[category] || '#0B0D12';
  }


    getCategoryIcon(category: string): string {
      const icons: any = {
        'Development': '💻',
        'Business': '💼',
        'Finance': '💰',
        'IT & Software': '🖥️',
        'Design': '🎨',
        'Marketing': '📣',
        'Data Science': '📊'
      };
      return icons[category] || '📚';
    }


}