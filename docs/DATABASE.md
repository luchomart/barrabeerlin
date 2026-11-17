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
  Se cierran con `docs/sql/hardening-v0.3.4.sql` (pendiente de aplicar).
- Hay politicas duplicadas de etapas anteriores (`app select …`, `public read …`, `lectura …`).
