# 🧩 Arquitectura de Servicios - Proyecto Taller Inteligente

## 📘 Objetivo
Documentar la estructura actual de servicios, detectar redundancias y definir una arquitectura modular estable, sin romper el código existente.

---

## 🧭 Clasificación de Servicios

### 1. Core / Infraestructura
- `auth.service.ts`
- `session.service.ts`
- `cache.service.ts`
- `event-bus.service.ts`
- `error-handler.service.ts`
- `sync.service.ts`
- `sync-mediator.service.ts`
- `ai-assistant.service.ts`
- `ai-cost-monitoring.service.ts`

### 2. Funcionales / Lógica del Negocio
- `appointment.service.ts`
- `queue.service.ts`
- `queue-session.service.ts`
- `client-flow.service.ts`
- `work-order.service.ts`
- `technician-metrics.service.ts`
- `employee-schedule.service.ts`
- `motorcycle.service.ts`
- `inventory-reports.service.ts`

### 3. Auxiliares / UI / Utilidades
- `toast.service.ts`
- `modal.service.ts`
- `notification.service.ts`
- `validation_service.ts`
- `form_cache_service.ts`

---

## 🔍 Auditoría y Recomendaciones

### Checklist
- [ ] Identificar servicios redundantes o duplicados.
- [ ] Consolidar lógica similar (ej. `cost-monitoring.service.ts` y `ai-cost-monitoring.service.ts`).
- [ ] Documentar dependencias entre servicios.
- [ ] Revisar interacciones entre servicios críticos (auth, sync, queue).
- [ ] Separar responsabilidades en módulos independientes (`core`, `business`, `ui`).

---

## 📜 Documentación Técnica
Cada servicio debe documentarse con:
```yaml
service_name:
  description: "Breve descripción funcional."
  dependencies: ["auth.service", "cache.service"]
  exposed_methods: ["create", "update", "delete", "list"]
  related_components: ["AppointmentForm", "QueueDashboard"]
  status: "Stable | Needs Review | Deprecated"
```

📍 *Última actualización:* *(pendiente de la auditoría técnica)*