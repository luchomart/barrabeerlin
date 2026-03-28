# Changelog

Historial de cambios de Stock Barra.

## v0.2.1 - 2026-03-27

### Added
- Categoria virtual de barriles sin pinchar para Camara usando productos ya existentes del catalogo.
- Deduplicacion defensiva de snapshots recientes con el mismo contenido.
- Comparacion estructurada de cambios de stock lista para render sin parsear texto.
- Verificacion hash del acceso supervisor para no dejar la clave en texto plano.

### Changed
- Unificacion del cliente de Supabase en una sola fuente de configuracion.
- Normalizacion de textos visibles y etiquetas con codificacion consistente.
- `buildStockData()` queda apoyada en una version pura reutilizable basada en inventario.

### Fixed
- Colisiones de snapshots provocadas por timestamps demasiado normalizados.
- Orden de categorias afectado por strings con codificacion rota en configuracion.
- Ruta del entrypoint de supervisor y script global sobrante en HTML.

### Removed
- Script global innecesario de Supabase en la vista principal.
- Archivos vacios y legacy que no aportaban a la arquitectura actual.

## v0.2.0 - 2026-03-27

### Added
- Guardado de snapshots de stock total al compartir por WhatsApp.
- Comparacion entre los dos ultimos snapshots por producto.
- Seccion de cambios de stock lista para futuras vistas de supervisor.

### Changed
- Version centralizada en `js/config.js` y visible en la UI.
- Supervisor con mejor jerarquia visual, loaders y estados mas claros.
- Documentacion de versionado y roadmap alineados con el estado real del proyecto.

### Fixed
- Validacion defensiva de cantidades antes de guardar inventario.
- Flujo de cambio de sector con rollback real cuando hay cambios pendientes.
- Bloqueo simple para evitar snapshots duplicados por doble toque en WhatsApp.

### Removed
- Referencias de version dispersas en la documentacion que ya no representaban el estado real.

## v0.1.0 - 2026-03-26

### Added
- Arquitectura modular con `services`, `modules`, `ui` y `core`.
- `stockController`, `supervisorController` y `appState` como base del flujo actual.
- Formateadores separados para stock total y cambios de stock.

### Changed
- `app.js` y `supervisor.js` pasan a ser entrypoints livianos.
- `ui/renderer.js` se consolida como capa principal de render.
- La carga de datos queda desacoplada de la UI legacy.

### Fixed
- Flujo de seleccion de empleado y sector alineado con el comportamiento original.
- Restauracion de estado al cancelar cambios de sector durante la migracion modular.

## v0.0.2 - 2026-03-13

### Fixed
- Se corrige la perdida de datos al cancelar un cambio de sector.
- El sistema vuelve a conservar el sector anterior para poder revertir correctamente.

## v0.0.1 - 2026-03-13

### Added
- Carga de stock por sector.
- Seleccion de empleado.
- Categorias colapsables.
- Buscador de productos.
- Guardado en Supabase.
- Copiar stock y compartir por WhatsApp.
- Vista inicial de supervisor.
