

import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, afterNextRender, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { GeminiService } from '../../services/gemini.service';
import { Product } from '../../models';
import { LoaderComponent } from '../shared/loader/loader.component';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { NotFoundException, ChecksumException, FormatException } from '@zxing/library';
import { QrValidationService, QrValidationResult } from '../../services/qr-validation.service';


@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoaderComponent]
})
export class ScannerComponent implements OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  
  geminiService = inject(GeminiService);
  router = inject(Router);
  qrValidationService = inject(QrValidationService);
  
  isCameraReady = signal(false);
  isCameraError = signal(false);
  isProcessing = signal(false); // For Gemini processing
  isScanningQr = signal(false); // For QR scanning state
  isFlashing = signal(false); // For shutter flash effect
  qrResultText = signal<string | null>(null);
  error = signal<string | null>(null);
  productData = signal<Partial<Product> | null>(null);

  // Scan History
  scanHistory = signal<Partial<Product>[]>([]);
  isHistoryVisible = signal(false);
  private readonly MAX_HISTORY_ITEMS = 5;
  private readonly HISTORY_STORAGE_KEY = 'scanHistory';
  
  // Camera Selection
  videoDevices = signal<MediaDeviceInfo[]>([]);
  selectedDeviceId = signal<string | undefined>(undefined);
  hasMultipleCameras = computed(() => this.videoDevices().length > 1);

  private stream: MediaStream | null = null;
  private qrReader = new BrowserQRCodeReader();
  private qrReaderControls: IScannerControls | undefined;
  
  constructor() {
    afterNextRender(() => {
      this.setupCamera();
      this.loadHistory();
    });
  }

  async setupCamera() {
    // Reset states for retry logic
    this.isCameraError.set(false);
    this.error.set(null);

    this.stopScanner(); // Stop any existing QR scanner
    this.stopCamera();  // Stop any existing camera stream
    
    if (!this.videoElement) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      this.videoDevices.set(videoInputs);

      if (videoInputs.length === 0) {
        throw new Error('No video input devices found.');
      }

      if (!this.selectedDeviceId() || !videoInputs.find(d => d.deviceId === this.selectedDeviceId())) {
        const backCamera = videoInputs.find(device => device.label.toLowerCase().includes('back'));
        this.selectedDeviceId.set(backCamera ? backCamera.deviceId : videoInputs[0].deviceId);
      }
      
      const constraints = { 
        video: { 
          deviceId: { exact: this.selectedDeviceId() },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.nativeElement.srcObject = this.stream;
      this.videoElement.nativeElement.onloadedmetadata = () => {
          this.isCameraReady.set(true);
          this.startQrScanning();
      };
    } catch (err: any) {
      console.error('Error al acceder a la cámara:', err);
      this.isCameraError.set(true);
      
      let advice = 'Por favor, comprueba que la cámara no esté siendo utilizada por otra aplicación y que los permisos estén concedidos en tu navegador.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        advice = 'Has denegado el permiso para usar la cámara. Por favor, actívalo en los ajustes de tu navegador y pulsa Reintentar.';
      } else if (err.name === 'NotFoundError' || err.message === 'No video input devices found.') {
        advice = 'No hemos encontrado una cámara en tu dispositivo. Asegúrate de que esté conectada correctamente.';
      }
      
      this.error.set(`Para escanear repuestos con IA y códigos QR, necesitamos acceso a tu cámara. ${advice}`);
    }
  }

  startQrScanning(): void {
    if (!this.videoElement || this.isScanningQr()) return;
    this.isScanningQr.set(true);
    
    try {
        this.qrReader.decodeFromVideoDevice(undefined, this.videoElement.nativeElement, (result, error, controls) => {
            this.qrReaderControls = controls;
            if (result) {
                this.handleQrResult(result.getText());
            }
            // Don't log common "not found" errors to avoid console spam
            if (error && !(error instanceof NotFoundException) && !(error instanceof ChecksumException) && !(error instanceof FormatException)) {
                console.error('QR Scan error:', error);
            }
        });
    } catch (err) {
        console.error("Failed to start QR decoding", err);
        this.error.set('No se pudo iniciar el escáner de QR. Intenta recargar la página.');
    }
  }

  async handleQrResult(text: string): Promise<void> {
    if (!this.isScanningQr()) return; // Prevent multiple triggers if detection is rapid

    this.isScanningQr.set(false); // Stop further processing
    this.stopScanner();

    this.qrResultText.set(`Código QR detectado. Procesando...`);
    try {
        const data = JSON.parse(text);
        if (typeof data.type === 'string' && data.type.trim() !== '' && typeof data.id === 'string' && data.id.trim() !== '') {
            // Check if this is a queue-entry QR code
            if (data.type === 'queue-entry') {
                await this.handleQueueEntryValidation(text);
            } else {
                this.qrResultText.set(`Código QR de '${data.type}' detectado. Redirigiendo...`);
                this.navigateToEntity(data.type, data.id);
            }
        } else {
            this.qrResultText.set(null); // Clear processing message
            this.error.set("Código QR inválido. Debe ser un JSON con campos 'type' y 'id' de tipo texto no vacíos.");
        }
    } catch (e) {
        this.qrResultText.set(null); // Clear processing message
        this.error.set(`El código QR no contiene un formato JSON válido.`);
    }
  }
  
  navigateToEntity(type: string, id: string): void {
      let path = '';
      switch(type) {
          case 'product': path = `/admin/products/${id}/edit`; break;
          case 'service': path = `/admin/services`; break;
          case 'work-order': path = `/admin/work-orders/${id}`; break;
          case 'supplier': path = `/admin/suppliers`; break;
          case 'user': path = `/admin/users`; break;
          case 'queue-join': path = `/queue/join`; break; // Navigate to queue join page - for workshop door QR
          case 'entrance':
            // Handle entrance QR - redirect to queue join with source parameter
            path = `/queue/join?source=entrance&location=${id || 'main'}`;
            break;
          default:
            this.error.set(`Tipo de QR desconocido: ${type}`);
            this.qrResultText.set(null); // Clear "Redirigiendo..." UI state.
            return;
      }
      this.router.navigateByUrl(path);
   }

  /**
   * Handle queue entry QR validation
   */
  private async handleQueueEntryValidation(qrData: string): Promise<void> {
    try {
      this.qrResultText.set('Validando entrada de cola...');

      const validationResult: QrValidationResult = await this.qrValidationService.validateQueueEntryQr(qrData);

      if (validationResult.success) {
        this.qrResultText.set('✅ Validación exitosa. Servicio iniciado.');
        this.error.set(null);

        // Show success message for a few seconds, then reset
        setTimeout(() => {
          this.resetScanner();
        }, 3000);
      } else {
        this.qrResultText.set(null);
        this.error.set(`❌ Validación fallida: ${validationResult.error}`);
      }
    } catch (error) {
      console.error('Error validating queue entry QR:', error);
      this.qrResultText.set(null);
      this.error.set('Error al validar el código QR de la cola.');
    }
  }

  captureImage() {
    if (!this.videoElement || !this.isCameraReady() || this.isProcessing() || this.qrResultText()) return;

    this.isProcessing.set(true);
    this.productData.set(null);
    this.error.set(null);
    this.stopScanner(); // Stop QR scanning to focus on capture

    this.isFlashing.set(true);
    setTimeout(() => this.isFlashing.set(false), 150);
    
    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg');
      this.identifyProduct(base64Image);
    } else {
        this.error.set('No se pudo procesar la imagen.');
        this.isProcessing.set(false);
    }
  }
  
  async identifyProduct(base64Image: string) {
    if (!this.geminiService.isConfigured()) {
        this.error.set('La clave de API de Gemini no está configurada. Esta función está deshabilitada.');
        this.isProcessing.set(false);
        return;
    }

    try {
      const result = await this.geminiService.identifyProduct(base64Image);
      
      // Check if Gemini returned a result but couldn't identify key properties.
      if (result && (!result.name && !result.brand && !result.sku)) {
        this.error.set('No pudimos identificar los detalles del repuesto. Intenta con una foto más clara, bien iluminada y sin distracciones de fondo.');
      } else {
        this.productData.set(result);
        this.addToHistory(result);
      }
    } catch (err: any) {
        console.error('Error identifying product with Gemini:', err);
        this.error.set('Ocurrió un error de comunicación con el servicio de IA. Por favor, inténtalo de nuevo más tarde.');
    } finally {
        this.isProcessing.set(false);
    }
  }

  saveScanResult(): void {
    const product = this.productData();
    if (product) {
      // Navigate to the product form and pass the scanned data in the state
      this.router.navigate(['/admin/products/new'], { state: { scannedProduct: product } });
    }
  }

  resetScanner() {
    this.productData.set(null);
    this.error.set(null);
    this.isProcessing.set(false);
    this.qrResultText.set(null);
    this.isHistoryVisible.set(false);
    this.startQrScanning(); // Restart QR scanning
  }

  // --- Camera Controls ---
  switchCamera(): void {
    if (!this.hasMultipleCameras()) return;

    const devices = this.videoDevices();
    const currentIndex = devices.findIndex(device => device.deviceId === this.selectedDeviceId());
    const nextIndex = (currentIndex + 1) % devices.length;
    this.selectedDeviceId.set(devices[nextIndex].deviceId);
    
    this.setupCamera(); // Re-initialize camera with new device
  }

  // --- History Methods ---
  private loadHistory(): void {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem(this.HISTORY_STORAGE_KEY);
      if (savedHistory) {
        try {
          this.scanHistory.set(JSON.parse(savedHistory));
        } catch (e) {
          console.error('Error parsing scan history from localStorage', e);
          localStorage.removeItem(this.HISTORY_STORAGE_KEY);
        }
      }
    }
  }

  private addToHistory(product: Partial<Product>): void {
    this.scanHistory.update(history => {
      const isDuplicate = history.some(item => 
        item.name === product.name && item.brand === product.brand && item.sku === product.sku
      );
      if (isDuplicate) {
        return history;
      }
      const newHistory = [product, ...history];
      return newHistory.slice(0, this.MAX_HISTORY_ITEMS);
    });
    this.saveHistory();
  }

  private saveHistory(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(this.scanHistory()));
    }
  }

  toggleHistory(): void {
    this.isHistoryVisible.update(v => !v);
  }

  selectHistoryItem(product: Partial<Product>): void {
    this.productData.set(product);
    this.error.set(null);
    this.qrResultText.set(null);
    this.isHistoryVisible.set(false);
  }

  clearHistory(): void {
    if (confirm('¿Estás seguro de que quieres borrar el historial de escaneo?')) {
      this.scanHistory.set([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.HISTORY_STORAGE_KEY);
      }
      this.isHistoryVisible.set(false);
    }
  }

  ngOnDestroy() {
    this.stopCamera();
    this.stopScanner();
  }

  private stopScanner(): void {
     if (this.qrReaderControls) {
        this.qrReaderControls.stop();
        this.qrReaderControls = undefined;
     }
     this.isScanningQr.set(false);
  }

  private stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.isCameraReady.set(false);
  }
}
