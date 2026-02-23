const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {};
let activeUser = null;
let waitingQueue = [];
let countdownInterval = null;
let remainingTime = 0;

function broadcastUsers(){
    io.emit("usersUpdate", Object.values(users));
}

function startTurn(username){

    activeUser = username;
    remainingTime = 15;

    io.emit("turnStarted", { user: activeUser, time: remainingTime });

    // contador sincronizado
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

io.on("connection", (socket) => {

    socket.on("join", (username)=>{
        users[socket.id] = username;
        socket.username = username;
        broadcastUsers();
    });

    socket.on("pressButton", ()=>{

        if(!activeUser){
            startTurn(socket.username);
        }
        else{
            waitingQueue.push({
                id:socket.id,
                username:socket.username
            });
        }
    });

    socket.on("disconnect", ()=>{

        delete users[socket.id];
        waitingQueue = waitingQueue.filter(u=>u.id!==socket.id);

        if(socket.username === activeUser){
            clearInterval(countdownInterval);
            activeUser = null;
            io.emit("turnEnded");
        }

        broadcastUsers();
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor iniciado en puerto " + PORT);
});
