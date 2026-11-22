# Changelog

Historial de cambios de Stock Barra.

## Sin publicar (en `dev`)

### Added
- Productos que se cuentan con decimales (ej. 2,5 botellas abiertas), hasta 2. Se eligen en el admin,
  bloque "Se cuentan con decimales". En el conteo su casilla abre el teclado con coma (acepta coma o
  punto) y los botones − / + siguen sumando de a uno. El resto se sigue contando en enteros.
- Mensaje de WhatsApp, cambios de stock y admin muestran los decimales con coma ("Gin: 2,5").
- Requiere `docs/sql/decimales-v0.6.0.sql` en Supabase (sin aplicarlo, todo sigue en enteros).

## v0.5.0 - 2026-11-17

### Changed (critica de diseño, 2026-11-17)
- Pantalla de conteo:
  - cada categoria muestra "Revisada" al abrirla o tocarla, y junto a `Guardar` se ve
    "N de M categorias revisadas";
  - si hay categorias sin abrir, `Guardar` avisa en pantalla (`Revisar` / `Guardar igual`);
    se sigue guardando todo el sector.
- `Guardar` muestra "Guardando…" y, en vez del `alert`, deja un comprobante en pantalla (sector,
  hora, empleado, productos) con `Enviar stock por WhatsApp`. Sin internet, el comprobante es amarillo.
- El badge fijo "OPERATIVO" paso a ser un indicador real: En linea / Sin conexion / N sin enviar / Sin datos.
- Si falla la carga de la app: tarjeta de error con `Reintentar` y `Guardar` deshabilitado.
- Cambiar de sector con cambios sin guardar ya no pregunta ni borra: lo contado queda como borrador.
- Botones − / + de 44px en cada producto (antes solo con teclado fisico), varias categorias abiertas
  a la vez y nombres largos en dos lineas en vez de cortados.
- Pie mas chico (Guardar + una fila "Stock total: Copiar / WhatsApp"); el buscador queda fijo arriba
  y el header se va al scrollear.
- Accesibilidad:
  - las categorias son botones con `aria-expanded` y cada cantidad tiene etiqueta;
  - hay foco visible con teclado;
  - todo el texto pasa 4.5:1 de contraste;
  - los toques miden al menos 44px y se respeta `prefers-reduced-motion`.
- Textos con tildes y ñ. Se sacan "Supabase" y "snapshots" de la interfaz, y la hora va en 24 h.
- Supervisor:
  - acciones en una fila neutra, "Volver al conteo" arriba y la sesion compacta;
  - las tarjetas de conteo sin etiquetas repetidas;
  - sin emojis decorativos.
- Se sacan adornos: linea de acento, circulos, ripple, brillo verde y entrada escalonada. Las fuentes
  cargan con `<link>` (no `@import`).

### Added
- Panel Admin: bloque "No avisar si estan en 0". Esos productos no aparecen en "Sin stock" del
  mensaje de WhatsApp (con stock se envian normal). Requiere `docs/sql/admin-v0.4.3.sql`.
- Panel Admin: boton "Mover" para cambiar un producto de categoria (tambien sirve para los
  productos sin categoria). Requiere `docs/sql/admin-v0.4.2.sql`.
- Mensaje de WhatsApp:
  - categorias en negrita con su total y emoji por palabra (📦 si no reconoce ninguna);
  - seccion "Sin stock" al final y hora en 24 h;
  - siempre incluye los barriles, elijas el sector que elijas;
  - el supervisor manda el mismo mensaje.
- El buscador ignora tildes y mayusculas ("levite" encuentra "Levité").
- Al buscar, la lista sube hasta el primer resultado. En el celu, mientras se escribe (buscador o
  cantidad), el pie fijo se oculta para que el teclado no tape los productos.
- Conteo a prueba de cortes de internet: lo tipeado en cada sector se guarda en el celular y se
  recupera si se cierra o recarga la pagina. Si `Guardar` falla por falta de red, el conteo queda
  en una cola local y se envia solo al volver la conexion (aviso amarillo en pantalla). Un pendiente
  no se envia si el sector ya tiene un conteo mas nuevo, y se avisa.
- Si falla la carga de empleados se usa la ultima lista guardada en el celular.
- Favicon.
- SQL `docs/sql/admin-v0.4.1.sql`: no se puede borrar un producto con ventas; altas sin duplicados
  por concurrencia.

