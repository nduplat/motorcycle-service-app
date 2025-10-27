/**
 * Validation Service
 * Centralized validation logic for queue join flow
 * Aligned with Firestore data model
 */

import { Injectable } from '@angular/core';
import { Motorcycle, Service, ServiceItem, UserVehicle } from '../models'; // Adjust path as needed

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  suggestions?: string[];
  data?: any;
  severity?: 'error' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ValidationService {

  // ========== PHONE VALIDATION ==========
  
  validatePhone(phone: string): ValidationResult {
    const cleaned = this.cleanPhone(phone);
    
    // Basic format check - Colombian mobile numbers
    if (!/^3\d{9}$/.test(cleaned)) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Formato de teléfono inválido',
        suggestions: [
          '• Debe iniciar con 3 (celular colombiano)',
          '• Debe tener exactamente 10 dígitos',
          '• Solo números, sin espacios ni guiones',
          '• Ejemplo válido: 3123456789'
        ]
      };
    }

    // Check for suspicious patterns
    const suspiciousCheck = this.checkSuspiciousPhone(cleaned);
    if (!suspiciousCheck.isValid) {
      return suspiciousCheck;
    }

    // Check if it's a valid Colombian carrier prefix
    const carrierCheck = this.validateColombianCarrier(cleaned);
    if (!carrierCheck.isValid) {
      return carrierCheck;
    }

    return { 
      isValid: true, 
      data: cleaned,
      message: '✅ Teléfono válido'
    };
  }

  private cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private checkSuspiciousPhone(phone: string): ValidationResult {
    // All same digit (e.g., 3111111111)
    if (/^3(.)\1{8}$/.test(phone)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Número sospechoso - dígitos repetidos',
        suggestions: ['Verifica que el número sea correcto']
      };
    }

    // Sequential patterns (e.g., 3123456789, 3987654321)
    if (/3(123456789|987654321|0123456789)/.test(phone)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Número sospechoso - secuencia detectada',
        suggestions: ['Este patrón no parece un número real']
      };
    }

    // Alternating patterns (e.g., 3131313131)
    if (/^3(.)(.)(\1\2){4}$/.test(phone)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Número sospechoso - patrón alternante',
        suggestions: ['Verifica que sea un número válido']
      };
    }

    return { isValid: true };
  }

  private validateColombianCarrier(phone: string): ValidationResult {
    // Valid Colombian carrier prefixes (updated 2025)
    const validPrefixes = [
      '300', '301', '302', '303', '304', '305', // Claro
      '310', '311', '312', '313', '314', '315', '316', '317', '318', '319', // Movistar
      '320', '321', '322', '323', // Tigo
      '350', '351', // Avantel
      '333' // ETB
    ];

    const prefix = phone.substring(0, 3);
    
    if (!validPrefixes.includes(prefix)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Prefijo de operador no reconocido',
        suggestions: [
          'Verifica que el número sea correcto',
          'El prefijo debe ser de un operador colombiano válido'
        ]
      };
    }

    return { isValid: true };
  }

  // ========== LICENSE PLATE VALIDATION ==========
  
  validateLicensePlate(plate: string): ValidationResult {
    const cleaned = plate.trim().toUpperCase().replace(/\s+/g, '');
    
    // Colombian motorcycle plate formats:
    // Format 1: ABC123 (3 letters + 3 numbers)
    // Format 2: ABC12 (3 letters + 2 numbers) - older format
    // Format 3: ABC12A (3 letters + 2 numbers + 1 letter) - newer format
    const plateRegex = /^[A-Z]{3}(\d{2,3}|\d{2}[A-Z])$/;
    
    if (!plateRegex.test(cleaned)) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Formato de placa inválido',
        suggestions: [
          '• Debe tener 3 letras mayúsculas al inicio',
          '• Seguido de 2-3 números O 2 números + 1 letra',
          '• Ejemplos válidos:',
          '  - ABC123 (formato estándar)',
          '  - XYZ45 (formato antiguo)',
          '  - AAA00A (formato nuevo)',
          '• Tu entrada: "' + plate + '"'
        ]
      };
    }

    // Check for suspicious patterns
    const suspiciousCheck = this.checkSuspiciousPlate(cleaned);
    if (!suspiciousCheck.isValid) {
      return suspiciousCheck;
    }

    return { 
      isValid: true, 
      data: cleaned,
      message: '✅ Placa válida'
    };
  }

  private checkSuspiciousPlate(plate: string): ValidationResult {
    // All same letter (e.g., AAA000)
    if (/^([A-Z])\1{2}/.test(plate)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Placa sospechosa - letras repetidas',
        suggestions: ['Verifica que la placa sea correcta']
      };
    }

    // Sequential numbers (e.g., ABC123, XYZ234)
    if (/(012|123|234|345|456|567|678|789|890)/.test(plate)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Placa sospechosa - números secuenciales',
        suggestions: ['Este patrón es poco común']
      };
    }

    // All same number (e.g., ABC111, XYZ000)
    if (/(\d)\1{2,}/.test(plate)) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Placa sospechosa - números repetidos',
        suggestions: ['Verifica que la placa sea correcta']
      };
    }

    // Test plates (e.g., AAA000, ZZZ999)
    const testPlates = ['AAA000', 'ZZZ999', 'XXX000', 'TTT000'];
    if (testPlates.includes(plate)) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Esta placa es de prueba',
        suggestions: ['Ingresa una placa real']
      };
    }

    return { isValid: true };
  }

  // ========== MILEAGE VALIDATION ==========
  
  validateMileage(mileage: string | number): ValidationResult {
    let value: number;

    if (typeof mileage === 'string') {
      const cleaned = mileage.trim().replace(/[^\d]/g, '');
      value = parseInt(cleaned, 10);
    } else {
      value = mileage;
    }

    // Check if valid number
    if (isNaN(value)) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Kilometraje inválido',
        suggestions: [
          '• Debe ser un número',
          '• Solo dígitos (0-9)',
          '• Ejemplo: 15000'
        ]
      };
    }

    // Check minimum
    if (value < 0) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ El kilometraje no puede ser negativo',
        suggestions: ['Ingresa un valor de 0 o mayor']
      };
    }

    // Check suspiciously low for used motorcycles
    if (value === 0) {
      return {
        isValid: true,
        data: value,
        severity: 'info',
        message: '💡 Kilometraje: 0 km (¿motocicleta nueva?)',
        suggestions: ['Si es usada, verifica el valor']
      };
    }

    // Check suspiciously high
    if (value > 999999) {
      return {
        isValid: false,
        severity: 'warning',
        message: '⚠️ Kilometraje muy alto',
        suggestions: [
          'El valor parece excesivo',
          '¿Estás seguro del kilometraje?',
          'Valor ingresado: ' + value.toLocaleString('es-CO') + ' km'
        ]
      };
    }

    // Warning for very high mileage
    if (value > 100000) {
      return {
        isValid: true,
        data: value,
        severity: 'info',
        message: '💡 Kilometraje alto detectado',
        suggestions: [
          'Valor: ' + value.toLocaleString('es-CO') + ' km',
          'Verifica que sea correcto'
        ]
      };
    }

    return { 
      isValid: true, 
      data: value,
      message: '✅ Kilometraje válido: ' + value.toLocaleString('es-CO') + ' km'
    };
  }

  // ========== SERVICE VALIDATION ==========
  
  /**
   * Validates a service selection against available services
   * @param serviceId - The selected service ID or name
   * @param availableServices - Array of ServiceItem objects from catalog
   */
  validateService(serviceId: string, availableServices: ServiceItem[]): ValidationResult {
    if (!availableServices || availableServices.length === 0) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ No hay servicios disponibles',
        suggestions: ['Contacta al taller directamente']
      };
    }

    const trimmed = serviceId.trim();

    // Try exact ID match first
    let found = availableServices.find(s => s.id === trimmed);

    // Try exact title match (case insensitive)
    if (!found) {
      found = availableServices.find(s =>
        s.title?.toLowerCase() === trimmed.toLowerCase()
      );
    }

    // Partial match if no exact match
    if (!found) {
      found = availableServices.find(s =>
        s.title?.toLowerCase().includes(trimmed.toLowerCase()) ||
        trimmed.toLowerCase().includes(s.title?.toLowerCase() || '')
      );
    }

    if (!found) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Servicio no encontrado',
        suggestions: [
          'Servicios disponibles:',
          ...availableServices.slice(0, 6).map(s =>
            `• ${s.title}${s.price ? ` - $${s.price.toLocaleString('es-CO')}` : ''}`
          )
        ]
      };
    }

    return {
      isValid: true,
      data: found,
      message: `✅ Servicio: ${found.title}`
    };
  }

  // ========== MOTORCYCLE VALIDATION ==========
  
  /**
   * Validates motorcycle selection from catalog
   * @param motorcycleId - The selected motorcycle ID
   * @param availableMotorcycles - Optional array of available motorcycles for additional checks
   */
  validateMotorcycleSelection(
    motorcycleId: string, 
    availableMotorcycles?: Motorcycle[]
  ): ValidationResult {
    if (!motorcycleId || motorcycleId.trim() === '') {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Debes seleccionar una motocicleta',
        suggestions: ['Elige una motocicleta de la lista']
      };
    }

    // If we have the motorcycle catalog, verify the ID exists
    if (availableMotorcycles && availableMotorcycles.length > 0) {
      const found = availableMotorcycles.find(m => m.id === motorcycleId);
      
      if (!found) {
        return {
          isValid: false,
          severity: 'error',
          message: '❌ Motocicleta no encontrada',
          suggestions: ['Selecciona una motocicleta válida de la lista']
        };
      }

      // Check if motorcycle is active
      if (found.isActive === false) {
        return {
          isValid: false,
          severity: 'warning',
          message: '⚠️ Esta motocicleta no está disponible',
          suggestions: ['Selecciona otra motocicleta']
        };
      }

      return { 
        isValid: true, 
        data: found,
        message: `✅ Motocicleta: ${found.brand} ${found.model} (${found.year})`
      };
    }

    return { 
      isValid: true, 
      data: motorcycleId,
      message: '✅ Motocicleta seleccionada'
    };
  }

  /**
   * Validates compatibility between motorcycle and service
   * @param motorcycle - Motorcycle object from catalog
   * @param service - Service object from catalog
   */
  validateServiceCompatibility(
    motorcycle: Motorcycle, 
    service: Service
  ): ValidationResult {
    // Check brand compatibility
    if (service.compatibleBrands && service.compatibleBrands.length > 0) {
      const brandMatch = service.compatibleBrands.some(brand => 
        brand.toLowerCase() === motorcycle.brand.toLowerCase()
      );

      if (!brandMatch) {
        return {
          isValid: false,
          severity: 'warning',
          message: '⚠️ Servicio no compatible con esta marca',
          suggestions: [
            `Este servicio es para: ${service.compatibleBrands.join(', ')}`,
            `Tu motocicleta: ${motorcycle.brand}`,
            'Contacta al taller para confirmar disponibilidad'
          ]
        };
      }
    }

    // Check model compatibility
    if (service.compatibleModels && service.compatibleModels.length > 0) {
      const modelMatch = service.compatibleModels.some(model => 
        model.toLowerCase() === motorcycle.model.toLowerCase()
      );

      if (!modelMatch) {
        return {
          isValid: false,
          severity: 'info',
          message: '💡 Modelo no listado específicamente',
          suggestions: [
            'Este servicio puede requerir verificación',
            'El taller confirmará la compatibilidad'
          ]
        };
      }
    }

    return { 
      isValid: true,
      message: '✅ Servicio compatible'
    };
  }

  // ========== USER VEHICLE VALIDATION ==========

  /**
   * Validates user vehicle data
   * @param vehicle - UserVehicle object
   */
  validateUserVehicle(vehicle: Partial<UserVehicle>): ValidationResult {
    const errors: string[] = [];

    // Validate required fields
    if (!vehicle.userId) {
      errors.push('Usuario requerido');
    }

    if (!vehicle.baseVehicleId) {
      errors.push('Modelo de motocicleta requerido');
    }

    // Validate plate if provided
    if (vehicle.plate) {
      const plateValidation = this.validateLicensePlate(vehicle.plate);
      if (!plateValidation.isValid) {
        return plateValidation;
      }
    }

    // Validate mileage if provided
    if (vehicle.mileageKm !== undefined && vehicle.mileageKm !== null) {
      const mileageValidation = this.validateMileage(vehicle.mileageKm);
      if (!mileageValidation.isValid) {
        return mileageValidation;
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Datos del vehículo incompletos',
        suggestions: errors
      };
    }

    return {
      isValid: true,
      message: '✅ Vehículo válido'
    };
  }

  // ========== COMBINED VALIDATIONS ==========
  
  /**
   * Checks if a license plate is unique in the system
   * @param plate - License plate to check
   * @param userId - User ID to exclude from check (for user's own vehicles)
   * @param checkFunction - Async function that checks uniqueness
   */
  async validatePlateUniqueness(
    plate: string, 
    userId: string,
    checkFunction: (plate: string, userId: string) => Promise<boolean>
  ): Promise<ValidationResult> {
    try {
      const plateUpper = plate.toUpperCase().trim();
      const isUnique = await checkFunction(plateUpper, userId);
      
      if (!isUnique) {
        return {
          isValid: false,
          severity: 'error',
          message: '❌ Esta placa ya está registrada',
          suggestions: [
            'La placa ya existe en el sistema',
            'Verifica que sea correcta',
            'Si es tu motocicleta, contacta al taller'
          ]
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error checking plate uniqueness:', error);
      return {
        isValid: false,
        severity: 'error',
        message: '❌ Error verificando la placa',
        suggestions: ['Intenta de nuevo o contacta al taller']
      };
    }
  }

  // ========== UTILITY METHODS ==========
  
  formatPhone(phone: string): string {
    const cleaned = this.cleanPhone(phone);
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  }

  formatMileage(mileage: number): string {
    return mileage.toLocaleString('es-CO') + ' km';
  }

  formatPlate(plate: string): string {
    return plate.toUpperCase().trim();
  }

  // ========== VALIDATION SUMMARY ==========
  
  createValidationSummary(validations: { [key: string]: ValidationResult }): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    let isValid = true;

    Object.entries(validations).forEach(([key, result]) => {
      if (!result.isValid) {
        isValid = false;
        if (result.severity === 'error') {
          errors.push(result.message || `Error en ${key}`);
        } else if (result.severity === 'warning') {
          warnings.push(result.message || `Advertencia en ${key}`);
        }
      } else if (result.severity === 'info' && result.message) {
        info.push(result.message);
      }
    });

    return { isValid, errors, warnings, info };
  }
}