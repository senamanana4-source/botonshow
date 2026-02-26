Este es un proyecto de una aplicación web interactiva en tiempo real llamada SUPER REALITY BATTLE. Es un sistema de juego de "quien presiona primero el botón", diseñado para dinámicas de grupo, concursos o debates, utilizando Node.js, Express y Socket.io.

SUPER REALITY BATTLE
SUPER REALITY BATTLE es una plataforma de interacción en vivo donde múltiples participantes compiten por el turno de palabra o respuesta. El sistema gestiona las conexiones en tiempo real, resuelve empates mediante una ruleta aleatoria y permite a los administradores configurar las reglas de la ronda.

Características Principales
Interacción en Tiempo Real: Comunicación instantánea mediante WebSockets.

Gestión de Fases:

Esperando: Los jugadores se unen a la sala.

Open Phase (Apertura): Se abre el tiempo para que los usuarios presionen su botón.

Turn Phase (Turno): El jugador más rápido (o el ganador del sorteo) toma el control para responder.

Roulette (Desempate): Si varios usuarios presionan casi al mismo tiempo (ventana de 400ms), el sistema activa una ruleta visual para elegir al azar.

Panel de Administración: Permite ajustar la duración de los turnos y el tiempo de presión antes de iniciar cada ronda.

Interfaz Responsiva: Estilo futurista "Cyberpunk" optimizado para móviles y escritorio con animaciones de partículas (estrellas).

Sistema de Opciones: El jugador activo puede seleccionar opciones (A, B, C, D) que se visualizan en su tarjeta de jugador.

Tecnologías Utilizadas
Backend: Node.js, Express.

Comunicación: Socket.io.

Frontend: HTML5, CSS3 (CSS Grid/Flexbox), JavaScript Vanilla.

Fuentes: Orbitron (Google Fonts).

*****Cómo ejecutarlo en local*****

Sigue estos pasos para poner en marcha el proyecto en tu pc:

1. Requisitos previos
Asegúrate de tener instalado Node.js.

2. Preparación del proyecto
Crea una carpeta para el proyecto.

Copia los archivos proporcionados respetando la siguiente estructura:


/tu-proyecto
├── server.js
├── package.json (debes crearlo)
└── /public
    ├── index.html
    ├── style.css
    └── client.js
    
3. Instalación de dependencias
Abre una terminal en la carpeta raíz del proyecto y ejecuta:

----------------------------------
npm init -y
npm install express socket.io
----------------------------------

4. Iniciar el servidor
Ejecuta el siguiente comando:

--------------------------------
node server.js
--------------------------------

Deberías ver el mensaje: Servidor activo en puerto 3003.

5. Acceder al juego
Abre tu navegador y ve a: http://localhost:3003

Para probar la interacción, abre varias pestañas o ventanas en modo incógnito con diferentes nombres.

¿Cómo funciona la plataforma?

Registro: Cada usuario ingresa un nombre y aparece una tarjeta con su color asignado.

Configuración: Alguien (el administrador) ajusta los segundos de la ronda y presiona "INICIAR RONDA".

El Gran Botón: Durante la fase de apertura, los botones de los usuarios brillarán. El primero en presionar gana el turno.

El Turno: El nombre del ganador se ilumina en grande y aparece un cronómetro. En su pantalla aparecerán los botones A, B, C, D para elegir su respuesta.

Cola de Espera: Si alguien presiona después de que ya hay un turno activo, entra en una fila y el sistema le cederá el turno automáticamente cuando el actual termine.