### Fixed
- Seguridad: los nombres (empleado del conteo, sectores, categorias, productos) se escapan antes de
  mostrarse. `inventario.empleado` lo puede escribir `anon` y se mostraba como HTML en el supervisor.
- Si se elegia el sector antes que el empleado, los productos nunca cargaban.
- Cambiando rapido de sector, la carga del sector anterior podia pisar las cantidades del nuevo.
- `Guardar` sin productos cargados ya no avisa "Conteo guardado".
- Panel Admin: una carga vieja ya no pisa a la nueva, y si el cambio se guarda pero falla la recarga
  se avisa que el cambio si se hizo.
- Empleados ordenados alfabeticamente (antes por id).

## v0.4.0 - 2026-11-16

### Added
- Panel `Admin` dentro de `supervisor.html`: agregar y eliminar empleados, categorias y productos.
- Tabla `empleados` en Supabase y RPCs `admin_*` (solo supervisor) en `docs/sql/admin-v0.4.0.sql`.
- Al borrar un producto se confirma con su stock actual; Supabase borra en cascada su inventario y snapshots.
- Productos sin categoria visibles en el panel como `Sin categoria`.
- SQL `docs/sql/hardening-v0.3.4.sql`: elimina las politicas "permitir todo" de `inventario` y `stock_snapshots`.
- Smoke tests en Linux con `PLAYWRIGHT_CHROMIUM_PATH`.

### Changed
- El desplegable de empleados se carga desde Supabase (antes era una lista fija en `js/config.js`).
- Los barriles se reconocen por la categoria `Barriles`, ademas de la lista fija de nombres.

### Fixed
- El orden de categorias del sector `Estante Cocina` (la clave en config decia `deposito cocina`).

## v0.3.3 - 2026-09-18

### Added
- Soporte frontend para guardar snapshots mediante RPC `save_stock_snapshot`.
- SQL versionado `docs/sql/snapshot-rpc-v0.3.3.sql` para agregar `snapshot_id`, backfill historico y RPC de guardado/deduplicacion.
- Test unitario para validar el contrato RPC de snapshots.

### Changed
- `saveStockSnapshot()` conserva fallback compatible, pero prioriza backend transaccional cuando la RPC esta disponible.
- La comparacion de supervisor queda preparada para agrupar por `snapshot_id` y usar `fecha` solo como compatibilidad historica.
- Documentacion de base de datos actualizada para snapshots con identidad propia.

## v0.3.2 - 2026-07-27

### Added
- Funciones de servicio especificas de supervisor con soporte para RPCs protegidas.
- SQL versionado `docs/sql/supervisor-hardening-v0.3.2.sql` para centralizar lecturas sensibles del supervisor en Supabase.
- Tests unitarios para normalizacion de respuestas RPC del supervisor.

### Changed
- `supervisorController` deja de consumir lecturas crudas generales y pasa a usar servicios orientados a supervisor.
- El hardening backend queda preparado con fallback compatible para no romper la app si el SQL aun no fue aplicado.

## v0.3.1 - 2026-07-27

### Added
- Comando `test:smoke:stable` para correr smoke tests con un solo worker cuando el navegador tiene timeouts aislados.

### Changed
- Roadmap reorganizado como guia de decision futura con prioridades, criterios de salida, riesgos y backlog.
- README y checklist de QA alineados con el estado real de validacion.
- Version visible de la app actualizada a `0.3.1`.

## v0.3.0 - 2026-04-16

### Added
- `authService.js` para manejar sesion real de supervisor con Supabase Auth.
- Login protegido dentro de `supervisor.html`, con cierre de sesion y guard del panel.
- Smoke tests de seguridad sobre acceso directo, login y logout del supervisor.
- Guia local de hardening en `docs/SUPERVISOR_AUTH.md`.

### Changed
- El acceso oculto desde stock ahora redirige al panel protegido en vez de pedir una clave hardcodeada en frontend.
- `supervisorController` pasa a cargar el panel solo cuando la sesion es valida.
- `supervisor.html` arranca bloqueado por defecto y habilita acciones/sections solo con sesion.

### Removed
- Password hash de supervisor embebido en `config.js`.

## v0.2.9 - 2026-04-16

### Added
- Cobertura ampliada sobre formatter, renderer y servicios de snapshots.
- Smoke tests operativos adicionales para copiar, acceso supervisor y estados de error.

