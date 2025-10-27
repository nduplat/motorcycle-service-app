import { Injectable, inject, signal, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { db } from '../firebase.config';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { TimeEntry, UserProfile } from '../models';

export interface WorkSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private currentSession = signal<WorkSession | null>(null);
  private logoutTimer: any;
  private notificationTimer: any;

  constructor() {
    // Watch for user changes using effect
    effect(() => {
      const user = this.authService.currentUser();
      if (user && this.isStaffUser(user)) {
        this.startWorkSession(user);
        this.scheduleAutomaticLogout();
      } else if (this.currentSession()) {
        this.endWorkSession();
      }
    });

    // Schedule automatic logout check
    this.scheduleAutomaticLogout();
  }

  private isStaffUser(user: UserProfile): boolean {
    return ['technician', 'employee', 'admin', 'manager', 'front_desk'].includes(user.role);
  }

  private async startWorkSession(user: UserProfile): Promise<void> {
    try {
      console.log('🔄 SessionService: Starting work session for user:', user.email);

      const sessionData = {
        userId: user.id,
        startTime: serverTimestamp(),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'workSessions'), sessionData);
      const session: WorkSession = {
        id: docRef.id,
        userId: user.id,
        startTime: new Date(),
        isActive: true,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };

      this.currentSession.set(session);
      console.log('🔄 SessionService: Work session started:', session.id);

    } catch (error) {
      console.error('Error starting work session:', error);
    }
  }

  private async endWorkSession(): Promise<void> {
    const session = this.currentSession();
    if (!session) return;

    try {
      console.log('🔄 SessionService: Ending work session:', session.id);

      const endTime = new Date();
      const durationMinutes = Math.floor((endTime.getTime() - session.startTime.getTime()) / (1000 * 60));

      await updateDoc(doc(db, 'workSessions', session.id), {
        endTime: serverTimestamp(),
        durationMinutes,
        isActive: false,
        updatedAt: serverTimestamp()
      });

      this.currentSession.set(null);
      console.log('🔄 SessionService: Work session ended, duration:', durationMinutes, 'minutes');

    } catch (error) {
      console.error('Error ending work session:', error);
    }
  }

  private scheduleAutomaticLogout(): void {
    // Clear existing timers
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
    }
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
    }

    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(22, 0, 0, 0); // 10:00 PM

    // If it's already past 10 PM, schedule for tomorrow
    if (now >= logoutTime) {
      logoutTime.setDate(logoutTime.getDate() + 1);
    }

    const timeUntilLogout = logoutTime.getTime() - now.getTime();
    const timeUntilNotification = timeUntilLogout - (5 * 60 * 1000); // 5 minutes before

    console.log('🔄 SessionService: Scheduling automatic logout in', Math.floor(timeUntilLogout / (1000 * 60)), 'minutes');

    // Schedule notification 5 minutes before logout
    if (timeUntilNotification > 0) {
      this.notificationTimer = setTimeout(() => {
        this.toastService.warning('Tu sesión terminará automáticamente en 5 minutos. Guarda tu trabajo.', 10000);
      }, timeUntilNotification);
    }

    this.logoutTimer = setTimeout(async () => {
      await this.performAutomaticLogout();
      // Schedule next logout
      this.scheduleAutomaticLogout();
    }, timeUntilLogout);
  }

  private async performAutomaticLogout(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user || !this.isStaffUser(user)) return;

    console.log('🔄 SessionService: Performing automatic logout for user:', user.email);

    // End current work session
    await this.endWorkSession();

    // Log out the user
    await this.authService.logout();

    // Show notification
    this.toastService.info('Tu sesión ha terminado automáticamente a las 10:00 PM. Hasta mañana.', 10000);
  }

  // Public methods for external access
  async getCurrentSession(): Promise<WorkSession | null> {
    return this.currentSession();
  }

  async getWorkSessionsForUser(userId: string, limitCount: number = 10): Promise<WorkSession[]> {
    try {
      const q = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId),
        orderBy('startTime', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data()['startTime']?.toDate() || new Date(),
        endTime: doc.data()['endTime']?.toDate(),
        createdAt: doc.data()['createdAt'],
        updatedAt: doc.data()['updatedAt']
      })) as WorkSession[];

    } catch (error) {
      console.error('Error fetching work sessions:', error);
      return [];
    }
  }

  async getTotalWorkTimeForUser(userId: string, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      let q = query(
        collection(db, 'workSessions'),
        where('userId', '==', userId)
      );

      if (startDate && endDate) {
        // Note: Firestore compound queries with inequalities need proper indexing
        // This is a simplified version
      }

      const querySnapshot = await getDocs(q);
      let totalMinutes = 0;

      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.durationMinutes) {
          totalMinutes += data.durationMinutes;
        }
      });

      return totalMinutes;

    } catch (error) {
      console.error('Error calculating total work time:', error);
      return 0;
    }
  }

  // Check if user should be available for queue assignments
  isUserAvailableForQueue(user: UserProfile): boolean {
    if (!this.isStaffUser(user)) return false;

    const now = new Date();
    const logoutTime = new Date();
    logoutTime.setHours(22, 0, 0, 0);

    // User is not available if it's past logout time
    if (now >= logoutTime) return false;

    // User is available if they have an active session
    return !!this.currentSession();
  }

  // Force logout a specific user (for admin use)
  async forceLogoutUser(userId: string): Promise<void> {
    try {
      console.log('🔄 SessionService: Forcing logout for user:', userId);

      // End the user's work session if they have one
      // Note: This is a simplified implementation. In a real system,
      // you might need to notify the user's browser to log out
      // This could be done via Firebase Cloud Messaging or similar

      // For now, we'll just end their session in the database
      // The actual logout would need to be handled on the client side

      // If this is the current user, perform normal logout
      const currentUser = this.authService.currentUser();
      if (currentUser && currentUser.id === userId) {
        await this.performAutomaticLogout();
      } else {
        // For other users, just end their session
        // In a real implementation, you'd need to send a signal to their session
        console.log('🔄 SessionService: Ending session for user:', userId);
        // This is a placeholder - actual implementation would require
        // real-time communication to force logout on other clients
      }

    } catch (error) {
      console.error('Error forcing logout for user:', error);
      throw error;
    }
  }

  // Force logout (for admin use) - deprecated, use forceLogoutUser
  async forceLogout(): Promise<void> {
    await this.performAutomaticLogout();
  }
}