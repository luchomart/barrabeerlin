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

Notas:

- Cada snapshot guarda stock total por producto, no por sector.
- Las filas de un mismo snapshot comparten la misma `fecha`.
- La app evita duplicados recientes en frontend antes de insertar.
