# Contexto del proyecto para asistentes de IA

## Qué es

Stock Barra es una aplicación web interna para contar y consultar bebidas por sector en Beerlin. Se usa principalmente desde celulares durante la operación diaria. La prioridad es cargar rápido, preservar la exactitud del inventario y no interrumpir el flujo que ya usa el personal.

Producción: https://beerlin.online

## Flujos funcionales

- `index.html`: una persona selecciona empleado y sector, carga cantidades y guarda el conteo en Supabase. Puede copiar el stock total o abrir WhatsApp con un reporte.
- Los productos se presentan por categoría y tienen buscador. El buscador es una parte estable y no debe cambiarse sin un motivo concreto.
- En `Camara` hay un flujo especial para contar barriles; esos productos no deben filtrarse a otros sectores.
- `supervisor.html`: requiere sesión de Supabase Auth. Presenta el estado de carga por sector, quién cargó, el inventario general y cambios de stock.
- `supervisor.html` tiene un panel `Admin` (v0.4.0) para agregar/eliminar empleados, categorias y productos via RPCs `admin_*`.
- Los snapshots guardan stock global consolidado para comparar conteos; no representan movimientos por sector.

## Tecnologías y estructura

- HTML, CSS y JavaScript vanilla; no hay framework de frontend.
- Supabase (PostgreSQL y `supabase-js`) para datos y autenticación.
- GitHub Pages publica el sitio, con dominio personalizado.
- Vitest, jsdom y Playwright cubren lógica y flujos principales. Consulta `README.md` para comandos; las cantidades de tests/cobertura que figuran allí pueden quedar desactualizadas.

Áreas principales:

- `js/app.js`, `js/supervisor.js`: inicialización de cada página.
- `js/core/appState.js`: estado compartido del frontend.
- `js/services/`: consultas a Supabase (`catalogoService`, `inventarioService`, `authService`, `ventasService`, cliente).
- `js/modules/stock/`: carga y formato de stock, catálogo renderizable y reglas de barriles.
- `js/modules/supervisor/`: lógica de supervisor.
- `js/ui/renderer.js` y `js/uiRenderer.js`: render de interfaz; revisa los imports antes de cambiar cualquiera.
- `tests/`: pruebas unitarias y smoke tests.

## Modelo de datos documentado

`docs/DATABASE.md` es un resumen, no un volcado completo del esquema.

- `categorias`: `id`, `nombre`.
- `productos`: `id`, `nombre`, `categoria_id`, `orden`.
- `sectores`: `id`, `nombre`.
- `inventario`: `id`, `producto_id`, `sector_id`, `cantidad`, `ultima_actualizacion`, `empleado`.
- `stock_snapshots`: `producto_id`, `cantidad`, `fecha`, `snapshot_id`; un snapshot agrupa el stock global por producto.
- `ventas`: cabecera de carga, fecha, empleado, origen, observación y creación.
- `ventas_detalle`: producto vendido, cantidad, cantidad descontada y faltante.
- `ventas_descuentos`: auditoría del descuento por sector y prioridad.

Las claves, tipos exactos, defaults, constraints, triggers, políticas RLS, funciones instaladas y datos actuales deben confirmarse contra el proyecto Supabase antes de depender de ellos. No inventes contenido ni asumas que los archivos SQL representan todo el esquema.

## Supabase y estado conocido

SQL versionado en `docs/sql/`:

- `supervisor-auth-template.sql`: referencia/plantilla de autenticación.
- `supervisor-hardening-v0.3.2.sql`: RPCs y políticas para el supervisor.
- `snapshot-rpc-v0.3.3.sql`: identidad y guardado de snapshots.
- `ventas-automaticas-v0.4.0.sql`: tablas y RPC de ventas.
- `admin-v0.4.x.sql`: RPCs del panel Admin.
- `decimales-v0.6.0.sql`: cantidades con hasta 2 decimales y `productos.permite_decimales` (ver `DATABASE.md`).

`README.md`, `docs/SUPERVISOR_AUTH.md` y `docs/DATABASE.md` registran algunos SQL como aplicados. Sin embargo, el encabezado de `ventas-automaticas-v0.4.0.sql` todavía dice que se ejecute al llegar a la Parte 2. Esa diferencia no permite confirmar por sí sola qué está desplegado. Verifica el estado real en Supabase antes de volver a aplicar una migración.

El SQL de ventas define `registrar_venta(...)` como `SECURITY DEFINER` y otorga ejecución a `anon` y `authenticated`. Si esa migración está aplicada, el rol `anon` puede invocar la RPC; revisa este acceso y sus efectos sobre `inventario` antes de habilitar el flujo para uso real. No cambies permisos sin revisar los flujos operativos y pedir confirmación cuando la tarea requiera modificar el proyecto remoto.

El trabajo de ventas en `dev` contiene el SQL, `js/services/ventasService.js`, pruebas del service y documentación de diseño. La UI de carga de ventas todavía no está integrada. No describas la función como disponible en la interfaz.

La documentación actual no incluye un volcado completo de la base productiva, estado comprobable de todas las políticas ni datos reales del catálogo. Para tareas que dependan de eso, solicita una exportación de esquema o una inspección autorizada del proyecto Supabase; nunca pidas ni publiques la clave `service_role`.

## Seguridad y datos

- El bloqueo del supervisor en la interfaz depende de una sesión Supabase Auth, pero eso no equivale a proteger todo el backend.
- El flujo operativo del frontend usa el rol público `anon` para ciertas operaciones. Revisa las políticas/RPCs antes de concluir que el stock está protegido.
- No publiques secretos. Las credenciales de administración deben permanecer fuera del navegador y de Git.
- Las pruebas de humo deben usar mocks, no modificar stock productivo.

## Flujo Git y cambios

- `dev` es la rama de trabajo; `main` es la rama estable vinculada a producción.
- Implementa y revisa cambios en `dev`. No hagas merge o push a `main` sin autorización explícita.
- Antes de editar, consulta el estado real de la rama y cualquier cambio local existente.
- Prefiere cambios pequeños que preserven los IDs del DOM, el buscador y las interfaces entre módulos.
- Consulta `docs/ROADMAP.md` para prioridades y `docs/QA_CHECKLIST.md` cuando haya que validar.
