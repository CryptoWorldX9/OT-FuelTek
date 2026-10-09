# Telegram → OT FuelTek → PDF

Estado: desplegada y activa en el VPS FuelTek. Mantiene la base existente `ot-fueltek`.
Usa Firestore `orders`, `config/lastOt`, `config/workshop` y el mismo generador vectorial con logo y timbre del sitio. No cambia reglas de Firestore ni la interfaz web.

## Registro rápido por Telegram

Un mensaje por orden. Copia este ejemplo, reemplaza los datos y envíalo al bot. `/ayuda` muestra la plantilla y `/equipos` enumera el catálogo vigente.

```text
/ot
Nombre: Juan Perez
Telefono: 912345678
Tipo: Motosierra
Marca: STIHL
Modelo: MS 180
Descripcion: No enciende
Correo: juan@ejemplo.cl
```

Solo Nombre, Telefono, Tipo, Marca, Modelo y Descripcion son obligatorios. Correo es opcional: borra esa línea si no fue informado. Tipo debe corresponder al catálogo, por ejemplo Motosierra o Desbrozadora si está activa. El móvil chileno de nueve dígitos se guarda con +56; también se acepta el formato internacional completo.

La fecha recibida es automáticamente el día de recepción en America/Santiago. Serie y accesorios quedan sin informar; presupuesto pendiente, abono 0, técnico Por asignar y entrega por definir. Luego se completan desde el PC. No se inventan datos ni se considera que el equipo llegó sin accesorios. Los nombres anteriores Cliente, Equipo y Falla continúan funcionando. También se aceptan Nombre, Tipo de herramienta, Diagnostico inicial y Descripcion con o sin tildes.

## Campos adicionales opcionales

El formato detallado anterior continúa disponible:

| Parámetro | Campo en la web | Regla |
|---|---|---|
| Cliente | clienteNombre | Nombre completo informado |
| Telefono | clienteTelefono | Formato internacional, por ejemplo +56912345678 |
| Equipo | tipoEquipo | Nombre del catálogo; consultar /equipos |
| Marca | marca | Marca informada |
| Modelo | modelo | Modelo, o «No identificado» explícito |
| Serie | serie | Opcional; vacío si no fue informado |
| Falla | diagnostico | Se identifica como síntoma del cliente; diagnóstico técnico pendiente |
| Accesorios | revisionDetalle.accessories y accesorios | Opcional; separar con `;`, o «Ninguno» |
| Valor | valorTrabajo | Opcional, pendiente por defecto; CLP entero o «pendiente» |
| Abono | montoAbonado | Opcional, 0 por defecto; nunca superior al valor |
| Tecnico | tecnico | Opcional, «Por asignar» por defecto |
| Entrega | fechaEntrega | Opcional, «por definir» por defecto |

Opcionales: `Correo`, `Ano`, `Recepcion` (AAAA-MM-DD), `Prioridad` (Normal/Alta/Urgente), `Hallazgos` (solo verificados, separados por `;`), `Trabajo` (solo realizado o notas explícitas). Se aceptan tildes en nombres de campo.

Automáticos: número OT, recepción de hoy en America/Santiago si no se informa, fecha de guardado, estado Recibida, prioridad configurada, estado de pago y saldo derivados de valor/abono, identidad y nota vigente del taller. No se generan firmas ni se deducen hallazgos. Correo y año pueden quedar vacíos; los datos desconocidos no se inventan.

La primera versión utiliza parámetros deterministas. Gemini existente queda disponible para una siguiente entrada de lenguaje libre, que deberá pasar por esta misma validación y pedir los datos faltantes antes de escribir. Este flujo no llama a Gemini ni envía información de clientes a un modelo.

## Arquitectura y garantías

1. Telegram Trigger de n8n recibe mensajes.
2. HTTP Request llama al servicio privado con autenticación Header Auth (`Authorization: Bearer …`).
3. El servicio acepta únicamente los identificadores numéricos autorizados y chats privados.
4. Valida campos y genera un PDF de prueba antes de escribir.
5. En una transacción crea `orders/{ot}`, avanza `config/lastOt` y registra `telegramRequests/{sha256(botId:updateId)}`. Nunca sobreescribe una orden existente.
6. n8n recibe el PDF y lo envía como documento al mismo chat, o devuelve los errores de validación.

