# 💰 Optimización de Costos - Firebase y Google Cloud

## 📘 Objetivo
Reducir los costos de operación sin afectar rendimiento, escalabilidad o experiencia de usuario.

---

## 📊 Uso Actual (Estimado)
| Recurso | Servicio | Estado | Recomendación |
|----------|-----------|--------|----------------|
| Firestore | Base de datos principal | OK | Mantener índices simples |
| Functions | Tareas automatizadas | Alto costo | Migrar algunas a cron local |
| Cloud Storage | Archivos e imágenes | Medio | Usar compresión y expiración |
| Authentication | Inicio de sesión | OK | Revisar App Check |
| Hosting | Web principal | OK | Aplicar cache CDN |
| Pub/Sub | Notificaciones | Bajo uso | Consolidar |
| Cloud Run | AI y tareas | Evaluar | Migrar a batch si es posible |

---

## 🧠 Estrategias Recomendadas

### Corto Plazo
- [ ] Activar App Check para reducir abusos.
- [ ] Establecer límites de lectura/escritura en Firestore.
- [ ] Usar `cache.service.ts` para respuestas repetidas.
- [ ] Activar compresión de imágenes (`image-optimization.service.ts`).

### Mediano Plazo
- [ ] Consolidar funciones en un único `scheduled-tasks` módulo.
- [ ] Implementar `budget-circuit-breaker.service.ts` para detener tareas cuando se supere umbral de gasto.
- [ ] Registrar métricas en `ai-cost-monitoring.service.ts`.

---

## 📈 Presupuesto Operativo Estimado

| Rol | Usuarios | Costo estimado mensual (USD) |
|------|-----------|-----------------------------|
| Técnicos | 7 | $3.00 |
| Clientes | 100 | $4.50 |
| Administradores | 4 | $2.00 |
| **Total** | **111** | **~$9.50 / mes (Free Tier)** |

📍 *Última actualización:* _(pendiente de revisión financiera)_