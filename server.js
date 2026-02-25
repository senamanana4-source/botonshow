// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let users = {}; // socket.id -> username
let userPressCount = {}; // username -> count
let userAnswers = {}; // username -> readable answer string
let waitingQueue = []; // [{ id, username }]
let activeUser = null; // username
let countdownInterval = null;
let remainingTime = 0;

let gamePhase = "waiting"; // "waiting", "open", "turn"
let customDuration = 15; // turn duration (segundos)
let openDuration = 10; // open press duration (segundos)
let openCountdownInterval = null;

function broadcastUsers(){
    io.emit("usersUpdate", Object.values(users));
}

function broadcastPressCount(){
    io.emit("pressCountUpdate", userPressCount);
}

function broadcastAnswers(){
    io.emit("answersUpdate", userAnswers);
}

function startTurn(username){
    activeUser = username;
    remainingTime = customDuration;
    gamePhase = "turn";

    io.emit("turnStarted", { user: activeUser, time: remainingTime });
    io.emit("showOptions", { player: activeUser });

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(()=>{
        remainingTime--;
        io.emit("countdown", remainingTime);

        if(remainingTime <= 0){
            clearInterval(countdownInterval);
            countdownInterval = null;
            activeUser = null;

            if(waitingQueue.length > 0){
                const next = waitingQueue.shift();
                // start next turn for next.username
                startTurn(next.username);
                // emit lock for new active
                io.emit("lockButtons", { active: next.username });
            } else {
                gamePhase = "waiting";
                io.emit("turnEnded");
            }
        }
    }, 1000);
}

function startOpenPhase(starter = null){
    if(openCountdownInterval) clearInterval(openCountdownInterval);
    gamePhase = "open";

    // reset states for the open phase
    userPressCount = {};
    userAnswers = {};
    waitingQueue = [];
    activeUser = null;

    io.emit("openPhase", { starter: starter || '', time: openDuration });
    let t = openDuration;
    io.emit("openCountdown", t);
    openCountdownInterval = setInterval(()=>{
        t--;
        io.emit("openCountdown", t);
        if(t <= 0){
            clearInterval(openCountdownInterval);
            openCountdownInterval = null;
            io.emit("openEnded");
            gamePhase = "waiting";
        }
    }, 1000);
}

io.on('connection', (socket) => {
    socket.on("join", (username) => {
        if(!username) return;
        socket.username = username;
        users[socket.id] = username;
        if(!(username in userPressCount)) userPressCount[username] = 0;
        if(!(username in userAnswers)) userAnswers[username] = "";

        socket.emit("gameState", { phase: gamePhase, customDuration, openDuration });
        broadcastUsers();
        broadcastPressCount();
        broadcastAnswers();
    });

    // Nuevo comportamiento: solo el primer press se acepta (los demás son ignorados)
    socket.on("pressButton", ()=>{
        if(!socket.username) return;

        // Si no hay activeUser, este usuario gana el primer click
        if(!activeUser){
            // Incrementar solo para el primer que logró el click
            userPressCount[socket.username] = (userPressCount[socket.username] || 0) + 1;
            broadcastPressCount();

            // Iniciar el turno para ese usuario
            startTurn(socket.username);

            // Bloquear botones inmediatamente en todos los clientes
            io.emit("lockButtons", { active: socket.username });
        } else {
            // Ignorar presses posteriores mientras haya activeUser
            socket.emit("pressIgnored", { reason: "Ya hay jugador activo" });
        }
    });

    socket.on("selectOption", (data)=>{
        // Guardar la opción seleccionada (solo si es el activeUser)
        if(socket.username === activeUser){
            let opt, truth;
            if(typeof data === 'string'){
                opt = data;
            } else if(typeof data === 'object'){
                opt = data.option;
                truth = data.truth; // 'V' o 'F'
            }

            let readable;
            if(opt && truth){
                readable = `${opt} - ${truth === 'V' ? 'Verdadero' : 'Falso'}`;
            } else if(opt){
                readable = `${opt}`;
            } else {
                readable = '';
            }

            userAnswers[socket.username] = readable;
            broadcastAnswers();

            // Opcional: terminar turno cuando el jugador confirma su opción
            // Si quieres que el turno termine al elegir, descomenta lo siguiente:
            /*
            if(countdownInterval){
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            activeUser = null;
            io.emit("turnEnded");
            */
        }
    });

    socket.on("setDurations", (data)=>{
        if(data.turnDuration && Number.isInteger(data.turnDuration) && data.turnDuration > 0) customDuration = data.turnDuration;
        if(data.openDuration && Number.isInteger(data.openDuration) && data.openDuration > 0) openDuration = data.openDuration;
        io.emit("gameState", { phase: gamePhase, customDuration, openDuration });
    });

    socket.on("startOpenPhase", ()=>{
        const allUsers = Object.values(users);
        const starter = allUsers.length ? allUsers[Math.floor(Math.random()*allUsers.length)] : '';
        startOpenPhase(starter);
    });

    socket.on("disconnect", ()=>{
        if(socket.username){
            delete userPressCount[socket.username];
            delete userAnswers[socket.username];
        }
        delete users[socket.id];
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);

        if(socket.username === activeUser){
            if(countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            activeUser = null;
            if(waitingQueue.length > 0){
                const next = waitingQueue.shift();
                startTurn(next.username);
                io.emit("lockButtons", { active: next.username });
            } else {
                gamePhase = "waiting";
                io.emit("turnEnded");
            }
        }

        broadcastUsers();
        broadcastPressCount();
        broadcastAnswers();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
