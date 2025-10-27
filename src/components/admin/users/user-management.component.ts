import { ChangeDetectionStrategy, Component, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { UserValidationService } from '../../../services/user-validation.service';
import { BulkOperationsService, BulkImportResult, BulkExportOptions } from '../../../services/bulk-operations.service';
import { SessionService } from '../../../services/session.service';
import { ToastService } from '../../../services/toast.service';
import { ModalService } from '../../../services/modal.service';

import { UserProfile, Role, Motorcycle } from '../../../models';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { NuevaMotocicletaComponent } from '../../shared/nueva-motocicleta.component';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LoaderComponent, NuevaMotocicletaComponent],
})
export class UserManagementComponent implements OnDestroy {
  authService = inject(AuthService);
  userService = inject(UserService);
  motorcycleService = inject(MotorcycleService);
  validationService = inject(UserValidationService);
  bulkOperationsService = inject(BulkOperationsService);
  sessionService = inject(SessionService);
  toastService = inject(ToastService);
  modalService = inject(ModalService);
  private fb = inject(FormBuilder);

  currentUser = this.authService.currentUser;
  users = this.userService.getUsers();
  allMotorcycles = this.motorcycleService.getMotorcycles();
  
  isModalOpen = signal(false);
  isVehicleModalOpen = signal(false);
  isSubmitting = signal(false);
  vehicleModalError = signal<string | null>(null);
  formError = signal<string | null>(null);
  searchTerm = signal('');
  selectedRoleFilter = signal<Role | ''>('');
  selectedStatusFilter = signal<'active' | 'inactive' | ''>('');

  // Bulk operations
  selectedUsers = signal<Set<string>>(new Set());
  isBulkModalOpen = signal(false);
  bulkOperationType = signal<'activate' | 'deactivate' | 'delete' | 'import' | 'export'>('activate');
  bulkImportResult = signal<BulkImportResult | null>(null);
  bulkOperationResult = signal<{ success: number; failed: number; errors: string[] } | null>(null);
  
  editingUser = signal<UserProfile | null>(null);
  managingVehiclesForUser = signal<UserProfile | null>(null);

  userVehicles = signal<any[]>([]);
  userVehiclesLoaded = signal(false);

  private destroy$ = new Subject<void>();
  
  roles: Role[] = ["admin", "technician", "customer"];

  userForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, this.validationService.emailValidator()]],
    phone: ['', this.validationService.phoneValidator()],
    role: ['customer' as Role, [Validators.required, this.validationService.roleValidator()]],
    active: [true],
    isAvailable: [true],
    availabilityReason: [''],
  });

  get isTechnicianRole(): boolean {
    return this.userForm.get('role')?.value === 'technician';
  }

  get isAssignableStaff(): boolean {
    const role = this.userForm.get('role')?.value;
    return role === 'technician';
  }

  vehicleForm = this.fb.group({
    motorcycleId: ['', Validators.required],
    plate: [''],
    mileageKm: [0, Validators.min(0)],
    notes: ['']
  });

  modalTitle = computed(() => this.editingUser() ? 'Editar Usuario' : 'Añadir Nuevo Usuario');

  filteredUsers = computed(() => {
    const filters: any = {};

    if (this.selectedRoleFilter()) {
      filters.role = this.selectedRoleFilter();
    }

    if (this.selectedStatusFilter()) {
      filters.active = this.selectedStatusFilter() === 'active';
    }

    return this.userService.searchUsers(this.searchTerm(), filters);
  });

  filteredUsersWithComputedValues = computed(() => {
    return this.filteredUsers().map(user => ({
      ...user,
      roleClass: this.getRoleClass(user.role)
    }));
  });
  
  constructor() {
    effect(() => {
      const user = this.managingVehiclesForUser();
      if (user) {
        this.userVehiclesLoaded.set(false);
        // Motorcycle assignments are now handled by queue service
        // For admin management, we can show user vehicles from userVehicleService
        this.userVehicles.set([]);
        this.userVehiclesLoaded.set(true);
      } else {
        this.userVehicles.set([]);
        this.userVehiclesLoaded.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayUserVehicles = computed(() => {
    const catalog = this.allMotorcycles();
    return this.userVehicles().map(assignment => {
      const baseMoto = catalog.find(m => m.id === assignment.motorcycleId);
      return {
        ...assignment,
        brand: baseMoto?.brand || 'Desconocido',
        model: baseMoto?.model || 'Modelo',
        year: baseMoto?.year || 2000
      };
    });
  });

  openUserModal(user: UserProfile | null = null): void {
    this.editingUser.set(user);
    this.formError.set(null);
    if (user) {
      this.userForm.patchValue({
        ...user,
        isAvailable: user.availability?.isAvailable ?? true,
        availabilityReason: user.availability?.reason ?? ''
      });
    } else {
      this.userForm.reset({
        role: 'customer',
        active: true,
        isAvailable: true,
        availabilityReason: ''
      });
    }
    this.isModalOpen.set(true);
  }

  createTestTechnician(): void {
    const testEmail = `test-technician-${Date.now()}@example.com`;
    const testName = `Técnico de Prueba ${Date.now().toString().slice(-4)}`;

    this.userForm.patchValue({
      name: testName,
      email: testEmail,
      phone: '3001234567',
      role: 'technician',
      active: true,
      isAvailable: true,
      availabilityReason: ''
    });

    this.editingUser.set(null);
    this.formError.set(null);
    this.isModalOpen.set(true);
  }

  closeUserModal(): void {
    this.isModalOpen.set(false);
    this.editingUser.set(null);
  }
  
  openVehicleModal(user: UserProfile): void {
    this.managingVehiclesForUser.set(user);
    this.vehicleModalError.set(null);
    this.isVehicleModalOpen.set(true);
  }

  closeVehicleModal(): void {
    this.isVehicleModalOpen.set(false);
    this.managingVehiclesForUser.set(null);
    this.vehicleForm.reset();
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.formError.set('Por favor, corrige los errores en el formulario.');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set(null);

    const formValue = this.userForm.getRawValue();
    const editing = this.editingUser();

    // Prepare user data
    const userData: any = {
      name: formValue.name,
      email: formValue.email,
      phone: formValue.phone,
      role: formValue.role,
      active: formValue.active,
    };

    // Add uid and displayName for new users (they will be set by the service)
    if (!editing) {
      userData.uid = formValue.email; // Temporary, will be set properly by auth
      userData.displayName = formValue.name;
    }

    // Add availability for assignable staff
    if (this.isAssignableStaff) {
      userData.availability = {
        isAvailable: formValue.isAvailable,
        lastUpdated: new Date(),
        reason: formValue.availabilityReason || undefined
      };
    }

    const operation = editing
      ? this.userService.updateUser({ id: editing.id, ...userData })
      : this.userService.addUser(userData as Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>);

    operation.subscribe({
      next: () => {
        this.closeUserModal();
        this.isSubmitting.set(false);
      },
      error: (error: any) => {
        this.isSubmitting.set(false);
        this.formError.set(error.message || 'Ocurrió un error al guardar el usuario. Por favor, inténtalo de nuevo.');
        console.error('Error saving user:', error);
      }
    });
  }

  saveUserVehicle(): void {
    if (this.vehicleForm.invalid || !this.managingVehiclesForUser()) return;
    this.isSubmitting.set(true);
    this.vehicleModalError.set(null);

    // Motorcycle assignment is now handled by queue service
    // This functionality is deprecated
    this.vehicleModalError.set('La asignación manual de motocicletas ya no está disponible. Las asignaciones se manejan automáticamente durante el proceso de cola.');
    this.isSubmitting.set(false);
  }

  deleteUserVehicle(id: string): void {
    this.modalService.confirm({
      title: 'Confirmar desvinculación',
      message: '¿Estás seguro de que quieres desvincular este vehículo?',
      confirmText: 'Desvincular',
      cancelText: 'Cancelar'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.vehicleModalError.set(null);
        // Motorcycle assignment removal is now handled by queue service
        // This functionality is deprecated
        this.vehicleModalError.set('La desvinculación manual de motocicletas ya no está disponible. Las asignaciones se manejan automáticamente.');
        this.toastService.warning('Funcionalidad no disponible');
      }
    });
  }

   onMotorcycleAssigned(): void {
     // Motorcycle assignment is now handled by queue service
     // This method is deprecated
     console.log('Motorcycle assignment handled by queue service');
   }

  toggleUserStatus(user: UserProfile): void {
    const action = user.active === false ? 'reactivar' : 'desactivar';
    this.modalService.confirm({
      title: `Confirmar ${action}`,
      message: `¿Estás seguro de que quieres ${action} al usuario ${user.name}?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      cancelText: 'Cancelar'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isSubmitting.set(true);
        const operation = user.active === false
          ? this.userService.reactivateUser(user.id)
          : this.userService.deactivateUser(user.id);

        operation.subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.toastService.success(`Usuario ${action}do exitosamente`);
          },
          error: (error: any) => {
            this.isSubmitting.set(false);
            this.toastService.error(`Error al ${action} usuario: ${error.message}`);
          }
        });
      }
    });
  }

  async forceLogoutUser(user: UserProfile): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (currentUser?.role !== 'admin') {
      this.toastService.warning('Solo los administradores pueden forzar el cierre de sesión de otros usuarios.');
      return;
    }

    if (currentUser.id === user.id) {
      this.toastService.warning('No puedes forzar el cierre de tu propia sesión. Usa el botón de cerrar sesión normal.');
      return;
    }

    this.modalService.confirm({
      title: 'Forzar cierre de sesión',
      message: `¿Estás seguro de que quieres forzar el cierre de sesión del usuario ${user.name}? Esto terminará su sesión activa y lo desconectará del sistema.`,
      confirmText: 'Forzar cierre',
      cancelText: 'Cancelar',
      type: 'warning'
    }).subscribe(async confirmed => {
      if (confirmed) {
        this.isSubmitting.set(true);
        try {
          await this.sessionService.forceLogoutUser(user.id);
          this.isSubmitting.set(false);
          this.toastService.success(`Sesión de ${user.name} cerrada exitosamente.`);
        } catch (error: any) {
          this.isSubmitting.set(false);
          this.toastService.error(`Error al cerrar sesión del usuario: ${error.message}`);
        }
      }
    });
  }

  deleteUser(user: UserProfile): void {
    const currentUser = this.authService.currentUser();
    if (currentUser?.role !== 'admin') {
      this.toastService.warning('Solo los administradores pueden eliminar usuarios permanentemente.');
      return;
    }

    if (user.role === 'admin') {
      this.toastService.warning('No se pueden eliminar cuentas de administrador.');
      return;
    }

    if (currentUser.id === user.id) {
      this.toastService.warning('No puedes eliminar tu propia cuenta.');
      return;
    }

    this.modalService.confirm({
      title: 'Eliminar usuario permanentemente',
      message: `¿Estás seguro de que quieres eliminar permanentemente al usuario ${user.name}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isSubmitting.set(true);
        this.userService.deleteUser(user.id).subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.toastService.success('Usuario eliminado exitosamente');
          },
          error: (error: any) => {
            this.isSubmitting.set(false);
            this.toastService.error(`Error al eliminar usuario: ${error.message}`);
          }
        });
      }
    });
  }

  getRoleClass(role: Role): string {
    const roles: Record<Role, string> = {
      admin: 'bg-red-200 text-red-800',
      technician: 'bg-blue-200 text-blue-800',
      customer: 'bg-green-200 text-green-800'
    };
    return roles[role] || 'bg-gray-200 text-gray-800';
  }

  // Search and filter methods
  updateSearchTerm(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  updateRoleFilter(role: Role | ''): void {
    this.selectedRoleFilter.set(role);
  }

  updateStatusFilter(status: 'active' | 'inactive' | ''): void {
    this.selectedStatusFilter.set(status);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedRoleFilter.set('');
    this.selectedStatusFilter.set('');
  }

  // Bulk operations methods
  toggleUserSelection(userId: string): void {
    const selected = this.selectedUsers();
    if (selected.has(userId)) {
      selected.delete(userId);
    } else {
      selected.add(userId);
    }
    this.selectedUsers.set(new Set(selected));
  }

  selectAllUsers(): void {
    const allUserIds = new Set(this.filteredUsers().map(u => u.id));
    this.selectedUsers.set(allUserIds);
  }

  clearSelection(): void {
    this.selectedUsers.set(new Set());
  }

  openBulkModal(operation: 'activate' | 'deactivate' | 'delete' | 'import' | 'export'): void {
    this.bulkOperationType.set(operation);
    this.bulkImportResult.set(null);
    this.bulkOperationResult.set(null);
    this.isBulkModalOpen.set(true);
  }

  closeBulkModal(): void {
    this.isBulkModalOpen.set(false);
    this.clearSelection();
  }

  executeBulkOperation(): void {
    const operation = this.bulkOperationType();
    const selectedIds = Array.from(this.selectedUsers());

    if (selectedIds.length === 0 && operation !== 'import' && operation !== 'export') {
      this.toastService.warning('Selecciona al menos un usuario');
      return;
    }

    this.isSubmitting.set(true);

    switch (operation) {
      case 'activate':
        this.bulkOperationsService.bulkActivateUsers(selectedIds).subscribe(result => {
          this.handleBulkResult(result);
        });
        break;
      case 'deactivate':
        this.bulkOperationsService.bulkDeactivateUsers(selectedIds).subscribe(result => {
          this.handleBulkResult(result);
        });
        break;
      case 'delete':
        this.modalService.confirm({
          title: 'Eliminar usuarios permanentemente',
          message: `¿Estás seguro de que quieres eliminar permanentemente ${selectedIds.length} usuarios? Esta acción no se puede deshacer.`,
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
          type: 'danger'
        }).subscribe(confirmed => {
          if (confirmed) {
            this.bulkOperationsService.bulkDeleteUsers(selectedIds).subscribe(result => {
              this.handleBulkResult(result);
            });
          } else {
            this.isSubmitting.set(false);
          }
        });
        break;
    }
  }

  private handleBulkResult(result: { success: number; failed: number; errors: string[] }): void {
    this.isSubmitting.set(false);
    this.bulkOperationResult.set(result);

    if (result.success > 0) {
      this.toastService.success(`Operación completada: ${result.success} exitosos, ${result.failed} fallidos`);
      this.clearSelection();
    }

    if (result.errors.length > 0) {
      console.error('Bulk operation errors:', result.errors);
      this.toastService.warning('Algunos elementos fallaron. Revisa los detalles.');
    }
  }

  // Import/Export methods
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      this.importUsers(content, file.name.endsWith('.json'));
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
  }

  private importUsers(content: string, isJson: boolean): void {
    this.isSubmitting.set(true);

    const importObservable = isJson
      ? this.bulkOperationsService.importUsersFromJSON(content)
      : this.bulkOperationsService.importUsersFromCSV(content);

    importObservable.subscribe(result => {
      this.isSubmitting.set(false);
      this.bulkImportResult.set(result);

      if (result.success) {
        this.toastService.success(`Importación completada: ${result.imported} usuarios importados, ${result.failed} fallidos`);
      } else {
        this.toastService.error('Importación fallida. Revisa los errores.');
      }
    });
  }

  exportUsers(format: 'csv' | 'json'): void {
    this.isSubmitting.set(true);

    const exportObservable = format === 'csv'
      ? this.bulkOperationsService.exportUsersToCSV()
      : this.bulkOperationsService.exportUsersToJSON();

    exportObservable.subscribe(content => {
      this.isSubmitting.set(false);
      this.downloadFile(content, `users-export.${format}`, format === 'json' ? 'application/json' : 'text/csv');
    });
  }

  downloadImportTemplate(): void {
    const template = this.bulkOperationsService.generateImportTemplate();
    this.downloadFile(template, 'users-import-template.csv', 'text/csv');
  }

  onRoleChange(user: UserProfile, newRole: Role): void {
    if (user.role === newRole) return;

    this.modalService.confirm({
      title: 'Cambiar rol de usuario',
      message: `¿Estás seguro de que quieres cambiar el rol de ${user.name} a ${newRole}?`,
      confirmText: 'Cambiar rol',
      cancelText: 'Cancelar'
    }).subscribe(confirmed => {
      if (!confirmed) {
        // Revert visual change if user cancels
        const select = document.querySelector(`select[data-user-id="${user.id}"]`) as HTMLSelectElement;
        if(select) select.value = user.role;
        return;
      }

      this.isSubmitting.set(true);
      this.userService.updateUserRole(user.id, newRole).subscribe({
        next: (updatedUser) => {
          this.isSubmitting.set(false);
          this.toastService.success(`Rol de ${updatedUser.name} actualizado a ${updatedUser.role}`);
        },
        error: (error) => {
          this.isSubmitting.set(false);
          // Revert visual change on error
          const select = document.querySelector(`select[data-user-id="${user.id}"]`) as HTMLSelectElement;
          if(select) select.value = user.role;
          this.toastService.error(`Error al actualizar el rol: ${error.message}`);
        }
      });
    });
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}