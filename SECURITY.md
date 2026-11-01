# Seguridad y límites de la primera versión

## Controles implementados

- Autenticación Firebase con correo verificado; validación de firma RS256, audiencia, emisor y fechas mediante `jose` en el Worker.
- Autorización independiente: exactamente dos correos configurados en el servidor y un máximo persistente de dos miembros.
- Misma procedencia para la API y el WebSocket. Sin credenciales administrativas en el navegador.
- Ticket aleatorio de conexión, de un uso, con 30 segundos de vigencia. El token Firebase no aparece en la URL del WebSocket.
- Identidad del emisor derivada de la conexión, nunca de un campo elegido por el cliente.
- Validación de acciones, límites de tamaño y frecuencia por conexión, control de asientos y revisiones de pomodoro.
- Expiración de WebSockets por la caducidad del token, reconexión y renovación de identidad. Una segunda pestaña sustituye a la primera.
- Sin fotos, IA, seguimiento de teclado ni analítica. Logs de observabilidad desactivados para evitar registrar URLs con tickets de conexión; cualquier observabilidad futura debe redactarlos.
- Historial almacenado y visible limitado a los 10 mensajes más recientes de las últimas 24 horas. Se recorta al guardar acciones y al recuperar una casa antigua. La expiración también se filtra en cada snapshot; el borrado físico por antigüedad sucede en la siguiente mutación o carga del Durable Object. No se promete borrado exacto al cumplirse las 24 horas ni borrado de backups del proveedor.
- El modo local es explícito y aislado. El backend jamás acepta identidades de demostración ni una variable de bypass de autenticación.

## TV y contenido externo

- El servidor valida dominio e ID de los enlaces YouTube y conserva solo ID, instante y revisión. No descarga URLs arbitrarias ni recibe credenciales de YouTube. Las órdenes de TV requieren pertenecer a la casa; un apagado antiguo no cancela un vídeo recién cambiado.
- Encender la TV carga el iframe oficial en `youtube-nocookie.com` y la API de YouTube; el proveedor recibe las peticiones habituales del navegador (incluida IP). No se promete ausencia de seguimiento ni funcionamiento sin conexión.
- CSP permite únicamente los hosts necesarios de YouTube para scripts/frames. El iframe envía el origen como Referer mediante `strict-origin-when-cross-origin`, requerido por YouTube; el resto de la página conserva `no-referrer`. No se envían tokens Firebase ni mensajes de la sala al reproductor.
- Revisar la presentación, privacidad y condiciones vigentes del reproductor antes de publicar. No se elimina publicidad ni se extrae audio.

## Pendiente antes de producción pública

1. La verificación JWT no consulta revocación de Firebase en cada operación. Un token emitido puede conservar validez hasta su vencimiento, normalmente alrededor de una hora. Deshabilitar una cuenta en Firebase no implica revocación inmediata en este backend. Implementar y verificar revocación administrativa por UID antes de anunciar esa capacidad.
2. La lista de correos cambia al actualizar secretos/despliegue; verificar cierre de conexiones y sustitución de miembros. El esquema actual no permite añadir indefinidamente UIDs nuevos.
3. El limitador de mensajes es por conexión y se reinicia al reconectar. Añadir protección de admisión y abuso por identidad/IP adecuada al proveedor, medir CPU de verificación y configurar la política de contraseñas en Firebase. El registro público de Firebase puede crear cuentas sin membresía; no permite leer la casa, pero requiere controlar abuso/cuotas antes del lanzamiento.
4. Probar latidos y plazos de presencia ante redes interrumpidas. El cierre limpio y reinicio están probados localmente; una conexión móvil interrumpida puede tardar en desaparecer.
5. El movimiento valida destinos y rutas, pero el estado lógico llega al destino antes de terminar la interpolación visual. Unificar tiempo de llegada e interacciones antes del acabado final de juego.
6. Añadir exportación, restauración y pruebas de migración. La persistencia no reemplaza las copias de seguridad.
7. Verificar las cabeceras y recuperación de cuentas en el dominio real. Revisar el CSP con todos los flujos de Firebase utilizados.

No se ha realizado una auditoría externa ni una prueba de carga de producción. Las pruebas locales son evidencia acotada, no una certificación.

## Reportar problemas

Mientras no exista un canal privado de seguridad del repositorio remoto, comunica al mantenedor el resumen por un canal privado acordado. No publiques credenciales, direcciones de correo reales, tokens, fotos ni conversaciones de la pareja en una incidencia pública.
