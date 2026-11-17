# Checklist de QA - Stock Barra

Usar esta lista corta antes de publicar cambios a produccion.

## Validacion automatizada

1. Ejecutar `npm test`.
2. Ejecutar `npm run test:smoke` (en Linux: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:smoke`).
3. Si hay un timeout aislado del navegador, repetir con `npm run test:smoke:stable`.
4. Confirmar que los smoke tests no tocaron Supabase real ni stock productivo.

## Stock

1. Abrir `index.html`.
2. Verificar que carguen empleado, sector y buscador.
3. Seleccionar empleado + sector y confirmar que aparezcan productos.
4. Cambiar cantidades y verificar que se marquen cambios pendientes.
5. Cambiar de sector con cambios sin guardar y confirmar que aparezca la confirmacion.
6. Guardar un conteo y verificar que no falle el flujo.
7. Probar `Copiar` y `WhatsApp`.
8. Elegir primero el sector y despues el empleado: tienen que aparecer los productos.

## Sin internet (en el celular)

1. Elegir empleado + sector, cambiar una cantidad y recargar la pagina: se recupera lo tipeado
   (aviso azul "Se recupero el conteo sin guardar").
2. Activar modo avion, tocar `Guardar`: aviso "quedo guardado en este celular" y aviso amarillo de pendiente.
3. Desactivar modo avion con la pagina abierta: en segundos aparece "Se envio el conteo pendiente" y
   el supervisor ve el conteo con la hora original.

## Barriles

1. Entrar al sector `Camara`.
2. Confirmar que aparezca `Barriles (sin pinchar)`.
3. Verificar que esten:
   `IPA`, `Session IPA`, `Mexican Lager`, `Amber`, `Stout`, `Honey`, `Barley Wine`, `Red Ipa`.
4. Cambiar a otro sector y confirmar que no aparezcan barriles.

## Supervisor

1. Abrir `supervisor.html`.
2. Verificar que sin sesion activa aparezca el login y el panel quede bloqueado.
3. Iniciar sesion con la cuenta de supervisor y confirmar que carguen:
   estado de sectores, ultimos conteos y cambios de stock.
4. Probar `Actualizar`, `Enviar stock`, `Cerrar sesion` y `Volver`.
5. Revisar estados vacios y de error sin layout roto.

## Administracion (supervisor)

1. Con sesion de supervisor, tocar `Admin` y confirmar que cargan empleados, categorias y productos.
2. Agregar un empleado de prueba y verificar que aparece en el desplegable de `index.html`.
3. Intentar agregar un nombre repetido (con otras mayusculas o acentos) y confirmar el error.
4. Confirmar que el boton de borrar de una categoria con productos esta deshabilitado.
5. Agregar una categoria y un producto de prueba; verificar que el producto aparece al contar en un sector.
6. Borrar el producto de prueba: la confirmacion muestra su stock. Luego borrar la categoria y el empleado de prueba.
7. Cerrar sesion y confirmar que el panel y el boton `Admin` desaparecen.

## Snapshots y cambios globales

1. Generar un snapshot con `WhatsApp`.
2. Cambiar stock.
3. Generar un segundo snapshot.
4. Repetir `WhatsApp` una vez mas sin cambiar stock y confirmar que no deberia generar una nueva comparacion relevante.
5. Abrir supervisor y confirmar:
   `Salida total`, `Entrada total`, bloques de `SALIDAS`, `ENTRADAS` y `SIN CAMBIOS`.

## Revision visual

1. Revisar mobile-first en `index.html`.
2. Revisar mobile-first en `supervisor.html`.
3. Confirmar que no haya textos rotos o con codificacion incorrecta.
