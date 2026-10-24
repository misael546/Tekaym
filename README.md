# Tekaym Online

Juego de supervivencia 3D en primera persona con mundo cúbico procedural, construcción por bloques, recolección, fabricación, criaturas y supervivencia. Esta es la base principal única de Tekaym Online; el antiguo mapa de prisión fue retirado. Proyecto independiente de NeonCore y DarkPixel Online.

## Juego principal

- Terreno procedural de bloques: pasto, tierra, piedra, arena, madera y hojas.
- Chunks dinámicos de 16×16 bloques: el terreno se genera al explorar, con distancia de render adaptable para móvil y PC.
- Descarga de geometría y datos base de chunks lejanos; las modificaciones se conservan y reaplican al volver.
- Mundo procedural sin borde fijo práctico; el servidor mantiene un límite de seguridad amplio.
- Romper y colocar bloques con controles de PC y botones táctiles.
- Inventario inicial vacío: el jugador reúne recursos desde cero.
- Progresión de supervivencia: troncos → tablas y palos → herramientas de madera → piedra y carbón → herramientas de piedra → mineral de hierro → horno, carbón y lingotes → pico de hierro.
- Añadidos minerales de carbón, hierro, oro y diamante en distintas profundidades.
- Recetas para pico, hacha, pala, espada, mesa de trabajo, horno y equipo de piedra/hierro.
- Correr con Shift en PC y botón CORRER en móvil; consume resistencia.
- Aparición sobre terreno generado con espacio libre alrededor y sin estructuras encima.
- Ciclo compartido por mundo de 20 minutos: día, atardecer, noche y amanecer; cambia el color del cielo, la niebla y la iluminación.
- Pollos, cerdos y vacas son entidades compartidas del servidor: todos ven la misma posición y salud, deambulan, reaparecen y sueltan recursos autorizados por el servidor. Vacas dan carne de res y pueden dar cuero; cerdos dan carne de cerdo; pollos dan pollo y pueden dar plumas.
- La carne cruda se puede comer con F en PC o COMER en móvil para recuperar hambre.
- Los zombis se activan por la noche y se acercan a los jugadores; durante el día dejan de perseguir y atacar.
- Colisión básica con bloques y ajuste de altura al terreno.
- Guardado local del mundo modificado e inventario en el navegador/dispositivo.
- Multijugador directo WebRTC: un jugador aloja su mundo local y comparte terreno modificado y posiciones de jugadores sin alojar el mundo en un servidor central. La invitación y respuesta se intercambian manualmente como texto.
- Se conservan los sistemas existentes de vida, resistencia, hambre, sed y zombis.

## Controles

### PC
- WASD: moverse; Espacio: saltar; Shift: correr y gastar resistencia.
- Mouse: mirar.
- Clic izquierdo: minar; clic derecho: colocar bloque.
- Clic derecho: colocar el bloque seleccionado.
- E: abrir inventario; Q: colocar bloque; R: cambiar espacio de la barra rápida; F: comer.
- Espacio o botón ATACAR: atacar.

### Android / pantalla táctil
- Joystick izquierdo: moverse; botón SALTAR: saltar; botón CORRER: sprint.
- Joystick derecho: mirar.
- Botones MINAR, COLOCAR, BLOQUE y ATAQUE.
- El panel de inventario y fabricación se puede desplazar.

## Desarrollo pendiente

- Pruebas y endurecimiento de la sincronización de bloques por mundo.
- Probar el intercambio de invitación/respuesta WebRTC entre dos dispositivos y el cierre cuando el anfitrión se desconecta.
- Sincronizar y verificar todas las entidades, inventarios y acciones de supervivencia en una sesión P2P.
- Verificación visual de carga y descarga de chunks en navegador y móvil.
- Mejoras de IA, animaciones, herramientas y recetas.
- Empaquetado y pruebas de una APK Android.

El modo P2P usa WebRTC DataChannel: el anfitrión mantiene el mundo y los cambios se transmiten directamente cuando la conexión logra establecerse. Para evitar un servicio de señalización central, la invitación (oferta) y la respuesta se copian y se comparten manualmente por un chat privado. Se necesita un navegador con HTTPS y redes que permitan establecer la conexión; algunas redes requieren TURN y pueden impedir la conexión directa. La conexión debe probarse con dos dispositivos reales. El antiguo sistema de salas con Worker permanece en el código como vía separada, pero no es necesario para el modo P2P.

## Arquitectura

- Cliente Three.js.
- WebRTC DataChannel para compartir directamente el mundo alojado en el dispositivo del anfitrión.
- STUN para ayudar a descubrir rutas de conexión; la señalización se hace intercambiando manualmente oferta/respuesta.
- GitHub Pages para el cliente web.
- El Worker y Firebase no son necesarios para alojar mundos en el modo P2P.

No guardar secretos en GitHub. No copiar archivos, bases de datos ni sistemas de DarkPixel o NeonCore a este repositorio.


## Horno, carbón, antorchas y audio

- Las vetas de carbón se generan en depósitos conectados dentro de la piedra; cada unidad de carbón permite procesar hasta ocho piezas en el horno.
- Fabrica un horno con ocho bloques de piedra, colócalo y cocina carne cruda. Cada pieza tarda diez segundos y la carne cocida restaura más hambre.
- Fabrica palos con tablas y crea cuatro antorchas con un palo y carbón. Las antorchas iluminan casas y cuevas y protegen contra la aparición natural de zombis en su radio iluminado.
- Los efectos de sonido y la música ambiental se sintetizan localmente con Web Audio, sin pistas de terceros.
- El workflow Android construye un APK de depuración firmado automáticamente para pruebas; no es una firma de publicación para Google Play.


## Menú, inventario y barra rápida

El juego abre primero el menú principal; el mundo solo se inicia al elegir Crear mundo nuevo o Continuar mundo. Cada mundo nuevo usa una semilla propia. El personaje comienza sin armas ni recursos. El inventario se abre con E y solo muestra recetas cuyos materiales están disponibles. La barra rápida tiene nueve espacios seleccionables con 1–9 en PC o tocándolos en Android.
