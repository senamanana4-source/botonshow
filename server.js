const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// MUY IMPORTANTE PARA RAILWAY
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// servir la web
app.use(express.static(path.join(__dirname, "public")));

// ---- VARIABLES DEL JUEGO ----
let users = {};
let activeUser = null;
let waitingQueue = [];
let countdownInterval = null;
let remainingTime = 0;

// enviar lista usuarios
function broadcastUsers(){
    io.emit("usersUpdate", Object.values(users));
}

// iniciar turno
function startTurn(username){

    activeUser = username;
    remainingTime = 15;

    io.emit("turnStarted", { user: activeUser, time: remainingTime });

    countdownInterval = setInterval(()=>{

        remainingTime--;
        io.emit("countdown", remainingTime);

        if(remainingTime <= 0){

            clearInterval(countdownInterval);
            activeUser = null;

            io.emit("turnEnded");

            if(waitingQueue.length > 0){
                const next = waitingQueue.shift();
                io.to(next.id).emit("autoPress");
            }
        }

    },1000);
}

// ---- CONEXIONES ----
io.on("connection", (socket)=>{

    socket.on("join",(username)=>{
        users[socket.id]=username;
        socket.username=username;
        broadcastUsers();
    });

    socket.on("pressButton",()=>{

        if(!activeUser){
            startTurn(socket.username);
        }else{
            waitingQueue.push({
                id:socket.id,
                username:socket.username
            });
        }
    });

    socket.on("disconnect",()=>{
        delete users[socket.id];
        waitingQueue=waitingQueue.filter(u=>u.id!==socket.id);

        if(socket.username===activeUser){
            clearInterval(countdownInterval);
            activeUser=null;
            io.emit("turnEnded");
        }

        broadcastUsers();
    });
});

// ---------- PUERTO CORRECTO RAILWAY ----------
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", ()=>{
    console.log("Servidor activo en puerto "+PORT);
});
