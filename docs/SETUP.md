# Configurar vuestra casa — Cloudflare + Firebase Auth

Esta guía instala una casa privada para dos personas. Solo una persona configura los servicios y administra el despliegue. Después, cada una entra con su cuenta desde cualquier equipo.

## Antes de empezar

Necesitas Node.js 22.12 o posterior, npm, acceso a tu correo y cuentas de Firebase y Cloudflare. Parte de un clon o una descarga de este repositorio y ejecuta los comandos desde su carpeta.

1. Ejecuta `npm ci`.
2. Copia `.env.example` a `.env.local` y `.dev.vars.example` a `.dev.vars`.
3. Completa los apartados siguientes antes de rellenar los valores.

En PowerShell puedes crear las copias con estos comandos.

```powershell
Copy-Item .env.example .env.local
Copy-Item .dev.vars.example .dev.vars
```

En macOS y Linux utiliza `cp` en lugar de `Copy-Item`. Si los archivos de destino ya existen, revísalos y conserva los valores que necesites.

El despliegue utiliza Firebase Authentication y Cloudflare Static Assets, Workers y Durable Objects SQLite. El objetivo son los planes gratuitos, sujetos a cuotas. Revisa las [limitaciones conocidas](../SECURITY.md) y las condiciones de los proveedores.
## 1. Crear Firebase y habilitar cuentas con contraseña

