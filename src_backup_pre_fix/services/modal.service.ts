import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from '../components/shared/ui/confirm-dialog.component';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {

  constructor(private dialog: MatDialog) {}

  confirm(data: ConfirmDialogData): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '400px',
      disableClose: true,
      hasBackdrop: true,
      backdropClass: 'confirm-dialog-backdrop',
      panelClass: 'confirm-dialog-panel'
    });

    return dialogRef.afterClosed();
  }

  alert(message: string, title: string = 'Información'): Observable<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message,
        confirmText: 'Aceptar',
        type: 'info'
      },
      width: '400px',
      disableClose: false,
      hasBackdrop: true,
      backdropClass: 'confirm-dialog-backdrop',
      panelClass: 'confirm-dialog-panel'
    });

    return dialogRef.afterClosed();
  }
}