# Tekaym Online — Diseño del juego

## Dirección

Tekaym Online es un único proyecto y una única base de desarrollo. No se mantienen copias paralelas del juego anterior ni se mezclan archivos de NeonCore o DarkPixel Online.

Juego de supervivencia 3D en primera persona con mundo cúbico, construcción por bloques, recolección, fabricación, animales, zombis y necesidades de supervivencia. El mundo cúbico procedural es la única base jugable; el mapa antiguo de prisión ya no forma parte del juego.

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
- El jugador comienza con las manos vacías; las herramientas se fabrican con recursos recogidos.
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


## Ciclo de día y noche, animales y enemigos

Cada mundo usa un reloj compartido de 1200 segundos (20 minutos) persistido por el Durable Object: día, atardecer, noche y amanecer. El cliente interpola el cielo, la niebla, el color e intensidad de la luz solar y la iluminación ambiental. Los zombis solo se mueven y atacan durante la franja nocturna; se reubican a una distancia jugable alrededor de jugadores activos. En la superficie, el servidor mantiene entidades persistentes compartidas de pollos, cerdos y vacas, crea una población cerca de los jugadores durante el día, controla sus posiciones y salud, actualiza su movimiento, y gestiona su reaparición. El estado se guarda en el almacenamiento del mundo y se transmite a todos los clientes. El servidor valida la distancia al atacar y decide las recompensas: vacas dan carne de res y posibilidad de cuero; cerdos dan cerdo; pollos dan pollo y posibilidad de plumas. El cliente receptor aplica las recompensas a su inventario local. La carne cruda puede consumirse para recuperar hambre.


## Supervivencia: cocina e iluminación

El horno se fabrica con ocho piedras y usa carbón como combustible. Cada carbón representa ocho operaciones de cocción/fundición; cocinar una pieza tarda diez segundos. Carne cocida restaura más hambre que carne cruda. Cuatro antorchas se fabrican con carbón y un palo. Las antorchas iluminan y bloquean la aparición natural de zombis dentro de una aproximación de radio Manhattan 11, tanto en local como en multijugador. El audio ambiental y los efectos se sintetizan con Web Audio.


## Flujo de inicio e inventario

El menú principal permite crear un mundo local, continuar la última partida o abrir el flujo multijugador. Cada mundo nuevo usa una semilla propia y el personaje empieza con las manos vacías. El inventario filtra las recetas según materiales disponibles y la barra rápida de nueve espacios se puede usar en PC y móvil.
