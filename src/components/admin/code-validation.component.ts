import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { UserService } from '../../services/user.service';
import { UserVehicleService } from '../../services/user-vehicle.service';
import { WorkOrderService } from '../../services/work-order.service';
import { QueueEntry, User, UserVehicle, WorkOrder } from '../../models';
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser';

interface ValidationResult {
  isValid: boolean;
  entry: QueueEntry | null;
  customer: User | null;
  motorcycle: UserVehicle | null;
  error: string | null;
}

@Component({
  selector: 'app-code-validation',
  templateUrl: './code-validation.component.html',
  styleUrl: './code-validation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class CodeValidationComponent {
  private queueService = inject(QueueService);
  private userService = inject(UserService);
  private userVehicleService = inject(UserVehicleService);
  private workOrderService = inject(WorkOrderService);
  private router = inject(Router);

  // Signals for component state
  codeInput = signal<string>('');
  validationResult = signal<ValidationResult>({
    isValid: false,
    entry: null,
    customer: null,
    motorcycle: null,
    error: null
  });
  isValidating = signal<boolean>(false);

  // QR Scanner state
  isScanning = signal<boolean>(false);
  scanError = signal<string | null>(null);
  private codeReader: BrowserMultiFormatReader | null = null;

  async validateCode(): Promise<void> {
     const code = this.codeInput().trim();
     console.log('🔍 [DEBUG] CodeValidation.validateCode called with code:', code);

     if (code.length !== 4 || !/^\d{4}$/.test(code)) {
       console.log('🔍 [DEBUG] Invalid code format');
       this.validationResult.set({
         isValid: false,
         entry: null,
         customer: null,
         motorcycle: null,
         error: 'El código debe tener exactamente 4 dígitos'
       });
       return;
     }

     this.isValidating.set(true);
     this.validationResult.set({
       isValid: false,
       entry: null,
       customer: null,
       motorcycle: null,
       error: null
     });

     try {
       // Step 1: Verify code exists in queue
       console.log('🔍 [DEBUG] Looking up queue entry for code:', code);
       const entry = this.queueService.getEntryByCode(code);
       if (!entry) {
         console.log('🔍 [DEBUG] Code not found in queue');
         this.validationResult.set({
           isValid: false,
           entry: null,
           customer: null,
           motorcycle: null,
           error: 'Código no encontrado en la cola'
         });
         return;
       }

       console.log('🔍 [DEBUG] Found queue entry:', { id: entry.id, status: entry.status, customerId: entry.customerId });

      // Step 2: Check entry status is 'called'
      if (entry.status !== 'called') {
        this.validationResult.set({
          isValid: false,
          entry: entry,
          customer: null,
          motorcycle: null,
          error: `El código está en estado '${entry.status}'. Debe estar en estado 'called' para ser validado.`
        });
        return;
      }

      // Step 3: Load customer data using UserService (single document read)
      const customer = this.userService.getUserById(entry.customerId);
      if (!customer) {
        this.validationResult.set({
          isValid: false,
          entry: entry,
          customer: null,
          motorcycle: null,
          error: 'Cliente no encontrado'
        });
        return;
      }

      // Step 4: Load motorcycle data using UserVehicleService (single document read)
      const motorcycles = await this.userVehicleService.getVehiclesForUser(entry.customerId).toPromise();
      const motorcycle = motorcycles && motorcycles.length > 0 ? motorcycles[0] : null;

      if (!motorcycle) {
        this.validationResult.set({
          isValid: false,
          entry: entry,
          customer: customer,
          motorcycle: null,
          error: 'No se encontró motocicleta registrada para este cliente'
        });
        return;
      }

      // Step 5: Check if work order already exists, create only if needed
      console.log('🔍 [DEBUG] Checking for existing work order for entry:', entry.id);

      // Check if a work order already exists for this queue entry
      const existingWorkOrders = this.workOrderService.getWorkOrders()();
      const existingWorkOrder = existingWorkOrders?.find(wo =>
        wo.clientId === entry.customerId &&
        wo.vehicleId === motorcycle.id &&
        (wo.status === 'in_progress' || wo.status === 'open')
      );

      let workOrderToUse = existingWorkOrder;

      if (!existingWorkOrder) {
        console.log('🔍 [DEBUG] No existing work order found, creating new one for validated code:', {
          entryId: entry.id,
          clientId: entry.customerId,
          vehicleId: motorcycle.id,
          assignedTo: entry.assignedTo
        });

        const workOrderData: Omit<WorkOrder, 'id' | 'createdAt'> = {
          clientId: entry.customerId,
          vehicleId: motorcycle.id,
          status: 'in_progress',
          services: [], // Will be populated during work order management
          products: [], // Will be populated during work order management
          totalPrice: 0,
          assignedTo: entry.assignedTo // Assign to the technician who called the entry
        };

        workOrderToUse = await this.workOrderService.createWorkOrder(workOrderData).toPromise();
        if (!workOrderToUse) {
          console.log('🔍 [DEBUG] Work order creation returned null');
          throw new Error('Error al crear la orden de trabajo');
        }

        console.log('✅ [DEBUG] Work order created successfully:', workOrderToUse.id);
      } else {
        console.log('✅ [DEBUG] Using existing work order:', existingWorkOrder.id);
      }

      // Step 6: Navigate to the work order
      console.log('🔍 [DEBUG] Navigating to work order:', workOrderToUse!.id);
      this.router.navigate(['/admin/work-orders', workOrderToUse!.id]);

    } catch (error: any) {
      console.error('Error validating code:', error);
      this.validationResult.set({
        isValid: false,
        entry: null,
        customer: null,
        motorcycle: null,
        error: error.message || 'Error desconocido durante la validación'
      });
    } finally {
      this.isValidating.set(false);
    }
  }

  // Helper method to update code input
  updateCodeInput(value: string): void {
    // Only allow numeric input and limit to 4 digits
    const numericValue = value.replace(/\D/g, '').substring(0, 4);
    this.codeInput.set(numericValue);
  }

  // Helper method to clear validation result
  clearValidation(): void {
    this.validationResult.set({
      isValid: false,
      entry: null,
      customer: null,
      motorcycle: null,
      error: null
    });
  }

  // QR Scanner methods
  async startScanning(): Promise<void> {
    console.log('🔍 [DEBUG] Starting QR code scan');
    this.isScanning.set(true);
    this.scanError.set(null);

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });

      // Initialize the QR reader
      this.codeReader = new BrowserMultiFormatReader();
      this.codeReader.decodeFromVideoDevice(
        undefined, // Use default camera
        'qr-video',
        (result, error) => {
          if (result) {
            console.log('✅ [DEBUG] QR code scanned:', result.getText());
            this.onQrCodeScanned(result.getText());
          }
          if (error && !(error instanceof Error)) {
            // Ignore non-error exceptions from the library
          }
        }
      );
    } catch (error: any) {
      console.error('❌ [DEBUG] Error starting QR scan:', error);
      this.scanError.set('Error al acceder a la cámara: ' + error.message);
      this.isScanning.set(false);
    }
  }

  stopScanning(): void {
    console.log('🔍 [DEBUG] Stopping QR code scan');
    // Note: ZXing continuous scanning stops automatically when component is destroyed
    // or when we navigate away. We just update the UI state here.
    this.isScanning.set(false);
    this.codeReader = null; // Clear reference to allow garbage collection
  }

  private onQrCodeScanned(qrData: string): void {
    try {
      console.log('🔍 [DEBUG] Processing scanned QR data:', qrData);
      const parsed = JSON.parse(qrData);

      if (parsed.type === 'queue-entry' && parsed.id) {
        // Extract verification code from queue entry
        const entry = this.queueService.getQueueEntry(parsed.id);
        entry.subscribe(queueEntry => {
          if (queueEntry && queueEntry.verificationCode) {
            console.log('✅ [DEBUG] Extracted verification code from QR:', queueEntry.verificationCode);
            this.codeInput.set(queueEntry.verificationCode);
            this.stopScanning();
            // Auto-validate
            this.validateCode();
          } else {
            this.scanError.set('Código QR no válido o entrada expirada');
          }
        });
      } else {
        this.scanError.set('Código QR no reconocido');
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error parsing QR data:', error);
      this.scanError.set('Error al procesar el código QR');
    }
  }
}