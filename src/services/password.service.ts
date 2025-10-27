import { Injectable } from '@angular/core';
import { sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../firebase.config';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserValidationService } from './user-validation.service';

@Injectable({
  providedIn: 'root',
})
export class PasswordService {
  constructor(private validationService: UserValidationService) {}

  /**
   * Send password reset email to user
   */
  sendPasswordResetEmail(email: string): Observable<void> {
    if (!email?.trim()) {
      return throwError(() => new Error('Email is required'));
    }

    // Simple email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return throwError(() => new Error('Invalid email format'));
    }

    return from(sendPasswordResetEmail(auth, email)).pipe(
      catchError(error => {
        console.error('Password reset email failed:', error);
        let message = 'Failed to send password reset email';

        switch (error.code) {
          case 'auth/user-not-found':
            message = 'No account found with this email address';
            break;
          case 'auth/invalid-email':
            message = 'Invalid email address';
            break;
          case 'auth/too-many-requests':
            message = 'Too many requests. Please try again later';
            break;
          default:
            message = error.message || message;
        }

        return throwError(() => new Error(message));
      })
    );
  }

  /**
   * Change current user's password
   */
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Observable<void> {
    const validation = this.validationService.validatePasswordChange(currentPassword, newPassword, confirmPassword);

    if (!validation.isValid) {
      return throwError(() => new Error(validation.errors.join(', ')));
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      return throwError(() => new Error('No authenticated user found'));
    }

    // Reauthenticate user before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    return from(
      reauthenticateWithCredential(user, credential)
        .then(() => updatePassword(user, newPassword))
    ).pipe(
      catchError(error => {
        console.error('Password change failed:', error);
        let message = 'Failed to change password';

        switch (error.code) {
          case 'auth/wrong-password':
            message = 'Current password is incorrect';
            break;
          case 'auth/weak-password':
            message = 'New password is too weak';
            break;
          case 'auth/requires-recent-login':
            message = 'Please re-authenticate and try again';
            break;
          case 'auth/too-many-requests':
            message = 'Too many requests. Please try again later';
            break;
          default:
            message = error.message || message;
        }

        return throwError(() => new Error(message));
      })
    );
  }

  /**
   * Validate password strength
   */
  getPasswordStrength(password: string) {
    return this.validationService.getPasswordStrength(password);
  }

  /**
   * Check if password meets requirements
   */
  isValidPassword(password: string): boolean {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}