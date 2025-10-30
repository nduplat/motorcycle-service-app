# 🤖 Arquitectura de IA y Monitoreo

## 📘 Objetivo
Integrar servicios de IA (Gemini, Groq, automatizaciones) de forma controlada y económica.

---

## 🧩 Servicios Relacionados
- `gemini.service.ts`
- `groq.service.ts`
- `ai-assistant.service.ts`
- `ai-cost-monitoring.service.ts`
- `automated-ai-tasks.service.ts`

---

## 🧠 Estrategia
1. Centralizar peticiones IA en un único gateway.
2. Cachear respuestas similares (`cache.service.ts`).
3. Monitorear costos (`ai-cost-monitoring.service.ts`).
4. Interrumpir tareas automáticas con `budget-circuit-breaker.service.ts` si se supera el límite.

---

## ✅ Checklist
- [ ] Verificar compatibilidad con API actual.
- [ ] Establecer umbrales de consumo (diario y mensual).
- [ ] Crear logs en `audit.service.ts`.
- [ ] Generar panel de métricas IA (reutilizando componentes existentes).

📍 *Última actualización:* _(pendiente de revisión de endpoints IA)_