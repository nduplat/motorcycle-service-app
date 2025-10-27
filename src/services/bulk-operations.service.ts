import { Injectable } from '@angular/core';
import { UserService } from './user.service';
import { UserValidationService } from './user-validation.service';
import { UserProfile, Role } from '../models';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { db } from '../firebase.config';
import { writeBatch, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

export interface BulkImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  data: UserProfile[];
}

export interface BulkExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeInactive?: boolean;
  roleFilter?: Role;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

@Injectable({
  providedIn: 'root',
})
export class BulkOperationsService {
  constructor(
    private userService: UserService,
    private validationService: UserValidationService
  ) {}

  /**
   * Import users from CSV data
   */
  importUsersFromCSV(csvData: string, options?: { skipValidation?: boolean }): Observable<BulkImportResult> {
    return from(this.processCSVImport(csvData, options));
  }

  /**
   * Import users from JSON data
   */
  importUsersFromJSON(jsonData: string, options?: { skipValidation?: boolean }): Observable<BulkImportResult> {
    return from(this.processJSONImport(jsonData, options));
  }

  /**
   * Export users to CSV
   */
  exportUsersToCSV(options?: BulkExportOptions): Observable<string> {
    return from(this.generateCSVExport(options));
  }

  /**
   * Export users to JSON
   */
  exportUsersToJSON(options?: BulkExportOptions): Observable<string> {
    return from(this.generateJSONExport(options));
  }

  /**
   * Bulk deactivate users
   */
  bulkDeactivateUsers(userIds: string[]): Observable<{ success: number; failed: number; errors: string[] }> {
    return from(this.processBulkDeactivation(userIds));
  }

  /**
   * Bulk activate users
   */
  bulkActivateUsers(userIds: string[]): Observable<{ success: number; failed: number; errors: string[] }> {
    return from(this.processBulkActivation(userIds));
  }

  /**
   * Bulk delete users
   */
  bulkDeleteUsers(userIds: string[]): Observable<{ success: number; failed: number; errors: string[] }> {
    return from(this.processBulkDeletion(userIds));
  }

