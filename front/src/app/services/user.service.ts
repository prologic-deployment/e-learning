import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Tous les users (admin)
  getAllUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/users`);
  }

  // Changer le rôle d'un user
  updateUserRole(userId: string, role: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/role`, { role });
  }

  // Supprimer un user
  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  // Créer un trainer
  createTrainer(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/create-trainer`, data);
  }

  // Créer un manager
  createManager(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/managers`, data);
  }
}