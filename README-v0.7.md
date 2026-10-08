# MiNegocio POS v0.7 (SQLite)

Requiere **Node.js 22.13 o superior** (módulo integrado `node:sqlite`).

```bash
npm install
npm start
```

Los datos se guardan en `data/minegocio.sqlite`, creado automáticamente al iniciar. Configure `DATA_DIR` para elegir una ubicación persistente. **Nunca versionar el archivo SQLite en Git**.

## Railway
Monte un **Railway Volume** en `/data` y configure `DATA_DIR=/data`. Sin volumen, los datos se perderán con redeploys. No ejecute múltiples réplicas de Railway sobre la misma base SQLite.

## Varias cajas en LAN
Ejecute UNA instancia de Node en el equipo servidor y conecte cada navegador de caja a `http://IP-DEL-SERVIDOR:3000`. Todas las cajas deben usar la API central; **no** compartir el archivo SQLite por SMB/NFS. Configure firewall y una red privada segura.

## Limitaciones críticas
Esta versión persiste el estado, pero mantiene usuarios de demostración y autenticación temporal, y no implementa transacciones SQL por venta ni controles de inventario a nivel de fila. No usar en producción multi-caja hasta migrar a tablas relacionales y transacciones atómicas, contraseñas seguras, roles, respaldo y recuperación. Para muchas cajas concurrentes o múltiples servidores, PostgreSQL sigue siendo más apropiado.

Se añadió desglose de descuentos y opciones de impresión de descuentos y notas; el IVA puede ocultarse solo en comprobantes no fiscales donde la normativa lo permita.
