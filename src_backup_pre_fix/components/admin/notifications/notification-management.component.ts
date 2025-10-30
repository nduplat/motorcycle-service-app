import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { NotificationTemplate, NotificationParameter, Notification as NotificationModel } from '../../../models';

@Component({
  selector: 'app-notification-management',
  imports: [CommonModule, ReactiveFormsModule, LoaderComponent],
  templateUrl: './notification-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationManagementComponent {
  private notificationService = inject(NotificationService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  activeTab = signal<'history' | 'send' | 'templates'>('history');
  isSubmitting = signal(false);
  selectedTemplate = signal<NotificationTemplate | null>(null);
  parameterForm = signal<FormGroup>(this.fb.group({}));

  // Data
  systemNotifications = this.notificationService.getSystemNotifications();
  templates = signal<NotificationTemplate[]>([]);
  users = this.userService.getUsers();

  // Computed signals
  recentNotifications = computed(() =>
    this.systemNotifications()
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
      .slice(0, 100)
  );

  availableTemplates = computed(() =>
    this.templates().filter(t => t.isActive)
  );

  marketingTemplates = computed(() =>
    this.availableTemplates().filter(t => t.type === 'marketing')
  );

  systemTemplates = computed(() =>
    this.availableTemplates().filter(t => t.type === 'system')
  );

  // Forms
  manualNotificationForm = this.fb.group({
    title: ['', Validators.required],
    message: ['', Validators.required],
    targetType: ['broadcast', Validators.required], // 'broadcast', 'specific_user', 'user_group'
    targetUserId: [''],
    targetRole: ['']
  });

  templateNotificationForm = this.fb.group({
    templateId: ['', Validators.required],
    targetType: ['broadcast', Validators.required],
    targetUserId: [''],
    targetRole: ['']
  });

  templateForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    type: ['marketing' as NotificationTemplate['type'], Validators.required],
    titleTemplate: ['', Validators.required],
    messageTemplate: ['', Validators.required],
    parameters: [[] as NotificationParameter[]]
  });

  constructor() {
    // Load templates
    this.loadTemplates();

    // Update parameter form when template changes
    effect(() => {
      const template = this.selectedTemplate();
      if (template) {
        this.buildParameterForm(template);
      }
    });
  }

  private async loadTemplates(): Promise<void> {
    try {
      // Load all template types
      const marketingTemplates = this.notificationService.getTemplatesByType('marketing');
      const systemTemplates = this.notificationService.getTemplatesByType('system');
      const appointmentTemplates = this.notificationService.getTemplatesByType('appointment');
      const maintenanceTemplates = this.notificationService.getTemplatesByType('maintenance');
      const customTemplates = this.notificationService.getTemplatesByType('custom');

      const allTemplates = [
        ...marketingTemplates,
        ...systemTemplates,
        ...appointmentTemplates,
        ...maintenanceTemplates,
        ...customTemplates
      ];

      this.templates.set(allTemplates);

      // Initialize default templates if none exist
      if (allTemplates.length === 0) {
        await this.initializeDefaultTemplates();
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  private async initializeDefaultTemplates(): Promise<void> {
    const defaultTemplates = this.notificationService.getDefaultTemplates();
    for (const template of defaultTemplates) {
      try {
        await this.notificationService.createTemplate(template).toPromise();
      } catch (error) {
        console.error('Error creating default template:', error);
      }
    }
  }

  private buildParameterForm(template: NotificationTemplate): void {
    const formGroup: any = {};
    template.parameters.forEach(param => {
      const validators = param.required ? [Validators.required] : [];
      formGroup[param.key] = [param.defaultValue || '', validators];
    });
    this.parameterForm.set(this.fb.group(formGroup));
  }

  selectTab(tab: 'history' | 'send' | 'templates'): void {
    this.activeTab.set(tab);
  }

  selectTemplate(template: NotificationTemplate): void {
    this.selectedTemplate.set(template);
    this.templateNotificationForm.patchValue({ templateId: template.id });
  }

  onTemplateChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const templateId = target.value;
    const template = this.availableTemplates().find(t => t.id === templateId);
    if (template) {
      this.selectTemplate(template);
    }
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id).subscribe();
  }

  formatDate(timestamp: { toDate: () => Date }): string {
    return timestamp.toDate().toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
  }

  getNotificationGenerationInfo(notification: NotificationModel): string {
    const meta = notification.meta;
    if (!meta) return 'Manual';

    if (meta.generatedBy === 'template' && meta.templateId) {
      const template = this.templates().find(t => t.id === meta.templateId);
      return template ? `Plantilla: ${template.name}` : 'Plantilla';
    }

    if (meta.generatedBy === 'automated') {
      return 'Automatizada';
    }

    return 'Manual';
  }

  getTargetUsers(): any[] {
    const targetType = this.manualNotificationForm.value.targetType;
    const targetRole = this.manualNotificationForm.value.targetRole;

    if (targetType === 'broadcast') {
      return []; // All users
    }

    if (targetType === 'user_group' && targetRole) {
      return this.users().filter(u => u.role === targetRole);
    }

    return this.users();
  }

  async onSendManualNotification(): Promise<void> {
    if (this.manualNotificationForm.invalid) {
      Object.keys(this.manualNotificationForm.controls).forEach(key => {
        this.manualNotificationForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting.set(true);

    try {
      const { title, message, targetType, targetUserId, targetRole } = this.manualNotificationForm.value;

      if (targetType === 'broadcast') {
        // Send to all users
        const allUserIds = this.users().map(u => u.id);
        await this.notificationService.sendBulkNotification(
          { title: title!.trim(), message: message!.trim() },
          allUserIds
        ).toPromise();
      } else if (targetType === 'specific_user' && targetUserId) {
        await this.notificationService.addSystemNotification({
          title: title!.trim(),
          message: message!.trim(),
          userId: targetUserId
        }).toPromise();
      } else if (targetType === 'user_group' && targetRole) {
        const userIds = this.users().filter(u => u.role === targetRole).map(u => u.id);
        await this.notificationService.sendBulkNotification(
          { title: title!.trim(), message: message!.trim() },
          userIds
        ).toPromise();
      }

      this.manualNotificationForm.reset({ targetType: 'broadcast' });
      console.log('Manual notification sent successfully');
    } catch (error: any) {
      console.error('Error sending manual notification:', error);
      alert(`Error al enviar la notificación: ${error.message}`);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async onSendTemplateNotification(): Promise<void> {
    if (this.templateNotificationForm.invalid || this.parameterForm().invalid) {
      Object.keys(this.templateNotificationForm.controls).forEach(key => {
        this.templateNotificationForm.get(key)?.markAsTouched();
      });
      Object.keys(this.parameterForm().controls).forEach(key => {
        this.parameterForm().get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting.set(true);

    try {
      const { templateId, targetType, targetUserId, targetRole } = this.templateNotificationForm.value;
      const parameters = this.parameterForm().value;

      if (targetType === 'broadcast') {
        // Send to all users
        const allUserIds = this.users().map(u => u.id);
        await this.notificationService.sendBulkTemplatedNotification(
          templateId!,
          parameters,
          allUserIds
        ).toPromise();
      } else if (targetType === 'specific_user' && targetUserId) {
        await this.notificationService.sendTemplatedNotification(
          templateId!,
          parameters,
          targetUserId
        ).toPromise();
      } else if (targetType === 'user_group' && targetRole) {
        const userIds = this.users().filter(u => u.role === targetRole).map(u => u.id);
        await this.notificationService.sendBulkTemplatedNotification(
          templateId!,
          parameters,
          userIds
        ).toPromise();
      }

      this.templateNotificationForm.reset({ targetType: 'broadcast' });
      this.parameterForm.set(this.fb.group({}));
      this.selectedTemplate.set(null);
      console.log('Template notification sent successfully');
    } catch (error: any) {
      console.error('Error sending template notification:', error);
      alert(`Error al enviar la notificación: ${error.message}`);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async onCreateTemplate(): Promise<void> {
    if (this.templateForm.invalid) {
      Object.keys(this.templateForm.controls).forEach(key => {
        this.templateForm.get(key)?.markAsTouched();
      });
      return;
    }

    try {
      const formValue = this.templateForm.value;
      const currentUser = this.authService.currentUser();
      const templateData: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formValue.name!,
        description: formValue.description || '',
        type: formValue.type!,
        titleTemplate: formValue.titleTemplate!,
        messageTemplate: formValue.messageTemplate!,
        parameters: formValue.parameters || [],
        isActive: true,
        createdBy: currentUser?.id || 'unknown'
      };

      await this.notificationService.createTemplate(templateData).toPromise();
      this.templateForm.reset({ type: 'marketing' });
      console.log('Template created successfully');
    } catch (error: any) {
      console.error('Error creating template:', error);
      alert(`Error al crear la plantilla: ${error.message}`);
    }
  }

  async onDeleteTemplate(templateId: string): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) {
      return;
    }

    try {
      await this.notificationService.deleteTemplate(templateId).toPromise();
      console.log('Template deleted successfully');
    } catch (error: any) {
      console.error('Error deleting template:', error);
      alert(`Error al eliminar la plantilla: ${error.message}`);
    }
  }

  getParameterControl(key: string): FormControl {
    return this.parameterForm().get(key) as FormControl;
  }
}
