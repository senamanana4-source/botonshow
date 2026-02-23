const socket = io();

let username;
let locked=false;

/* entrar */
function enter(){

    username=document.getElementById("nameInput").value.trim();
    if(!username) return;

    document.getElementById("login").style.display="none";
    document.getElementById("main").style.display="block";

    socket.emit("join",username);
}

/* actualizar usuarios */
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

/* presionar */
function press(){
    if(locked) return;

    const myButton=[...document.getElementsByClassName("mine")][0];
    if(myButton) starExplosion(myButton);

    socket.emit("pressButton");
}

/* turno inicia */
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

/* contador */
socket.on("countdown",(time)=>{
    document.getElementById("timer").innerText=" "+time;
});

/* turno termina */
socket.on("turnEnded",()=>{

    locked=false;
    document.getElementById("speaker").innerText="";
    document.getElementById("timer").innerText="";

    const buttons=document.getElementsByClassName("btn");
    for(let b of buttons){
        b.classList.remove("green");
    }
});

/* cola automática */
socket.on("autoPress",()=>{
    socket.emit("pressButton");
});

/* -------- EXPLOSION DE ESTRELLAS -------- */

function starExplosion(element){

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const centerY = rect.top + rect.height/2;

    for(let i=0;i<28;i++){

        const star=document.createElement("div");
        star.className="star";

        const angle=Math.random()*Math.PI*2;
        const distance=80+Math.random()*140;

        const x=Math.cos(angle)*distance+"px";
        const y=Math.sin(angle)*distance+"px";

        star.style.left=centerX+"px";
        star.style.top=centerY+"px";
        star.style.setProperty("--x",x);
        star.style.setProperty("--y",y);

        document.body.appendChild(star);

        setTimeout(()=>star.remove(),900);
    }
}
