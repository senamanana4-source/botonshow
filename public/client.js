const socket = io();

let username;
let locked=false;

// entrar
function enter(){

    username=document.getElementById("nameInput").value.trim();
    if(!username) return;

    document.getElementById("login").style.display="none";
    document.getElementById("main").style.display="block";

    socket.emit("join",username);
}

// actualizar usuarios
socket.on("usersUpdate",(users)=>{

    const container=document.getElementById("buttons");
    container.innerHTML="";

    users.forEach(name=>{

        const btn=document.createElement("button");
        btn.className="btn";
        btn.innerText=name;

        if(name===username){
            btn.classList.add("mine");
            btn.onclick=press;
        }else{
            btn.classList.add("disabled");
        }

        container.appendChild(btn);
    });
});

// presionar
function press(){
    if(locked) return;
    socket.emit("pressButton");
}

// turno inicia
socket.on("turnStarted",(data)=>{

    locked=true;

    document.getElementById("speaker").innerText=data.user;

    const buttons=document.getElementsByClassName("btn");
    for(let b of buttons){
        if(b.innerText===data.user){
            b.classList.add("green");
        }
    }
});

// contador
socket.on("countdown",(time)=>{
    document.getElementById("timer").innerText=" "+time;
});

// turno termina
socket.on("turnEnded",()=>{

    locked=false;
    document.getElementById("speaker").innerText="";
    document.getElementById("timer").innerText="";

    const buttons=document.getElementsByClassName("btn");
    for(let b of buttons){
        b.classList.remove("green");
    }
});

// cola
socket.on("autoPress",()=>{
    socket.emit("pressButton");
});
