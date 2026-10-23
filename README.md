# Tekaym Online

Juego de supervivencia 3D en primera persona, en transición desde el prototipo de prisión hacia un mundo cúbico construible. Proyecto independiente de NeonCore y DarkPixel Online.

## Base cúbica integrada en la rama de desarrollo

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
- Se conservan los sistemas existentes de vida, resistencia, hambre, sed y zombis.

## Controles

### PC
- WASD: moverse; Shift: correr y gastar resistencia.
- Mouse: mirar.
- Clic izquierdo: minar.
- Clic derecho: colocar el bloque seleccionado.
- E: minar; Q: colocar; R: cambiar bloque.
- Espacio o botón ATACAR: atacar.

### Android / pantalla táctil
- Joystick izquierdo: moverse; botón CORRER: sprint.
- Joystick derecho: mirar.
- Botones MINAR, COLOCAR, BLOQUE y ATAQUE.
- El panel de inventario y fabricación se puede desplazar.

## Desarrollo pendiente

- Pruebas y endurecimiento de la sincronización de bloques por mundo.
- Probar la creación de mundos con códigos de invitación y el cierre cuando el anfitrión se desconecta.
- Verificar el guardado remoto del mundo y el acceso de amigos.
- Verificación visual de carga y descarga de chunks en navegador y móvil.
- Mejoras de IA, animaciones, herramientas y recetas.
- Empaquetado y pruebas de una APK Android.

La rama de desarrollo ya contiene rutas para crear salas, entrar con código y sincronizar cambios de bloques mediante Durable Objects. Sin embargo, la URL del Worker sigue pendiente de configurar en `src/config.js`, por lo que el multijugador no se puede probar desde el cliente publicado todavía. El guardado local funciona como respaldo; la sincronización remota requiere despliegue y pruebas.

## Arquitectura existente

- Cliente Three.js.
- Cloudflare Workers + Durable Objects para el backend previsto.
- Firebase/Firestore para cuentas y progreso previsto.
- GitHub Pages para el cliente web.

No guardar secretos en GitHub. No copiar archivos, bases de datos ni sistemas de DarkPixel o NeonCore a este repositorio.


## Horno, carbón, antorchas y audio

- Las vetas de carbón se generan en depósitos conectados dentro de la piedra; cada unidad de carbón permite procesar hasta ocho piezas en el horno.
- Fabrica un horno con ocho bloques de piedra, colócalo y cocina carne cruda. Cada pieza tarda diez segundos y la carne cocida restaura más hambre.
- Fabrica palos con tablas y crea cuatro antorchas con un palo y carbón. Las antorchas iluminan casas y cuevas y protegen contra la aparición natural de zombis en su radio iluminado.
- Los efectos de sonido y la música ambiental se sintetizan localmente con Web Audio, sin pistas de terceros.
- El workflow Android construye un APK de depuración firmado automáticamente para pruebas; no es una firma de publicación para Google Play.
