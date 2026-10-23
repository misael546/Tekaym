# Tekaym Online

Juego de supervivencia 3D en primera persona, en transición desde el prototipo de prisión hacia un mundo cúbico construible. Proyecto independiente de NeonCore y DarkPixel Online.

## Base cúbica integrada en la rama de desarrollo

- Terreno procedural de bloques: pasto, tierra, piedra, arena, madera y hojas.
- Chunks para agrupar la geometría y dibujar solo las caras visibles.
- Romper y colocar bloques con controles de PC y botones táctiles.
- Inventario inicial de recursos y selección de bloque para construir.
- Recetas iniciales: madera a tablas, tablas a palos, pico y hacha.
- Colisión básica con bloques y ajuste de altura al terreno.
- Guardado local del mundo modificado e inventario en el navegador/dispositivo.
- Se conservan los sistemas existentes de vida, resistencia, hambre, sed y zombis.

## Controles

### PC
- WASD: moverse.
- Mouse: mirar.
- Clic izquierdo: minar.
- Clic derecho: colocar el bloque seleccionado.
- E: minar; Q: colocar; R: cambiar bloque.
- Espacio o botón ATACAR: atacar.

### Android / pantalla táctil
- Joystick izquierdo: moverse.
- Joystick derecho: mirar.
- Botones MINAR, COLOCAR, BLOQUE y ATAQUE.
- El panel de inventario y fabricación se puede desplazar.

## Desarrollo pendiente

- Pruebas y endurecimiento de la sincronización de bloques por mundo.
- Probar la creación de mundos con códigos de invitación y el cierre cuando el anfitrión se desconecta.
- Verificar el guardado remoto del mundo y el acceso de amigos.
- Mejoras de IA, animaciones, herramientas y recetas.
- Empaquetado y pruebas de una APK Android.

La rama de desarrollo ya contiene rutas para crear salas, entrar con código y sincronizar cambios de bloques mediante Durable Objects. Sin embargo, la URL del Worker sigue pendiente de configurar en `src/config.js`, por lo que el multijugador no se puede probar desde el cliente publicado todavía. El guardado local funciona como respaldo; la sincronización remota requiere despliegue y pruebas.

## Arquitectura existente

- Cliente Three.js.
- Cloudflare Workers + Durable Objects para el backend previsto.
- Firebase/Firestore para cuentas y progreso previsto.
- GitHub Pages para el cliente web.

No guardar secretos en GitHub. No copiar archivos, bases de datos ni sistemas de DarkPixel o NeonCore a este repositorio.
