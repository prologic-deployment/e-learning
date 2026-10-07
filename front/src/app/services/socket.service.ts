import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {

  private socket: Socket | null = null;
  public notification$ = new Subject<any>();

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe(user => {
      const wasConnected = !!this.socket;
      this.disconnect();
      if (user && wasConnected) this.connect();
    });
  }

  connect(): void {
    if (this.socket?.connected) return;

    const user = this.authService.getCurrentUser();
    const token = this.authService.getToken();
    if (!(user?._id || user?.id) || !token) {
      return;
    }

    // ✅ JWT sent in the handshake — the server now REQUIRES it and rejects
    // sockets that try to register with a userId they don't own.
    this.socket = io(environment.backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?._id || currentUser?.id) {
        this.socket?.emit('register', currentUser._id || currentUser.id);
      }
    });

    this.socket.on('notification', (data: any) => {
      this.notification$.next(data);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}