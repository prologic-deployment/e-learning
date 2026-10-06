import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-recommendations',
  templateUrl: './recommendations.component.html',
  styleUrls: ['./recommendations.component.scss']
})
export class RecommendationsComponent implements OnInit {

  recommendations: any[] = [];
  loading = true;
  error = '';
  userProfile: any = null;
  apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRecommendations();
  }

  loadRecommendations(): void {
    this.loading = true;
    this.http.get(`${this.apiUrl}/recommendations`).subscribe({
      next: (data: any) => {
        this.recommendations = data.recommendations || [];
        this.userProfile = data.user_profile;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Error loading recommendations';
        this.loading = false;
      }
    });
  }

  getLevelColor(level: string): string {
    const colors: any = {
      'Beginner Level': '#43e97b',
      'Intermediate Level': '#f093fb',
      'Expert Level': '#f5576c',
      'All Levels': '#457B9D'
    };
    return colors[level] || '#457B9D';
  }

  getLevelIcon(level: string): string {
    const icons: any = {
      'Beginner Level': '🌱',
      'Intermediate Level': '🚀',
      'Expert Level': '⭐',
      'All Levels': '📚'
    };
    return icons[level] || '📚';
  }

  getSubjectIcon(subject: string): string {
    const icons: any = {
      'Web Development': '💻',
      'Business Finance': '💰',
      'Graphic Design': '🎨',
      'Musical Instruments': '🎵'
    };
    return icons[subject] || '📚';
  }

  getScoreColor(score: number): string {
    if (score >= 0.7) return '#43e97b';
    if (score >= 0.4) return '#f093fb';
    return '#457B9D';
  }

  openCourse(url: string): void {
    window.open(url, '_blank');
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

  getCourseColor(category: string): string {
    const colors: any = {
      'Development': 'linear-gradient(135deg, #457B9D, #1D3557)',
      'Business': 'linear-gradient(135deg, #f093fb, #f5576c)',
      'Finance': 'linear-gradient(135deg, #4facfe, #00f2fe)',
      'IT & Software': 'linear-gradient(135deg, #43e97b, #38f9d7)',
      'Design': 'linear-gradient(135deg, #fa709a, #fee140)',
      'Marketing': 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
      'Data Science': 'linear-gradient(135deg, #ffecd2, #fcb69f)'
    };
    return colors[category] || 'linear-gradient(135deg, #457B9D, #1D3557)';
  }


}
