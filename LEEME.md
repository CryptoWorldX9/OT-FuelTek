# FuelTek · Versión profesional para revisión

Preparada el 5 de octubre de 2026. Esta entrega contiene el código mejorado. **Todavía no está publicada ni validada contra escrituras en Firebase real.**

## Qué incluye

- Inicio de sesión con Google para las dos cuentas autorizadas; acceso a la nube protegido mediante reglas separadas.
- Panel de órdenes activas, equipos listos, entregas atrasadas y saldo pendiente.
- Búsqueda por OT, cliente, marca, modelo, serie y técnico; filtros por reparación y pago.
- Seguimiento: recibida, diagnóstico, aprobación, repuestos, reparación, lista y entregada.
- Técnico responsable, prioridad y tipo de equipo.
- Interfaz adaptable a escritorio y móvil; guardar siempre visible en móvil.
- Borrador recuperable en el mismo navegador; aviso antes de reemplazarlo.
- Validación de cliente, marca, correo, fechas y abonos.
- JSON y Excel desde la combinación de órdenes locales y nube. Aviso si solo está disponible la copia local.
- Importación que omite números existentes y añade únicamente registros locales. No reemplaza ni sube automáticamente registros a Firebase.
- Creación de OT y avance del correlativo en una sola transacción de Firebase. Si el número ya existe, se detiene sin reemplazarlo.
- Detección de cambios de otra sesión antes de actualizar una orden, mediante fechaGuardado.
- Las órdenes que existían solo en este navegador pueden sincronizarse al guardar manualmente, conservando su número y avanzando el correlativo si corresponde.
- Campos adicionales de registros existentes conservados al editar; actualización remota con merge.
- Borrado total y borrado individual retirados de la interfaz y del código de acceso a datos.
- Texto ingresado por usuarios escapado en historial e impresión.
- Manifest, iconos y service worker con rutas relativas para /OT-FuelTek/.

## Revisar sin tocar la base real

Sirve esta carpeta con un servidor local y abre `/?demo`. Ese modo usa información ficticia, desconecta Firebase y desactiva guardado, importación y exportación de datos. Los borradores de demostración usan una clave separada.

La navegación sin `?demo` conserva la conexión al proyecto Firebase existente. No uses el guardado en ese modo antes de revisar los permisos y el respaldo.

## Protección y almacenamiento

Se mantienen `fueltek_db_v7`, versión 1, almacén `orders`, clave `fueltek_last_ot_v7`, colección Firestore `orders` y documento `config/lastOt`. No hay migración destructiva ni cambio de proyecto.

Los registros guardados únicamente en un navegador permanecen en ese origen, perfil y dispositivo. Mantén la misma URL al publicar para seguir accediendo a ellos. Un dominio nuevo no recibe automáticamente estos datos.

El service worker guarda los archivos de la aplicación; los datos permanecen en IndexedDB y Firebase. Sin conexión puedes conservar un borrador y consultar las órdenes locales. **Guardar una OT requiere conexión a Firebase** para evitar colisiones de números. La PWA es una aplicación web instalable; no es un binario nativo para tiendas.

Excel depende de la descarga de SheetJS desde su CDN. Si no está disponible, el respaldo JSON sigue siendo la alternativa. Firebase y los iconos utilizan bibliotecas incluidas en `vendor/`; las fuentes tienen alternativas del sistema.

## Antes de publicar

1. Desde cada equipo que tenga órdenes locales, exporta su JSON actual. Ese respaldo original puede incluir solamente los registros del dispositivo.
2. Con acceso administrador, realiza un respaldo independiente de Firestore y registra el correlativo actual. Conserva también el código anterior.
3. Revisa las reglas de Firestore, los usuarios autorizados y los permisos sobre `orders` y `config/lastOt`. Las reglas vigentes revisadas en la consola el 5 de octubre permitían acceso sin autenticación hasta el 14 de diciembre de 2030. Las nuevas reglas de firestore.rules todavía requieren publicación coordinada con la versión que incluye acceso con Google.
4. Valida las transacciones nuevas en un proyecto de pruebas o emulador, con las reglas que se usarán en producción. Se validaron las reglas y las funciones de transacción contra el emulador oficial de Firestore, con un proyecto demo aislado, sin escrituras en producción.
5. Publica mediante una rama y revisión, manteniendo /OT-FuelTek/. No subas archivos con registros o respaldos privados al repositorio público.
6. Comprueba la instalación PWA en Chrome/Android y Safari/iPhone, impresión/PDF y exportación Excel. La posibilidad de instalar depende del navegador.
7. Actualiza todos los equipos: las versiones antiguas siguen usando su lógica anterior de guardado y no quedan protegidas por estas nuevas transacciones.

## Límites pendientes

Esta versión es una base operativa para revisión; aún no es un producto comercial completo. El acceso con Google está preparado para dos cuentas con los mismos permisos de operación. Faltan roles diferenciados, aislamiento entre talleres, presupuestos desglosados, movimientos de inventario, fotos, autorización del cliente, historial de cambios y respaldo automatizado independiente. Las firmas actuales son campos de texto: no representan una solución de firma electrónica.

Los indicadores representan lo registrado: saldo por cobrar no equivale a utilidad. Las órdenes antiguas sin estado se muestran como recibidas hasta que se revisen y actualicen; no se cambia su estado en la base automáticamente.

## Validación realizada

Sintaxis de JavaScript; escenarios simulados de saldo, mezcla de fuentes, escape HTML, creación concurrente, colisiones, edición concurrente y abortos de IndexedDB. Revisión visual a 1440 y 390 píxeles, búsqueda, filtro, apertura de OT y recuperación de borrador en el navegador.

No se realizaron escrituras, eliminaciones ni migraciones en la base real. Se revisaron las reglas existentes en Firebase y se comprobaron las reglas nuevas en el emulador oficial. No se confirmó instalación real de la PWA, ingreso con Google en el sitio publicado, sincronización entre dispositivos reales ni impresión física.


## Pruebas de seguridad y publicación coordinada

Instala las dependencias de desarrollo del package.json (solo herramientas de prueba). `npm test` valida lógica y barrera de acceso; `npm run test:rules` requiere Java 21 y ejecuta el emulador oficial contra demo-fueltek-tests. El archivo de pruebas se niega a ejecutarse sin FIRESTORE_EMULATOR_HOST.

La prueba verifica acceso de ambas cuentas, denegación a usuarios anónimos, externos y no verificados, borrado bloqueado, creación concurrente, correlativo atómico, rechazo de conflictos, conservación de campos antiguos y sincronización manual de órdenes locales sin cambiar su número.

Habilita Google en Authentication y autoriza cryptoworldx9.github.io. Publica primero la aplicación con el ingreso y confirma una sesión válida; después publica firestore.rules. Las reglas nuevas bloquean clientes antiguos sin sesión. No cambies la URL ni borres el almacenamiento del navegador. Las copias locales permanecen en el dispositivo después de cerrar sesión; el cierre no es una limpieza de datos del equipo.
