const socket = io();

let username;
let locked = false;
let myButton = null;

function enter(){

    username = document.getElementById("nameInput").value;

    if(username.trim()=="") return;

    document.getElementById("login").style.display="none";
    document.getElementById("main").style.display="block";

    socket.emit("join", username);
}

// ----- ACTUALIZAR USUARIOS -----
socket.on("usersUpdate", (users)=>{

    const container = document.getElementById("buttons");
    container.innerHTML="";

    users.forEach(name=>{

        const btn = document.createElement("button");
        btn.className="btn";
        btn.innerText=name;

        if(name===username){

            btn.classList.add("mine");

            btn.onclick=()=>{
                if(locked) return;
                socket.emit("pressButton");
            };

            myButton=btn;
        }
        else{
            btn.classList.add("disabled");
        }

        container.appendChild(btn);
    });

});

// ----- EMPIEZA TURNO -----
socket.on("turnStarted",(data)=>{

    locked=true;

    document.getElementById("speaker").innerText=data.user;
    document.getElementById("timer").innerText=" 15";

    const buttons=document.getElementsByClassName("btn");

    for(let b of buttons){
        if(b.innerText===data.user){
            b.classList.add("green");
        }
    }
});

// ----- CUENTA REGRESIVA -----
socket.on("countdown",(time)=>{
    document.getElementById("timer").innerText=" "+time;
});

// ----- TERMINA TURNO -----
socket.on("turnEnded",()=>{

    locked=false;

    document.getElementById("speaker").innerText="";
    document.getElementById("timer").innerText="";

    const buttons=document.getElementsByClassName("btn");

    for(let b of buttons){
        b.classList.remove("green");
    }
});

// ----- COLA -----
socket.on("autoPress",()=>{
    socket.emit("pressButton");
});