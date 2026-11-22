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

## Ajustes de administracion (v0.4.1, aplicado 2026-11-17)

`docs/sql/admin-v0.4.1.sql` reemplaza 4 RPCs sin tocar tablas, datos ni permisos:

- `admin_eliminar_producto` rechaza el borrado si el producto tiene filas en `ventas_detalle` o
  `ventas_descuentos` (no tienen FK a `productos`).
- `admin_agregar_empleado/categoria/producto` toman un candado sobre su tabla antes de chequear
  nombres repetidos (evita duplicados por altas simultaneas).
- Probado en PGlite imitando roles y esquema: 16 casos OK (incluye el rollback).
- Aplicado por Luciano el 2026-11-17. Verificacion: las 4 RPCs con `cambio_aplicado = true` y
  `sin_anon = true`; permisos solo `postgres`, `authenticated` y `service_role`.

## Mover producto de categoria (v0.4.2, aplicado 2026-11-17)

`docs/sql/admin-v0.4.2.sql` agrega la RPC `admin_mover_producto(producto_id, categoria_id)`:

- `SECURITY DEFINER`, solo `authenticated` (se revoca `anon`) y exige `is_supervisor()`.
- Modifica solo `productos.categoria_id` y `productos.orden` de ese producto (queda al final de la
  categoria nueva). No toca inventario, snapshots ni ventas.
- Sirve para darle categoria a los productos que hoy no tienen.
- Aplicado por Luciano el 2026-11-17; la consulta de verificacion dio `sin_anon = true`.
- La prueba en produccion movio a Vinos los 4 productos sin categoria (duplicados: 19, 32, 33, 34).
  Se revirtio con `docs/sql/revertir-prueba-mover-2026-11-17.sql` (verificado: los 4 con
  `categoria_id` y `orden` en null). Siguen siendo los unicos productos sin categoria.

## Productos sin aviso de stock en 0 (v0.4.3, aplicado 2026-11-17)

`docs/sql/admin-v0.4.3.sql`:

- Columna `productos.avisar_sin_stock` (boolean, default true). En false, el producto en 0 no
  aparece en "SIN STOCK" del mensaje de WhatsApp (con stock se envia normal).
- RPC `admin_avisar_sin_stock(producto_id, avisar)`: `SECURITY DEFINER`, solo `authenticated`,
  exige `is_supervisor()`. Solo cambia esa columna de ese producto.
- La app lee `productos` con `select("*")`: sin la columna, trata a todos como "avisar".
- Probado en PGlite imitando roles y esquema: 14 casos OK (incluye el rollback).
- Aplicado por Luciano el 2026-11-17. Verificacion: `columna_ok = true`, `productos_sin_aviso = 0`,
  `rpc_sin_anon = true`.
- Probado en PGlite imitando roles y esquema (con v0.4.0 y v0.4.1 cargados): 14 casos OK.

## Cantidades con decimales (v0.6.0, aplicado 2026-11-22)

`docs/sql/decimales-v0.6.0.sql` (todo en un `begin/commit`):

- `inventario.cantidad` y `stock_snapshots.cantidad` pasan de `integer` (verificado 2026-11-22 con
  un filtro de solo lectura) a `numeric(10,2)`. Los valores actuales no cambian.
- Columna `productos.permite_decimales` (boolean, default false). Con false el producto se cuenta
  en enteros como siempre.
- RPC `admin_permitir_decimales(producto_id, permitir)`: `SECURITY DEFINER`, solo `authenticated`,
  exige `is_supervisor()`. Solo cambia esa columna de ese producto.
- `save_stock_snapshot` guarda con 2 decimales (antes redondeaba para abajo). Mismos permisos.
- `get_supervisor_inventario_con_sectores` y `get_supervisor_diferencias_stock` devuelven `numeric`
  (se borran y recrean) y quedan solo para `authenticated` (antes `anon` tambien, pero devolvian vacio).
- No toca `registrar_venta`: con stock decimal convierte lo disponible a entero (0,5 cuenta como 1).
  Revisarlo antes de hacer la UI de ventas.
- La app anda antes y despues de aplicarlo: sin la columna nadie tiene decimales.
- Probado en PGlite imitando roles y esquema: 17 casos OK (incluye permisos y el rollback).
- Aplicado por Luciano el 2026-11-22. Verificacion: `inventario_numeric`, `snapshots_numeric`,
  `columna_ok`, `rpcs_sin_anon` y `snapshot_sigue_para_anon` en true; `productos_con_decimales = 0`.
