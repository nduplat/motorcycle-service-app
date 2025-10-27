import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Role } from '../models';

@Injectable({
  providedIn: 'root',
})
export class UserValidationService {
  private readonly emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  private readonly phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  private readonly passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  // Custom validators
  emailValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const isValid = this.emailRegex.test(control.value);
      return isValid ? null : { invalidEmail: { value: control.value } };
    };
  }

  phoneValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const isValid = this.phoneRegex.test(control.value.replace(/[\s\-\(\)]/g, ''));
      return isValid ? null : { invalidPhone: { value: control.value } };
    };
  }

  passwordStrengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const password = control.value;
      const errors: any = {};

      if (password.length < 8) {
        errors.minLength = true;
      }

      if (!/(?=.*[a-z])/.test(password)) {
        errors.noLowerCase = true;
      }

      if (!/(?=.*[A-Z])/.test(password)) {
        errors.noUpperCase = true;
      }

      if (!/(?=.*\d)/.test(password)) {
        errors.noNumber = true;
      }

      if (!/(?=.*[@$!%*?&])/.test(password)) {
        errors.noSpecialChar = true;
      }

      return Object.keys(errors).length > 0 ? { passwordStrength: errors } : null;
    };
  }

  roleValidator(allowedRoles?: Role[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;

      const validRoles: Role[] = ['admin', 'technician', 'customer'];

      if (!validRoles.includes(control.value)) {
        return { invalidRole: { value: control.value } };
      }

      if (allowedRoles && !allowedRoles.includes(control.value)) {
        return { roleNotAllowed: { value: control.value, allowed: allowedRoles } };
      }

      return null;
    };
  }

  // Business logic validation
  validateUserCreation(userData: any, currentUserRole?: Role): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!userData.name?.trim()) errors.push('Name is required');
    if (!userData.email?.trim()) errors.push('Email is required');
    if (!userData.role) errors.push('Role is required');

    // Email format
    if (userData.email && !this.emailRegex.test(userData.email)) {
      errors.push('Invalid email format');
    }

    // Phone format (if provided)
    if (userData.phone && !this.phoneRegex.test(userData.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push('Invalid phone number format');
    }

    // Role validation
    const validRoles: Role[] = ['admin', 'technician', 'customer'];
    if (userData.role && !validRoles.includes(userData.role)) {
      errors.push('Invalid role specified');
    }

    // Permission checks
    if (currentUserRole) {
      if (currentUserRole !== 'admin' && userData.role === 'admin') {
        errors.push('Only admins can create admin accounts');
      }

      if (currentUserRole !== 'admin' && ['admin'].includes(userData.role)) {
        errors.push('Insufficient permissions to create admin accounts');
      }
    }

    // Name length
    if (userData.name && userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    return { isValid: errors.length === 0, errors };
  }

  validateUserUpdate(userData: any, currentUserRole?: Role, targetUserRole?: Role): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Email format (if provided)
    if (userData.email && !this.emailRegex.test(userData.email)) {
      errors.push('Invalid email format');
    }

    // Phone format (if provided)
    if (userData.phone && !this.phoneRegex.test(userData.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.push('Invalid phone number format');
    }

    // Role validation and permissions
    if (userData.role) {
      const validRoles: Role[] = ['admin', 'technician', 'customer'];
      if (!validRoles.includes(userData.role)) {
        errors.push('Invalid role specified');
      }

      // Permission checks for role changes
      if (currentUserRole && targetUserRole) {
        if (currentUserRole !== 'admin' && userData.role === 'admin') {
          errors.push('Only admins can promote users to admin');
        }

        if (currentUserRole !== 'admin' && targetUserRole === 'admin') {
          errors.push('Cannot modify admin accounts');
        }

        if (currentUserRole !== 'admin' && ['admin'].includes(userData.role)) {
          errors.push('Insufficient permissions to assign admin roles');
        }
      }
    }

    // Name validation (if provided)
    if (userData.name !== undefined && userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    return { isValid: errors.length === 0, errors };
  }

  validatePasswordChange(currentPassword: string, newPassword: string, confirmPassword: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!currentPassword) errors.push('Current password is required');
    if (!newPassword) errors.push('New password is required');
    if (!confirmPassword) errors.push('Password confirmation is required');

    if (newPassword !== confirmPassword) {
      errors.push('New password and confirmation do not match');
    }

    if (newPassword && !this.passwordRegex.test(newPassword)) {
      errors.push('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
    }

    if (currentPassword === newPassword) {
      errors.push('New password must be different from current password');
    }

    return { isValid: errors.length === 0, errors };
  }

  getPasswordStrength(password: string): { score: number; feedback: string[] } {
    if (!password) return { score: 0, feedback: ['Enter a password'] };

    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[@$!%*?&]/.test(password)) score += 1;
    else feedback.push('Add special characters');

    if (password.length >= 12) score += 1;

    return { score, feedback };
  }
}