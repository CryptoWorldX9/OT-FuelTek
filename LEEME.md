# FuelTek · Versión profesional

Publicada el 5 de octubre de 2026 en https://cryptoworldx9.github.io/OT-FuelTek/. Google y las reglas protegidas de Firestore están activos. Se verificó la lectura con una cuenta autorizada y el rechazo del acceso anónimo. Las escrituras se validaron en el emulador oficial, sin crear órdenes de prueba en producción.

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
3. Revisa las reglas de Firestore, los usuarios autorizados y los permisos sobre `orders` y `config/lastOt`. Las reglas de firestore.rules fueron publicadas el 5 de octubre de 2026, con Google verificado para las dos cuentas autorizadas y borrado denegado.
4. Valida las transacciones nuevas en un proyecto de pruebas o emulador, con las reglas que se usarán en producción. Se validaron las reglas y las funciones de transacción contra el emulador oficial de Firestore, con un proyecto demo aislado, sin escrituras en producción.
5. Publica mediante una rama y revisión, manteniendo /OT-FuelTek/. No subas archivos con registros o respaldos privados al repositorio público.
6. Comprueba la instalación PWA en Chrome/Android y Safari/iPhone, impresión/PDF y exportación Excel. La posibilidad de instalar depende del navegador.
7. Actualiza todos los equipos: las versiones antiguas siguen usando su lógica anterior de guardado y no quedan protegidas por estas nuevas transacciones.

## Límites pendientes

Esta versión está publicada para el taller; aún no es un producto comercial para múltiples empresas. El acceso con Google está preparado para dos cuentas con los mismos permisos de operación. Faltan roles diferenciados, aislamiento entre talleres, presupuestos desglosados, movimientos de inventario, fotos, autorización del cliente, historial de cambios y respaldo automatizado independiente. Las firmas actuales son campos de texto: no representan una solución de firma electrónica.

Los indicadores representan lo registrado: saldo por cobrar no equivale a utilidad. Las órdenes antiguas sin estado se muestran como recibidas hasta que se revisen y actualicen; no se cambia su estado en la base automáticamente.

## Validación realizada

Sintaxis de JavaScript; escenarios simulados de saldo, mezcla de fuentes, escape HTML, creación concurrente, colisiones, edición concurrente y abortos de IndexedDB. Revisión visual a 1440 y 390 píxeles, búsqueda, filtro, apertura de OT y recuperación de borrador en el navegador.

No se realizaron escrituras de órdenes, eliminaciones ni migraciones en la base real. Se publicaron las reglas probadas en el emulador oficial y se confirmó el ingreso con Google y la lectura de órdenes en el sitio publicado. No se confirmó instalación real de la PWA, sincronización entre dispositivos reales ni impresión física.


## Pruebas de seguridad y publicación coordinada

Instala las dependencias de desarrollo del package.json (solo herramientas de prueba). `npm test` valida lógica y barrera de acceso; `npm run test:rules` requiere Java 21 y ejecuta el emulador oficial contra demo-fueltek-tests. El archivo de pruebas se niega a ejecutarse sin FIRESTORE_EMULATOR_HOST.

La prueba verifica acceso de ambas cuentas, denegación a usuarios anónimos, externos y no verificados, borrado bloqueado, creación concurrente, correlativo atómico, rechazo de conflictos, conservación de campos antiguos y sincronización manual de órdenes locales sin cambiar su número.

Habilita Google en Authentication y autoriza cryptoworldx9.github.io. Publica primero la aplicación con el ingreso y confirma una sesión válida; después publica firestore.rules. Las reglas nuevas bloquean clientes antiguos sin sesión. No cambies la URL ni borres el almacenamiento del navegador. Las copias locales permanecen en el dispositivo después de cerrar sesión; el cierre no es una limpieza de datos del equipo.

## Catálogo, configuración y comprobante del cliente

- 29 familias iniciales: forestal y jardín, agricultura y agua, energía y limpieza y construcción. Cada equipo muestra accesorios y hallazgos propios. Pistón/cilindro rayado son hallazgos de inspección, no una afirmación automática de recepción.
- Configuración permite agregar o editar hasta 60 familias, 40 accesorios y 40 condiciones por familia. Ocultar o renombrar opciones no elimina las selecciones de órdenes anteriores; se muestran como otros elementos registrados cuando corresponde.
- Identidad del taller, contacto, RUT opcional, técnicos, prioridad inicial, plazo sugerido de entrega y mensaje del comprobante se guardan en `config/workshop`, sin tocar `config/lastOt`. Ambos usuarios autorizados pueden administrar esta configuración. El contador de revisión detecta cambios simultáneos para impedir sobrescrituras silenciosas.
- Exportación/importación de configuración independiente del respaldo de órdenes. Importar prepara una propuesta; solo Guardar configuración la aplica. La configuración se carga al iniciar o pulsar Recargar en cada dispositivo. La caché permite consultar la última copia si no se puede leer la nube.
- Los datos corporativos se conservan en `documentoTaller` al guardar cada orden. Las órdenes anteriores se mantienen intactas hasta que el usuario las actualiza; si todavía no tienen esa instantánea, el comprobante usa la configuración vigente.
- El comprobante ofrece vista previa, descarga directa de PDF vectorial A4, texto seleccionable, numeración de páginas y alternativa de impresión. Se conservan saltos y líneas en blanco. Los documentos extensos se paginan. La descarga directa usa las fuentes PDF estándar para texto occidental; ante caracteres fuera de esas fuentes se indica usar Imprimir / Guardar PDF, sin omitirlos silenciosamente.
- Después de guardar, la orden permanece abierta para entregar su comprobante. Nueva orden inicia otra recepción. Los formularios todavía no guardados generan un comprobante identificado como BORRADOR.
- Nuevas órdenes: 30 días corridos sin bodegaje desde el día siguiente al aviso comprobable de disponibilidad y $1.500 finales por día corrido desde el día 31. La condición se entrega antes de contratar y requiere aceptación expresa separada en una página legible del PDF. La firma general o el silencio no equivalen a aceptación. Conservar acuerdo y aviso, detallar días y período al cobrar; sin aceptación no se cobra. No se suman cargos automáticamente.
- Las órdenes anteriores mantienen sus condiciones de retiro de 60 días; no reciben la nueva cláusula al editarlas o reimprimirlas. `documentoTaller.storagePolicyVersion` identifica la política de nuevas órdenes y se conserva al editar. No se migran documentos existentes ni se modifica su saldo.
- El plazo de abandono del artículo 42 permanece en un año desde el documento de recepción otorgado y suscrito. No hay exención de custodia ni autorización de venta o eliminación. No se cobra durante la reparación, antes del aviso ni por impedimentos del taller. El comprobante no reemplaza una boleta o factura.
- Base normativa: artículos 16 b), e) y g), 17, 30 y 42 de la Ley 19.496 (texto refundido: https://www.bcn.cl/leychile/navegar?idNorma=1160403). No existe aprobación legal específica de la tarifa; deben considerarse proporcionalidad, costos reales y circunstancias del caso.

Se verificaron en el emulador los permisos y conflictos de configuración, sin cambiar órdenes. El PDF de ejemplo se generó con la misma función de la aplicación y se revisó visualmente; la prueba extensa verifica texto y márgenes en cinco páginas. `npm test` incluye catálogo, comprobante y generación PDF. No se suben respaldos privados ni PDFs de clientes al repositorio.
