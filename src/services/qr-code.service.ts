import { Injectable } from '@angular/core';

// This will be a global from the script tag in index.html
declare var qrcode: any;

@Injectable({
  providedIn: 'root'
})
export class QrCodeService {
  /**
   * Generates a QR code containing a JSON payload with the entity type and ID.
   * @param type The type of the entity (e.g., 'product', 'work-order').
   * @param id The Firestore document ID of the entity.
   * @returns A base64 data URL string of the generated QR code image.
   */
  generateQrCodeDataUrl(type: string, id: string): string {
    if (typeof qrcode === 'undefined') {
      console.error('qrcode-generator library is not loaded.');
      return '';
    }

    const payload = JSON.stringify({ type, id });
    const qr = qrcode(0, 'M'); // type 0 = auto, error correction M
    qr.addData(payload);
    qr.make();

    // createDataURL(cellSize, margin)
    return qr.createDataURL(8, 4);
  }

  /**
   * Generates a URL for entrance QR codes that redirect to the queue join flow.
   * @param location The location identifier (e.g., 'main', 'express', 'vip').
   * @returns A URL string for the entrance QR code.
   */
  generateEntranceQrUrl(location: string): string {
    // Get the current origin (protocol + host + port)
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bluedragion.com';
    return `${origin}/queue/join?source=entrance&location=${encodeURIComponent(location)}`;
  }
}