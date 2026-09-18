# Roadmap - Stock Barra

Roadmap actualizado segun el estado real del proyecto al 2026-09-18.

Este documento es la guia de decision para futuras implementaciones. La regla general es simple: mejorar estabilidad, velocidad operativa y seguridad sin romper el flujo actual de uso real.

## Principios del producto

- No hacer rewrites completos mientras la app siga en uso real.
- Mantener mobile-first como prioridad principal.
- No tocar el buscador salvo que exista una razon concreta y pruebas que cubran regresiones.
- Preservar IDs del DOM y estructura visual salvo mejoras controladas.
- Usar `appState` como fuente unica de estado de frontend.
- Mantener `services` como capa de datos, `modules` como logica, `ui/renderer.js` como render y `core` como estado.
- Priorizar cambios pequenos, testeables y reversibles.
- Documentar cada cambio que afecte seguridad, Supabase o flujo operativo.

## Estado actual

Version base:

- `0.3.3`

Capas consolidadas:

- Arquitectura modular con `services`, `modules`, `ui` y `core`.
- Carga de stock por sector con empleado + sector.
- Buscador estable.
- Guardado de inventario en Supabase.
- Supervisor con login real usando Supabase Auth.
- Snapshots globales de stock.
- Comparacion global de cambios entre snapshots.
- Conteo de barriles en `Camara`.
- Versionado centralizado en `js/config.js`.
- Tests unitarios y smoke tests de navegador.

Estado de validacion conocido:

- `50` tests unitarios.
- `12` smoke tests de navegador.
- Cobertura unitaria aproximada: `90%` statements y `93%` lines.
- Smoke tests seguros con mocks, sin tocar stock real.

## Hallazgos del analisis

Fortalezas actuales:

- La app ya tiene una arquitectura razonable para crecer sin reescribir.
- El flujo critico esta cubierto por pruebas automatizadas.
- El supervisor dejo de depender de password hardcodeado en frontend.
- La logica de barriles esta aislada en catalogo renderizable y no deberia contaminar otros sectores.
- Los snapshots ya se guardan desde stock total consolidado, que es la direccion correcta.

Riesgos actuales:

- `stockController.js` todavia concentra demasiadas responsabilidades operativas.
- La seguridad backend aun necesita una segunda capa mas fuerte con politicas/RPCs en Supabase.
- Los snapshots todavia dependen de convenciones de fecha/contenido y no de una identidad fuerte de snapshot.
- Algunas experiencias usan `alert()`, correcto para estabilidad pero limitado para UX mobile.
- El supervisor detecta posibles errores/anomalias, pero todavia no los convierte en un diagnostico visual accionable.
- La administracion de catalogo/productos todavia depende de SQL manual.
- La configuracion de smoke tests puede ser sensible a concurrencia del navegador; conviene estandarizar corrida estable.

## Criterio de prioridad

P0 - Seguridad e integridad:

- Se hace antes que features visuales si hay riesgo de exponer datos, perder stock o guardar datos corruptos.
- Incluye RLS, RPCs, validacion, snapshots confiables y rollback.

P1 - Operacion diaria:

- Mejora lo que el usuario toca todos los dias durante el conteo.
- Incluye velocidad de carga, inputs, feedback, errores claros y experiencia mobile.

P2 - Supervisor y analisis:

- Mejora lectura, decision y control.
- Incluye dashboard, alertas, comparaciones y anomalias.

P3 - Mantenimiento y escala:

- Reduce costo futuro.
- Incluye tests, CI, documentacion, release workflow, migraciones y limpieza tecnica.

## No hacer todavia

- No migrar a React/Vue ni introducir framework grande.
- No cambiar la estructura de base de datos de inventario sin migracion y pruebas.
- No cerrar `inventario` con RLS agresivo antes de separar lecturas de supervisor.
- No crear un dashboard complejo antes de robustecer snapshots y permisos.
- No agregar gestion completa de usuarios/roles hasta cerrar el caso supervisor actual.
- No tocar el buscador estable salvo bugs demostrados.
- No cambiar nombres comerciales de productos sin decision operativa.

## v0.3.1 - Cierre post-publicacion (completado)

Tipo:

- `PATCH`

Objetivo:

- Dejar la version publicada consistente, documentada y facil de validar despues de un tiempo sin tocar la app.

Incluye:

