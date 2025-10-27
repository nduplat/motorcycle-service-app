import { Injectable } from '@angular/core';
import { Motorcycle, MotorcycleCategory, MotorcycleType } from '../models';

@Injectable({
  providedIn: 'root',
})
export class MotorcycleCategorizationService {

  // CC Range definitions (cilindrada)
  private readonly CC_RANGES = {
    bajo_cc: { min: 0, max: 250 },      // Bajo CC: 0-250cc
    mediano_cc: { min: 251, max: 650 }, // Mediano CC: 251-650cc
    alto_cc: { min: 651, max: 9999 }    // Alto CC: 651cc+
  };

  // Motorcycle type definitions with keywords
  private readonly TYPE_KEYWORDS: Record<MotorcycleType, string[]> = {
    naked: ['naked', 'street', 'urban', 'standard'],
    sport: ['sport', 'racing', 'super sport', 'ss', 'r6', 'r1', 'zx', 'gsx-r'],
    touring: ['touring', 'gt', 'grand touring', 'adventure touring'],
    cruiser: ['cruiser', 'chopper', 'bobber', 'custom cruiser'],
    off_road: ['off road', 'enduro', 'motocross', 'mx', 'dirt', 'trail'],
    adventure: ['adventure', 'adv', 'dual sport', 'rally'],
    scooter: ['scooter', 'maxi scooter', 'vespa', 'automatic'],
    cafe_racer: ['cafe racer', 'café racer', 'caferacer', 'classic racer'],
    bobber: ['bobber', 'chopper', 'custom'],
    chopper: ['chopper', 'bobber', 'custom chopper'],
    custom: ['custom', 'bagger', 'special'],
    vintage: ['vintage', 'classic', 'retro', 'old school']
  };

  /**
   * Automatically categorize motorcycle based on displacement
   */
  categorizeByCC(displacementCc?: number): MotorcycleCategory | undefined {
    if (!displacementCc) return undefined;

    if (displacementCc <= this.CC_RANGES.bajo_cc.max) return 'bajo_cc';
    if (displacementCc <= this.CC_RANGES.mediano_cc.max) return 'mediano_cc';
    return 'alto_cc';
  }

  /**
   * Get CC range label
   */
  getCCRangeLabel(category: MotorcycleCategory): string {
    switch (category) {
      case 'bajo_cc': return 'Bajo CC (≤250cc)';
      case 'mediano_cc': return 'Mediano CC (251-650cc)';
      case 'alto_cc': return 'Alto CC (≥651cc)';
      default: return 'Sin Categoría';
    }
  }

