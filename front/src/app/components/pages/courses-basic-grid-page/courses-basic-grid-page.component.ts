import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs';
import { CourseService } from '../../../services/course.service';
import { environment } from '../../../../environments/environment';
import { priceView } from '../../../shared/pricing';
import {
  COURSE_CATEGORIES, CourseCategory, findCategory, categoryColor, categoryIcon
} from '../../../shared/categories';

type PriceType = '' | 'free' | 'paid';
type SortKey = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'title';

interface Facets {
  total: number;
  categories: { [name: string]: number };
  subCategories: { [category: string]: { [sub: string]: number } };
  price: { free: number; paid: number };
}

/**
 * Course catalogue (/courses-grid).
 *
 * Search comes from the header search box (?search=…). Every filter lives in the URL (?search, category, subCategory, type, sort,
 * tag, page): links are shareable, the back button works, and the header
 * menu deep-links land on the same state as clicks on this page.
 */
@Component({
  selector: 'app-courses-basic-grid-page',
  templateUrl: './courses-basic-grid-page.component.html',
  styleUrls: ['./courses-basic-grid-page.component.scss']
})
export class CoursesBasicGridPageComponent implements OnInit, OnDestroy {
  /** promotion info for the course cards */
  pv = priceView;


  readonly pageSize = 9;
  readonly categories: CourseCategory[] = COURSE_CATEGORIES;
  readonly sortOptions: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'price_asc', label: 'Price: low to high' },
    { key: 'price_desc', label: 'Price: high to low' },
    { key: 'title', label: 'Title (A–Z)' },
    { key: 'oldest', label: 'Oldest' }
  ];

  // state (mirrors the query string)
  searchQuery = '';
  selectedCategory = '';
  selectedSubCategory = '';
  selectedType: PriceType = '';
  selectedTag = '';
  sort: SortKey = 'newest';
  currentPage = 1;

  showFilters = false;         // mobile filter drawer

  courses: any[] = [];
  totalCourses = 0;
  totalPages = 1;
  loading = true;
  error = '';
  facets: Facets | null = null;

  reviewsMap: { [courseId: string]: { avgRating: number; total: number } } = {};

  private apiUrl = environment.apiUrl;
  private sub?: Subscription;

  constructor(
    private courseService: CourseService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.courseService.getCourseFacets().subscribe({
      next: (f) => this.facets = f,
      error: () => this.facets = null
    });

    this.sub = this.route.queryParams.subscribe((p: Params) => {
      this.searchQuery = p['search'] || '';
      this.selectedCategory = p['category'] || '';
      this.selectedSubCategory = p['subCategory'] || '';
      this.selectedType = (p['type'] === 'free' || p['type'] === 'paid') ? p['type'] : '';
      this.selectedTag = p['tag'] || '';
      this.sort = this.sortOptions.some(o => o.key === p['sort']) ? p['sort'] : 'newest';
      this.currentPage = Math.max(1, parseInt(p['page'], 10) || 1);
      this.loadCourses();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ---------- data ----------
  private loadCourses(): void {
    this.loading = true;
    this.error = '';
    this.courseService.getAllCourses({
      search: this.searchQuery,
      category: this.selectedCategory,
      subCategory: this.selectedSubCategory,
      type: this.selectedType,
      tag: this.selectedTag,
      sort: this.sort,
      page: this.currentPage,
      limit: this.pageSize
    }).subscribe({
      next: (data) => {
        this.courses = data.courses || [];
        this.totalCourses = data.pagination?.total || 0;
        this.totalPages = Math.max(1, data.pagination?.pages || 1);
        this.loading = false;
        this.loadRatings();
      },
      error: (err) => {
        this.courses = [];
        this.error = err.error?.message || 'Could not load courses. Please try again.';
        this.loading = false;
      }
    });
  }

  private loadRatings(): void {
    for (const course of this.courses) {
      if (this.reviewsMap[course._id]) continue;
      this.http.get<any>(`${this.apiUrl}/reviews/course/${course._id}`).subscribe({
        next: (d) => this.reviewsMap[course._id] = { avgRating: Number(d.avgRating) || 0, total: d.total || 0 },
        error: () => this.reviewsMap[course._id] = { avgRating: 0, total: 0 }
      });
    }
  }

  // ---------- navigation (URL is the source of truth) ----------
  private update(patch: Params, keepPage = false): void {
    const next: Params = {
      search: this.searchQuery || null,
      category: this.selectedCategory || null,
      subCategory: this.selectedSubCategory || null,
      type: this.selectedType || null,
      tag: this.selectedTag || null,
      sort: this.sort !== 'newest' ? this.sort : null,
      page: keepPage && this.currentPage > 1 ? this.currentPage : null,
      ...patch
    };
    this.router.navigate(['/courses-grid'], { queryParams: next });
  }

  selectCategory(name: string): void {
    // clicking the active category again clears it
    const cat = this.selectedCategory === name ? null : name;
    this.update({ category: cat, subCategory: null });
  }

  selectSubCategory(name: string): void {
    this.update({ subCategory: this.selectedSubCategory === name ? null : name });
  }

  selectType(type: PriceType): void {
    this.update({ type: type || null });
  }

  changeSort(key: string): void {
    this.update({ sort: key !== 'newest' ? key : null });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.update({ page: page > 1 ? page : null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearAll(): void {
    this.router.navigate(['/courses-grid']);
  }

  removeChip(key: string): void {
    if (key === 'category') this.update({ category: null, subCategory: null });
    else this.update({ [key]: null });
  }

  openCourse(id: string): void {
    this.router.navigate(['/courses-details', id]);
  }

  // ---------- view helpers ----------
  get activeCategory(): CourseCategory | null {
    return this.selectedCategory ? findCategory(this.selectedCategory) : null;
  }

  get pageTitle(): string {
    if (this.searchQuery) return `Results for “${this.searchQuery}”`;
    if (this.selectedSubCategory) return this.selectedSubCategory;
    if (this.selectedCategory) return this.selectedCategory;
    return 'All courses';
  }

  get pageSubtitle(): string {
    if (this.activeCategory && this.activeCategory.name !== 'Other') return this.activeCategory.description;
    return 'Hands-on IT training — development, systems, networking, DevOps, cloud, security and data.';
  }

  get activeChips(): { key: string; label: string }[] {
    const chips: { key: string; label: string }[] = [];
    if (this.searchQuery) chips.push({ key: 'search', label: `“${this.searchQuery}”` });
    if (this.selectedCategory) chips.push({ key: 'category', label: this.selectedCategory });
    if (this.selectedSubCategory) chips.push({ key: 'subCategory', label: this.selectedSubCategory });
    if (this.selectedType) chips.push({ key: 'type', label: this.selectedType === 'free' ? 'Free' : 'Paid' });
    if (this.selectedTag) chips.push({ key: 'tag', label: `#${this.selectedTag}` });
    return chips;
  }

  get resultLabel(): string {
    const n = this.totalCourses;
    return `${n} ${n === 1 ? 'course' : 'courses'}`;
  }

  get rangeLabel(): string {
    if (!this.totalCourses) return '';
    const from = (this.currentPage - 1) * this.pageSize + 1;
    const to = Math.min(this.currentPage * this.pageSize, this.totalCourses);
    return `${from}–${to} of ${this.totalCourses}`;
  }

  categoryCount(name: string): number | null {
    return this.facets ? (this.facets.categories[name] || 0) : null;
  }

  subCategoryCount(sub: string): number | null {
    if (!this.facets) return null;
    return this.facets.subCategories[this.selectedCategory]?.[sub] || 0;
  }

  priceCount(type: PriceType): number | null {
    if (!this.facets) return null;
    return type === '' ? this.facets.total : this.facets.price[type];
  }

  /** Page numbers with gaps: 1 … 4 5 6 … 12 */
  get pages(): (number | null)[] {
    const total = this.totalPages, cur = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, cur - 1, cur, cur + 1].filter(p => p >= 1 && p <= total));
    const sorted = [...set].sort((a, b) => a - b);
    const out: (number | null)[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
      out.push(p);
    });
    return out;
  }

  rating(courseId: string): number {
    return Math.round((this.reviewsMap[courseId]?.avgRating || 0) * 10) / 10;
  }

  reviewCount(courseId: string): number {
    return this.reviewsMap[courseId]?.total || 0;
  }

  /** Boxicons classes for 5 stars (full / half / empty) */
  stars(value: number): string[] {
    return [1, 2, 3, 4, 5].map(i =>
      value >= i ? 'bx bxs-star' : value >= i - 0.5 ? 'bx bxs-star-half' : 'bx bx-star');
  }

  getCategoryIcon(category: string): string {
    return categoryIcon(category);
  }

  getCourseColor(category: string): string {
    return categoryColor(category);
  }

  trackById(_: number, c: any): string {
    return c._id;
  }
}
