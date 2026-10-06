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