1. Abre [Firebase Console](https://console.firebase.google.com/) e inicia sesión con tu cuenta de Google.
2. Selecciona **Crear un proyecto / Add project** y usa un nombre como `Our Cozy Room`. El ID concreto debe ser único; conserva el que te asigne el panel.
3. Google Analytics no es necesario para esta aplicación. Puedes desactivarlo durante la creación.
4. Completa la creación manteniendo el plan **Spark**, sin vincular facturación. Si el panel solicita activar Blaze para algún producto, no lo necesitamos en esta arquitectura.
5. Dentro del proyecto, abre **Compilación / Build → Authentication → Comenzar / Get started**.
6. En **Método de acceso / Sign-in method**, selecciona **Correo electrónico/contraseña / Email/Password**, habilita ese método y guarda. No hace falta activar enlaces de acceso sin contraseña ni proveedores sociales.
7. En la configuración de Authentication, revisa la política de contraseñas y exige al menos **12 caracteres** si la opción está disponible para el proyecto. La interfaz ya exige 12 al registrarse; la política del proveedor debe reforzarlo para llamadas directas a su API.
8. En **Configuración → Dominios autorizados / Authorized domains**, añade `localhost` y `127.0.0.1` para probar localmente, si no están presentes. Añadiremos el dominio público al desplegar.
9. Abre el engranaje de **Configuración del proyecto / Project settings → General**.
10. En **Tus aplicaciones / Your apps**, pulsa el icono web **`</>`**, registra `Our Cozy Room Web` y deja sin marcar la configuración de Firebase Hosting: usaremos Cloudflare para servir la web.
11. El panel mostrará `firebaseConfig`. Necesitamos únicamente los valores `apiKey`, `authDomain` y `projectId`.
12. En la raíz de este repositorio crea `.env.local` a partir de `.env.example` y rellena:

```dotenv
VITE_FIREBASE_API_KEY=valor_apiKey_del_panel
VITE_FIREBASE_AUTH_DOMAIN=valor_authDomain_del_panel
VITE_FIREBASE_PROJECT_ID=valor_projectId_del_panel
```

Estas tres opciones identifican la aplicación web y son públicas por diseño; no sustituyen las reglas de acceso. No copies una clave privada, un JSON de cuenta de servicio ni una contraseña. El archivo se ignora en Git para evitar mezclar instalaciones.

13. En **Authentication → Templates / Plantillas**, revisa los correos de verificación y restablecimiento. El primer ensayo comprobará llegada, spam y enlaces. No dar por validado el correo solo porque el panel permita guardarlo.
14. Avisa: **«Firebase está creado, Email/Password activado y `.env.local` guardado»**. Si algo no coincide, indica el nombre del apartado o el mensaje de error, sin credenciales.

Referencia oficial: [gestión de usuarios y correos](https://firebase.google.com/docs/auth/web/manage-users), [verificación de tokens para backend propio](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## 2. Preparar Cloudflare

1. Abre [Cloudflare Dashboard](https://dash.cloudflare.com/) y crea tu cuenta o inicia sesión. Completa personalmente la confirmación de correo y las condiciones de alta.
2. Busca **Workers & Pages** en el menú de desarrollo. No necesitas añadir ni comprar un dominio.
3. Mantén el plan gratuito. No actives Workers Paid por este proyecto sin revisar juntos el motivo y el coste.
4. Desde una terminal en la raíz de este repositorio ejecuta:

```sh
npx wrangler login
```

5. El navegador abrirá el flujo oficial de autorización de Wrangler. Comprueba que corresponde a tu cuenta de Cloudflare y completa tú la autorización. No copies el token resultante al chat.
6. Comprueba la sesión con `npx wrangler whoami`. Basta con confirmar que reconoce la cuenta correcta; no hace falta compartir la salida completa.
7. Avisa: **«Cloudflare está listo y Wrangler reconoce mi cuenta»**.

Referencia: [Wrangler login](https://developers.cloudflare.com/workers/wrangler/commands/#login).

## 3. Autorizar los dos correos

Esta primera versión permite el acceso mediante una lista privada de exactamente dos correos. Cada uno se registra por su cuenta en la web y verifica su correo. Tener una cuenta Firebase, por sí solo, no permite entrar. El flujo de invitación dentro del juego llegará después.

Para la prueba local crea un archivo **`.dev.vars`**, ignorado por Git:

```dotenv
FIREBASE_PROJECT_ID=el_mismo_projectId_de_env_local
ALLOWED_EMAILS=person-a@example.com,person-b@example.com
```

- Sustituye los valores de ejemplo por los correos exactos que usaréis al registraros.
- No hay espacio para un tercer miembro. Se comparan los correos sin distinguir mayúsculas.
- No crees una variable `VITE_ALLOWED_EMAILS`: expondría la lista en el frontend.
- No publiques estos archivos. Comprueba `git status` antes de cada commit.
- Si se borra y vuelve a crear una cuenta Firebase, su UID puede cambiar. La sustitución de miembros aún requiere un procedimiento administrativo; no borrar cuentas para probar sin revisar ese efecto.

**Si cambias los correos durante una prueba.** guarda `.dev.vars`, detén Wrangler con `Ctrl+C` en su terminal y vuelve a ejecutar el comando del apartado 4. Después recarga la ventana de la cuenta rechazada. La autorización la lee el backend desde `.dev.vars`; cambiar `.env.local` no actualiza esa lista. No necesitas registrarte de nuevo. Si la sala ya tenía dos UIDs admitidos, cambiar correos no sustituye esos miembros: consulta antes el procedimiento de reemplazo, todavía pendiente. No borres la base de datos para resolver un rechazo.

## 4. Primera prueba local con identidad real

1. Detén la vista local anterior y reinicia tras guardar `.env.local`.
2. Ejecuta `npm run build`.
3. Ejecuta `npm run worker:dev -- --local --ip 127.0.0.1 --port 8787` en una terminal y abre `http://127.0.0.1:8787/`. Sirve frontend y API desde el mismo origen. Mantén esta terminal abierta durante la prueba. La URL de Vite (`5173`) es una vista de desarrollo distinta; para este ensayo usa `8787`.
4. Usa **Crear mi cuenta** con uno de los dos correos, verifica el mensaje recibido y pulsa **Ya he confirmado mi correo**.
5. Abre otro perfil de navegador o una ventana privada y repite con la segunda cuenta. No compartáis la misma sesión de navegador.
6. Comprueba que ambos aparecéis y que recibís cambios de personaje, mensajes y pomodoro.
7. Prueba un correo ajeno: aunque se registre en Firebase, la sala debe rechazarlo.
8. Si se usa Vite con el proxy, mantener `localhost`/`127.0.0.1` coherente entre URL y configuración. El camino de verificación preferido es la URL única de Wrangler.

**Dos sesiones en el mismo ordenador:** dos pestañas normales del mismo navegador comparten la sesión Firebase; no sirven para representar a dos personas. Usa otro navegador o una ventana privada. La segunda persona introduce personalmente su contraseña. `127.0.0.1` siempre apunta al ordenador donde se abre: para probar desde dos equipos distintos necesitamos el despliegue del apartado 5.

Con las dos cuentas dentro, comprobar manualmente:

1. Cada una aparece conectada en «Al otro lado» de la otra ventana.
2. Cambiar el personaje y caminar; comprobar que el otro cliente recibe los cambios.
3. Enviar un mensaje de prueba desde cada ventana y activar voluntariamente los avisos sonoros en la receptora.
4. Iniciar tareas de distinta duración: cada contador debe ser independiente y verse el estado de la pareja.
5. Recargar una ventana: recupera su personaje, tarea y mensajes recientes.
6. Cerrar una ventana: el otro cliente deja de mostrarla como conectada. Volver a entrar y comprobar recuperación.

Comunicar qué pasos pasan o el texto de los errores, sin pegar credenciales ni conversaciones privadas. La prueba de recuperación de contraseña se hará aparte y su nueva contraseña también la introduce la persona usuaria.

## 5. Desplegar después de la prueba

El primer despliegue abre la instalación privada. Completa las comprobaciones de esta sección para validar el acceso y funcionamiento desde Internet.

1. Revisa `wrangler.jsonc`. Cambia `name` si deseas otro nombre de instalación; no cambies la clase, el binding ni las migraciones de Durable Objects.
2. Ejecuta `npm run build` y `npx wrangler deploy`. Si aún no hay secretos remotos, la API permanecerá cerrada; no permite acceso por defecto.
3. Conserva la URL `https://…workers.dev` que imprime Wrangler.
4. Configura los valores del backend mediante prompts interactivos:

```sh
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put ALLOWED_EMAILS
```

Introduce en cada prompt el mismo proyecto y los dos correos del apartado 3. Usamos el almacén de secretos también para proteger la privacidad de los correos. No los añadas a comandos guardados, capturas o documentación pública.

5. En Firebase Authentication → Settings → Authorized domains, añade únicamente el hostname público, sin `https://` ni rutas.
6. Abre la URL pública y repite la prueba desde dos dispositivos reales. Comprueba correo, login, logout, reconexión y recuperación de contraseña.
7. Cierra ambos clientes, espera a que el servicio pueda hibernar y vuelve a entrar sin abrir Cloudflare Dashboard. Repite después de un despliegue de código.
8. Revisa métricas de peticiones, CPU, duración y almacenamiento. Una prueba local no demuestra que Workers Free sea suficiente en producción.

Los secretos del backend no se incluyen en el build. Las opciones `VITE_*` se incorporan al compilar: si cambias de proyecto Firebase, vuelve a construir y desplegar.

## 6. Verificar y mantener vuestra instalación

Antes de dar el despliegue por comprobado, completa esta lista con datos de prueba.

- [ ] La portada pública carga y `/api/health` responde `status: ok` y `configured: true`.
- [ ] Cada persona puede crear su cuenta, verificar el correo y entrar.
- [ ] Dos sesiones independientes se ven, intercambian mensajes y muestran el foco de la otra.
- [ ] Recargar conserva personaje, tarea y estado de la sala.
- [ ] Se prueban cierre, reentrada, recuperación de contraseña y cortes de red.
- [ ] La casa vuelve a abrir tras dejar cerrados ambos navegadores durante un periodo de inactividad.
- [ ] Se revisan métricas y cuotas tras una sesión de al menos una hora.

Las pruebas automatizadas locales no sustituyen estas comprobaciones del dominio, correo y redes reales.

### Consultar el panel de cada servicio

- **Firebase → Authentication → Users** contiene las cuentas. El registro no concede por sí solo acceso a la casa.
- **Cloudflare → Workers & Pages → tu Worker → Metrics** muestra peticiones, errores y CPU.
- **Deployments** contiene las versiones del código publicado.
- **Settings → Variables and Secrets** contiene el proyecto y la lista de correos del backend.
- **Durable Objects** contiene el recurso de la casa. Los datos de esta versión se guardan mediante `ctx.storage.get/put` sobre almacenamiento SQLite. Data Studio tiene limitaciones para mostrar esa API de clave/valor.

### Actualizar el código

1. Conserva una copia segura de la configuración de tu instalación fuera del repositorio público.
2. Lee los cambios de esquema o de comportamiento antes de actualizar.
3. Ejecuta `npm ci`, `npm test` y `npm run test:integration`.
4. Ejecuta `npm run deploy` y repite las pruebas de entrada, estado persistido y tiempo real.
5. Evita cambiar la clase, el namespace, el nombre de la casa o sus migraciones para resolver un problema de acceso.

La versión actual carece de exportación/restauración y reemplazo administrativo de miembros desde la interfaz. Las limitaciones de revocación y abuso están en [SECURITY.md](../SECURITY.md). Antes de utilizar el proyecto con información importante, evalúa estas limitaciones y las opciones de recuperación del proveedor.

### Problemas habituales

| Síntoma | Qué comprobar |
| --- | --- |
| «La casa todavía no tiene configurado el acceso privado» | Los dos secretos del Worker y el proyecto Firebase. La salud solo comprueba presencia de configuración. |
| Correo verificado pero acceso rechazado | Coincidencia del correo con ALLOWED_EMAILS, proyecto del token y cupo persistente de dos UIDs. |
| Acceso rechazado tras cambiar .dev.vars | Reinicia Wrangler local. En producción actualiza el secreto remoto. |
| Dos pestañas muestran la misma persona | Comparten sesión Firebase. Usa perfiles o navegadores distintos para las dos cuentas. |
| «Abierto en otra pestaña» | La misma cuenta ya abrió otra conexión. Recarga la pestaña donde quieras continuar. |
| 127.0.0.1 no abre desde otro equipo | Es una dirección local. Usa la URL pública workers.dev. |
| El vídeo no suena automáticamente | Activa «Escuchar aquí» y comprueba el volumen del mando. Algunos vídeos no admiten inserción. |
| El segundo correo nuevo no entra tras borrar cuentas | Un UID anterior puede ocupar una plaza. La sustitución administrativa todavía está pendiente. |