  private async processCSVImport(csvData: string, options?: { skipValidation?: boolean }): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      errors: [],
      data: []
    };

    try {
      const lines = csvData.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        result.errors.push('CSV must have at least a header row and one data row');
        return result;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const requiredHeaders = ['name', 'email'];

      // Check required headers
      for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
          result.errors.push(`Required column '${required}' is missing`);
          return result;
        }
      }

      const usersToImport: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          result.errors.push(`Row ${i + 1}: Column count mismatch`);
          result.failed++;
          continue;
        }

        const userData: any = {};
        headers.forEach((header, index) => {
          userData[header] = values[index]?.trim().replace(/"/g, '') || '';
        });

        // Set defaults
        userData.role = userData.role || 'customer';
        userData.active = userData.active !== 'false' && userData.active !== '0';

        if (!options?.skipValidation) {
          const validation = this.validationService.validateUserCreation(userData);
          if (!validation.isValid) {
            result.errors.push(`Row ${i + 1}: ${validation.errors.join(', ')}`);
            result.failed++;
            continue;
          }
        }

        usersToImport.push(userData);
      }

      // Import users
      for (const userData of usersToImport) {
        try {
          const newUser = await this.userService.addUser(userData).toPromise();
          if (newUser) {
            result.data.push(newUser);
            result.imported++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to import user ${userData.email}: ${error.message}`);
          result.failed++;
        }
      }

      result.success = result.failed === 0;
      return result;
    } catch (error: any) {
      result.errors.push(`Import failed: ${error.message}`);
      return result;
    }
  }

  private async processJSONImport(jsonData: string, options?: { skipValidation?: boolean }): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      errors: [],
      data: []
    };

    try {
      const usersData = JSON.parse(jsonData);
      if (!Array.isArray(usersData)) {
        result.errors.push('JSON data must be an array of users');
        return result;
      }

      for (let i = 0; i < usersData.length; i++) {
        const userData = usersData[i];

        if (!options?.skipValidation) {
          const validation = this.validationService.validateUserCreation(userData);
          if (!validation.isValid) {
            result.errors.push(`User ${i + 1}: ${validation.errors.join(', ')}`);
            result.failed++;
            continue;
          }
        }

        try {
          const newUser = await this.userService.addUser(userData).toPromise();
          if (newUser) {
            result.data.push(newUser);
            result.imported++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to import user ${userData.email || i + 1}: ${error.message}`);
          result.failed++;
        }
      }

      result.success = result.failed === 0;
      return result;
    } catch (error: any) {
      result.errors.push(`JSON parsing failed: ${error.message}`);
      return result;
    }
  }

  private async generateCSVExport(options?: BulkExportOptions): Promise<string> {
    const users = this.getFilteredUsers(options);

    const headers = ['name', 'email', 'phone', 'role', 'active', 'createdAt', 'updatedAt'];
    let csv = headers.join(',') + '\n';

    for (const user of users) {
      const row = [
        `"${user.name}"`,
        `"${user.email}"`,
        `"${user.phone || ''}"`,
        `"${user.role}"`,
        user.active ? 'true' : 'false',
        `"${user.createdAt.toDate().toISOString()}"`,
        `"${user.updatedAt.toDate().toISOString()}"`
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  private async generateJSONExport(options?: BulkExportOptions): Promise<string> {
    const users = this.getFilteredUsers(options);

    // Convert timestamps to serializable format
    const exportData = users.map(user => ({
      ...user,
      createdAt: user.createdAt.toDate().toISOString(),
      updatedAt: user.updatedAt.toDate().toISOString(),
      technicianProfile: user.technicianProfile ? {
        ...user.technicianProfile,
        employmentStartAt: user.technicianProfile.employmentStartAt?.toDate().toISOString()
      } : null
    }));

    return JSON.stringify(exportData, null, 2);
  }

  private getFilteredUsers(options?: BulkExportOptions): UserProfile[] {
    let users = this.userService.getUsers()();

    if (options?.includeInactive === false) {
      users = users.filter((u: UserProfile) => u.active !== false);
    }

    if (options?.roleFilter) {
      users = users.filter((u: UserProfile) => u.role === options.roleFilter);
    }

    if (options?.dateRange) {
      users = users.filter((u: UserProfile) => {
        const createdDate = u.createdAt.toDate();
        return createdDate >= options.dateRange!.start && createdDate <= options.dateRange!.end;
      });
    }

    return users;
  }

  private async processBulkDeactivation(userIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const batch = writeBatch(db);

    for (const userId of userIds) {
      try {
        const docRef = doc(db, "users", userId);
        batch.update(docRef, {
          active: false,
          updatedAt: serverTimestamp()
        });
        result.success++;
      } catch (error: any) {
        result.errors.push(`Failed to prepare deactivation for user ${userId}: ${error.message}`);
        result.failed++;
      }
    }

    try {
      await batch.commit();
      // Invalidate user service cache
      this.userService['invalidateCache']?.();
    } catch (error: any) {
      result.errors.push(`Batch commit failed: ${error.message}`);
      result.failed = userIds.length;
      result.success = 0;
    }

    return result;
  }

  private async processBulkActivation(userIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const batch = writeBatch(db);

    for (const userId of userIds) {
      try {
        const docRef = doc(db, "users", userId);
        batch.update(docRef, {
          active: true,
          updatedAt: serverTimestamp()
        });
        result.success++;
      } catch (error: any) {
        result.errors.push(`Failed to prepare activation for user ${userId}: ${error.message}`);
        result.failed++;
      }
    }

    try {
      await batch.commit();
      // Invalidate user service cache
      this.userService['invalidateCache']?.();
    } catch (error: any) {
      result.errors.push(`Batch commit failed: ${error.message}`);
      result.failed = userIds.length;
      result.success = 0;
    }

    return result;
  }

  private async processBulkDeletion(userIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const batch = writeBatch(db);

    for (const userId of userIds) {
      try {
        const docRef = doc(db, "users", userId);
        batch.delete(docRef);
        result.success++;
      } catch (error: any) {
        result.errors.push(`Failed to prepare deletion for user ${userId}: ${error.message}`);
        result.failed++;
      }
    }

    try {
      await batch.commit();
      // Invalidate user service cache
      this.userService['invalidateCache']?.();
    } catch (error: any) {
      result.errors.push(`Batch commit failed: ${error.message}`);
      result.failed = userIds.length;
      result.success = 0;
    }

    return result;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Generate CSV template for user import
   */
  generateImportTemplate(): string {
    const headers = ['name', 'email', 'phone', 'role', 'active'];
    const sampleData = [
      ['Juan Pérez', 'juan@example.com', '+57 300 123 4567', 'customer', 'true'],
      ['María García', 'maria@example.com', '+57 301 987 6543', 'technician', 'true']
    ];

    let csv = headers.join(',') + '\n';
    sampleData.forEach(row => {
      csv += row.map(field => `"${field}"`).join(',') + '\n';
    });

    return csv;
  }
}