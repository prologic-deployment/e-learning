import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject, Subscription, finalize, timeout } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private probe?: Subscription;
  private probing = false;
  private state = new BehaviorSubject<'idle' | 'checking' | 'connecting' | 'connected' | 'offline'>('idle');
  readonly state$ = this.state.asObservable();
  readonly notification$ = new Subject<any>();

  constructor(private authService: AuthService, private http: HttpClient) {
    this.authService.currentUser$.subscribe(user => {
      this.disconnect();
      // Includes first sign-in for every role, not only previously connected users.
      if (user) this.connect();
    });
  }

  connect(): void {
    // A connecting socket counts too: repeated component initialization must not
    // create competing managers and their own reconnection loops.
    if (this.socket || this.probing || this.state.value === 'offline') return;
    const user = this.authService.getCurrentUser();
    const token = this.authService.getToken();
    if (!(user?._id || user?.id) || !token) return;
    this.probing = true;
    this.state.next('checking');
    this.probe = this.http.get<{ready:boolean}>(`${environment.apiUrl}/health`).pipe(
      timeout(5000), finalize(() => this.probing = false),
    ).subscribe({
      next: health => {
        if (!health.ready) { this.state.next('offline'); return; }
        this.openSocket(token);
      },
      error: () => this.state.next('offline'),
    });
  }

  private openSocket(token: string): void {
    this.state.next('connecting');
    const socket = io(environment.backendUrl, {
      auth: { token },
      // Normal polling handshake with optional WebSocket upgrade; no forced WS storm.
      transports: ['polling', 'websocket'],
      reconnection: false,
      autoConnect: false,
      timeout: 5000,
    });
    this.socket = socket;
    socket.on('connect', () => {
      this.state.next('connected');
      const user = this.authService.getCurrentUser();
      socket.emit('register', user?._id || user?.id);
    });
    socket.on('notification', data => this.notification$.next(data));
    const offline = () => {
      if (this.socket !== socket) return;
      socket.removeAllListeners();
      socket.disconnect();
      this.socket = null;
      this.state.next('offline');
    };
    socket.on('connect_error', offline);
    socket.on('disconnect', offline);
    socket.connect();
  }

  retry(): void { this.disconnect(); this.connect(); }

  disconnect(): void {
    this.probe?.unsubscribe();
    this.probe = undefined;
    this.probing = false;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.state.next('idle');
  }
}
