import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { applyCategories } from '../shared/categories';

/**
 * Loads course categories from GET /api/categories before the app renders
 * (registered as an APP_INITIALIZER). If the API is slow or unreachable the
 * built-in list in shared/categories.ts is kept, so the app always starts.
 */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  constructor(private http: HttpClient) {}

  load(): Promise<boolean> {
    return firstValueFrom(
      this.http.get<{ categories: any[] }>(`${environment.apiUrl}/categories`).pipe(
        timeout(4000),
        map(res => applyCategories(res?.categories)),
        catchError(() => of(false))
      )
    );
  }
}
