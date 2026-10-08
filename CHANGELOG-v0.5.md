# MiNegocio POS 0.5 - Cambios
- CRUD de clientes y proveedores (alta/edición/activación).
- Sucursales y cajas de cobro administrables. Las sucursales todavía NO son aislamiento multiempresa ni licenciamiento comercial.
- Apertura, movimientos y cierre de caja con cálculo de diferencia; las ventas exigen caja abierta.
- Reportes resumidos y estado de cajas.
- Logo configurable en ticket, posición y ancho. Impresión automática tras cobrar opcional: el diálogo del navegador sigue apareciendo salvo que el terminal se configure para impresión silenciosa/kiosco.
- Animaciones suaves con soporte para preferencia de movimiento reducido.

## IMPORTANTE antes de producción
- Realizar respaldo de PostgreSQL antes de desplegar.
- Usuarios de prueba y sesiones en memoria: sustituir por autenticación persistente y contraseñas cifradas antes de uso real.
- Estado JSON único en PostgreSQL: no garantiza concurrencia segura entre instancias ni cajas simultáneas; migrar a tablas y transacciones antes de usar en operación multi-caja.
- No hay licenciamiento por sucursal, permisos por caja, conciliación de pagos, ni integración directa con impresoras.
- Para impresoras térmicas sin diálogo, configurar kiosco/servicio local de impresión por equipo; `window.print()` no permite impresión silenciosa en navegador estándar.
- Probar impresión física y flujo completo en Railway antes de operar.
