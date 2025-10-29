/**
 * Client Flow Container Component
 *
 * Main container component that orchestrates the 4-step client interface flow.
 * Handles step navigation, state management, and component switching.
 * Features:
 * - Step-based navigation
 * - Progress tracking
 * - Authentication guards
 * - Error handling
 * - Responsive layout
 */

import { ChangeDetectionStrategy, Component, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ClientFlowService, ClientFlowStep } from '../../../services/client-flow.service';
import { AuthService } from '../../../services/auth.service';
import { PhoneVerificationComponent, PhoneVerificationResult } from '../../shared/phone-verification.component';
import { MotorcycleSelectionComponent } from './motorcycle-selection.component';
import { ServiceSelectionComponent } from '../../shared/service-selection.component';
import { WaitTicketComponent } from './wait-ticket.component';

import { ServiceItemService } from '../../../services/service-item.service';

@Component({
  selector: 'app-client-flow-container',
  templateUrl: './client-flow-container.component.html',
  styleUrls: ['./client-flow-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    PhoneVerificationComponent,
    MotorcycleSelectionComponent,
    ServiceSelectionComponent,
    WaitTicketComponent
  ]
})
export class ClientFlowContainerComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private flowService = inject(ClientFlowService);
  private authService = inject(AuthService);
  private serviceItemService = inject(ServiceItemService);

  // Flow state
  readonly flowState = this.flowService.flowState;
  readonly currentStep = computed(() => this.flowState().currentStep);
  readonly isLoading = computed(() => this.flowState().isLoading);
  readonly error = computed(() => this.flowState().error);
  readonly isAuthenticated = computed(() => this.flowState().isAuthenticated);
  readonly availableServices = this.serviceItemService.getServices();

  // Navigation state
  readonly canGoBack = computed(() => {
    const step = this.currentStep();
    return step !== 'phone' && step !== 'ticket';
  });

  readonly canGoForward = computed(() => {
    return this.flowService.canProceedToNext();
  });

  readonly isFirstStep = computed(() => this.currentStep() === 'phone');
  readonly isLastStep = computed(() => this.currentStep() === 'ticket');

  // Step information
  readonly currentStepInfo = computed(() => {
    const step = this.currentStep();
    return {
      title: this.flowService.getStepTitle(step),
      description: this.flowService.getStepDescription(step),
      number: this.getStepNumber(step),
      total: 4
    };
  });

  ngOnInit(): void {
    this.detectEntranceSource();
    this.checkAuthentication();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  private detectEntranceSource(): void {
    // Detect if user came from entrance QR
    this.route.queryParams.subscribe(params => {
      const source = params['source'];
      const location = params['location'];

      if (source === 'entrance') {
        console.log('🎯 ClientFlowContainer: Detected entrance QR scan', { source, location });
        // Pass the parameters to the flow service
        this.flowService.setEntranceSource(source, location);
      }
    });
  }

  private async checkAuthentication(): Promise<void> {
    // Wait for authentication to be resolved
    await this.authService.waitForAuth();

    if (!this.authService.currentUser()) {
      // Redirect to login if not authenticated
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/queue/join' }
      });
      return;
    }

    // Authentication is good, flow service will handle initialization
  }

  onPrevious(): void {
    this.flowService.previousStep();
  }

  onNext(): void {
    if (this.canGoForward()) {
      this.flowService.nextStep();
    }
  }

  onStepClick(step: ClientFlowStep): void {
    if (this.flowService.canNavigateToStep(step)) {
      this.flowService.navigateToStep(step);
    }
  }

  onExitFlow(): void {
    if (confirm('¿Estás seguro de que quieres salir? Se perderá el progreso actual.')) {
      this.flowService.resetFlow();
      this.router.navigate(['/']);
    }
  }

  onPhoneVerificationSuccess(result: PhoneVerificationResult): void {
    this.flowService.setPhone(result.phoneNumber);
    this.flowService.nextStep();
  }

  onPhoneVerificationFailure(result: PhoneVerificationResult): void {
    this.flowService.setError(result.error || 'Verificación fallida');
  }

  // Template helpers
  getStepNumber(step: ClientFlowStep): number {
    const stepOrder: ClientFlowStep[] = ['phone', 'motorcycle', 'service', 'ticket'];
    return stepOrder.indexOf(step) + 1;
  }

  getStepIcon(step: ClientFlowStep): string {
    switch (step) {
      case 'phone': return '📱';
      case 'motorcycle': return '🏍️';
      case 'service': return '🔧';
      case 'ticket': return '🎫';
      default: return '❓';
    }
  }

  getStepStatus(step: ClientFlowStep): 'completed' | 'current' | 'pending' {
    const current = this.currentStep();
    const stepOrder: ClientFlowStep[] = ['phone', 'motorcycle', 'service', 'ticket'];
    const currentIndex = stepOrder.indexOf(current);
    const stepIndex = stepOrder.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  }

  isStepAccessible(step: ClientFlowStep): boolean {
    return this.flowService.canNavigateToStep(step);
  }

  // Error handling
  onRetry(): void {
    // Retry the current operation
    window.location.reload();
  }

  onDismissError(): void {
    // For now, just clear the error
    // In a real implementation, you might want to handle this differently
    console.log('Error dismissed by user');
  }
}