### Fixed
- `inventarioService` deja de aceptar `producto_id` nulos o invalidos como si fueran `0` en comparaciones de snapshots.
- La validacion automatizada cierra huecos en guardado, rollback de sector y fallbacks visuales.

## v0.2.8 - 2026-04-16

### Added
- Smoke tests extra para copiado, acceso oculto a supervisor y fallbacks visuales de error.
- Cobertura de navegador sobre normalizacion al guardar, rollback de sector y apertura mockeada de WhatsApp.

### Changed
- La validacion automatizada ahora cubre los flujos operativos mas sensibles del controller sin tocar produccion.

### Fixed
- El mock de clipboard en navegador queda estabilizado para validar el flujo de `Copiar`.

## v0.2.7 - 2026-04-16

### Added
- Smoke tests de navegador con `Playwright` sobre stock y supervisor.
- Server estatico local para correr la app durante pruebas end-to-end.
- Mocks seguros de servicios para validar UI sin tocar Supabase real ni stock de produccion.

### Changed
- El proyecto suma `test:smoke` como comando oficial de validacion.
- La base de testing ahora cubre logica pura, renderer DOM y flujos reales de navegador.

### Fixed
- Los flujos criticos de stock y supervisor quedan protegidos contra regresiones basicas de UI.

## v0.2.6 - 2026-04-16

### Added
- Modulo `stockCatalog.js` para encapsular la logica de catalogo renderizable por sector y barriles.
- Cobertura `jsdom` para render DOM critico y renderizado de catalogo/barriles.
- Suites nuevas para `renderer` y `stockCatalog`.

### Changed
- `stockController.js` delega el armado del catalogo renderizable en un helper puro testeable.
- La base de testing ahora cubre logica pura y smoke tests de DOM dentro de Vitest.

### Fixed
- Se elimina redundancia interna del controller alrededor de la logica de barriles.
- La categoria virtual de barriles y el render supervisor quedan cubiertos por pruebas automatizadas.

## v0.2.5 - 2026-04-09

### Added
- Base de testing con `Node.js` + `Vitest`.
- Scripts `npm test`, `npm run test:watch` y `npm run test:coverage`.
- Suites iniciales para `appState`, normalizacion de texto, formatter y snapshots con mocks de Supabase.

### Changed
- El proyecto suma `package.json`, `vitest.config.js` y `package-lock.json` como base de desarrollo reproducible.
- El reporte de cambios conserva metadatos de fecha de snapshots para futuras vistas de supervisor.

### Fixed
- La primera implementacion de fechas en el reporte de cambios ya queda propagada correctamente desde las diferencias.

## v0.2.4 - 2026-04-09

### Changed
- El guardado de snapshots pasa a devolver un estado explicito (`created`, `deduplicated`, `empty`, `invalid`) para que el frontend no dependa de efectos implicitos.
- La comparacion de snapshots se centraliza sobre helpers comunes y agrega metadatos listos para futuras vistas o diagnosticos.

### Fixed
- Se endurece la deduplicacion reciente de snapshots sin cambiar la estructura de la base.
- El flujo de WhatsApp deja de asumir que todo snapshot no fallido fue insertado realmente.

## v0.2.3 - 2026-04-09

### Added
- Checklist corta de QA pre-release en `docs/QA_CHECKLIST.md`.

### Changed
- El supervisor usa textos mas claros en estados vacios, errores y resumenes de cambios.
- Se alinea la documentacion operativa con la pasada de hardening.

### Fixed
- Se eliminan logs de debug de barriles que habian quedado activos en produccion.
- Se normalizan textos visibles para reducir ruido de codificacion en la app.
- El badge operativo del header pasa a usar escape unicode seguro en CSS.

## v0.2.2 - 2026-03-29

### Added
- `Red Ipa` al conjunto de barriles disponibles para Camara.
- Logs de debug para sector detectado, modo Camara y barriles encontrados.

### Changed
- La normalizacion de texto pasa a una utilidad global reutilizable.
- La categoria virtual de barriles usa `id: "barriles"` y se inserta al inicio.

### Fixed
- Los barriles dejan de filtrarse mal por diferencias de mayusculas, acentos o espacios.
- Los barriles ya no aparecen en sectores distintos de Camara.
- La integracion de barriles queda aislada sin mutar `appState`.

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