- Actualizar documentacion de validacion a `46` tests unitarios.
- Estandarizar comando recomendado de smoke tests si la corrida paralela vuelve a ser inestable.
- Revisar checklist de QA contra el flujo real publicado.
- Confirmar que login/logout supervisor funciona en produccion.
- Confirmar que los productos nuevos del catalogo aparecen donde corresponde.
- Validar que no quedaron logs temporales de debug visibles en produccion.

Criterio de salida:

- `npm test` pasa.
- `npm run test:smoke` pasa o queda documentada la corrida estable.
- Checklist manual principal completada.
- No hay cambios de UX no intencionales.

## v0.3.2 - Hardening backend de supervisor (completado)

Tipo:

- `PATCH`

Objetivo:

- Convertir la proteccion del supervisor en seguridad real de backend, no solo bloqueo de UI.

Incluye:

- Consolidar `public.is_supervisor()` en Supabase.
- Mover lecturas sensibles del supervisor a RPCs dedicadas.
- Restringir lectura de `stock_snapshots` a supervisor autenticado.
- Definir politicas RLS para que el flujo de stock siga funcionando sin exponer mas de lo necesario.
- Documentar SQL final aplicado y rollback manual.

Criterio de salida:

- Stock principal sigue cargando, guardando y compartiendo.
- Supervisor solo lee datos sensibles con sesion autorizada.
- El frontend usa servicios de supervisor compatibles con RPCs protegidas.
- SQL versionado en `docs/sql/supervisor-hardening-v0.3.2.sql` aplicado en Supabase.

Riesgo:

- No cerrar todavia `stock_snapshots` para `anon` porque el guardado de snapshots aun deduplica leyendo snapshots recientes desde frontend.

## v0.3.3 - Snapshots confiables (completado)

Tipo:

- `PATCH`

Objetivo:

- Hacer que los snapshots sean una base solida para analisis futuro.

Incluye:

- Definir identidad de snapshot mas fuerte que solo `fecha`.
- Evaluar `snapshot_id` o `batch_id` para agrupar filas de un mismo snapshot.
- Guardar metadata minima: origen, version app, usuario/supervisor si aplica.
- Revisar deduplicacion desde frontend vs restriccion en DB.
- Agregar pruebas para casos con fechas iguales, duplicados y snapshots incompletos.

Criterio de salida:

- Comparar ultimos 2 snapshots no depende de casualidades de timestamp.
- Doble click o repeticion accidental no duplica analisis.
- El supervisor puede mostrar estado "sin datos suficientes" de forma confiable.
- SQL versionado en `docs/sql/snapshot-rpc-v0.3.3.sql` aplicado en Supabase.

## v0.4.0 - Velocidad de conteo

Tipo:

- `MINOR`

Objetivo:

- Reducir tiempo y friccion durante carga real de stock en mobile.

Incluye:

- Acciones rapidas `+1`, `+6`, `+12` o equivalentes configurables.
- Mejoras de foco entre inputs.
- Mejor lectura de categorias largas.
- Feedback no bloqueante para guardado/copiar.
- Revision de densidad visual sin cambiar el flujo base.
- Posible mejora de rendimiento al cambiar de sector.

Criterio de salida:

- El conteo se siente mas rapido en celular.
- No cambia el resultado guardado.
- El buscador sigue funcionando igual.
- Los usuarios pueden seguir usando inputs normales.

## v0.4.1 - Gestion controlada de catalogo

Tipo:

- `PATCH`

Objetivo:

- Reducir dependencia de SQL manual para altas simples de productos.

Opciones posibles:

- Mantener SQL templates bien documentados para agregar productos.
- Crear una mini herramienta interna protegida para productos/categorias.
- Agregar campo `activo` para ocultar productos sin borrar historial.
- Documentar reglas de nombres, categorias y orden.

Criterio de salida:

- Agregar productos nuevos deja de ser riesgoso.
- No se rompe historial de inventario.
- No se requiere modificar codigo para cada alta comun, salvo casos especiales.

Decision pendiente:

- Elegir entre mantener SQL guiado o construir una UI chica de administracion.

## v0.5.0 - Supervisor inteligente

Tipo:

- `MINOR`

Objetivo:

- Convertir el supervisor en una herramienta de decision rapida.

Incluye:

- Dashboard con resumen operativo global.
- Alertas de stock bajo.
- Ranking de mayores salidas y entradas.
- Estado de sectores con antiguedad del ultimo conteo.
- Deteccion visual de anomalias.
- Export o copia de reportes operativos.
- Filtros simples por fecha/rango si los datos lo justifican.

