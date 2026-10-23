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
- La conexión móvil normalmente requiere un servicio de señalización/relay o un servidor accesible; no se debe asumir que el teléfono puede aceptar conexiones entrantes.
- El servidor debe validar movimiento, bloques colocados/rotos, inventario y daño.
- Las modificaciones del mundo deben sincronizarse y guardarse remotamente antes de considerar esta función terminada.
- Estado actual: la URL del Worker aún es un placeholder y la edición de bloques solo se guarda localmente. Invitaciones y mundos compartidos aún no están implementados.

## Seguridad y aislamiento

Tekaym Online es independiente de NeonCore y DarkPixel Online. No reutilizar sus bases de datos, secretos, sistemas de actualización ni economía. Las credenciales deben permanecer en el backend y fuera del repositorio.
