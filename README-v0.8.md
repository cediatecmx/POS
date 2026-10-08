# MiNegocio POS v0.8 — doble motor (versión de transición)

## Inicio
Requiere Node.js 22.13+ (node:sqlite). Ejecutar `npm install` y `npm start`.

- **SQLite local:** `DB_ENGINE=sqlite` (predeterminado), `DATA_DIR=./data`. Crea `data/minegocio.sqlite`. No subir este archivo a Git.
- **SQLite en Railway:** montar volumen persistente en `/data`, configurar `DB_ENGINE=sqlite` y `DATA_DIR=/data`. Una sola réplica.
- **PostgreSQL:** `DB_ENGINE=postgres` y `DATABASE_URL=...`. Crea tabla `pos_state` automáticamente. Una sola réplica.
- **LAN:** iniciar servidor en una PC y conectar otras cajas mediante `http://IP_DEL_SERVIDOR:3000`. Proteger la red, restringir acceso con firewall y usar HTTPS/VPN para accesos remotos.

## Limitaciones IMPORTANTES
- **No es todavía un POS empresarial apto para producción.** El almacenamiento usa una instantánea JSON en una fila, no tablas transaccionales por venta, stock y caja. La cola serializa escrituras **dentro de una sola instancia** y no protege contra múltiples instancias de Node ni contra fallos entre mutación y guardado.
- La versión anterior 0.7 SQLite se lee sin migración de esquema. PostgreSQL v0.8 crea un estado nuevo; **no importa datos** del PostgreSQL de versiones anteriores.
- No ejecutar SQLite y PostgreSQL contra el mismo negocio a la vez: son estados separados, sin sincronización ni migración automática.
- Antes de vender el producto: migrar a tablas normalizadas, transacciones ACID por venta, autenticación segura (contraseñas con hash, roles), permisos por caja, backups probados, auditoría y pruebas de concurrencia multiinstancia.
- Credenciales demo `admin/admin123` y `cajero/caja123`: **no publicar este prototipo en internet con datos reales**.
- Si cambias el motor, la nueva base arranca con datos demo; respaldar y migrar por un procedimiento explícito.

## Prueba de persistencia
Crear cliente, abrir caja, realizar venta, reiniciar servidor y verificar que los registros continúan. Ejecutar `npm test` para pruebas automáticas de persistencia y venta con SQLite.