Criterio de salida:

- En menos de 3 segundos se entiende que falta, que cambio y que sectores estan al dia.
- No requiere entrenamiento para leer lo importante.
- Los calculos vienen de datos consolidados y no duplican logica de UI.

## v0.6.0 - Calidad y release workflow

Tipo:

- `MINOR`

Objetivo:

- Hacer que publicar cambios sea repetible y menos riesgoso.

Incluye:

- GitHub Actions para `npm test`.
- Workflow documentado para `dev -> main -> deploy`.
- Checklist de release por version.
- Estrategia de rollback manual.
- Convencion de ramas y commits.
- Posible script de version bump.
- Evidencia minima de QA antes de publicar.

Criterio de salida:

- Ningun cambio importante llega a `main` sin pruebas.
- Publicar deja de depender de memoria.
- Volver atras esta documentado.

## v0.7.0 - Resiliencia operativa

Tipo:

- `MINOR`

Objetivo:

- Reducir riesgo cuando hay mala conexion o uso intenso en barra.

Incluye:

- Guardado de borrador local antes de enviar a Supabase.
- Indicador claro de estado de guardado.
- Reintento controlado si falla red.
- Prevencion de perdida accidental al cerrar o cambiar sector.
- Evaluar PWA/offline parcial solo si aporta de verdad.

Criterio de salida:

- Una falla de red no hace perder un conteo cargado.
- El usuario entiende si algo quedo guardado o pendiente.
- No se generan duplicados por reintentos.

## v1.0.0 - Sistema estable

Tipo:

- `MAJOR`

Objetivo:

- Considerar Stock Barra estable para uso continuo y mantenimiento ordenado.

Condiciones esperadas:

- Seguridad backend aplicada y probada.
- Flujos criticos cubiertos por tests o smoke checks repetibles.
- Snapshots robustos con identidad clara.
- Supervisor util para decision operativa real.
- Catalogo mantenible sin tocar codigo para cada cambio menor.
- Documentacion tecnica y operativa al dia.
- Release workflow claro.

## Backlog de ideas

Ideas utiles, pero no comprometidas a version todavia:

- Exportar reportes a CSV o PDF.
- Plantillas de WhatsApp para compra/reposicion.
- Historial por producto.
- Vista de "productos sin contar".
- Modo evento o cierre de noche.
- QR/barcode scanning si el catalogo crece mucho.
- Auditoria de quien cargo o modifico cada conteo.
- Roles adicionales: supervisor, encargado, empleado.
- Umbrales configurables por producto.
- Panel simple de salud del sistema.

## Orden recomendado de ejecucion

1. Avanzar a `v0.4.0` para mejorar velocidad de conteo.
2. Recien despues construir `v0.5.0` con supervisor inteligente.

## Preguntas de producto abiertas

- El catalogo deberia seguir siendo administrado por SQL guiado o necesita una UI protegida?
- Los snapshots deben representar cada envio por WhatsApp o cada cierre operativo de stock?
- Quien puede ver supervisor en el futuro: una sola cuenta o varios roles?
- Que productos necesitan umbrales de alerta y cuales no?
- Que tan importante es offline/PWA para el uso real en barra?

## Historial cerrado

Versiones ya completadas y documentadas en `CHANGELOG.md`:

- `v0.1.0`: modularizacion base.
- `v0.2.0`: snapshots, comparacion y versionado inicial.
- `v0.2.1`: barriles, deduplicacion y limpieza legacy.
- `v0.2.2`: `Red Ipa` y normalizacion de sector `Camara`.
- `v0.2.3`: hardening operativo y QA checklist.
- `v0.2.4`: consistencia de snapshots.
- `v0.2.5`: base de testing con Node/Vitest.
- `v0.2.6`: cobertura de catalogo y DOM.
- `v0.2.7`: smoke tests de navegador.
- `v0.2.8`: smoke tests operativos ampliados.
- `v0.2.9`: cierre de huecos de testing.
- `v0.3.0`: seguridad de supervisor en app y backend preparado.
- `v0.3.1`: cierre post-publicacion, roadmap rector y QA estabilizado.
- `v0.3.2`: servicios de supervisor por RPC y SQL de hardening compatible aplicado.
- `v0.3.3`: snapshots con identidad propia y RPC de guardado aplicada.
