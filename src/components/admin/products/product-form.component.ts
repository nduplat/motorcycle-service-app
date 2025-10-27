import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { CategoryService } from '../../../services/category.service';
import { SupplierService } from '../../../services/supplier.service';
import { LocationService } from '../../../services/location.service';
import { ImageOptimizationService } from '../../../services/image-optimization.service';
import { Product, ProductVariant } from '../../../models';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { switchMap, of, debounceTime, distinctUntilChanged } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ProductBasicInfoComponent } from './product-basic-info.component';
import { ProductPricingComponent } from './product-pricing.component';
import { ProductInventoryComponent } from './product-inventory.component';
import { ProductVariantsComponent } from './product-variants.component';
import { ProductMediaComponent } from './product-media.component';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LoaderComponent,
    ProductBasicInfoComponent,
    ProductPricingComponent,
    ProductInventoryComponent,
    ProductVariantsComponent,
    ProductMediaComponent
  ]
})
export class ProductFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  categoryService = inject(CategoryService);
  supplierService = inject(SupplierService);
  locationService = inject(LocationService);
  private imageOptimizationService = inject(ImageOptimizationService);

  // State signals
  isSubmitting = signal(false);
  isLoading = signal(true);
  productId = signal<string | null>(null);
  showVariantsSection = signal(false);
  activeTab = signal<'basic' | 'pricing' | 'inventory' | 'variants' | 'media'>('basic');

  private originalProduct: Product | undefined;
  private destroy$ = new Subject<void>();
  images: any[] = [];

  // Computed data
  categories = this.categoryService.getCategories();
  suppliers = this.supplierService.getSuppliers();
  workshopLocations = computed(() => this.locationService.getActiveLocations());
  pageTitle = computed(() => this.productId() ? 'Editar Producto' : 'Crear Nuevo Producto');

  // Form management
  productForm = this.fb.group({
    // Basic Information
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    sku: ['', [Validators.pattern(/^[A-Z0-9\-_]{0,50}$/)]],
    barcode: ['', [Validators.pattern(/^[0-9]{8,13}$/)]],
    description: ['', [Validators.maxLength(1000)]],
    brand: ['', [Validators.maxLength(100)]],
    manufacturer: ['', [Validators.maxLength(100)]],
    categoryId: ['', Validators.required],
    
    // Pricing
    purchasePrice: [0, [Validators.min(0), Validators.max(999999999)]],
    sellingPrice: [0, [Validators.required, Validators.min(1), Validators.max(999999999)]],
    taxPercent: [19, [Validators.min(0), Validators.max(100)]],
    
    // Inventory
    stock: [0, [Validators.required, Validators.min(0), Validators.max(999999)]],
    minStock: [0, [Validators.min(0), Validators.max(999999)]],
    workshopLocationId: [''],
    
    // Specifications
    weightKg: [null as number | null, [Validators.min(0), Validators.max(1000)]],
    dimensionsW: [null as number | null, [Validators.min(0), Validators.max(1000)]],
    dimensionsH: [null as number | null, [Validators.min(0), Validators.max(1000)]],
    dimensionsD: [null as number | null, [Validators.min(0), Validators.max(1000)]],
    
    // Media and Status
    images: [''],
    isActive: [true, Validators.required],
    
    // Relations
    suppliers: [[] as string[]],
    compatibleBrands: [''],
    compatibleModels: [''],
    
    // Variants
    variants: this.fb.array([])
  });

  get variantsFormArray() {
    return this.productForm.get('variants') as FormArray;
  }

  ngOnInit(): void {
    this.loadProductData();
    this.setupFormValidations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFormValidations(): void {
    // Add real-time validation feedback
    this.productForm.get('name')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => {
      if (value && value.length < 2) {
        this.productForm.get('name')?.setErrors({ minLength: true });
      }
    });

    // Auto-generate SKU if not provided
    this.productForm.get('name')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(name => {
      const currentSku = this.productForm.get('sku')?.value;
      if (!currentSku && name) {
        const autoSku = this.generateSKU(name);
        this.productForm.get('sku')?.setValue(autoSku);
      }
    });
  }

  private generateSKU(name: string): string {
    const clean = name.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 3)
      .map(word => word.substring(0, 3))
      .join('');
    
    const timestamp = Date.now().toString().slice(-4);
    return `${clean}-${timestamp}`;
  }

  private loadProductData(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (id) {
          this.productId.set(id);
          return this.productService.getProduct(id);
        }
        this.isLoading.set(false);
        return of(undefined);
      }),
      takeUntil(this.destroy$)
    ).subscribe(product => {
      if (product) {
        this.loadEditMode(product);
      } else {
        this.loadCreateMode();
      }
      this.isLoading.set(false);
    });
  }

  private loadEditMode(product: Product): void {
    this.originalProduct = product;

    // Load variants first
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(variant => this.addVariantFromData(variant));
      this.showVariantsSection.set(true);
    }

    // Load existing images
    if (product.images && product.images.length > 0) {
      this.images = product.images.map(url => ({
        id: crypto.randomUUID(),
        url: url,
        uploading: false,
        uploadProgress: 100
      }));
    }

    // Patch form values
    this.productForm.patchValue({
      ...product,
      images: product.images?.join('\n') || '',
      dimensionsW: product.dimensionsCm?.w,
      dimensionsH: product.dimensionsCm?.h,
      dimensionsD: product.dimensionsCm?.d,
      workshopLocationId: product.workshopLocationId || '',
      compatibleBrands: product.compatibleBrands?.join(', ') || '',
      compatibleModels: product.compatibleModels?.join(', ') || '',
    });
  }

  private loadCreateMode(): void {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { scannedProduct: Partial<Product> } | undefined;

    if (state?.scannedProduct) {
      this.productForm.patchValue({
        name: state.scannedProduct.name,
        brand: state.scannedProduct.brand,
        sku: state.scannedProduct.sku,
        description: state.scannedProduct.description,
        compatibleBrands: state.scannedProduct.compatibleBrands?.join(', ') || '',
        compatibleModels: state.scannedProduct.compatibleModels?.join(', ') || '',
      });
    }
  }

  // Tab Navigation
  setActiveTab(tab: 'basic' | 'pricing' | 'inventory' | 'variants' | 'media'): void {
    this.activeTab.set(tab);
  }

  // Variants Management
  toggleVariantsSection(): void {
    this.showVariantsSection.set(!this.showVariantsSection());
    if (this.showVariantsSection()) {
      this.setActiveTab('variants');
    }
  }

  addVariant(): void {
    const variantForm = this.fb.group({
      id: [crypto.randomUUID()],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      sku: ['', [Validators.pattern(/^[A-Z0-9\-_]{0,50}$/)]],
      stock: [0, [Validators.min(0), Validators.max(999999)]],
      additionalPrice: [0, [Validators.min(0), Validators.max(999999)]],
      attributes: this.fb.record({})
    });

    this.variantsFormArray.push(variantForm);
  }

  private addVariantFromData(variant: ProductVariant): void {
    const attributesRecord = this.fb.record({});
    if (variant.attributes) {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        attributesRecord.addControl(key, new FormControl(value));
      });
    }

    const variantForm = this.fb.group({
      id: [variant.id || crypto.randomUUID()],
      name: [variant.name, [Validators.required, Validators.maxLength(100)]],
      sku: [variant.sku, [Validators.pattern(/^[A-Z0-9\-_]{0,50}$/)]],
      stock: [variant.stock || 0, [Validators.min(0), Validators.max(999999)]],
      additionalPrice: [variant.additionalPrice || 0, [Validators.min(0), Validators.max(999999)]],
      attributes: attributesRecord
    });

    this.variantsFormArray.push(variantForm);
  }

  removeVariant(index: number): void {
    if (confirm('¿Eliminar esta variante?')) {
      this.variantsFormArray.removeAt(index);
    }
  }

  addVariantAttribute(variantIndex: number): void {
    const variant = this.variantsFormArray.at(variantIndex);
    const attributes = variant.get('attributes') as FormArray | any;
    
    const key = `attr_${Object.keys(attributes.controls || {}).length + 1}`;
    attributes.addControl(key, new FormControl(''));
  }

  removeVariantAttribute(variantIndex: number, attributeKey: string): void {
    const variant = this.variantsFormArray.at(variantIndex);
    const attributes = variant.get('attributes') as any;
    attributes.removeControl(attributeKey);
  }

  // Form Validation Helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field?.invalid && (field?.dirty || field?.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    if (!field?.errors) return '';

    if (field.errors['required']) return 'Este campo es obligatorio';
    if (field.errors['minLength']) return `Mínimo ${field.errors['minLength'].requiredLength} caracteres`;
    if (field.errors['maxLength']) return `Máximo ${field.errors['maxLength'].requiredLength} caracteres`;
    if (field.errors['min'] && field.errors['min'].min !== undefined) return `Valor mínimo: ${field.errors['min'].min}`;
    if (field.errors['max'] && field.errors['max'].max !== undefined) return `Valor máximo: ${field.errors['max'].max}`;
    if (field.errors['pattern']) return 'Formato inválido';

    return 'Campo inválido';
  }

  // Form Submission
  onSubmit(): void {
    if (this.productForm.invalid) {
      this.markFormGroupTouched();
      this.scrollToFirstError();
      return;
    }

    this.isSubmitting.set(true);
    const productData = this.buildProductData();

    const operation = this.productId()
      ? this.productService.updateProduct({ ...this.originalProduct, ...productData, id: this.productId()! } as Product)
      : this.productService.addProduct(productData as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);

    operation.subscribe({
      next: () => {
        this.router.navigate(['/admin/products']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
      }
    });
  }

  private buildProductData(): any {
    const formValue = this.productForm.getRawValue();
    
    // Process variants
    const processedVariants = formValue.variants
      ?.map((variant: any) => ({
        id: variant.id.startsWith('temp-') ? undefined : variant.id,
        name: variant.name?.trim(),
        sku: variant.sku?.trim() || undefined,
        stock: variant.stock || 0,
        additionalPrice: variant.additionalPrice || 0,
        attributes: variant.attributes || {}
      }))
      .filter((variant: any) => variant.name && variant.name.length > 0);

    // Process dimensions
    const dimensionsCm: any = {};
    if (formValue.dimensionsW) dimensionsCm.w = formValue.dimensionsW;
    if (formValue.dimensionsH) dimensionsCm.h = formValue.dimensionsH;
    if (formValue.dimensionsD) dimensionsCm.d = formValue.dimensionsD;

    const productData = {
      name: formValue.name?.trim(),
      sku: formValue.sku?.trim() || undefined,
      barcode: formValue.barcode?.trim() || undefined,
      description: formValue.description?.trim() || undefined,
      brand: formValue.brand?.trim() || undefined,
      manufacturer: formValue.manufacturer?.trim() || undefined,
      categoryId: formValue.categoryId,
      purchasePrice: formValue.purchasePrice || undefined,
      sellingPrice: formValue.sellingPrice,
      taxPercent: formValue.taxPercent || undefined,
      stock: formValue.stock || 0,
      minStock: formValue.minStock || undefined,
      workshopLocationId: formValue.workshopLocationId || undefined,
      weightKg: formValue.weightKg || undefined,
      dimensionsCm: Object.keys(dimensionsCm).length > 0 ? dimensionsCm : undefined,
      images: formValue.images ? 
        formValue.images.split('\n')
          .map((url: string) => url.trim())
          .filter((url: string) => url && this.isValidUrl(url)) : 
        undefined,
      isActive: formValue.isActive,
      suppliers: (formValue.suppliers?.length ?? 0) > 0 ? formValue.suppliers : undefined,
      compatibleBrands: formValue.compatibleBrands ? 
        formValue.compatibleBrands.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      compatibleModels: formValue.compatibleModels ? 
        formValue.compatibleModels.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      variants: processedVariants?.length > 0 ? processedVariants : undefined,
    };

    // Remove undefined values
    Object.keys(productData).forEach(key => {
      if ((productData as any)[key] === undefined) {
        delete (productData as any)[key];
      }
    });

    return productData;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.productForm.controls).forEach(key => {
      const control = this.productForm.get(key);
      control?.markAsTouched();
      
      if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormArray) {
            arrayControl.markAsTouched();
          }
        });
      }
    });
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstError = document.querySelector('.border-red-500, .border-destructive');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  // Utility methods
  cancel(): void {
    if (this.productForm.dirty && !confirm('¿Descartar los cambios?')) {
      return;
    }
    this.router.navigate(['/admin/products']);
  }

  resetForm(): void {
    if (confirm('¿Restablecer el formulario?')) {
      this.productForm.reset();
      this.variantsFormArray.clear();
      this.showVariantsSection.set(false);
      this.setActiveTab('basic');
    }
  }

  isEditMode(): boolean {
    return !!this.productId();
  }

  onImageSelected(event: any): void {
    // Handle image selection
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type and size
      if (!this.imageOptimizationService.isValidImageFile(file)) {
        continue;
      }

      // Create a temporary image object for preview
      const tempImage = {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        file: file,
        uploading: true,
        uploadProgress: 0
      };
      this.images.push(tempImage);

      // Optimize and upload the image
      this.imageOptimizationService.optimizeAndUploadImage(file, 'products/').subscribe({
        next: (result) => {
          // Update the image object with the optimized URL
          const imageIndex = this.images.findIndex(img => img.id === tempImage.id);
          if (imageIndex !== -1) {
            this.images[imageIndex] = {
              ...this.images[imageIndex],
              url: result.optimizedUrl,
              uploading: false,
              uploadProgress: 100,
              optimizedSize: result.optimizedSize,
              originalSize: result.fileSize
            };

            // Update the form with the new image URL
            this.updateFormImages();
          }
        },
        error: (error) => {
           // Remove the failed image from the list
           const imageIndex = this.images.findIndex(img => img.id === tempImage.id);
           if (imageIndex !== -1) {
             this.images.splice(imageIndex, 1);
           }
         }
      });
    }
  }

  removeImage(image: any): void {
    const index = this.images.indexOf(image);
    if (index > -1) {
      // If the image has been uploaded to Cloud Storage, we should delete it
      if (image.url && image.url.includes('firebasestorage.googleapis.com')) {
        this.imageOptimizationService.deleteImage(image.url).subscribe();
      }
      this.images.splice(index, 1);
      this.updateFormImages();
    }
  }

  private updateFormImages(): void {
    // Update the form with current uploaded image URLs
    const uploadedUrls = this.images
      .filter(img => img.url && !img.uploading && img.url.includes('firebasestorage.googleapis.com'))
      .map(img => img.url);

    this.productForm.get('images')?.setValue(uploadedUrls.join('\n'));
  }
}