# 🔐 Seguridad y Autenticación

## 📘 Objetivo
Garantizar un sistema seguro de acceso y control de roles.

---

## 🧩 Servicios Relacionados
- `auth.service.ts`
- `password.service.ts`
- `session.service.ts`
- `user.service.ts`
- `rate-limiter.service.ts`
- `offline-detection.service.ts`

---

## 🧠 Roles Definidos
| Rol | Descripción | Permisos |
|------|--------------|-----------|
| Administrador | Control total del sistema | CRUD completo |
| Técnico | Gestiona colas, órdenes y reportes | Limitado |
| Cliente | Crea solicitudes y consulta estados | Lectura |

---

## ✅ Checklist
- [ ] Revisar flujo de autenticación y expiración de tokens.
- [ ] Activar `rate-limiter.service.ts` contra intentos de fuerza bruta.
- [ ] Asegurar logout completo al cerrar sesión.
- [ ] Documentar endpoints seguros por rol.
- [ ] Implementar 2FA opcional para administradores.

📍 *Última actualización:* _(pendiente de test de roles)_