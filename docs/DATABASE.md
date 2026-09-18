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
