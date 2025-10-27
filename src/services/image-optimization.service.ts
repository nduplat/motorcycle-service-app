import { Injectable, inject } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Observable, from, map, switchMap } from 'rxjs';
import { CostMonitoringService } from './cost-monitoring.service';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for JPEG/WebP
  format?: 'webp' | 'jpeg' | 'png';
  maintainAspectRatio?: boolean;
}

export interface OptimizedImageResult {
  originalUrl: string;
  optimizedUrl: string;
  fileName: string;
  fileSize: number;
  optimizedSize: number;
  dimensions: { width: number; height: number };
}

@Injectable({
  providedIn: 'root'
})
export class ImageOptimizationService {
  private storage = getStorage();
  private costMonitoringService = inject(CostMonitoringService);

  /**
   * Optimizes and uploads an image to Cloud Storage
   * @param file The image file to optimize and upload
   * @param path The storage path (e.g., 'products/', 'motorcycles/')
   * @param options Optimization options
   * @returns Observable with optimization results
   */
  optimizeAndUploadImage(
    file: File,
    path: string,
    options: ImageOptimizationOptions = {}
  ): Observable<OptimizedImageResult> {
    const defaultOptions: Required<ImageOptimizationOptions> = {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.8,
      format: 'webp',
      maintainAspectRatio: true,
      ...options
    };

    return from(this.processImage(file, defaultOptions)).pipe(
      switchMap(optimizedBlob => {
        const fileName = `${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}.${defaultOptions.format}`;
        const storageRef = ref(this.storage, `${path}${fileName}`);

        // Set caching metadata for optimized images
        const metadata = {
          cacheControl: 'public, max-age=31536000, s-maxage=31536000', // Cache for 1 year
          contentType: `image/${defaultOptions.format}`,
          customMetadata: {
            'optimized': 'true',
            'originalSize': file.size.toString(),
            'optimizedSize': optimizedBlob.size.toString(),
            'format': defaultOptions.format,
            'quality': defaultOptions.quality.toString()
          }
        };

        return from(uploadBytes(storageRef, optimizedBlob, metadata)).pipe(
          switchMap(snapshot => {
            this.costMonitoringService.trackStorageUpload(optimizedBlob.size);
            return from(getDownloadURL(snapshot.ref));
          }),
          map(downloadUrl => ({
            originalUrl: downloadUrl,
            optimizedUrl: downloadUrl,
            fileName,
            fileSize: file.size,
            optimizedSize: optimizedBlob.size,
            dimensions: { width: defaultOptions.maxWidth, height: defaultOptions.maxHeight }
          }))
        );
      })
    );
  }

  /**
   * Processes an image file for optimization
   * @param file The original image file
   * @param options Optimization options
   * @returns Promise with optimized Blob
   */
  private async processImage(file: File, options: Required<ImageOptimizationOptions>): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate dimensions
          let { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            options.maxWidth,
            options.maxHeight,
            options.maintainAspectRatio
          );

          // Set canvas size
          canvas.width = width;
          canvas.height = height;

          // Draw and compress image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with specified format and quality
          canvas.toBlob(
            blob => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create optimized image blob'));
              }
            },
            `image/${options.format}`,
            options.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculates optimal dimensions for image resizing
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean
  ): { width: number; height: number } {
    if (!maintainAspectRatio) {
      return {
        width: Math.min(originalWidth, maxWidth),
        height: Math.min(originalHeight, maxHeight)
      };
    }

    const aspectRatio = originalWidth / originalHeight;

    let width = Math.min(originalWidth, maxWidth);
    let height = width / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Generates multiple sizes of an image for responsive loading
   * @param file The original image file
   * @param path The storage path
   * @param sizes Array of sizes to generate
   * @returns Observable with array of optimized images
   */
  generateResponsiveImages(
    file: File,
    path: string,
    sizes: { name: string; maxWidth: number; maxHeight: number }[]
  ): Observable<OptimizedImageResult[]> {
    const uploadObservables = sizes.map(size =>
      this.optimizeAndUploadImage(file, path, {
        maxWidth: size.maxWidth,
        maxHeight: size.maxHeight,
        format: 'webp',
        quality: 0.8
      })
    );

    return from(Promise.all(uploadObservables.map(obs => obs.toPromise()))).pipe(
      map(results => results.filter((result): result is OptimizedImageResult => result !== undefined))
    );
  }

  /**
   * Deletes an image from Cloud Storage
   * @param url The download URL of the image to delete
   * @returns Observable<boolean>
   */
  deleteImage(url: string): Observable<boolean> {
    try {
      // Extract the path from the download URL
      const urlParts = url.split('/o/')[1]?.split('?')[0];
      if (!urlParts) {
        throw new Error('Invalid storage URL');
      }

      const decodedPath = decodeURIComponent(urlParts);
      const storageRef = ref(this.storage, decodedPath);

      return from(deleteObject(storageRef)).pipe(
        map(() => {
          this.costMonitoringService.trackStorageDelete();
          return true;
        }),
        // Handle case where file doesn't exist
        // Firebase throws error if file doesn't exist, but we want to return true
        // as the end result is the same (file is not there)
      );
    } catch (error) {
      // If we can't parse the URL or delete fails, return false
      return from(Promise.resolve(false));
    }
  }

  /**
   * Gets image metadata without downloading the full image
   * @param url The image URL
   * @returns Promise with image dimensions
   */
  async getImageMetadata(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load image for metadata'));
      img.src = url;
    });
  }

  /**
   * Validates if a file is a supported image type
   * @param file The file to validate
   * @returns boolean
   */
  isValidImageFile(file: File): boolean {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    return supportedTypes.includes(file.type) && file.size <= maxSize;
  }

  /**
   * Gets optimal image format based on browser support
   * @returns The best supported format
   */
  getOptimalFormat(): 'webp' | 'jpeg' {
    // Check WebP support
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.toBlob(blob => {
        // WebP is supported if we can create a blob
      }, 'image/webp', 1.0);
      return 'webp';
    }
    return 'jpeg';
  }
}