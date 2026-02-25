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
let customDuration = 15; // turn duration
let openDuration = 10; // open press duration
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
    // preserve existing userAnswers for display OR reset only for current user
    // we'll keep userAnswers global but only set for activeUser when they submit
    io.emit("turnStarted", { user: activeUser, time: remainingTime });
    // Inform all clients which player should see options. Clients show only if they are that player.
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
                // start next turn with next username
                startTurn(next.username);
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
    // reset counts and answers only for display during open
    userPressCount = {};
    userAnswers = {};
    waitingQueue = [];
    activeUser = null;

    io.emit("openPhase", { starter: starter || '', time: openDuration });
    // open countdown
    let t = openDuration;
    io.emit("openCountdown", t);
    openCountdownInterval = setInterval(()=>{
        t--;
        io.emit("openCountdown", t);
        if(t <= 0){
            clearInterval(openCountdownInterval);
            openCountdownInterval = null;
            // end open phase
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

        // Emit current state to this client
        socket.emit("gameState", { phase: gamePhase, customDuration, openDuration });
        broadcastUsers();
        broadcastPressCount();
        broadcastAnswers();
    });

    socket.on("pressButton", ()=>{
        if(!socket.username) return;
        // increment press count
        if(!(socket.username in userPressCount)) userPressCount[socket.username] = 0;
        userPressCount[socket.username]++;
        broadcastPressCount();

        // If in open or waiting or turn, handle queueing and starter behavior
        if(gamePhase === "open" || gamePhase === "waiting" || gamePhase === "turn"){
            if(!activeUser){
                // first one to press becomes active user (starter of the turn)
                startTurn(socket.username);
            } else {
                // push to waiting queue
                // avoid duplicate entries
                if(!waitingQueue.find(x => x.id === socket.id)){
                    waitingQueue.push({ id: socket.id, username: socket.username });
                }
            }
        }
    });

    socket.on("selectOption", (data)=>{
        // Guardar la opción seleccionada (soporta recibir string o objeto)
        if(socket.username === activeUser){
            let opt, truth;
            if(typeof data === 'string'){
                opt = data;
            } else if(typeof data === 'object'){
                opt = data.option;
                truth = data.truth; // 'V' or 'F' or undefined
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
            // Optionally you could end the turn immediately after selection:
            // clearInterval(countdownInterval); countdownInterval = null; activeUser = null; io.emit("turnEnded");
        }
    });

    socket.on("setDurations", (data)=>{
        if(data.turnDuration && Number.isInteger(data.turnDuration) && data.turnDuration > 0) customDuration = data.turnDuration;
        if(data.openDuration && Number.isInteger(data.openDuration) && data.openDuration > 0) openDuration = data.openDuration;
        io.emit("gameState", { phase: gamePhase, customDuration, openDuration });
    });

    socket.on("startOpenPhase", ()=>{
        // Optionally pick a random starter name to show as "🎬 starter"
        const allUsers = Object.values(users);
        const starter = allUsers.length ? allUsers[Math.floor(Math.random()*allUsers.length)] : '';
        startOpenPhase(starter);
    });

    socket.on("disconnect", ()=>{
        // cleanup
        if(socket.username){
            delete userPressCount[socket.username];
            delete userAnswers[socket.username];
        }
        delete users[socket.id];
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);

        // if the disconnected user was activeUser, move to next or end
        if(socket.username === activeUser){
            if(countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            activeUser = null;
            if(waitingQueue.length > 0){
                const next = waitingQueue.shift();
                startTurn(next.username);
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
