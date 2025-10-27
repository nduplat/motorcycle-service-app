

import { Routes } from '@angular/router';


export const APP_ROUTES: Routes = [
  // Public routes
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent),
    title: 'Blue Dragon Motors - Inicio'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    title: 'Iniciar Sesión'
  },
  {
    path: 'inventory',
    loadComponent: () => import('./components/inventory/inventory.component').then(m => m.InventoryComponent),
    title: 'Repuestos'
  },
  {
    path: 'services',
    loadComponent: () => import('./components/public/services-page/services-page.component').then(m => m.ServicesPageComponent),
    title: 'Servicios'
  },
  {
    path: 'appointments',
    loadComponent: () => import('./components/public/appointments-page/appointments-page.component').then(m => m.AppointmentsPageComponent),
    title: 'Citas',
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)],
    data: { requiredRoles: ['customer'] }
  },
  {
    path: 'offers',
    loadComponent: () => import('./components/public/offers-page/offers-page.component').then(m => m.OffersPageComponent),
    title: 'Ofertas'
  },
  {
    path: 'contact',
    loadComponent: () => import('./components/public/contact-page/contact-page.component').then(m => m.ContactPageComponent),
    title: 'Contacto'
  },
  {
    path: 'queue/join',
    loadComponent: () => import('./components/public/client-flow/client-flow-container.component').then(m => m.ClientFlowContainerComponent),
    title: 'Unirse a la Cola',
    canActivate: [() => import('./guards/client-flow.guard').then(m => m.ClientFlowGuard)],
    data: { requiredRoles: ['customer', 'admin', 'employee', 'technician'] }
  },
  {
    path: 'queue-status',
    loadComponent: () => import('./components/public/queue-status/queue-status.component').then(m => m.QueueStatusComponent),
    title: 'Estado de Cola'
  },

  // Protected client route
  {
    path: 'account',
    loadComponent: () => import('./components/account/account.component').then(m => m.AccountComponent),
    title: 'Mi Cuenta',
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)],
    data: { requiredRoles: ['customer', 'employee', 'admin'] }
  },

  // UNIFIED DASHBOARD ROUTE FOR STAFF
  {
    path: 'employee',
    loadComponent: () => import('./components/unified-dashboard.component').then(m => m.UnifiedDashboardComponent),
    title: 'Panel de Empleado',
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)],
    data: { requiredRoles: ['technician', 'employee', 'front_desk'] }
  },

  // Protected checkout route
  {
    path: 'checkout',
    loadComponent: () => import('./components/checkout/checkout.component').then(m => m.CheckoutComponent),
    title: 'Checkout',
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)],
    data: { requiredRoles: ['customer'] }
  },

  // Protected admin routes with lazy loading
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)],
    data: { requiredRoles: ['admin', 'manager'] },
    children: [
        { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
        // UNIFIED DASHBOARD ROUTE FOR ADMIN/MANAGER
        {
          path: 'dashboard',
          loadComponent: () => import('./components/unified-dashboard.component').then(m => m.UnifiedDashboardComponent),
          title: 'Panel de Administración'
        },
        {
          path: 'motorcycles',
          loadComponent: () => import('./components/admin/motorcycles/motorcycle-management.component').then(m => m.MotorcycleManagementComponent),
          title: 'Gestión de Motocicletas'
        },
        {
          path: 'products',
          loadComponent: () => import('./components/admin/products/product-list.component').then(m => m.ProductListComponent),
          title: 'Gestión de Productos'
        },
        {
          path: 'products/new',
          loadComponent: () => import('./components/admin/products/product-form.component').then(m => m.ProductFormComponent),
          title: 'Nuevo Producto'
        },
        {
          path: 'products/:id/edit',
          loadComponent: () => import('./components/admin/products/product-form.component').then(m => m.ProductFormComponent),
          title: 'Editar Producto'
        },
        {
          path: 'suppliers',
          loadComponent: () => import('./components/admin/suppliers/supplier-management.component').then(m => m.SupplierManagementComponent),
          title: 'Gestión de Proveedores'
        },
        {
          path: 'purchase-orders',
          loadComponent: () => import('./components/admin/purchase-orders/purchase-order-list.component').then(m => m.PurchaseOrderListComponent),
          title: 'Órdenes de Compra'
        },
        {
          path: 'purchase-orders/new',
          loadComponent: () => import('./components/admin/purchase-orders/purchase-order-form.component').then(m => m.PurchaseOrderFormComponent),
          title: 'Nueva Orden de Compra'
        },
        {
          path: 'purchase-orders/:id/edit',
          loadComponent: () => import('./components/admin/purchase-orders/purchase-order-form.component').then(m => m.PurchaseOrderFormComponent),
          title: 'Editar Orden de Compra'
        },
        {
          path: 'stock-movements',
          loadComponent: () => import('./components/admin/stock-movements/stock-movement.component').then(m => m.StockMovementComponent),
          title: 'Movimientos de Stock'
        },
        {
          path: 'services',
          loadComponent: () => import('./components/admin/services/service-management.component').then(m => m.ServiceManagementComponent),
          title: 'Catálogo de Servicios'
        },
        {
          path: 'work-orders',
          loadComponent: () => import('./components/admin/work-orders/work-order-list.component').then(m => m.WorkOrderListComponent),
          title: 'Órdenes de Trabajo'
        },
        {
          path: 'work-orders/:id',
          loadComponent: () => import('./components/admin/work-orders/work-order-form.component').then(m => m.WorkOrderFormComponent),
          title: 'Detalle Orden de Trabajo'
        },
        {
          path: 'users',
          loadComponent: () => import('./components/admin/users/user-management.component').then(m => m.UserManagementComponent),
          title: 'Gestión de Usuarios',
          data: { requiredRoles: ['admin'] }
        },
        {
          path: 'scanner',
          loadComponent: () => import('./components/scanner/scanner.component').then(m => m.ScannerComponent),
          title: 'Escáner IA de Repuestos'
        },
        {
          path: 'qr-generator',
          loadComponent: () => import('./components/admin/qr-generator/qr-generator.component').then(m => m.QrGeneratorComponent),
          title: 'Generador de Códigos QR',
          canActivate: [() => import('./guards/auth.guard').then(m => m.authGuard)],
          data: { requiredRoles: ['admin'] }
        },
        {
          path: 'notifications',
          loadComponent: () => import('./components/admin/notifications/notification-management.component').then(m => m.NotificationManagementComponent),
          title: 'Gestión de Notificaciones'
        },
        {
          path: 'queue',
          loadComponent: () => import('./components/admin/queue-management/queue-management.component').then(m => m.QueueManagementComponent),
          title: 'Gestión de Cola'
        },
        {
          path: 'code-validation',
          loadComponent: () => import('./components/admin/code-validation.component').then(m => m.CodeValidationComponent),
          title: 'Validación de Códigos'
        },
        {
          path: 'cost-monitoring',
          loadComponent: () => import('./app/cost-monitoring-dashboard/cost-monitoring-dashboard.component').then(m => m.CostMonitoringDashboardComponent),
          title: 'Monitoreo de Costos AI'
        },
        { path: '**', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: '', pathMatch: 'full' }
];