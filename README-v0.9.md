# MiNegocio POS v0.9 — revisión de caja y ventas en espera

- Apertura de caja y corte mediante ventanas internas, sin `prompt()` del navegador.
- Selección persistente de caja, confirmación del estado y validación previa al cobro.
- Ventas en espera guardadas en `localStorage` por navegador (no compartidas entre cajas).
- Los datos del servidor se almacenan en SQLite o PostgreSQL según DB_ENGINE.

## Railway: diagnóstico de persistencia

Para PostgreSQL: `DB_ENGINE=postgres` y `DATABASE_URL` correcta. Para SQLite: `DB_ENGINE=sqlite`, volumen persistente montado en `/data` y `DATA_DIR=/data`.

**Limitaciones:** la persistencia y las transacciones entre varias instancias de Railway no están verificadas; el estado aún se guarda como un JSON completo. No usar en producción con múltiples cajas concurrentes. Las sesiones de inicio de sesión viven en memoria y requieren iniciar sesión tras reiniciar el servidor. Las ventas en espera solo persisten en el navegador de origen.
