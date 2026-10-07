import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CourseService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Tous les cours
  getAllCourses(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.tag) params = params.set('tag', filters.tag);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    if (filters?.category) params = params.set('category', filters.category); //
    return this.http.get(`${this.apiUrl}/courses`, { params });
  }

  // Détail d'un cours
  getCourseById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/courses/${id}`);
  }

  // Créer un cours
  createCourse(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/courses`, formData);
  }

  // Modifier un cours
  updateCourse(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/courses/${id}`, data);
  }

  // Supprimer un cours
  deleteCourse(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/courses/${id}`);
  }

  // Approuver un cours
  approveCourse(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/courses/${id}/approve`, {});
  }
}
