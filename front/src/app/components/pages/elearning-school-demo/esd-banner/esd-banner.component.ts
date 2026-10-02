import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-esd-banner',
  templateUrl: './esd-banner.component.html',
  styleUrls: ['./esd-banner.component.scss']
})
export class EsdBannerComponent {

  searchQuery = '';

  constructor(private router: Router) {}

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