import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

@Component({
  selector: 'app-pagination',
  template: `
    @if (meta().totalPages > 1) {
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-card border-t border-border">
        <!-- Results info -->
        <div class="text-sm text-muted-foreground">
          Mostrando {{ meta().startIndex }}-{{ meta().endIndex }} de {{ meta().totalItems }} resultados
        </div>

        <!-- Pagination controls -->
        <div class="flex items-center gap-2">
          <!-- Page size selector -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Mostrar:</span>
            <select
              [value]="meta().pageSize"
              (change)="onPageSizeChange($any($event.target).value)"
              class="px-2 py-1 text-sm bg-background border border-border rounded">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <!-- Page navigation -->
          <div class="flex items-center gap-1">
            <!-- First page -->
            <button
              (click)="onPageChange(1)"
              [disabled]="meta().currentPage === 1"
              class="px-2 py-1 text-sm bg-background border border-border rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Primera página">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            <!-- Previous page -->
            <button
              (click)="onPreviousPage()"
              [disabled]="!meta().hasPreviousPage"
              class="px-2 py-1 text-sm bg-background border border-border rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Página anterior">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <!-- Page numbers -->
            @for (page of visiblePages(); track page) {
              <button
                (click)="onPageChange(page)"
                [class.active]="page === meta().currentPage"
                class="px-3 py-1 text-sm border rounded hover:bg-secondary transition-colors"
                [class]="page === meta().currentPage
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border'">
                {{ page }}
              </button>
            }

            <!-- Next page -->
            <button
              (click)="onNextPage()"
              [disabled]="!meta().hasNextPage"
              class="px-2 py-1 text-sm bg-background border border-border rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Página siguiente">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Last page -->
            <button
              (click)="onPageChange(meta().totalPages)"
              [disabled]="meta().currentPage === meta().totalPages"
              class="px-2 py-1 text-sm bg-background border border-border rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Última página">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Jump to page -->
          <div class="flex items-center gap-2 ml-4">
            <span class="text-sm text-muted-foreground">Ir a:</span>
            <input
              type="number"
              [value]="meta().currentPage"
              (keyup.enter)="onJumpToPage($any($event.target).value)"
              [min]="1"
              [max]="meta().totalPages"
              class="w-16 px-2 py-1 text-sm text-center bg-background border border-border rounded"
              placeholder="Página">
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .active {
      @apply bg-primary text-primary-foreground border-primary;
    }
  `]
})
export class PaginationComponent {
  meta = input.required<PaginationMeta>();

  pageChange = output<number>();
  pageSizeChange = output<number>();

  visiblePages = () => {
    const current = this.meta().currentPage;
    const total = this.meta().totalPages;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < total - 1) {
      rangeWithDots.push('...', total);
    } else if (total > 1) {
      rangeWithDots.push(total);
    }

    return rangeWithDots.filter(item => item !== '...') as number[];
  };

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.meta().totalPages) {
      this.pageChange.emit(page);
    }
  }

  onPreviousPage(): void {
    if (this.meta().hasPreviousPage) {
      this.pageChange.emit(this.meta().currentPage - 1);
    }
  }

  onNextPage(): void {
    if (this.meta().hasNextPage) {
      this.pageChange.emit(this.meta().currentPage + 1);
    }
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSizeChange.emit(pageSize);
  }

  onJumpToPage(pageInput: string): void {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= this.meta().totalPages) {
      this.pageChange.emit(page);
    }
  }
}