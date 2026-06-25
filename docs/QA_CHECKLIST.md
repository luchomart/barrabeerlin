# Checklist de QA - Stock Barra

Usar esta lista corta antes de publicar cambios a produccion.

## Stock

1. Abrir `index.html`.
2. Verificar que carguen empleado, sector y buscador.
3. Seleccionar empleado + sector y confirmar que aparezcan productos.
4. Cambiar cantidades y verificar que se marquen cambios pendientes.
5. Cambiar de sector con cambios sin guardar y confirmar que aparezca la confirmacion.
6. Guardar un conteo y verificar que no falle el flujo.
7. Probar `Copiar` y `WhatsApp`.

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
