# Contribuir a Our Cozy Room

Gracias por dedicar tiempo a este pequeño refugio. El proyecto busca una experiencia tranquila, comprensible y fácil de instalar para dos personas.

## Preparar el entorno

1. Crea tu fork y clónalo.
2. Instala Node.js 22.12 o posterior y ejecuta `npm ci`.
3. Ejecuta `npm run dev` para explorar la demo sin servicios externos.
4. Para modificar el backend, configura una instalación propia siguiendo [SETUP](docs/SETUP.md).

La interfaz y la documentación principal están en español. Mantén los términos de la aplicación y utiliza nombres descriptivos para el código.

## Proponer una mejora

Explica qué problema resuelve y cómo debería comportarse la aplicación. Para un fallo incluye pasos de reproducción, navegador, entorno local o remoto y resultado esperado. Usa datos ficticios y elimina correos, tokens, mensajes privados e identificadores de tu instalación de cualquier captura.

Una función que necesita servicios externos debe explicar la configuración y el coste esperado. El editor manual de personajes debe seguir funcionando por sí solo.

## Preparar un cambio

- Mantén el alcance centrado en el problema y conserva la persistencia de casas existentes.
- Las reglas de sala compartidas viven en `shared/`. El servidor valida las acciones recibidas.
- Respeta los estados de conexión, los controles de sonido y la preferencia de movimiento reducido.
- Si cambias el esquema, explica cómo se leen y migran los datos antiguos.
- Actualiza la documentación y los créditos cuando cambien funciones, configuración o recursos.

Ejecuta las comprobaciones antes de abrir la solicitud.

```sh
npm test
npm run test:integration
```

La integración incluye TypeScript y build. Para un cambio exclusivamente documental comprueba los enlaces y las imágenes. Si cambias el dibujo, incluye una captura de la demo con datos ficticios. Si cambias el acceso o el tiempo real, describe la prueba con dos sesiones independientes.

En el pull request explica el problema, el resultado visible y las comprobaciones realizadas. Indica cualquier limitación pendiente.

## Datos y licencias

Los archivos de configuración con valores reales y el estado local permanecen fuera de Git. Revisa los archivos que vas a incluir antes de hacer commit. No subas volcados de casas ni exportaciones de cuentas.

Las contribuciones de código se distribuyen bajo [MIT](LICENSE). Las grabaciones de piano mantienen su licencia y atribución propias. Consulta [ASSETS](docs/ASSETS.md) antes de sustituir o añadir recursos.

Los problemas de seguridad deben comunicarse por el procedimiento de [SECURITY](SECURITY.md).
