# Base de datos - Stock Barra

## Tabla productos

- `id`
- `nombre`
- `categoria_id`
- `orden`

## Tabla categorias

- `id`
- `nombre`

## Tabla sectores

- `id`
- `nombre`

## Tabla inventario

- `id`
- `producto_id`
- `sector_id`
- `cantidad`
- `ultima_actualizacion`
- `empleado`

## Tabla empleados (v0.4.0)

- `id`
- `nombre` (unico)
- `created_at`

Lectura para `anon`/`authenticated`. Escritura solo via RPCs `admin_*`.

## Tabla stock_snapshots

- `producto_id`
- `cantidad`
- `fecha`
- `snapshot_id`

Notas:

- Cada snapshot guarda stock total por producto, no por sector.
- Las filas de un mismo snapshot comparten `snapshot_id`.
- Los snapshots historicos sin `snapshot_id` se pueden agrupar por `fecha`.
- El guardado nuevo queda preparado para usar la RPC `save_stock_snapshot(...)`.

## Tablas de ventas automaticas

Aplicadas en Supabase:

- `ventas`
- `ventas_detalle`
- `ventas_descuentos`

SQL aplicado:

- `docs/sql/ventas-automaticas-v0.4.0.sql`

## Estado real en Supabase (revisado 2026-11-16)

Revisado con una consulta de solo lectura a `pg_proc`, `pg_policies` y permisos. Antes de esa fecha,
"aplicado" en los docs no estaba verificado.

- Aplicados: `supervisor-hardening-v0.3.2.sql`, `snapshot-rpc-v0.3.3.sql`, `ventas-automaticas-v0.4.0.sql`.
- Sectores reales: `Camara` (5), `Deposito Superior` (1), `Estante Cocina` (2), `Estantes Barra` (3), `Exhibidoras` (4).
- Un usuario de Auth con `app_metadata.role = "supervisor"`.
- RLS activo en todas las tablas. Sin triggers en `public`.
- `anon` puede ejecutar todas las RPCs (default de Supabase); las del supervisor devuelven vacio sin `is_supervisor()`.
- `productos`, `categorias`, `sectores`: `anon` solo lectura.
- `ventas*`: solo lectura para supervisor; escritura solo via `registrar_venta`.
- `inventario` y `stock_snapshots` tenian politicas "permitir todo" creadas a mano (`inventario libre`, `allow all`).
  Se cierran con `docs/sql/hardening-v0.3.4.sql` (aplicado y verificado el 2026-11-16: ya no existen).
- Hay politicas duplicadas de etapas anteriores (`app select …`, `public read …`, `lectura …`).
- FKs: `inventario.producto_id` y `stock_snapshots.producto_id` -> `productos` con `ON DELETE CASCADE`;
  `productos.categoria_id` -> `categorias` sin cascade. Hay 4 productos sin categoria (no aparecen en ningun sector).

## Administracion (v0.4.0, aplicado 2026-11-16)

`docs/sql/admin-v0.4.0.sql` crea `empleados` y las RPCs `admin_agregar/eliminar_empleado`,
`admin_agregar/eliminar_categoria` y `admin_agregar/eliminar_producto`.

- `SECURITY DEFINER`, ejecutables solo por `authenticated` (se revoca `anon`) y cada una exige `is_supervisor()`.
- Borrar un producto borra en cascada su inventario y sus snapshots. Borrar una categoria con productos se rechaza.
- Probado en un Postgres local (PGlite) imitando roles y esquema de produccion: 23 casos OK.
- Verificado en produccion tras aplicarlo: 5 empleados cargados; las 6 RPCs solo con EXECUTE para
  `authenticated` (sin `anon`); los helpers `admin_exigir_supervisor` y `admin_nombre_limpio` sin acceso para `anon`/`authenticated`.

## Ajustes de administracion (v0.4.1, PENDIENTE de aplicar)

`docs/sql/admin-v0.4.1.sql` reemplaza 4 RPCs sin tocar tablas, datos ni permisos:

- `admin_eliminar_producto` rechaza el borrado si el producto tiene filas en `ventas_detalle` o
  `ventas_descuentos` (no tienen FK a `productos`).
- `admin_agregar_empleado/categoria/producto` toman un candado sobre su tabla antes de chequear
  nombres repetidos (evita duplicados por altas simultaneas).
- Probado en PGlite imitando roles y esquema: 16 casos OK (incluye el rollback).
