# Instalar Our Cozy Room con tu agente de IA

Esta guía permite que Codex u otro agente trabaje sobre una copia del proyecto y deje una casa privada en las cuentas de quien la instala. Una persona prepara la instalación; después ambas acceden a su propia URL y crean sus cuentas.

La aplicación ya existe. **El agente configura y despliega este código**, acompaña las altas necesarias y comprueba el resultado. No necesita escribir otra aplicación ni acceder a la casa del autor.

## 1. Empieza aquí

1. Abre [el repositorio](https://github.com/oscarfr96/our-cozy-room).
2. Para conservar cambios en GitHub, crea un **Fork** en tu cuenta y clónalo. También puedes elegir **Code → Download ZIP**, descomprimirlo y abrir esa carpeta; Git no es necesario para ejecutar la demo.
3. Abre la carpeta en tu herramienta de IA con acceso al proyecto y a una terminal.
4. Pega este mensaje:

> Lee AGENTS.md y docs/AI_SETUP.md. Quiero instalar y publicar mi propia casa de Our Cozy Room en mis cuentas de Cloudflare y Firebase, priorizando los planes gratuitos. Revisa qué está preparado, ejecuta lo que puedas y acompáñame paso a paso cuando tenga que iniciar sesión, crear una cuenta o configurar un panel. No me pidas contraseñas ni claves por chat. Guarda la configuración solo en archivos ignorados o secretos del proveedor. Comprueba el acceso de dos personas antes de dar la instalación por terminada.

Para explorar el diseño, pide «Arranca la demo local, sin configurar servicios». La demo tiene un único participante; una casa compartida requiere las fases restantes.

## 2. Quién hace cada cosa

| El agente puede preparar | La persona titular completa |
| --- | --- |
| Revisar código, instalar dependencias, ejecutar pruebas y arrancar demo | Acceso a sus propias cuentas de Google/Firebase y Cloudflare |
| Preparar archivos sin sobrescribir la configuración existente | Condiciones de alta, confirmación de correo, MFA y CAPTCHA si aparecen |
| Explicar el panel y comprobar coherencia de configuración | Elección de proyecto y autorización OAuth de Wrangler |
| Compilar y desplegar con acceso autorizado | Contraseñas del juego, introducidas directamente en la web |
| Acompañar o automatizar subida segura de secretos | Confirmar recepción de verificación y recuperación de correo |
| Revisar HTTP, pruebas y estado persistido | Ensayo con dos sesiones o dispositivos independientes |

Si existe una integración admitida del proveedor, el agente puede usarla dentro del alcance autorizado. En caso contrario debe entregar acciones concretas del panel y continuar con lo independiente. No debe fingir haber creado cuentas, verificado correo o probado dispositivos.

## 3. Inventario inicial — para el agente

1. Lee `AGENTS.md`, `README.md`, `docs/SETUP.md`, `SECURITY.md` y `docs/ARCHITECTURE.md`.
2. Comprueba la raíz: `package.json`, `shared/`, `worker/` y `wrangler.jsonc`.
3. Comprueba herramientas:

```sh
node --version
npm --version
```

Se requiere Node.js 22.12 o posterior; CI usa Node.js 24. Si falta, acompaña la instalación desde [Node.js oficial](https://nodejs.org/). En PowerShell utiliza `npm.cmd`/`npx.cmd` si la política bloquea los lanzadores `.ps1`; no rebajes la política global del equipo.

Para clonar, publicar cambios o revisar historial necesitas [Git](https://git-scm.com/). Una descarga ZIP sin Git permite ejecutar el producto y revisar sus archivos; no permite comprobar commits que no están incluidos. La prueba específica de historial se omite si Git no está instalado; no la presentes como superada.

4. Si hay Git, revisa `git status --short` y el destino de `origin`. No imprimas URLs que contengan tokens. No cambies el remoto para una instalación normal; un fork debe apuntar al repositorio de esa persona.
5. Comprueba la existencia de `.env.local` y `.dev.vars`. No vuelques sus valores en terminal o chat.
6. Si existen despliegue o datos de una pareja, trata la tarea como mantenimiento. No apliques el primer despliegue sobre un Worker ajeno ni recrees cuentas o namespaces.
7. Guarda continuidad en `.local/setup-status.md`: fase, pendiente/preparado/verificado, siguiente acción y comprobaciones. Sin correos, tokens, contraseñas o contenido de la casa.

## 4. Preparar el código y la demo

```sh
npm ci
npm run check:public -- --history
npm test
npm run test:integration
```

La revisión pública examina archivos distribuibles y objetos de los commits accesibles. En ZIP revisa los archivos sin historial. Los tests utilizan identidades de prueba y workerd local; no necesitan Firebase real. La integración también compila y comprueba TypeScript.

Para visitar el diseño:

```sh
npm run dev
```

Abre la URL que imprime Vite con `?demo=1`. Esta ruta usa estado local separado incluso con Firebase configurado. No demuestra conexión entre personas.

Resuelve fallos de pruebas antes de publicar. No cambies dependencias o arquitectura para ocultar errores de configuración.

## 5. Crear los archivos locales sin sobrescribir

El agente prepara las copias antes de pedir que se completen los paneles.

PowerShell:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (-not (Test-Path .dev.vars)) { Copy-Item .dev.vars.example .dev.vars }
```

macOS / Linux:

```sh
test -f .env.local || cp .env.example .env.local
test -f .dev.vars || cp .dev.vars.example .dev.vars
```

`.env.local`: las tres opciones web públicas de Firebase:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

`.dev.vars`: configuración del backend local:

```dotenv
FIREBASE_PROJECT_ID=your-firebase-project-id
ALLOWED_EMAILS=person-a@example.com,person-b@example.com
```

Las opciones `VITE_*` se incorporan al JavaScript compilado. La apiKey web Firebase es pública por diseño y no una clave administrativa; la autorización de la casa depende del backend. Aun así, estos archivos no se versionan para separar instalaciones. **Nunca pongas secretos en `VITE_*` ni crees `VITE_ALLOWED_EMAILS`.** [Explicación oficial de Firebase](https://firebase.google.com/docs/projects/api-keys).

## 6. Crear Firebase — pasos para la persona

No reutilices cuentas ni identificadores de otra pareja. Si ya tienes un proyecto dedicado a esta casa, revísalo en lugar de crear otro.

1. Entra en [Firebase Console](https://console.firebase.google.com/) con tu cuenta Google.
2. Pulsa **Crear un proyecto / Add project** y elige un nombre reconocible. Conserva el ID asignado por Firebase.
3. Puedes desactivar Analytics: no lo utiliza la aplicación.
4. Mantén el plan **Spark**, sin activar Blaze ni vincular facturación.
5. Entra en **Build / Compilación → Authentication → Get started / Comenzar**.
6. Abre **Sign-in method / Método de acceso → Email/Password / Correo y contraseña**, activa ese método y guarda. No necesitas acceso por enlace sin contraseña.
7. En **Authentication → Settings / Configuración**, revisa la política de contraseñas. La interfaz exige 12 caracteres al registrarse; configura el proveedor para reforzarlo si está disponible.
8. En **Authorized domains / Dominios autorizados**, comprueba `localhost` y `127.0.0.1` para pruebas locales; añádelos si faltan.
9. Abre el engranaje **Project settings / Configuración del proyecto → General → Your apps / Tus aplicaciones**.
10. Pulsa **`</>`**, registra una aplicación web y deja Firebase Hosting desactivado: la web la sirve Cloudflare.
11. Localiza `firebaseConfig`. Necesitamos únicamente `apiKey`, `authDomain` y `projectId`.
12. Abre `.env.local` y copia los tres valores en sus variables. Guarda sin pegarlos en la conversación.
13. En **Authentication → Templates / Plantillas**, revisa verificación y restablecimiento de contraseña. La entrega se prueba al crear las cuentas.
14. Confirma al agente **«Firebase preparado y .env.local guardado»**, o indica el error sin credenciales.

El agente no necesita Admin SDK, cuenta de servicio, clave privada, Firestore, Realtime Database ni Firebase Hosting. El Worker verifica los tokens con las claves públicas del proveedor.

## 7. Autorizar los dos correos y validar configuración

1. En `.dev.vars`, la persona pone el mismo `projectId` en `FIREBASE_PROJECT_ID`.
2. Completa `ALLOWED_EMAILS` con exactamente dos direcciones reales distintas, separadas por coma. Serán las que utilizaréis en el juego. No uses los ejemplos para una casa real.
3. Guarda el archivo y confirma **«Correos autorizados guardados»**. No hace falta copiarlos al chat.
4. El agente ejecuta:

```sh
npm run setup:check
```

Comprueba formato, coincidencia de proyecto, dos correos distintos y variables no previstas sin mostrar valores. No se conecta al proveedor ni demuestra que la apiKey esté activa o los correos verificados.

## 8. Preparar Cloudflare — pasos para la persona

1. Abre [Cloudflare Dashboard](https://dash.cloudflare.com/) y crea una cuenta o entra en la que alojará vuestra casa.
2. Completa personalmente verificación de correo y condiciones de alta. No necesitas comprar ni transferir un dominio.
3. Localiza **Workers & Pages** y mantén **Workers Free**, sin activar facturación.
4. El agente ejecuta desde el proyecto:

```sh
npx wrangler login
```

5. El navegador abre la autorización oficial. Comprueba la cuenta y autoriza Wrangler personalmente. No pegues el token en el chat.
6. El agente comprueba `npx wrangler whoami` sin copiar identificadores al informe. Con varias cuentas, acordad el destino antes de publicar.
7. Confirma **«Cloudflare preparado y cuenta de destino confirmada»**.

Wrangler crea el Worker, publica los archivos estáticos y aplica el binding/migración del namespace SQLite de Durable Objects. No necesitas crear tablas, una base D1 ni un servidor dedicado. El estado local de `.wrangler/` no se copia a la nube.

## 9. Ensayo local de cuentas reales

Si ambas personas están disponibles, hacedlo antes de publicar; si no, registra lo pendiente y termina la preparación técnica.

```sh
npm run build
npm run worker:dev -- --local --ip 127.0.0.1 --port 8787
```

1. Abre `http://127.0.0.1:8787/` en el ordenador donde corre Wrangler.
2. Selecciona **Crear mi cuenta** con el primer correo autorizado. Introduce la contraseña, de al menos 12 caracteres, directamente en la web.
3. Abre el correo de verificación, confirma el enlace, vuelve y pulsa **Ya he confirmado mi correo**.
4. Repite con el segundo correo desde otro navegador o una ventana privada. Dos pestañas normales comparten sesión y no representan a dos personas.
5. Comprueba presencia mutua, mensajes y foco independiente.

Las cuentas Firebase son reales; el estado de habitación de este ensayo es local. Las mismas cuentas sirven al desplegar, donde la habitación empieza separada. `127.0.0.1` no permite entrar desde otro ordenador.

No borres cuentas para repetir un ensayo: al recrearlas cambia el UID y pueden quedar plazas ocupadas. No borres el estado de la casa para resolverlo; consulta `SECURITY.md`.

## 10. Publicar vuestra casa

«Instalar y publicar mi casa» autoriza el despliegue en el destino acordado; una petición de demo local no lo implica. Aclara el destino si puede sobreescribirse un Worker existente.

1. Revisa `wrangler.jsonc`. Puedes cambiar `name` para vuestra instalación; comprueba que no sobreescribe otra. Conserva `ROOM`, `CozyRoom`, `new_sqlite_classes`, la migración `v1` y la clave interna de la casa.
2. Ejecuta `npm run setup:check` y `npm run check:public -- --history`.
3. Si las pruebas anteriores siguen siendo válidas y el código no ha cambiado, no hace falta repetirlas. Publica:

```sh
npm run deploy
```

4. Guarda la URL `https://…workers.dev` que imprime Wrangler. Hasta configurar los secretos, el acceso a la sala permanece cerrado.
5. Añade los dos secretos con prompts oficiales:

```sh
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put ALLOWED_EMAILS
```

La persona introduce cada valor directamente en su prompt, sin pegarlo en chat ni en la línea del comando. Usa los mismos datos de `.dev.vars`. Si el agente no admite prompts, guíala por **Workers & Pages → vuestro Worker → Settings → Variables and Secrets → Add → Secret**, crea ambas variables y aplica el cambio. No guardes correos en `wrangler.jsonc`.

**Desplegar el código no transfiere `.dev.vars`.** Los archivos locales y los secretos remotos son configuraciones distintas.

6. En Firebase abre **Authentication → Settings → Authorized domains → Add domain**. Introduce solo el hostname público de Wrangler, sin `https://`, rutas ni `?demo=1`.
7. Guarda y confirma **«Dominio autorizado»**.
8. Cambiar el proyecto web requiere reconstruir y desplegar. Cambiar correos locales requiere actualizar también el secreto remoto; no sustituye miembros persistidos.

## 11. Criterios de aceptación

El agente puede comprobar HTTP con herramientas de red. Usa siempre la URL de esta instalación.

| Comprobación | Resultado esperado |
| --- | --- |
| Portada, JS y CSS | HTTPS 200 y aplicación visible |
| `GET /api/health` | `status: "ok"`, `configured: true`: presencia de configuración, no prueba de login |
| `POST /api/connect` sin token y con Origin propio | 403, sin datos privados |
| Conexión con un Origin ajeno | 403 |
| `/api/room?ticket=invalid`, Upgrade WebSocket y origen propio | 403 |
| Cabeceras estáticas | CSP, `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff` |

Ensayo humano con ambas cuentas en sesiones independientes:

1. Crear o acceder con cada correo autorizado, verificarlo y ver **EN CASA**. No hace falta registrarse de nuevo si ya se probó localmente.
2. Ver a la otra persona, caminar y sentarse en las dos plazas del sofá.
3. Iniciar «Trabajo» durante 25 minutos y comprobar título, duración y tiempo restante en «Al otro lado» del otro navegador. Pausar y reanudar.
4. Interactuar con clic o tecla en la receptora para permitir audio, dejarla en otra pestaña y mandar un mensaje desde la otra cuenta. Comprobar sonido y título. Probar llegada, silencio explícito y preferencia tras recargar.
5. Recargar y recuperar personaje, tarea y últimos mensajes. Cerrar y reentrar.
6. Probar recuperación de contraseña y entrega del correo con su titular; la nueva contraseña se introduce solo en la web del proveedor.
7. Cerrar ambas ventanas, esperar un periodo de inactividad y entrar desde otro equipo sin abrir el dashboard ni arrancar nada en el ordenador administrador.
8. Revisar cuotas y errores en Cloudflare tras una sesión de al menos una hora.

Marca cada punto comprobado, fallido o pendiente. Si falta la segunda persona, entrega la URL y lo completado con esa aceptación pendiente. No prometas operación ilimitada por una primera prueba correcta.

## 12. Entrega y continuidad

Entrega a la persona un resumen sin credenciales:

- URL de su casa y cómo entrar.
- Fases verificadas y pasos manuales pendientes.
- Dónde se guardan los archivos locales y cómo quedan protegidos, sin copiar valores.
- Comandos de mantenimiento: `npm run setup:check`, `npm run check:public -- --history`, `npm run deploy`.
- Cuentas: Firebase → Authentication → Users.
- Métricas, versiones y secretos: Cloudflare → Workers & Pages → vuestro Worker.
- Límites conocidos de `SECURITY.md`: dos UIDs, revocación no inmediata, exportación/restauración administrativa pendiente, cuotas y comportamiento de redes/correo.

Actualiza `.local/setup-status.md` para futuras sesiones. No lo publiques ni lo adjuntes a incidencias.

## 13. Publicar un fork sin datos de vuestra casa

Una casa funciona sin publicar un fork. Si mantienes código en GitHub:

1. Comprueba que `origin` apunta a tu repositorio, no al del autor.
2. Ejecuta `npm run check:public -- --history`. Revisa también imágenes y nombres autorizados: el análisis de texto no interpreta capturas.
3. Revisa los archivos preparados para el commit. Solo `.env.example` y `.dev.vars.example` deben ser públicos como plantillas.
4. No uses `git add -f` para forzar configuración ignorada. Excluye `dist`, `.wrangler`, notas y exportaciones.
5. Si se publicó un secreto, revócalo o rótalo y revisa el historial. Eliminarlo en el último commit no lo retira de los anteriores. No reescribas un historial compartido sin coordinarlo.

La revisión comprueba rutas privadas, patrones de claves/tokens, valores de la configuración local y enlaces Markdown ausentes del conjunto público. No sustituye un detector especializado ni la inspección de imágenes: un valor no reconocido puede pasar inadvertido. CI vuelve a ejecutarla y prueba el proyecto sin secretos de una casa.

## 14. Diagnóstico sin borrar datos

| Problema | Próxima acción |
| --- | --- |
| PowerShell bloquea npm | Usar `npm.cmd`/`npx.cmd`; no cambiar la política global |
| Firebase no carga tras guardar `.env.local` | Revisar tres variables; reiniciar Vite o reconstruir |
| Salud `configured: false` | Revisar los dos secretos remotos; el archivo local no los sustituye |
| Dominio no autorizado | Añadir el hostname exacto de vuestra URL en Authentication |
| Segundo correo rechazado | Revisar verificación, lista, proyecto y plazas UID existentes |
| Cambiar `.dev.vars` no afecta | Reiniciar Wrangler local; actualizar secreto en producción |
| Mi pareja ve mi misma cuenta | Usar perfiles o navegadores distintos |
| La segunda pestaña desconecta la primera | Cada UID tiene una conexión activa; continuar desde la elegida |
| No llega el correo | Revisar spam, plantillas, dirección y cuotas; no fingir verificación |
| No suena el audio al abrir sin tocar la web | Interactuar en la receptora; revisar silencio, volumen y autoplay |
| Un panel pide un plan de pago | Detener esa acción, revisar producto y documentación; no activar facturación automáticamente |

## Fuentes oficiales

Recetas contrastadas el 4 de noviembre de 2026. Revisa las fuentes si cambian el panel o las cuotas.

- [Aplicación web Firebase](https://firebase.google.com/docs/web/setup).
- [Authentication con correo/contraseña](https://firebase.google.com/docs/auth/web/password-auth).
- [Gestión de usuarios y correo](https://firebase.google.com/docs/auth/web/manage-users).
- [Configuración web y apiKeys](https://firebase.google.com/docs/projects/api-keys).
- [Comandos de Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/).
- [Secretos del Worker](https://developers.cloudflare.com/workers/configuration/secrets/).
- [Durable Objects SQLite y cuotas](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Las fuentes describen los proveedores. La arquitectura, los comandos de npm y la aceptación se basan en el código de este repositorio.
