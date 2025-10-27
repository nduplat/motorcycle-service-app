import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../services/product.service';
import { ServiceItemService } from '../../../services/service-item.service';
import { WorkOrderService } from '../../../services/work-order.service';
import { SupplierService } from '../../../services/supplier.service';
import { UserService } from '../../../services/user.service';
import { QrCodeService } from '../../../services/qr-code.service';

type QrEntityType = 'product' | 'service' | 'work-order' | 'supplier' | 'user' | 'queue-join' | 'entrance';

@Component({
  selector: 'app-qr-generator',
  templateUrl: './qr-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class QrGeneratorComponent implements OnInit {
  private productService = inject(ProductService);
  private serviceItemService = inject(ServiceItemService);
  private workOrderService = inject(WorkOrderService);
  private supplierService = inject(SupplierService);
  private userService = inject(UserService);
  private qrCodeService = inject(QrCodeService);
  private route = inject(ActivatedRoute);

  qrType = signal<QrEntityType>('product');
  selectedId = signal<string>('');
  qrCodeDataUrl = signal<string | null>(null);
  entranceLocations = signal<string[]>(['main', 'express', 'vip']);
  selectedLocation = signal<string>('main');

  // Data sources for dropdowns
  products = this.productService.getProducts();
  services = this.serviceItemService.getServices();
  workOrders = this.workOrderService.getWorkOrders();
  suppliers = this.supplierService.getSuppliers();
  users = this.userService.getUsers();

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const type = params.get('type') as QrEntityType | null;
      const id = params.get('id');
      if (type && id) {
        this.qrType.set(type);
        this.selectedId.set(id);
        this.generateQr();
      }
    });
  }

  onTypeChange(event: Event): void {
    const newType = (event.target as HTMLSelectElement).value as QrEntityType;
    this.qrType.set(newType);
    if (newType === 'queue-join') {
      this.selectedId.set('static');
      this.generateQr();
    } else if (newType === 'entrance') {
      this.selectedId.set('static');
      this.generateQr();
    } else {
      this.selectedId.set('');
      this.qrCodeDataUrl.set(null);
    }
  }

  onIdChange(event: Event): void {
    const newId = (event.target as HTMLSelectElement).value;
    this.selectedId.set(newId);
    this.generateQr();
  }

  onLocationChange(event: Event): void {
    const newLocation = (event.target as HTMLSelectElement).value;
    this.selectedLocation.set(newLocation);
    if (this.qrType() === 'entrance') {
      this.generateQr();
    }
  }

  generateQr(): void {
    const type = this.qrType();
    const id = this.selectedId();
    if (type && id) {
      let url: string;
      if (type === 'entrance') {
        url = this.qrCodeService.generateEntranceQrUrl(this.selectedLocation());
      } else {
        url = this.qrCodeService.generateQrCodeDataUrl(type, id);
      }
      this.qrCodeDataUrl.set(url);
    } else {
      this.qrCodeDataUrl.set(null);
    }
  }

  printQr(): void {
    const dataUrl = this.qrCodeDataUrl();
    if (!dataUrl) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Código QR</title>
            <style>
              @media print {
                @page { size: 3in 3in; margin: 0; }
                body { margin: 0; }
              }
              body { 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100vh;
                margin: 0;
              }
              img { max-width: 90%; max-height: 90%; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" />
            <script>
              window.onload = () => {
                window.print();
                window.onafterprint = () => window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }
}