Los reintentos del mismo update_id reutilizan el número y la instantánea original. **Un mensaje nuevo completo representa una orden nueva**, aunque su texto sea idéntico. No reenviar como mensaje nuevo cuando falle el envío del PDF: reintentar la ejecución fallida de n8n. Las ediciones de mensajes se ignoran. Puede repetirse la entrega del PDF si Telegram recibió el documento pero la respuesta se perdió; no se promete entrega exactamente una vez.

Si el servicio falla, el nodo HTTP termina con error: n8n no debe informar éxito. Configurar alerta de ejecuciones fallidas antes de activar. Los registros `telegramRequests` no tienen caducidad automática para conservar la protección frente a reintentos; contienen la instantánea de la orden y deben incluirse en la política de respaldo y retención del taller.

## Despliegue y mantenimiento

Se necesita acceso al servidor que aloja n8n o a su panel (Docker/Portainer/Coolify, según exista). GitHub Pages no ejecuta este servicio Node.

- Crear una identidad de servidor dedicada con acceso IAM a Firestore en el proyecto `ot-fueltek`; usar la identidad del entorno cuando sea posible, o montar su archivo privado en `/run/secrets/firebase-service-account.json`. Admin SDK utiliza IAM; las reglas de clientes no limitan esa identidad. No conceder Owner ni publicar claves.
- Definir las variables de `.env.example`; sustituir TODOS los marcadores. `TELEGRAM_BOT_ID` es el identificador numérico público, no el token. Guardar el token del bot únicamente en la credencial Telegram que ya existe en n8n.
- `OT_API_TOKEN` debe ser un secreto aleatorio; configurarlo también en la credencial Header Auth de n8n. No reutilizar contraseñas. Los secretos se configuran en el servidor/gestor de credenciales, nunca en GitHub.
- Si se ejecuta sin contenedor: `cd automation && npm ci && node --env-file=.env server.cjs`. Por defecto escucha solo 127.0.0.1.
- Docker: desde la raíz, `docker build -f automation/Dockerfile -t fueltek-ot .`. Conectar el contenedor a la red privada de n8n con alias `fueltek-ot`, sin publicar el puerto 8080 a Internet. Pasar las variables y montar credencial en solo lectura; Dockerfile escucha 0.0.0.0 dentro del contenedor. La configuración real de red debe revisarse en el servidor existente.
- Importar `n8n-workflow.json` como flujo nuevo inactivo. Elegir la credencial Telegram existente en los tres nodos Telegram; seleccionar Header Auth en HTTP Request. Ajustar `http://fueltek-ot:8080/telegram` a la dirección privada real.
- El bot solo admite un webhook activo: revisar qué flujo utiliza actualmente esa credencial antes de publicar. Usar un bot de pruebas distinto para la validación inicial.
- Comprobar proyecto, configuración y contador en Firebase, y respaldo vigente. Probar primero contra emulador/proyecto aislado; este paquete no inicializa contadores ni migra registros.
- Publicar solamente después de validar una OT completa, PDF, campos faltantes, remitente no autorizado, reintento y creación concurrente con la web. Una prueba en producción necesita identificarse claramente para no confundirse con un cliente real.

## Pruebas

`npm test` en la raíz valida la web. `cd automation && npm test` comprueba validación, fechas de Chile, pagos, autorización, colisiones, reintentos, fallos de PDF y generación con el motor real de la app. La base simulada verifica la lógica de transacción; no sustituye una prueba de integración con el emulador oficial o Firestore. El flujo importable requiere verificación en la versión instalada de n8n.

## Referencias de código abierto consultadas

- [grammyjs/grammY](https://github.com/grammyjs/grammY): aproximadamente 3.800 estrellas observadas. Referencia para bot y manejo explícito de mensajes; licencia MIT. Se usa el nodo nativo de Telegram de n8n, sin añadir una segunda librería de bot.
- [pdfme/pdfme](https://github.com/pdfme/pdfme): aproximadamente 4.900 estrellas observadas. Referencia para separar datos y generación PDF; licencia MIT. Se conserva el motor PDF de FuelTek para mantener el comprobante actual.
- [activepieces/activepieces](https://github.com/activepieces/activepieces): aproximadamente 24.600 estrellas observadas. Referencia para separación de integraciones y pasos del flujo. Edición comunitaria MIT; funciones enterprise con licencia comercial. No se reemplaza n8n ni se copia código enterprise.

Estrellas variables; consulta realizada el 8 de octubre de 2026. No se copió código de estos repositorios; las ideas se aplican mediante validación separada, orquestación por pasos y reutilización del generador existente.