  /**
   * Get CC range color for UI
   */
  getCCRangeColor(category: MotorcycleCategory): string {
    switch (category) {
      case 'bajo_cc': return 'bg-green-100 text-green-800';
      case 'mediano_cc': return 'bg-blue-100 text-blue-800';
      case 'alto_cc': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Suggest motorcycle type based on model name and description
   */
  suggestType(motorcycle: Partial<Motorcycle>): MotorcycleType | undefined {
    const searchText = `${motorcycle.brand} ${motorcycle.model} ${motorcycle.description || ''} ${motorcycle.subType || ''}`.toLowerCase();

    for (const [type, keywords] of Object.entries(this.TYPE_KEYWORDS)) {
      if (keywords.some(keyword => searchText.includes(keyword))) {
        return type as MotorcycleType;
      }
    }

    return undefined;
  }

  /**
   * Get motorcycle type label
   */
  getTypeLabel(type: MotorcycleType): string {
    const labels: Record<MotorcycleType, string> = {
      naked: 'Naked',
      sport: 'Deportiva',
      touring: 'Touring',
      cruiser: 'Cruiser',
      off_road: 'Off Road',
      adventure: 'Adventure',
      scooter: 'Scooter',
      cafe_racer: 'Café Racer',
      bobber: 'Bobber',
      chopper: 'Chopper',
      custom: 'Custom',
      vintage: 'Vintage'
    };
    return labels[type] || type;
  }

  /**
   * Get motorcycle type color for UI
   */
  getTypeColor(type: MotorcycleType): string {
    const colors: Record<MotorcycleType, string> = {
      naked: 'bg-purple-100 text-purple-800',
      sport: 'bg-red-100 text-red-800',
      touring: 'bg-blue-100 text-blue-800',
      cruiser: 'bg-orange-100 text-orange-800',
      off_road: 'bg-green-100 text-green-800',
      adventure: 'bg-teal-100 text-teal-800',
      scooter: 'bg-pink-100 text-pink-800',
      cafe_racer: 'bg-indigo-100 text-indigo-800',
      bobber: 'bg-yellow-100 text-yellow-800',
      chopper: 'bg-gray-100 text-gray-800',
      custom: 'bg-slate-100 text-slate-800',
      vintage: 'bg-amber-100 text-amber-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Group motorcycles by category
   */
  groupByCategory(motorcycles: Motorcycle[]): Record<MotorcycleCategory, Motorcycle[]> {
    const groups: Record<MotorcycleCategory, Motorcycle[]> = {
      bajo_cc: [],
      mediano_cc: [],
      alto_cc: []
    };

    motorcycles.forEach(motorcycle => {
      const category = motorcycle.category || this.categorizeByCC(motorcycle.displacementCc);
      if (category && groups[category]) {
        groups[category].push(motorcycle);
      }
    });

    return groups;
  }

  /**
   * Group motorcycles by type
   */
  groupByType(motorcycles: Motorcycle[]): Record<MotorcycleType, Motorcycle[]> {
    const groups: Record<string, Motorcycle[]> = {};

    // Initialize all types
    Object.keys(this.TYPE_KEYWORDS).forEach(type => {
      groups[type] = [];
    });

    motorcycles.forEach(motorcycle => {
      const type = motorcycle.type || 'custom';
      if (groups[type]) {
        groups[type].push(motorcycle);
      }
    });

    return groups as Record<MotorcycleType, Motorcycle[]>;
  }

  /**
   * Group motorcycles by brand
   */
  groupByBrand(motorcycles: Motorcycle[]): Record<string, Motorcycle[]> {
    const groups: Record<string, Motorcycle[]> = {};

    motorcycles.forEach(motorcycle => {
      const brand = motorcycle.brand || 'Sin Marca';
      if (!groups[brand]) {
        groups[brand] = [];
      }
      groups[brand].push(motorcycle);
    });

    return groups;
  }

  /**
   * Group motorcycles by year range
   */
  groupByYearRange(motorcycles: Motorcycle[]): Record<string, Motorcycle[]> {
    const groups: Record<string, Motorcycle[]> = {};

    motorcycles.forEach(motorcycle => {
      const year = motorcycle.year;
      let range: string;

      if (year >= 2020) range = '2020+';
      else if (year >= 2010) range = '2010-2019';
      else if (year >= 2000) range = '2000-2009';
      else if (year >= 1990) range = '1990-1999';
      else range = 'Antes de 1990';

      if (!groups[range]) {
        groups[range] = [];
      }
      groups[range].push(motorcycle);
    });

    return groups;
  }

  /**
   * Group motorcycles by specific year
   */
  groupByYear(motorcycles: Motorcycle[]): Record<number, Motorcycle[]> {
    const groups: Record<number, Motorcycle[]> = {};

    motorcycles.forEach(motorcycle => {
      const year = motorcycle.year;
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(motorcycle);
    });

    return groups;
  }

  /**
   * Get available years for filtering
   */
  getAvailableYears(motorcycles: Motorcycle[]): number[] {
    const years = new Set(motorcycles.map(m => m.year));
    return Array.from(years).sort((a, b) => b - a); // Most recent first
  }

  /**
   * Smart search with multiple criteria
   */
  searchMotorcycles(motorcycles: Motorcycle[], query: string, filters?: {
    category?: MotorcycleCategory;
    type?: MotorcycleType;
    brand?: string;
    minYear?: number;
    maxYear?: number;
    minCC?: number;
    maxCC?: number;
    features?: string[];
  }): Motorcycle[] {
    let results = motorcycles;

    // Text search
    if (query?.trim()) {
      const searchTerm = query.toLowerCase().trim();
      results = results.filter(motorcycle =>
        motorcycle.brand.toLowerCase().includes(searchTerm) ||
        motorcycle.model.toLowerCase().includes(searchTerm) ||
        motorcycle.description?.toLowerCase().includes(searchTerm) ||
        motorcycle.subType?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter(m => m.category === filters.category);
      }

      if (filters.type) {
        results = results.filter(m => m.type === filters.type);
      }

      if (filters.brand) {
        results = results.filter(m => m.brand.toLowerCase() === filters.brand!.toLowerCase());
      }

      if (filters.minYear) {
        results = results.filter(m => m.year >= filters.minYear!);
      }

      if (filters.maxYear) {
        results = results.filter(m => m.year <= filters.maxYear!);
      }

      if (filters.minCC) {
        results = results.filter(m => (m.displacementCc || 0) >= filters.minCC!);
      }

      if (filters.maxCC) {
        results = results.filter(m => (m.displacementCc || 0) <= filters.maxCC!);
      }

      if (filters.features?.length) {
        results = results.filter(motorcycle =>
          filters.features!.every(feature => {
            switch (feature) {
              case 'abs': return motorcycle.abs === true;
              case 'tractionControl': return motorcycle.tractionControl === true;
              case 'bluetooth': return motorcycle.bluetooth === true;
              case 'cruiseControl': return motorcycle.cruiseControl === true;
              default: return false;
            }
          })
        );
      }
    }

    return results;
  }

  /**
   * Get popular motorcycle types for the region
   */
  getPopularTypes(): { type: MotorcycleType; label: string; count?: number }[] {
    return [
      { type: 'naked', label: 'Naked' },
      { type: 'sport', label: 'Deportiva' },
      { type: 'touring', label: 'Touring' },
      { type: 'cruiser', label: 'Cruiser' },
      { type: 'off_road', label: 'Off Road' },
      { type: 'adventure', label: 'Adventure' },
      { type: 'scooter', label: 'Scooter' }
    ];
  }

  /**
   * Get motorcycle brands (can be expanded with real data)
   */
  getPopularBrands(): string[] {
    return [
      'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'Harley-Davidson',
      'Triumph', 'KTM', 'Royal Enfield', 'Bajaj', 'TVS', 'Hero'
    ];
  }

  /**
   * Validate motorcycle data
   */
  validateMotorcycle(motorcycle: Partial<Motorcycle>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!motorcycle.brand?.trim()) errors.push('Marca es requerida');
    if (!motorcycle.model?.trim()) errors.push('Modelo es requerido');
    if (!motorcycle.year || motorcycle.year < 1900 || motorcycle.year > new Date().getFullYear() + 1) {
      errors.push('Año inválido');
    }

    if (motorcycle.displacementCc && (motorcycle.displacementCc < 50 || motorcycle.displacementCc > 3000)) {
      errors.push('Cilindrada debe estar entre 50cc y 3000cc');
    }

    if (motorcycle.weightKg && (motorcycle.weightKg < 50 || motorcycle.weightKg > 500)) {
      errors.push('Peso debe estar entre 50kg y 500kg');
    }

    if (motorcycle.fuelCapacityL && (motorcycle.fuelCapacityL < 1 || motorcycle.fuelCapacityL > 50)) {
      errors.push('Capacidad de combustible debe estar entre 1L y 50L');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Auto-complete motorcycle data based on existing patterns
   */
  autoComplete(motorcycle: Partial<Motorcycle>): Partial<Motorcycle> {
    const completed = { ...motorcycle };

    // Auto-categorize by CC
    if (!completed.category && completed.displacementCc) {
      completed.category = this.categorizeByCC(completed.displacementCc);
    }

    // Auto-suggest type
    if (!completed.type) {
      completed.type = this.suggestType(completed);
    }

    return completed;
  }
}