import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmDialogData } from '../../../services/modal.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="confirm-dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="data.title">
      <div class="dialog-header">
        <div class="dialog-icon">
          <span *ngIf="data.type === 'warning'">⚠</span>
          <span *ngIf="data.type === 'danger'">✕</span>
          <span *ngIf="data.type === 'info'">ℹ</span>
        </div>
        <h2 class="dialog-title" id="dialog-title">{{ data.title }}</h2>
      </div>

      <div class="dialog-content">
        <p class="dialog-message">{{ data.message }}</p>
      </div>

      <div class="dialog-actions">
        <button mat-button
                (click)="cancel()"
                [attr.aria-label]="data.cancelText || 'Cancelar'">
          {{ data.cancelText || 'Cancelar' }}
        </button>
        <button mat-raised-button
                color="primary"
                (click)="confirm()"
                [attr.aria-label]="data.confirmText || 'Confirmar'"
                cdkFocusInitial>
          {{ data.confirmText || 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 24px;
      max-width: 400px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .dialog-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .dialog-title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: #333;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .dialog-message {
      margin: 0;
      font-size: 16px;
      line-height: 1.5;
      color: #666;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .dialog-actions button {
      min-width: 80px;
    }

    @media (max-width: 480px) {
      .confirm-dialog {
        padding: 16px;
      }

      .dialog-title {
        font-size: 18px;
      }

      .dialog-message {
        font-size: 14px;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    private dialogRef: MatDialogRef<ConfirmDialogComponent>
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}