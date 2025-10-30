import { Injectable } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ToastComponent } from '../components/shared/ui/toast.component';

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private overlayRef: OverlayRef | null = null;

  constructor(private overlay: Overlay) {}

  show(config: ToastConfig): void {
    this.hide(); // Hide any existing toast

    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position()
        .global()
        .top('20px')
        .right('20px'),
      hasBackdrop: false,
      panelClass: 'toast-overlay'
    });

    const portal = new ComponentPortal(ToastComponent);
    const componentRef = this.overlayRef.attach(portal);
    (componentRef.instance as any).config = config;

    // Auto hide after duration
    const duration = config.duration ?? 5000;
    setTimeout(() => this.hide(), duration);
  }

  success(message: string, duration?: number): void {
    this.show({ message, type: 'success', duration });
  }

  error(message: string, duration?: number): void {
    this.show({ message, type: 'error', duration });
  }

  warning(message: string, duration?: number): void {
    this.show({ message, type: 'warning', duration });
  }

  info(message: string, duration?: number): void {
    this.show({ message, type: 'info', duration });
  }

  hide(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }
}