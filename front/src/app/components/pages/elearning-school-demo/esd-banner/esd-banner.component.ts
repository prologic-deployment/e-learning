import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface HeroStat { value: string; label: string; }

@Component({
  selector: 'app-esd-banner',
  templateUrl: './esd-banner.component.html',
  styleUrls: ['./esd-banner.component.scss']
})
export class EsdBannerComponent implements OnInit {

  searchQuery = '';

  /** Real platform totals from GET /api/stats/public. Zero values are not
   *  shown, and the whole row stays hidden if the request fails. */
  stats: HeroStat[] = [];

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/stats/public`).subscribe({
      next: (d) => {
        this.stats = [
          { n: d?.courses, one: 'Course', many: 'Courses' },
          { n: d?.learners, one: 'Learner', many: 'Learners' },
          { n: d?.trainers, one: 'Trainer', many: 'Trainers' },
          { n: d?.certificates, one: 'Certificate issued', many: 'Certificates issued' }
        ]
          .filter(s => Number(s.n) > 0)
          .map(s => ({ value: this.format(Number(s.n)), label: Number(s.n) === 1 ? s.one : s.many }));
      },
      error: () => this.stats = []
    });
  }

  /** 7 → "7", 1 234 → "1,234", 12 500 → "12.5K", 1 200 000 → "1.2M" */
  private format(n: number): string {
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${+(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('en-US');
  }

  search(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/courses-grid'], {
        queryParams: { search: this.searchQuery }
      });
    } else {
      this.router.navigate(['/courses-grid']);
    }
  }
}
