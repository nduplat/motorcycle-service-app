import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

export interface QueueSession {
  id: string;
  userId?: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  hasGeneratedTicket: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QueueSessionService {
  private sessions = signal<QueueSession[]>([]);
  private readonly SESSION_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL);

    // Load sessions from localStorage on startup
    this.loadSessionsFromStorage();
  }

  createSession(userId?: string): QueueSession {
    const session: QueueSession = {
      id: this.generateSessionId(),
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_DURATION),
      isActive: true,
      hasGeneratedTicket: false
    };

    const currentSessions = this.sessions();
    const updatedSessions = [...currentSessions, session];
    this.sessions.set(updatedSessions);
    this.saveSessionsToStorage(updatedSessions);

    return session;
  }

  getSession(sessionId: string): QueueSession | null {
    const session = this.sessions().find(s => s.id === sessionId);
    if (!session) return null;

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      this.deactivateSession(sessionId);
      return null;
    }

    return session;
  }

  validateSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    return session !== null && session.isActive && !session.hasGeneratedTicket;
  }

  markTicketGenerated(sessionId: string): void {
    const currentSessions = this.sessions();
    const updatedSessions = currentSessions.map(session =>
      session.id === sessionId
        ? { ...session, hasGeneratedTicket: true, isActive: false }
        : session
    );

    this.sessions.set(updatedSessions);
    this.saveSessionsToStorage(updatedSessions);
  }

  deactivateSession(sessionId: string): void {
    const currentSessions = this.sessions();
    const updatedSessions = currentSessions.map(session =>
      session.id === sessionId
        ? { ...session, isActive: false }
        : session
    );

    this.sessions.set(updatedSessions);
    this.saveSessionsToStorage(updatedSessions);
  }

  getActiveSessions(): Observable<QueueSession[]> {
    return toObservable(this.sessions);
  }

  private generateSessionId(): string {
    return 'qs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const currentSessions = this.sessions();
    const activeSessions = currentSessions.filter(session =>
      session.isActive && now <= session.expiresAt
    );

    if (activeSessions.length !== currentSessions.length) {
      this.sessions.set(activeSessions);
      this.saveSessionsToStorage(activeSessions);
    }
  }

  private saveSessionsToStorage(sessions: QueueSession[]): void {
    try {
      localStorage.setItem('queue_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.warn('Failed to save sessions to localStorage:', error);
    }
  }

  private loadSessionsFromStorage(): void {
    try {
      const stored = localStorage.getItem('queue_sessions');
      if (stored) {
        const sessions: QueueSession[] = JSON.parse(stored).map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          expiresAt: new Date(session.expiresAt)
        }));

        // Filter out expired sessions on load
        const now = new Date();
        const validSessions = sessions.filter(session =>
          session.isActive && now <= session.expiresAt
        );

        this.sessions.set(validSessions);
      }
    } catch (error) {
      console.warn('Failed to load sessions from localStorage:', error);
      this.sessions.set([]);
    }
  }
}