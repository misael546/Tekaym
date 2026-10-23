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

- Sincronización autoritativa de los bloques con el servidor.
- Mundos personales compartibles mediante códigos de invitación.
- Guardado remoto de los mundos y acceso de amigos.
- Mejoras de IA, animaciones, herramientas y recetas.
- Empaquetado y pruebas de una APK Android.

La URL del Worker sigue pendiente de configurar en `src/config.js`; por eso la base multijugador no debe considerarse lista. El guardado actual de bloques es local al dispositivo/navegador y todavía no se comparte entre amigos.

## Arquitectura existente

- Cliente Three.js.
- Cloudflare Workers + Durable Objects para el backend previsto.
- Firebase/Firestore para cuentas y progreso previsto.
- GitHub Pages para el cliente web.

No guardar secretos en GitHub. No copiar archivos, bases de datos ni sistemas de DarkPixel o NeonCore a este repositorio.
