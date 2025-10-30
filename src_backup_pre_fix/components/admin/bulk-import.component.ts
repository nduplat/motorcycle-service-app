import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { SupplierService } from '../../services/supplier.service';

interface ImportResult {
  success: boolean;
  message: string;
  data?: any;
}

@Component({
  selector: 'app-bulk-import',
  template: `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold">Importación Masiva de Datos</h1>
        <a routerLink="/admin/products" class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80">
          Volver a Productos
        </a>
      </div>

      <!-- Import Options -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Products Import -->
        <div class="bg-card rounded-xl border border-border p-6">
          <h2 class="text-xl font-semibold mb-4">Importar Productos</h2>
          <p class="text-sm text-muted-foreground mb-4">
            Importa productos desde un archivo CSV con las siguientes columnas:
            nombre, sku, descripcion, categoria, marca, precio_compra, precio_venta, stock, stock_minimo
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Archivo CSV</label>
              <input
                type="file"
                accept=".csv"
                (change)="onProductsFileSelected($event)"
                class="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90">
            </div>

            <button
              (click)="importProducts()"
              [disabled]="!productsFile() || isImportingProducts()"
              class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50">
              @if(isImportingProducts()) {
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2"></div>
              }
              Importar Productos
            </button>
          </div>

          @if(productsImportResult()) {
            <div class="mt-4 p-4 rounded-md" [class]="productsImportResult()?.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
              <p class="text-sm">{{ productsImportResult()?.message }}</p>
            </div>
          }
        </div>

        <!-- Categories Import -->
        <div class="bg-card rounded-xl border border-border p-6">
          <h2 class="text-xl font-semibold mb-4">Importar Categorías</h2>
          <p class="text-sm text-muted-foreground mb-4">
            Importa categorías desde un archivo CSV con las siguientes columnas:
            nombre, slug, descripcion
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Archivo CSV</label>
              <input
                type="file"
                accept=".csv"
                (change)="onCategoriesFileSelected($event)"
                class="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90">
            </div>

            <button
              (click)="importCategories()"
              [disabled]="!categoriesFile() || isImportingCategories()"
              class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50">
              @if(isImportingCategories()) {
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2"></div>
              }
              Importar Categorías
            </button>
          </div>

          @if(categoriesImportResult()) {
            <div class="mt-4 p-4 rounded-md" [class]="categoriesImportResult()?.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
              <p class="text-sm">{{ categoriesImportResult()?.message }}</p>
            </div>
          }
        </div>
      </div>

      <!-- Sample CSV Templates -->
      <div class="bg-card rounded-xl border border-border p-6">
        <h2 class="text-xl font-semibold mb-4">Plantillas de CSV</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-medium mb-2">Plantilla de Productos</h3>
            <div class="bg-secondary/20 p-4 rounded-md text-sm font-mono">
              nombre,sku,descripcion,categoria,marca,precio_compra,precio_venta,stock,stock_minimo<br>
              "Aceite Motul","ACEITE-001","Aceite sintético","Aceites","Motul","50000","63000","25","3"<br>
              "Pastillas de Freno","FRENO-001","Pastillas delanteras","Frenos","Brembo","120000","180000","15","3"
            </div>
            <button (click)="downloadProductsTemplate()" class="mt-2 px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/80">
              Descargar Plantilla
            </button>
          </div>

          <div>
            <h3 class="font-medium mb-2">Plantilla de Categorías</h3>
            <div class="bg-secondary/20 p-4 rounded-md text-sm font-mono">
              nombre,slug,descripcion<br>
              "Neumáticos","neumaticos","Componentes de neumáticos y llantas"<br>
              "Frenos","frenos","Sistemas de frenado y accesorios"
            </div>
            <button (click)="downloadCategoriesTemplate()" class="mt-2 px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/80">
              Descargar Plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class BulkImportComponent {
  // File signals
  productsFile = signal<File | null>(null);
  categoriesFile = signal<File | null>(null);

  // Import states
  isImportingProducts = signal(false);
  isImportingCategories = signal(false);

  // Results
  productsImportResult = signal<ImportResult | null>(null);
  categoriesImportResult = signal<ImportResult | null>(null);

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private supplierService: SupplierService
  ) {}

  onProductsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.productsFile.set(input.files[0]);
      this.productsImportResult.set(null);
    }
  }

  onCategoriesFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.categoriesFile.set(input.files[0]);
      this.categoriesImportResult.set(null);
    }
  }

  async importProducts(): Promise<void> {
    const file = this.productsFile();
    if (!file) return;

    this.isImportingProducts.set(true);
    this.productsImportResult.set(null);

    try {
      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      const products = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const product = {
            nombre: values[0],
            sku: values[1],
            descripcion: values[2],
            categoria: values[3],
            marca: values[4],
            precio_compra: parseFloat(values[5]) || 0,
            precio_venta: parseFloat(values[6]) || 0,
            stock: parseInt(values[7]) || 0,
            stock_minimo: parseInt(values[8]) || 0
          };
          products.push(product);
        }
      }

      // Get existing categories to map category names to IDs
      const existingCategories = this.categoryService.getCategories()();
      const categoryMap = new Map<string, string>();
      existingCategories.forEach(cat => categoryMap.set(cat.name.toLowerCase(), cat.id));

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const product of products) {
        try {
          // Find category ID by name
          const categoryId = categoryMap.get(product.categoria.toLowerCase());

          if (!categoryId && product.categoria) {
            errors.push(`Categoría "${product.categoria}" no encontrada para producto "${product.nombre}"`);
            errorCount++;
            continue;
          }

          // Create product using service
          await this.productService.addProduct({
            name: product.nombre,
            sku: product.sku,
            description: product.descripcion,
            brand: product.marca,
            purchasePrice: product.precio_compra,
            sellingPrice: product.precio_venta,
            price: product.precio_venta, // Use selling price as main price
            stock: product.stock,
            minStock: product.stock_minimo,
            categoryId: categoryId || undefined,
            isActive: true,
            compatibleBrands: [],
            compatibleModels: []
          }).toPromise();

          successCount++;
        } catch (error: any) {
          errors.push(`Error importando "${product.nombre}": ${error.message}`);
          errorCount++;
        }
      }

      const message = `Importación completada: ${successCount} productos importados exitosamente.`;
      if (errorCount > 0) {
        this.productsImportResult.set({
          success: errorCount === 0,
          message: `${message} ${errorCount} errores: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
        });
      } else {
        this.productsImportResult.set({
          success: true,
          message: message
        });
      }

    } catch (error) {
      this.productsImportResult.set({
        success: false,
        message: `Error al procesar el archivo: ${error}`
      });
    } finally {
      this.isImportingProducts.set(false);
    }
  }

  async importCategories(): Promise<void> {
    const file = this.categoriesFile();
    if (!file) return;

    this.isImportingCategories.set(true);
    this.categoriesImportResult.set(null);

    try {
      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      const categories = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const category = {
            nombre: values[0],
            slug: values[1],
            descripcion: values[2]
          };
          categories.push(category);
        }
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const category of categories) {
        try {
          // Create category using service
          await this.categoryService.addCategory({
            name: category.nombre,
            description: category.descripcion
          }).toPromise();

          successCount++;
        } catch (error: any) {
          errors.push(`Error importando "${category.nombre}": ${error.message}`);
          errorCount++;
        }
      }

      const message = `Importación completada: ${successCount} categorías importadas exitosamente.`;
      if (errorCount > 0) {
        this.categoriesImportResult.set({
          success: errorCount === 0,
          message: `${message} ${errorCount} errores: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
        });
      } else {
        this.categoriesImportResult.set({
          success: true,
          message: message
        });
      }

    } catch (error) {
      this.categoriesImportResult.set({
        success: false,
        message: `Error al procesar el archivo: ${error}`
      });
    } finally {
      this.isImportingCategories.set(false);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim().replace(/"/g, ''));
    return result;
  }

  downloadProductsTemplate(): void {
    const template = `nombre,sku,descripcion,categoria,marca,precio_compra,precio_venta,stock,stock_minimo
"Aceite Motul","ACEITE-001","Aceite sintético","Aceites","Motul","50000","63000","25","3"
"Pastillas de Freno","FRENO-001","Pastillas delanteras","Frenos","Brembo","120000","180000","15","3"`;

    this.downloadFile(template, 'plantilla_productos.csv');
  }

  downloadCategoriesTemplate(): void {
    const template = `nombre,slug,descripcion
"Neumáticos","neumaticos","Componentes de neumáticos y llantas"
"Frenos","frenos","Sistemas de frenado y accesorios"`;

    this.downloadFile(template, 'plantilla_categorias.csv');
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}