# MiNegocio POS v0.9.1 — Recuperación de caja
- Normaliza identificadores de caja/turno como números al cargar el estado.
- Si ya existe un turno abierto, la API de apertura devuelve ese turno en lugar de bloquear con error 409.
- El frontend compara identificadores normalizados para habilitar el cobro.
- IDs de turnos nuevos usan máximo existente + 1.
IMPORTANTE: Desplegar primero en pruebas. Esta corrección no sustituye las transacciones por tabla ni valida toda la operación de producción.
