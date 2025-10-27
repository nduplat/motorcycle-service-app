import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MotorcycleService } from '../../services/motorcycle.service';
import { QueueService } from '../../services/queue.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Motorcycle, QueueJoinData, QueueEntry, Timestamp } from '../../models';
import { QrCodeService } from '../../services/qr-code.service';
import { PhoneVerificationComponent, PhoneVerificationResult } from './phone-verification.component';
import { ServiceSelectionComponent, ServiceSelectionData } from './service-selection.component';
import { WaitTicketComponent, WaitTicketData } from './wait-ticket.component';
import { ServiceItem } from '../../models';

type Step = 'qr-scan' | 'user-detection' | 'motorcycle-registration' | 'phone-verification' | 'service-selection' | 'confirmation' | 'success';

@Component({
  selector: 'app-queue-join',
  templateUrl: './queue-join.component.html',
  styleUrls: ['./queue-join.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, PhoneVerificationComponent, ServiceSelectionComponent, WaitTicketComponent],
})
export class QueueJoinComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private motorcycleService = inject(MotorcycleService);
  private queueService = inject(QueueService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private qrCodeService = inject(QrCodeService);

  // State management
  currentStep = signal<Step>('qr-scan');
  isLoading = signal(false);
  error = signal<string | null>(null);
  qrSource = signal<string>('');

  // User and motorcycle data
  currentUser = this.authService.currentUser;
  selectedMotorcycle = signal<Motorcycle | null>(null);
  queueEntry = signal<QueueEntry | null>(null);

  // Forms
  motorcycleForm = this.fb.group({
    plate: ['', [
      Validators.required,
      Validators.minLength(5),
      Validators.maxLength(6),
      Validators.pattern(/^[A-Z0-9]+$/)
    ]],
    mileageKm: [0, [Validators.required, Validators.min(0)]]
  });

  // Remove old phoneForm as it's now handled by PhoneVerificationComponent

  serviceForm = this.fb.group({
    serviceType: ['direct_work_order', Validators.required],
    notes: ['']
  });

  // Available services with pricing (converted to ServiceItem format)
  availableServices: ServiceItem[] = [
    {
      id: 'direct_work_order',
      title: 'Servicio General',
      description: 'Servicio de mantenimiento general',
      price: 0,
      type: 'maintenance',
      estimatedHours: 2,
      compatibleBrands: [],
      compatibleModels: [],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    },
    {
      id: 'oil_change',
      title: 'Cambio de Aceite',
      description: 'Cambio de aceite y filtro',
      price: 45000,
      type: 'maintenance',
      estimatedHours: 1,
      compatibleBrands: [],
      compatibleModels: [],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    },
    {
      id: 'brake_service',
      title: 'Servicio de Frenos',
      description: 'Revisión y ajuste de frenos',
      price: 80000,
      type: 'repair',
      estimatedHours: 2.5,
      compatibleBrands: [],
      compatibleModels: [],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    },
    {
      id: 'tire_change',
      title: 'Cambio de Llantas',
      description: 'Cambio de llantas delanteras/traseras',
      price: 120000,
      type: 'repair',
      estimatedHours: 3,
      compatibleBrands: [],
      compatibleModels: [],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    }
  ];

  selectedServiceIds = signal<string[]>(['direct_work_order']);
  selectedServicesData = signal<ServiceSelectionData | null>(null);
  waitTicketData = signal<WaitTicketData | null>(null);

  ngOnInit() {
    this.checkQRSource();
  }

  private checkQRSource() {
    // Check URL parameters for QR source
    this.route.queryParams.subscribe(params => {
      const source = params['source'];
      if (source === 'qr-main-entrance') {
        this.qrSource.set(source);
        this.currentStep.set('user-detection');
      }
    });
  }

  // PASO 1: QR scan detection and URL handling
  onQRScanned(qrData: string) {
    try {
      const url = new URL(qrData);
      const source = url.searchParams.get('source');

      if (source === 'qr-main-entrance') {
        this.qrSource.set(source);
        this.currentStep.set('user-detection');
        this.error.set(null);
      } else {
        this.error.set('Código QR no válido para entrada principal');
      }
    } catch (err) {
      this.error.set('Código QR no válido');
    }
  }

  // PASO 2: User detection (existing vs new)
  async detectUser() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const user = this.currentUser();
      if (user) {
        // Existing user - proceed to motorcycle registration
        this.currentStep.set('motorcycle-registration');
      } else {
        // New user - redirect to login/register
        await this.router.navigate(['/login'], {
          queryParams: { returnUrl: '/queue-join', source: this.qrSource() }
        });
      }
    } catch (err: any) {
      this.error.set('Error al detectar usuario: ' + err.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  // PASO 3: Motorcycle registration/selection by plate
  async onPlateSubmit() {
    if (this.motorcycleForm.invalid) {
      this.markFormGroupTouched(this.motorcycleForm);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const formData = this.motorcycleForm.value;
      const plate = formData.plate!.toUpperCase();

      // Try to find existing motorcycle by plate
      const existingMotorcycle = await this.motorcycleService.findMotorcycleByPlate(plate).toPromise();

      if (existingMotorcycle) {
        // Check if user has access to this motorcycle
        const user = this.currentUser()!;
        const hasAccess = await this.motorcycleService.canUserAccessMotorcycleByPlate(user.id, plate).toPromise();

        if (hasAccess) {
          this.selectedMotorcycle.set(existingMotorcycle);
          this.currentStep.set('service-selection');
        } else {
          this.error.set('Esta motocicleta ya está registrada por otro usuario. Contacte al administrador.');
        }
      } else {
        // Create new motorcycle
        const user = this.currentUser()!;
        const newMotorcycle = await this.motorcycleService.getOrCreateMotorcycleByPlate(plate, {
          userId: user.id,
          mileageKm: formData.mileageKm || 0
        }).toPromise();

        if (newMotorcycle) {
          this.selectedMotorcycle.set(newMotorcycle);
          this.currentStep.set('service-selection');
        } else {
          this.error.set('Error al registrar la motocicleta');
        }
      }
    } catch (err: any) {
      this.error.set('Error al procesar la placa: ' + err.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  onPlateInput(event: Event): void {
    const input = (event.target as HTMLInputElement);
    const upperValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    input.value = upperValue;
    this.motorcycleForm.patchValue({ plate: upperValue }, { emitEvent: false });
  }

  // PASO 4: Phone verification event handlers
  async onPhoneVerificationSuccess(result: PhoneVerificationResult) {
    try {
      // Update user phone number in database
      const user = this.currentUser()!;
      await this.userService.updateUser({ id: user.id, phone: result.phoneNumber }).toPromise();

      // Proceed to next step
      this.currentStep.set('service-selection');
      this.error.set(null);
    } catch (err: any) {
      this.error.set('Error al actualizar teléfono: ' + err.message);
    }
  }

  onPhoneVerificationFailure(result: PhoneVerificationResult) {
    this.error.set(result.error || 'Verificación fallida');
  }

  // PASO 5: Service selection
  onServiceSelectionChange(data: ServiceSelectionData) {
    this.selectedServicesData.set(data);
    // Update service form with selected service IDs
    const serviceIds = data.selectedServices.map(s => s.id);
    this.selectedServiceIds.set(serviceIds);

    // For backward compatibility, set the first service as the primary one
    if (data.selectedServices.length > 0) {
      this.serviceForm.patchValue({ serviceType: data.selectedServices[0].id });
    }
  }

  proceedToConfirmation() {
    if (this.serviceForm.invalid) {
      this.markFormGroupTouched(this.serviceForm);
      return;
    }
    this.currentStep.set('confirmation');
  }

  // PASO 6: Confirmation and queue joining
  async joinQueue() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const user = this.currentUser()!;
      const motorcycle = this.selectedMotorcycle()!;
      const serviceData = this.serviceForm.value;

      const queueData: QueueJoinData = {
        customerId: user.id,
        customerName: user.name,
        customerPhone: user.phone,
        serviceType: serviceData.serviceType as 'appointment' | 'direct_work_order',
        motorcycleId: motorcycle.id,
        plate: motorcycle.plate || '',
        mileageKm: this.motorcycleForm.value.mileageKm || 0,
        notes: serviceData.notes || undefined
      };

      const entryId = await this.queueService.addToQueue(queueData);
      const entry = await this.queueService.getQueueEntry(entryId).toPromise();

      if (entry) {
        this.queueEntry.set(entry);

        // Prepare wait ticket data
        const ticketData: WaitTicketData = {
          queueEntry: entry,
          selectedServices: this.selectedServicesData()?.selectedServices || [],
          totalCost: this.selectedServicesData()?.totalCost || 0,
          estimatedTime: this.selectedServicesData()?.estimatedTime
        };
        this.waitTicketData.set(ticketData);

        this.currentStep.set('success');
      } else {
        this.error.set('Error al unirse a la cola');
      }
    } catch (err: any) {
      this.error.set('Error al unirse a la cola: ' + err.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  // PASO 7: Success screen with QR code
  getQueuePosition(): number {
    return this.queueEntry()?.position || 0;
  }

  getEstimatedWaitTime(): number {
    return this.queueEntry()?.estimatedWaitTime || 0;
  }

  getVerificationCode(): string {
    return this.queueEntry()?.verificationCode || '';
  }

  getQRCodeDataUrl(): string {
    return this.queueEntry()?.qrCodeDataUrl || '';
  }

  // Navigation helpers
  goBack() {
    const steps: Step[] = ['qr-scan', 'user-detection', 'motorcycle-registration', 'phone-verification', 'service-selection', 'confirmation'];
    const currentIndex = steps.indexOf(this.currentStep());
    if (currentIndex > 0) {
      this.currentStep.set(steps[currentIndex - 1]);
      this.error.set(null);
    }
  }

  startOver() {
    this.currentStep.set('qr-scan');
    this.error.set(null);
    this.selectedMotorcycle.set(null);
    this.queueEntry.set(null);
    this.selectedServicesData.set(null);
    this.waitTicketData.set(null);
    this.selectedServiceIds.set(['direct_work_order']);
    this.motorcycleForm.reset();
    this.serviceForm.reset();
  }

  onBackToTracking() {
    // Navigate back to queue tracking or emit event
    this.router.navigate(['/queue-tracking'], {
      queryParams: { entryId: this.queueEntry()?.id }
    });
  }

  private markFormGroupTouched(formGroup: any): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}