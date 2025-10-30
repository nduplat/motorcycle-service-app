# 🔄 Flujo Cliente–Técnico–Administrador (Queue Flow)

## 📘 Objetivo
Estandarizar el flujo de atención en tiempo real: cliente → técnico → administrador.

---

## 🧭 Diagrama Lógico
```mermaid
flowchart TD
  A[Cliente escanea QR] --> B[Verifica autenticación]
  B -->|No autenticado| C[Redirigir a login]
  B -->|Autenticado| D[Verifica disponibilidad técnica]
  D --> E[Asigna técnico disponible]
  E --> F[Genera turno en cola]
  F --> G[Administrador supervisa / reasigna]
  G --> H[Finaliza servicio y registra reporte]
```

---

## 🧩 Servicios Involucrados

* `client-flow.service.ts`
* `queue.service.ts`
* `queue-session.service.ts`
* `appointment.service.ts`
* `workshop-capacity.service.ts`
* `technician-metrics.service.ts`

---

## ✅ Checklist de Implementación

* [ ] Sincronizar cola en tiempo real (Firestore o WebSocket).
* [ ] Verificar límite de técnicos simultáneos.
* [ ] Agregar control de prioridades en `queue-session.service.ts`.
* [ ] Validar interfaz visual en componentes actuales (sin nuevos estilos).
* [ ] Loguear todos los eventos en `audit.service.ts`.

---

📍 *Última actualización:* *(pendiente de validación de flujo operativo)*