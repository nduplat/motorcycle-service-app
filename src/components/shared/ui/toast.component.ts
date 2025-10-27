import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastConfig } from '../../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast toast-{{ config?.type }}"
         role="alert"
         aria-live="assertive"
         [attr.aria-label]="config?.message">
      <div class="toast-icon">
        <span *ngIf="config?.type === 'success'">✓</span>
        <span *ngIf="config?.type === 'error'">✕</span>
        <span *ngIf="config?.type === 'warning'">⚠</span>
        <span *ngIf="config?.type === 'info'">ℹ</span>
      </div>
      <div class="toast-message">{{ config?.message }}</div>
      <button class="toast-close"
              (click)="close()"
              aria-label="Cerrar notificación"
              type="button">
        ×
      </button>
    </div>
  `,
  styles: [`
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 300px;
      max-width: 500px;
      animation: slideIn 0.3s ease-out;
      position: relative;
    }

    .toast-success {
      background: #d4edda;
      color: #155724;
      border-left: 4px solid #28a745;
    }

    .toast-error {
      background: #f8d7da;
      color: #721c24;
      border-left: 4px solid #dc3545;
    }

    .toast-warning {
      background: #fff3cd;
      color: #856404;
      border-left: 4px solid #ffc107;
    }

    .toast-info {
      background: #d1ecf1;
      color: #0c5460;
      border-left: 4px solid #17a2b8;
    }

    .toast-icon {
      font-size: 18px;
      font-weight: bold;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      font-size: 14px;
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s;
      flex-shrink: 0;
    }

    .toast-close:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 480px) {
      .toast {
        min-width: 280px;
        max-width: 90vw;
        padding: 12px 16px;
      }

      .toast-message {
        font-size: 13px;
      }
    }
  `]
})
export class ToastComponent implements OnInit {
  @Input() config?: ToastConfig;

  ngOnInit() {
    // Component initialization if needed
  }

  close() {
    // The service will handle closing
  }
}