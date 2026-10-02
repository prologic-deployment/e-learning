import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CvService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Voir mon CV
  getMyCV(): Observable<any> {
    return this.http.get(`${this.apiUrl}/cv/me`);
  }

  // Sauvegarder le CV
  saveCV(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/cv`, formData);
  }

  // Télécharger le CV en PDF
  downloadCV(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/cv/download`, {
      responseType: 'blob'
    });
  }

  // Expériences
  addExperience(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cv/experience`, data);
  }

  deleteExperience(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cv/experience/${id}`);
  }

  // Formations
  addFormation(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cv/formation`, data);
  }

  deleteFormation(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cv/formation/${id}`);
  }

  // Compétences
  addCompetence(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cv/competence`, data);
  }

  deleteCompetence(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cv/competence/${id}`);
  }

  // Langues
  addLangue(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cv/langue`, data);
  }

  deleteLangue(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cv/langue/${id}`);
  }

  // Hobbies
  addHobby(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/cv/hobby`, data);
  }

  deleteHobby(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cv/hobby/${id}`);
  }
}