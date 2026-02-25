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
let activeUser = null;
let waitingQueue = [];
let countdownInterval = null;
let remainingTime = 0;
let gamePhase = "waiting"; // "waiting" | "countdown" | "open" | "turn"
let openCountdown = 0;
let openCountdownInterval = null;
let customDuration = 15;
let openDuration = 10;

function broadcastUsers(){
    io.emit("usersUpdate", Object.values(users));
}

function startOpenPhase(){
    gamePhase = "open";
    openCountdown = openDuration;
    io.emit("openPhase", { time: openCountdown });

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

    io.emit("turnStarted", { user: activeUser, time: remainingTime });

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

io.on("connection", (socket)=>{

    socket.on("join", (username)=>{
        users[socket.id] = username;
        socket.username = username;
        socket.emit("gameState", { phase: gamePhase, customDuration, openDuration });
        broadcastUsers();
    });

    socket.on("setDurations", (data)=>{
        if(gamePhase !== "waiting") return;
        if(data.turnDuration && data.turnDuration > 0) customDuration = Math.min(data.turnDuration, 300);
        if(data.openDuration && data.openDuration > 0) openDuration = Math.min(data.openDuration, 60);
        io.emit("durationsUpdated", { customDuration, openDuration });
    });

    socket.on("startOpenPhase", ()=>{
        if(gamePhase !== "waiting") return;
        startOpenPhase();
    });

    socket.on("pressButton", ()=>{
        if(gamePhase === "open"){
            if(!activeUser){
                startTurn(socket.username);
            } else {
                waitingQueue.push({ id: socket.id, username: socket.username });
            }
        } else if(gamePhase === "turn"){
            if(!activeUser){
                startTurn(socket.username);
            } else {
                waitingQueue.push({ id: socket.id, username: socket.username });
            }
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
