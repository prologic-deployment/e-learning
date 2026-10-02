import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StatsService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAdminStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/admin`);
  }

  getManagerStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/manager`);
  }

  getTrainerStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats/trainer`);
  }
}