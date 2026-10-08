# MiNegocio POS — MVP 0.3

## Novedades
- Cobro en efectivo con captura del dinero recibido.
- Cálculo automático del cambio antes de confirmar la venta.
- Botones de efectivo rápido y opción de importe exacto.
- El ticket registra efectivo recibido y cambio.
- Módulo **Configurar ticket** para administrador.
- Personalización de nombre, sucursal, dirección, teléfono, RFC, encabezado, pie, IVA y papel de 58/80 mm.
- Vista previa de ticket e impresión mediante el diálogo del sistema.
- Se mantienen inicio de sesión, departamentos, inventario demo y lector de código de barras.

## Ejecutar
```bash
npm install
npm run dev
```
Abrir http://localhost:3000

## Usuarios demo
- Administrador: `admin` / `admin123`
- Cajero: `cajero` / `caja123`

> MVP: los datos todavía viven en memoria y se reinician al reiniciar Node. La siguiente etapa debe migrar productos, ventas, usuarios, inventario y configuración a PostgreSQL.


## Versión 0.4
- Productos: alta, edición, imagen JPG/PNG/WebP (máximo 850 KB), departamento, precio y existencias.
- Historial de ventas, nota de venta tamaño carta y notas de crédito con reintegro de inventario.
- Configuración de encabezados/pies de notas y despacho de almacén opcional.
- Despacho: venta genera pendiente; almacén confirma entrega desde el panel.
- Persistencia en PostgreSQL si se configura `DATABASE_URL` en Railway. Sin esta variable, el modo demostración sigue siendo volátil.

**IMPORTANTE antes de producción:** esta versión es una base funcional, no un sistema fiscal ni de almacén de alta seguridad. El flujo de despacho es lógico (no bloquea físicamente puertas), los accesos siguen usando credenciales de demostración, y las operaciones no tienen transacciones concurrentes ni autorización por roles de almacenista. Configura PostgreSQL y cambia el sistema de autenticación antes de utilizarlo con dinero o inventario real. La nota de crédito es comercial, no un CFDI de egresos SAT.
