import { Directive, Input, ComponentRef, ViewContainerRef, ComponentFactoryResolver, OnInit, OnDestroy } from '@angular/core';
import { ErrorHandler } from '@angular/core';

@Directive({
  selector: '[appErrorBoundary]',
  standalone: true
})
export class ErrorBoundaryDirective implements OnInit, OnDestroy {
  @Input() errorMessage = 'Ha ocurrido un error inesperado. Por favor, recarga la página.';
  @Input() showRetry = true;

  private componentRef: ComponentRef<any> | null = null;

  constructor(
    private viewContainerRef: ViewContainerRef,
    private componentFactoryResolver: ComponentFactoryResolver,
    private errorHandler: ErrorHandler
  ) {}

  ngOnInit() {
    // Store original content
    const originalContent = this.viewContainerRef.element.nativeElement.innerHTML;

    // Override error handler for this component
    const originalHandleError = this.errorHandler.handleError;
    this.errorHandler.handleError = (error: any) => {
      console.error('Error caught by ErrorBoundaryDirective:', error);
      this.showErrorFallback(originalContent);
      // Still call original error handler for logging
      originalHandleError.call(this.errorHandler, error);
    };
  }

  ngOnDestroy() {
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }

  private showErrorFallback(originalContent: string) {
    // Clear existing content
    this.viewContainerRef.clear();

    // Create error component dynamically
    const factory = this.componentFactoryResolver.resolveComponentFactory(ErrorFallbackComponent);
    this.componentRef = this.viewContainerRef.createComponent(factory);

    // Set inputs
    this.componentRef.instance.message = this.errorMessage;
    this.componentRef.instance.showRetry = this.showRetry;
    this.componentRef.instance.originalContent = originalContent;
    this.componentRef.instance.retry = () => this.retry();
  }

  private retry() {
    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }
    // Clear and let Angular re-render the original content
    this.viewContainerRef.clear();
    // The parent component should handle re-rendering
    window.location.reload();
  }
}

// Fallback component
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-fallback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error-boundary" role="alert" aria-live="assertive">
      <div class="error-icon">⚠</div>
      <h3 class="error-title">Error</h3>
      <p class="error-message">{{ message }}</p>
      <div class="error-actions" *ngIf="showRetry">
        <button
          class="retry-button"
          (click)="retry()"
          aria-label="Reintentar cargar el componente">
          Reintentar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .error-boundary {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      border: 1px solid #dc3545;
      border-radius: 8px;
      background-color: #f8d7da;
      color: #721c24;
      margin: 1rem 0;
    }

    .error-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .error-title {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }

    .error-message {
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .error-actions {
      display: flex;
      gap: 1rem;
    }

    .retry-button {
      padding: 0.5rem 1rem;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s;
    }

    .retry-button:hover {
      background-color: #c82333;
    }

    .retry-button:focus {
      outline: 2px solid #721c24;
      outline-offset: 2px;
    }
  `]
})
export class ErrorFallbackComponent {
  @Input() message = '';
  @Input() showRetry = true;
  @Input() originalContent = '';
  @Input() retry: () => void = () => {};
}