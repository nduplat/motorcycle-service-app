import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { QueueSessionService } from '../services/queue-session.service';

@Injectable({
  providedIn: 'root'
})
export class QueueSessionGuard implements CanActivate {
  constructor(
    private queueSessionService: QueueSessionService,
    private router: Router
  ) {}

  canActivate(): boolean {
    // For now, allow access but create a session
    // In a production environment, you might want to check for a session ID in the URL
    // or implement more sophisticated session management

    // Create a new session for this access
    const session = this.queueSessionService.createSession();

    // You could store the session ID in the URL or use it for tracking
    console.log('Queue session created:', session.id);

    return true;
  }
}