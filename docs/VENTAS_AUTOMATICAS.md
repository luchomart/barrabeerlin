# Ventas automaticas - Diseno inicial

Documento de contrato para implementar carga de ventas con descuento automatico de stock por prioridad de sectores.

Estado:

- SQL de base aplicado en Supabase.
- No implementado todavia en UI.
- Pendiente integrar service y UI.

## Objetivo

Permitir cargar ventas del dia para que el sistema descuente automaticamente cantidades del inventario existente, sin reemplazar el conteo manual.

El conteo manual sigue siendo la verdad fisica final. Las ventas automaticas son una herramienta secundaria para reducir carga manual y mejorar trazabilidad.

## Principios

- No tocar el buscador existente.
- No reemplazar el flujo principal de carga de stock.
- No permitir stock negativo.
- Registrar auditoria de cada descuento.
- Guardar faltantes si una venta supera el stock disponible.
- Ejecutar el descuento en Supabase mediante RPC transaccional, no solo desde frontend.
- Mantener la feature separada del flujo principal hasta validarla bien.

## Prioridad de sectores

La venta descuenta desde sectores en este orden:

Prioridad 1:

- `Exhibidoras`
- `Estantes Barra`

Prioridad 2:

- `Camara`

Prioridad 3:

- `Deposito Superior`
- `Deposito Cocina`

Notas de normalizacion:

- La app normaliza acentos y mayusculas para comparar sectores.
- Si en Supabase un nombre difiere, se deberia mapear por nombre normalizado.
- Antes de aplicar SQL definitivo conviene validar nombres reales de `sectores`.

## Regla de descuento

Para cada producto vendido:

1. Buscar inventario disponible del producto en sectores de prioridad 1.
2. Descontar hasta cubrir la cantidad vendida o agotar esos sectores.
3. Continuar con prioridad 2.
4. Continuar con prioridad 3.
5. Si no alcanza el stock total disponible, guardar el faltante.

Nunca se permite cantidad negativa en `inventario`.

Ejemplo:

Venta:

- `Coca Cola x10`

Inventario:

- `Exhibidoras`: 4
- `Estantes Barra`: 3
- `Camara`: 20
- `Deposito Superior`: 50

Resultado:

- `Exhibidoras`: 0
- `Estantes Barra`: 0
- `Camara`: 17
- `Deposito Superior`: 50

Auditoria:

- descuento `Exhibidoras`: 4
- descuento `Estantes Barra`: 3
- descuento `Camara`: 3
- faltante: 0

## Caso de stock insuficiente

Ejemplo:

- Venta: 10
- Stock disponible total: 7

Resultado esperado:

- Descontar 7.
- Registrar faltante 3.
- No bloquear la venta.
- No dejar stock negativo.

Motivo:

- En uso real puede haber ventas aunque el sistema no tenga stock registrado suficiente.
- El faltante sirve para supervisor y correccion posterior.

## Datos a guardar

### Tabla `ventas`

Representa una carga de ventas.

Campos sugeridos:

- `id`
- `fecha`
- `empleado`
- `origen`
- `observacion`
- `created_at`

Notas:

- `origen` puede ser `manual`, y a futuro podria ser `importado`.
- `empleado` puede ser texto para mantener compatibilidad con la app actual.

### Tabla `ventas_detalle`

Representa productos vendidos dentro de una venta.

Campos sugeridos:

- `id`
- `venta_id`
- `producto_id`
- `cantidad`
- `faltante`
- `created_at`

### Tabla `ventas_descuentos`

Auditoria de como se desconto cada producto por sector.

Campos sugeridos:

- `id`
- `venta_id`
- `producto_id`
- `sector_id`
- `cantidad_descontada`
- `prioridad`
- `created_at`

## RPC sugerida

Nombre:

- `registrar_venta(stock_vendido jsonb, empleado text, observacion text default null)`

Entrada esperada:

```json
{
  "101": 3,
  "201": 10
}
```

Salida esperada:

```json
{
  "status": "created",
  "venta_id": "...",
  "detalles": [
    {
      "producto_id": 201,
      "cantidad": 10,
      "descontado": 7,
      "faltante": 3
    }
  ],
  "descuentos": [
    {
      "producto_id": 201,
      "sector_id": "exhibidoras",
      "cantidad_descontada": 4,
      "prioridad": 1
    }
  ]
}
```

## Validaciones

- Cantidad debe ser numero entero.
- Cantidad minima: `0`.
- Cantidad maxima por producto: `1000`.
- Productos invalidos se ignoran o generan error controlado.
- Una venta sin productos validos devuelve `status: "empty"`.
- El descuento completo debe ser transaccional.

## UI inicial propuesta

Pantalla o seccion:

- `Cargar ventas`

Campos:

- Buscador o selector de productos.
- Input numerico de cantidad vendida.
- Boton `Agregar`.
- Resumen de productos cargados.
- Boton `Guardar ventas`.

Feedback:

- Venta guardada.
- Productos descontados.
- Faltantes detectados.

No incluido en primera version:

- Importar desde planilla.
- Integracion con punto de venta.
- Edicion avanzada de ventas.
- Reportes complejos.

## Supervisor

Primera lectura util:

- Ventas del dia.
- Faltantes del dia.
- Productos mas vendidos.
- Descuentos por sector.

No bloquearia el lanzamiento inicial si la UI de supervisor queda para una fase posterior.

## Riesgos

- Descontar del sector equivocado si los nombres no coinciden.
- Doble carga accidental de una venta.
- Dos usuarios cargando ventas al mismo tiempo.
- Producto vendido que no existe en inventario para ningun sector.
- Auditoria insuficiente para corregir errores.

Mitigaciones:

- Usar RPC transaccional.
- Guardar `ventas_descuentos`.
- No permitir negativos.
- Registrar faltantes.
- Agregar debounce o bloqueo de boton en UI.
- Validar nombres reales de sectores antes de SQL final.

## Etapas de implementacion

### Parte 1 - Contrato

- Definir reglas, prioridades y datos.
- Documentar decisiones.

### Parte 2 - Base de datos

- Crear tablas `ventas`, `ventas_detalle`, `ventas_descuentos`.
- Crear RPC `registrar_venta(...)`.
- Agregar SQL versionado.

SQL aplicado:

- `docs/sql/ventas-automaticas-v0.4.0.sql`

### Parte 3 - Service y tests

- Crear `ventasService.js`.
- Testear payloads, faltantes y errores.
- Agregar mocks.

### Parte 4 - UI minima

- Crear acceso a `Cargar ventas`.
- Permitir agregar productos y cantidades.
- Guardar por RPC.

### Parte 5 - Supervisor

- Mostrar ventas y faltantes del dia.
- Mostrar auditoria basica.

### Parte 6 - Seguridad y cierre

- RLS y permisos finales.
- Smoke tests.
- Checklist manual.

## Decision actual recomendada

Implementar la primera version como descuento automatico real sobre `inventario`, pero solo mediante RPC transaccional y con auditoria completa.

No implementar descuento desde frontend.
