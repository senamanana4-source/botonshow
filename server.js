// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "public")));

let users = {};
let userPressCount = {}; 
let activeUser = null;
let waitingQueue = [];
let countdownInterval = null;
let remainingTime = 0;
let gamePhase = "waiting"; 
let openCountdown = 0;
let openCountdownInterval = null;
let customDuration = 15;
let openDuration = 10;
let roundStarter = null; 
let userAnswers = {}; 

// Variables para control de empates (Ruleta)
let tieTimeout = null;
let tieCandidates = [];

function broadcastUsers(){
    io.emit("usersUpdate", Object.values(users));
}

function broadcastPressCount(){
    io.emit("pressCountUpdate", userPressCount);
}

function broadcastAnswers(){
    io.emit("answersUpdate", userAnswers);
}

function startOpenPhase(initiator){
    gamePhase = "open";
    roundStarter = initiator;
    openCountdown = openDuration;
    userPressCount = {}; 
    userAnswers = {}; 
    tieCandidates = [];
    if(tieTimeout) { clearTimeout(tieTimeout); tieTimeout = null; }

    io.emit("openPhase", { time: openCountdown, starter: initiator });

    openCountdownInterval = setInterval(()=>{
        openCountdown--;
        io.emit("openCountdown", openCountdown);
        if(openCountdown <= 0){
            clearInterval(openCountdownInterval);
            openCountdownInterval = null;
            gamePhase = "waiting";
            io.emit("openEnded");
        }
    }, 1000);
}

function startTurn(username){
    activeUser = username;
    remainingTime = customDuration;
    gamePhase = "turn";
    userAnswers = {}; 

    io.emit("turnStarted", { user: activeUser, time: remainingTime });
    io.emit("showOptions", { player: activeUser }); 

    countdownInterval = setInterval(()=>{
        remainingTime--;
        io.emit("countdown", remainingTime);

        if(remainingTime <= 0){
            clearInterval(countdownInterval);
            countdownInterval = null;
            activeUser = null;

            if(waitingQueue.length > 0){
                const next = waitingQueue.shift();
                io.to(next.id).emit("autoPress");
            } else {
                gamePhase = "waiting";
                io.emit("turnEnded");
            }
        }
    }, 1000);
}

function processTieBreaker() {
    let candidates = [...tieCandidates];
    tieCandidates = [];
    tieTimeout = null;

    if (openCountdownInterval) {
        clearInterval(openCountdownInterval);
        openCountdownInterval = null;
        io.emit("openEnded");
    }

    if (candidates.length === 1) {
        startTurn(candidates[0]);
    } else if (candidates.length > 1) {
        gamePhase = "roulette";
        let winner = candidates[Math.floor(Math.random() * candidates.length)];
        io.emit("startRoulette", { candidates, winner });
        
        setTimeout(() => {
            startTurn(winner);
        }, 4000);
    }
}

io.on("connection", (socket)=>{

    socket.on("join", (username)=>{
        users[socket.id] = username;
        socket.username = username;
        socket.emit("gameState", { phase: gamePhase, customDuration, openDuration });
        broadcastUsers();
    });

    socket.on("setDurations", (data)=>{
        if(data.turnDuration && data.turnDuration > 0) customDuration = Math.min(data.turnDuration, 300);
        if(data.openDuration && data.openDuration > 0) openDuration = Math.min(data.openDuration, 60);
        io.emit("durationsUpdated", { customDuration, openDuration });
    });

    socket.on("startOpenPhase", ()=>{
        if(gamePhase !== "waiting") return;
        startOpenPhase(socket.username);
    });

    socket.on("pressButton", ()=>{
        if(!userPressCount[socket.username]){
            userPressCount[socket.username] = 0;
        }
        userPressCount[socket.username]++;
        broadcastPressCount();

        if(gamePhase === "open" || gamePhase === "turn"){
            if(!activeUser){
                if (!tieCandidates.includes(socket.username)) {
                    tieCandidates.push(socket.username);
                }
                if (!tieTimeout) {
                    tieTimeout = setTimeout(() => {
                        processTieBreaker();
                    }, 400); // Ventana de 400ms para atrapar empates
                }
            } else {
                waitingQueue.push({ id: socket.id, username: socket.username });
            }
        }
    });

    socket.on("selectOption", (data)=>{
        if(socket.username === activeUser){
            userAnswers[socket.username] = data.option;
            broadcastAnswers();
        }
    });

    socket.on("disconnect", ()=>{
        delete users[socket.id];
        waitingQueue = waitingQueue.filter(u => u.id !== socket.id);

        if(socket.username === activeUser){
            clearInterval(countdownInterval);
            countdownInterval = null;
            activeUser = null;

            if(waitingQueue.length > 0){
                const next = waitingQueue.shift();
                io.to(next.id).emit("autoPress");
            } else {
                gamePhase = "waiting";
                io.emit("turnEnded");
            }
        }
        broadcastUsers();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", ()=>{
    console.log("Servidor activo en puerto " + PORT);
});
