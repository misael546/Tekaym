# Tekaym Online — Diseño del juego

## Dirección

Juego de supervivencia 3D en primera persona con mundo cúbico, construcción por bloques, recolección, fabricación, zombis y necesidades de supervivencia. La antigua prisión queda como prototipo de origen; la dirección jugable nueva es un mundo abierto cúbico.

## Mundo cúbico

- Terreno procedural con chunks.
- Bloques iniciales: pasto, tierra, piedra, arena, madera y hojas.
- La geometría solo genera las caras expuestas de los bloques.
- Romper bloques, recoger materiales y colocar bloques.
- El terreno y los cambios del jugador deben persistir.
- El movimiento debe respetar el terreno y evitar atravesar bloques.
- Próximas mejoras: cuevas, minerales, agua, biomas, iluminación y generación por semilla.

## Supervivencia y combate

- Vida, resistencia, hambre y sed existentes.
- Zombis que persiguen al jugador en el prototipo local.
- Cuchillo inicial y recetas de pico/hacha en la primera iteración.
- Próximas mejoras: durabilidad, daño por herramienta, armadura, curación, ciclos día/noche y dificultad progresiva.

## Inventario y fabricación

- Inventario básico de bloques y materiales.
- Recetas iniciales: madera → tablas; tablas → palos; tablas + palos → pico/hacha.
- Las recetas iniciales preparan el sistema; se ampliarán con estaciones de trabajo y herramientas con efectos reales.
- Guardado local de los cambios del mundo e inventario.

## Android

- Reutilizar el cliente Three.js y controles táctiles existentes.
- Mantener botones de minería, colocación, selección de bloque y ataque.
- Optimizar chunks, geometría, sombras y resolución para dispositivos modestos.
- Después de estabilizar el juego web, empaquetarlo como APK y probar en dispositivos reales.

## Multijugador y mundos personales

- El objetivo es que el jugador cree un mundo personal y comparta un código de invitación.
- En el modelo A, los amigos solo podrán entrar mientras el anfitrión tenga el juego abierto.
- La conexión móvil se hace a través del Worker/Durable Objects; no se depende de conexiones entrantes directas al teléfono.
- La rama de desarrollo añade códigos de mundo, una comprobación de presencia del anfitrión y sincronización/guardado de bloques por sala.
- El servidor debe endurecerse para validar inventario, altura/alcance de construcción, movimiento y daño antes de una prueba pública.
- Estado actual: las rutas de sala y los mensajes de sincronización están implementados en la rama, pero la URL del Worker sigue siendo un placeholder. Falta desplegar y probar con dos cuentas/dispositivos antes de considerar las invitaciones terminadas.

## Seguridad y aislamiento

Tekaym Online es independiente de NeonCore y DarkPixel Online. No reutilizar sus bases de datos, secretos, sistemas de actualización ni economía. Las credenciales deben permanecer en el backend y fuera del repositorio.
