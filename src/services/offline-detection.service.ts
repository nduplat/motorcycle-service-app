import { Injectable, signal, inject } from '@angular/core';
import { fromEvent, merge, Observable, BehaviorSubject } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OfflineDetectionService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private connectionQualitySubject = new BehaviorSubject<'slow' | 'fast' | 'unknown'>('unknown');

  // Public signals
  isOnline = signal(navigator.onLine);
  connectionQuality = signal<'slow' | 'fast' | 'unknown'>('unknown');
  lastOnlineTime = signal<Date | null>(navigator.onLine ? new Date() : null);

  constructor() {
    // Listen for online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

    merge(online$, offline$)
      .pipe(startWith(navigator.onLine))
      .subscribe(isOnline => {
        this.isOnlineSubject.next(isOnline);
        this.isOnline.set(isOnline);

        if (isOnline) {
          this.lastOnlineTime.set(new Date());
          this.checkConnectionQuality();
        }
      });

    // Initial connection quality check
    if (navigator.onLine) {
      this.checkConnectionQuality();
    }
  }

  /**
   * Get observable for online status changes
   */
  getOnlineStatus(): Observable<boolean> {
    return this.isOnlineSubject.asObservable();
  }

  /**
   * Get observable for connection quality changes
   */
  getConnectionQuality(): Observable<'slow' | 'fast' | 'unknown'> {
    return this.connectionQualitySubject.asObservable();
  }

  /**
   * Check connection quality by measuring response time
   */
  private async checkConnectionQuality(): Promise<void> {
    try {
      const startTime = Date.now();
      // Use a small image or API endpoint to test connection
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Determine quality based on response time
      let quality: 'slow' | 'fast' | 'unknown' = 'unknown';
      if (responseTime < 500) {
        quality = 'fast';
      } else if (responseTime < 2000) {
        quality = 'slow';
      } else {
        quality = 'slow'; // Very slow but still connected
      }

      this.connectionQualitySubject.next(quality);
      this.connectionQuality.set(quality);
    } catch (error) {
      this.connectionQualitySubject.next('unknown');
      this.connectionQuality.set('unknown');
    }
  }

  /**
   * Force a connection quality check
   */
  async refreshConnectionQuality(): Promise<void> {
    if (this.isOnline()) {
      await this.checkConnectionQuality();
    }
  }

  /**
   * Get time since last online (in minutes)
   */
  getTimeSinceLastOnline(): number {
    const lastOnline = this.lastOnlineTime();
    if (!lastOnline) return Infinity;

    return (Date.now() - lastOnline.getTime()) / (1000 * 60);
  }

  /**
   * Check if we should attempt operations based on connection status
   */
  shouldAttemptOnlineOperation(): boolean {
    return this.isOnline() && this.connectionQuality() !== 'unknown';
  }
}