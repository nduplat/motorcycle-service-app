# Estructura del Proyecto Blue Dragon Motors

```
bluedragonmotors-main/
├── .dockerignore
├── .env.example
├── .firebaserc
├── .gitignore
├── AI_SECURITY_README.md
├── angular.json
├── api-services-documentation.md
├── create-github-repo.sh
├── cypress.config.js
├── deploy-to-render.sh
├── DEPLOYMENT_README.md
├── docker-compose.override.yml
├── docker-compose.yml
├── Dockerfile
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── jest.config.cjs
├── metadata.json
├── monitoring.yml
├── nginx.conf
├── ngsw-config.json
├── package-lock.json
├── package.json
├── README.md
├── storage.rules
├── test-ai-proxy.js
├── .github/
├── cypress/
│   ├── e2e/
│   │   └── home-page.cy.ts
│   └── support/
│       ├── commands.ts
│       └── e2e.ts
├── docs/
│   ├── api-documentation.md
│   ├── manager-operations-manual.md
│   ├── technician-guide.md
│   ├── troubleshooting-runbook.md
│   └── workflow-diagrams.md
├── functions/
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── ai-proxy.ts
│       ├── backup.ts
│       ├── callable.ts
│       ├── health-check.ts
│       ├── index.ts
│       ├── scheduledTasks.ts
│       ├── services.ts
│       └── triggers.ts
├── monitoring/
│   ├── loki-config.yml
│   └── promtail-config.yml
├── scripts/
│   ├── delete-users.mjs
│   ├── deploy.sh
│   ├── firebase.mjs
│   ├── seed-inventory.mjs
│   ├── seed-locations.mjs
│   ├── seed-services.mjs
│   ├── seed.mjs
│   ├── motorcycles/
│   │   ├── clear-motorcycles.mjs
│   │   ├── seed-bajaj.mjs
│   │   ├── seed-hero.mjs
│   │   ├── seed-honda.mjs
│   │   ├── seed-kawasaki.mjs
│   │   ├── seed-ktm.mjs
│   │   ├── seed-motorcycles.mjs
│   │   ├── seed-susuki.mjs
│   │   ├── seed-tvs.mjs
│   │   ├── seed-um.mjs
│   │   └── seed-yamaha.mjs
│   └── productos/
│       ├── baterias
│       └── seed-oils.mjs
├── server/
│   ├── .dockerignore
│   ├── .eslintrc.js
│   ├── Dockerfile
│   ├── index.js
│   ├── jest.config.js
│   ├── logger.js
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   ├── render.yaml
│   ├── vercel.json
│   ├── __tests__/
│   │   └── index.test.js
│   └── (otros archivos si existen)
├── src/
│   ├── app.component.html
│   ├── app.component.ts
│   ├── app.routes.ts
│   ├── firebase.config.ts
│   ├── main.ts
│   ├── setup-jest.ts
│   ├── styles.css
│   ├── test.ts
│   ├── app/
│   │   └── admin/
│   │       └── work-orders/
│   │           └── work-order-list/
│   │               ├── work-order-list.html
│   │               └── work-order-list.ts
│   ├── assets/
│   │   └── images/
│   │       ├── hero-background.png
│   │       └── logo.PNG
│   ├── components/
│   │   ├── unified-dashboard.component.ts
│   │   ├── inventory/
│   │   │   ├── inventory.component.spec.ts
│   │   │   └── inventory.component.ts
│   │   ├── login/
│   │   │   ├── login.component.html
│   │   │   ├── login.component.spec.ts
│   │   │   └── login.component.ts
│   │   ├── scanner/
│   │   │   ├── scanner.component.html
│   │   │   └── scanner.component.ts
│   │   ├── shared/
│   │   │   ├── ai-agent.component.ts
│   │   │   ├── availability-modal.component.ts
│   │   │   ├── availability-toggle.component.ts
│   │   │   ├── chatbot.component.html
│   │   │   ├── chatbot.component.scss
│   │   │   ├── nueva-motocicleta.component.html
│   │   │   ├── nueva-motocicleta.component.scss
│   │   │   ├── nueva-motocicleta.component.ts
│   │   │   ├── footer/
│   │   │   │   ├── footer.component.html
│   │   │   │   └── footer.component.ts
│   │   │   ├── loader/
│   │   │   │   └── loader.component.ts
│   │   │   └── ui/
│   │   │       ├── button.component.ts
│   │   │       ├── card.component.ts
│   │   │       ├── confirm-dialog.component.ts
│   │   │       ├── input.component.ts
│   │   │       ├── label.component.ts
│   │   │       ├── pagination.component.ts
│   │   │       └── toast.component.ts
│   │   ├── admin/
│   │   │   ├── motorcycle-management.component.ts
│   │   │   ├── notifications/
│   │   │   │   ├── notification-management.component.html
│   │   │   │   └── notification-management.component.ts
│   │   │   ├── products/
│   │   │   │   ├── product-inventory.component.html
│   │   │   │   ├── product-inventory.component.ts
│   │   │   │   ├── product-list.component.html
│   │   │   │   ├── product-list.component.ts
│   │   │   │   ├── product-media.component.html
│   │   │   │   ├── product-media.component.ts
│   │   │   │   ├── product-pricing.component.html
│   │   │   │   ├── product-pricing.component.ts
│   │   │   │   ├── product-variants.component.html
│   │   │   │   └── product-variants.component.ts
│   │   │   ├── purchase-orders/
│   │   │   │   ├── purchase-order-form.component.html
│   │   │   │   ├── purchase-order-form.component.ts
│   │   │   │   ├── purchase-order-list.component.html
│   │   │   │   └── purchase-order-list.component.ts
│   │   │   ├── qr-generator/
│   │   │   │   ├── qr-generator.component.html
│   │   │   │   └── qr-generator.component.ts
│   │   │   ├── queue-management/
│   │   │   │   ├── queue-management.component.html
│   │   │   │   ├── queue-management.component.scss
│   │   │   │   └── queue-management.component.ts
│   │   │   ├── schedule/
│   │   │   │   ├── calendar.module.ts
│   │   │   │   ├── schedule.component.html
│   │   │   │   ├── schedule.component.ts
│   │   │   │   └── modal/
│   │   │   │       ├── modal.component.html
│   │   │   │       └── modal.component.ts
│   │   │   ├── services/
│   │   │   │   ├── enhanced-service-list.component.html
│   │   │   │   ├── enhanced-service-list.component.ts
│   │   │   │   ├── service-management.component.html
│   │   │   │   └── service-management.component.ts
│   │   │   ├── stock-movements/
│   │   │   │   ├── stock-movement.component.html
│   │   │   │   └── stock-movement.component.ts
│   │   │   ├── suppliers/
│   │   │   │   ├── supplier-management.component.html
│   │   │   │   └── supplier-management.component.ts
│   │   │   ├── users/
│   │   │   │   ├── user-management.component.html
│   │   │   │   └── user-management.component.ts
│   │   │   └── work-orders/
│   │   │       ├── work-order-form.component.html
│   │   │       ├── work-order-form.component.ts
│   │   │       ├── work-order-list.component.html
│   │   │       └── work-order-list.component.ts
│   │   ├── checkout/
│   │   │   ├── checkout.component.html
│   │   │   └── checkout.component.ts
│   │   ├── employee/
│   │   │   ├── code-validator.component.ts
│   │   │   ├── employee-calendar.component.ts
│   │   │   ├── employee-dashboard.component.html
│   │   │   ├── employee-dashboard.component.ts
│   │   │   ├── employee-notifications.component.ts
│   │   ├── home/
│   │   │   ├── home.component.html
│   │   │   ├── home.component.spec.ts
│   │   │   ├── home.component.ts
│   │   │   ├── featured-products/
│   │   │   │   ├── featured-products.component.html
│   │   │   │   └── featured-products.component.ts
│   │   │   ├── hero/
│   │   │   │   ├── hero.component.html
│   │   │   │   ├── hero.component.scss
│   │   │   │   └── hero.component.ts
│   │   │   ├── motorcycle-search/
│   │   │   │   ├── mm.scss
│   │   │   │   ├── motorcycle-search.component.html
│   │   │   │   └── motorcycle-search.component.ts
│   │   │   └── services/
│   │   │       ├── services.component.html
│   │   │       └── services.component.ts
│   │   ├── public/
│   │   │   ├── appointments-page/
│   │   │   │   ├── appointments-page.component.html
│   │   │   │   ├── appointments-page.component.ts
│   │   │   │   ├── weekly-availability.component.ts
│   │   │   │   └── appointment-booking/
│   │   │   │       ├── appointment-booking.css
│   │   │   │       ├── appointment-booking.html
│   │   │   │       └── appointment-booking.ts
│   │   │   ├── client-flow/
│   │   │   │   ├── client-flow-container.component.html
│   │   │   │   ├── client-flow-container.component.scss
│   │   │   │   ├── client-flow-container.component.ts
│   │   │   │   ├── motorcycle-selection.component.html
│   │   │   │   ├── motorcycle-selection.component.scss
│   │   │   │   ├── motorcycle-selection.component.ts
│   │   │   │   ├── phone-verification.component.html
│   │   │   │   ├── phone-verification.component.scss
│   │   │   │   ├── phone-verification.component.ts
│   │   │   │   ├── service-selection.component.html
│   │   │   │   ├── service-selection.component.scss
│   │   │   │   ├── service-selection.component.ts
│   │   │   │   ├── wait-ticket.component.html
│   │   │   │   ├── wait-ticket.component.scss
│   │   │   │   └── wait-ticket.component.ts
│   │   │   ├── contact-page/
│   │   │   │   ├── contact-page.component.html
│   │   │   │   └── contact-page.component.ts
│   │   │   ├── offers-page/
│   │   │   │   ├── offers-page.component.html
│   │   │   │   └── offers-page.component.ts
│   │   │   ├── queue-join/
│   │   │   │   ├── queue-join.component.html
│   │   │   │   ├── queue-join.component.scss
│   │   │   │   └── queue-join.component.ts
│   │   │   └── services-page/
│   │   │       ├── services-page.component.html
│   │   │       └── services-page.component.ts
│   ├── dataconnect-generated/
│   │   ├── index.cjs.js
│   │   ├── index.d.ts
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── angular/
│   │   │   ├── index.cjs.js
│   │   │   ├── index.d.ts
│   │   │   ├── package.json
│   │   │   ├── README.md
│   │   │   └── esm/
│   │   │       ├── index.esm.js
│   │   │       └── package.json
│   │   └── esm/
│   │       ├── index.esm.js
│   │       └── package.json
│   ├── environments/
│   │   ├── environment.prod.ts
│   │   └── environment.ts
│   ├── guards/
│   │   ├── auth.guard.spec.ts
│   │   ├── auth.guard.ts
│   │   ├── client-flow.guard.spec.ts
│   │   ├── client-flow.guard.ts
│   │   ├── queue-session.guard.spec.ts
│   │   └── queue-session.guard.ts
│   ├── models/
│   │   ├── index.ts
│   │   ├── inventory.ts
│   │   ├── invoicing.ts
│   │   ├── notifications.ts
│   │   ├── product.ts
│   │   ├── purchasing.ts
│   │   ├── queue.ts
│   │   ├── returns.ts
│   │   ├── scheduling.ts
│   │   ├── settings.ts
│   │   ├── types.ts
│   │   ├── user.ts
│   │   ├── vehicle.ts
│   │   └── work-order.ts
│   ├── services/
│   │   ├── advanced-product.service.ts
│   │   ├── advanced-service.service.ts
│   │   ├── ai-assistant.service.ts
│   │   ├── alerting.service.ts
│   │   ├── appointment.service.spec.ts
│   │   ├── appointment.service.ts
│   │   ├── audit.service.ts
│   │   ├── auth.service.integration.spec.ts
│   │   ├── auth.service.spec.ts
│   │   ├── auth.service.ts
│   │   ├── auto-assignment.service.ts
│   │   ├── automated-ai-tasks.service.ts
│   │   ├── backup-recovery.service.ts
│   │   ├── bulk-operations.service.ts
│   │   ├── cache.service.ts
│   │   ├── category.service.ts
│   │   ├── circuit-breaker.service.ts
│   │   ├── client-flow.service.ts
│   │   ├── cost-monitoring.service.ts
│   │   ├── employee-schedule.service.ts
│   │   ├── error-handler.service.ts
│   │   ├── modal.service.ts
│   │   ├── motorcycle-assignment.service.ts
│   │   ├── motorcycle-categorization.service.ts
│   │   ├── motorcycle.service.ts
│   │   ├── notification.service.ts
│   │   ├── password.service.ts
│   │   ├── product-validation.service.ts
│   │   ├── product.service.ts
│   │   ├── purchase-order.service.ts
│   │   ├── qr-code.service.ts
│   │   ├── queue_analytics_service.ts
│   │   ├── queue-session.service.ts
│   │   ├── queue.service.ts
│   │   ├── rate-limiter.service.ts
│   │   ├── retry.service.ts
│   │   ├── scheduling.service.ts
│   │   ├── service-health.service.ts
│   │   ├── service-item.service.ts
│   │   ├── session.service.ts
│   │   ├── smart-assignment.service.ts
│   │   ├── stock-movement.service.ts
│   │   ├── supplier.service.ts
│   │   ├── technician-metrics.service.ts
│   │   ├── time-entry.service.ts
│   │   ├── toast.service.ts
│   │   ├── user-validation.service.ts
│   │   ├── user-vehicle.service.ts
│   │   ├── user.service.ts
│   │   ├── validation_service.ts
│   │   ├── work-order.service.ts
│   │   ├── workshop-capacity.service.ts
│   │   └── (otros servicios)
│   ├── utils/
│   │   ├── error-handler.ts
│   │   └── product-filters.ts
│   └── (otros archivos)
└── testsprite_tests/
```

**Notas:**
- Esta estructura está basada en la lista recursiva de archivos obtenida.
- Algunos directorios pueden tener archivos adicionales no listados completamente.
- Los archivos marcados con `(otros archivos si existen)` indican que la lista fue truncada.