# Our Cozy Room — instrucciones para agentes

Este archivo es público y sirve para cualquier clon. Our Cozy Room instala una casa privada por pareja, en las cuentas de sus propietarios.

## Antes de actuar

1. Lee [README](README.md), [configuración](docs/SETUP.md), [seguridad](SECURITY.md) y [arquitectura](docs/ARCHITECTURE.md).
2. Para instalar o desplegar, sigue [la guía paso a paso para agentes](docs/AI_SETUP.md). La aplicación ya existe; no la reconstruyas.
3. Revisa carpeta, archivos reales y estado de Git. Conserva los cambios de la persona. Si existe una guía privada `PLAN_MAESTRO.md`, léela también; es opcional, local y no debe publicarse. Actualiza su continuidad al terminar si la instalación la utiliza.
4. Distingue lo solicitado, lo implementado y lo verificado. La demo es individual; un build no demuestra acceso remoto ni correo.

## Arquitectura vigente

- React, TypeScript y Vite para interfaz; Phaser para la sala.
- Firebase Authentication solo para identidad con correo/contraseña y verificación de correo.
- Cloudflare Static Assets + Worker + Durable Object con SQLite y WebSockets hibernables.
- Una casa por instalación, dos correos autorizados en backend y URL propia `workers.dev`, sin ordenador anfitrión.
- Conserva el binding `ROOM`, la clase `CozyRoom` y la migración `v1` de `wrangler.jsonc`. No borres namespaces, miembros o datos para corregir un rechazo de acceso.
- Prioriza Firebase Spark y Workers Free. No actives facturación, compres dominios ni crees Supabase, Firestore o credenciales administrativas para este flujo.

## Configuración y privacidad

- No pidas contraseñas, tokens ni claves privadas por chat, ni imprimas sus valores. Se introducen en el proveedor o archivos ignorados.
- `.env.local`: solo las tres opciones web públicas `VITE_FIREBASE_*`. Se incorporan al frontend; nunca deben contener secretos.
- `.dev.vars`: `FIREBASE_PROJECT_ID` y `ALLOWED_EMAILS` para Wrangler local. En producción van en secretos de Cloudflare; desplegar no copia este archivo.
- No publiques `.env*`, `.dev.vars*`, estado de Wrangler, notas de instalación, exportaciones de cuentas, fotos o mensajes privados. Solo se distribuyen `.env.example` y `.dev.vars.example` con valores vacíos/ficticios.
- Antes de publicar ejecuta `npm run check:public -- --history` y revisa también las capturas; el análisis de texto no interpreta imágenes.
- Los nombres del material promocional están autorizados para esas imágenes; no sirven para deducir la configuración de quien instala un clon.

## Acompañar a la persona

- Ejecuta el trabajo técnico autorizado. Para paneles y altas, entrega pasos numerados, valores a configurar, comprobación y confirmación mínima.
- La persona completa acceso, condiciones de alta, verificación de correo, MFA y autorización OAuth de sus cuentas. Nunca finjas haber completado estas acciones.
- Si falta algo, solicita la acción concreta y sigue con el trabajo independiente. No pidas una configuración ya disponible localmente.
- «Instalar y publicar mi casa» puede autorizar el despliegue en el destino acordado; una demo local no lo implica. Aclara el destino si es ambiguo o existe un Worker que podría sobreescribirse.
- No envíes cambios al repositorio del autor cuando te pidan instalar un fork personal.
- Guarda continuidad en `.local/setup-status.md` sin valores sensibles y fuera de Git. Las instrucciones actuales de la persona prevalecen.

## Desarrollo y comprobaciones

```sh
npm ci
npm run check:public -- --history
npm test
npm run test:integration
```

La integración ya incluye TypeScript y build; utiliza identidades locales ficticias, sin secretos de una casa. `npm run setup:check` valida ambos archivos locales sin mostrar valores. Los cambios solo documentales necesitan revisión de enlaces y capturas, no nuevas pruebas de lógica.

Mantén el editor manual funcional sin IA, la persistencia compatible y la demo separada del acceso remoto. Documenta límites reales y comprueba los flujos afectados.
