const socket = io();

let username;
let locked = false;
let gamePhase = "waiting";

function enter(){
    username = document.getElementById("nameInput").value.trim();
    if(!username) return;
    document.getElementById("login").style.display = "none";
    document.getElementById("main").style.display = "block";
    socket.emit("join", username);
}

socket.on("gameState", (data)=>{
    gamePhase = data.phase;
    document.getElementById("turnDurationInput").value = data.customDuration;
    document.getElementById("openDurationInput").value = data.openDuration;
    updatePhaseUI();
});

socket.on("durationsUpdated", (data)=>{
    document.getElementById("turnDurationInput").value = data.customDuration;
    document.getElementById("openDurationInput").value = data.openDuration;
});

socket.on("usersUpdate", (users)=>{
    const container = document.getElementById("buttons");
    container.innerHTML = "";

    users.forEach(name => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.innerText = name;

        if(name === username){
            btn.classList.add("mine");
            btn.onclick = press;
        } else {
            btn.classList.add("disabled");
        }

        container.appendChild(btn);
    });

    updatePhaseUI();
});

function press(){
    if(locked) return;
    if(gamePhase !== "open" && gamePhase !== "turn") return;

    const myButton = [...document.getElementsByClassName("mine")][0];
    if(myButton) starExplosion(myButton);

    socket.emit("pressButton");
}

function updatePhaseUI(){
    const adminPanel = document.getElementById("adminPanel");
    const phaseMsg = document.getElementById("phaseMessage");
    const myBtn = [...document.getElementsByClassName("mine")][0];

    if(gamePhase === "waiting"){
        if(adminPanel) adminPanel.style.display = "flex";
        if(phaseMsg){
            phaseMsg.innerText = "Esperando para iniciar...";
            phaseMsg.style.display = "block";
        }
        locked = false;
        if(myBtn){ myBtn.classList.remove("btn-open"); myBtn.style.opacity="0.5"; myBtn.style.cursor="not-allowed"; }
    } else if(gamePhase === "open"){
        if(adminPanel) adminPanel.style.display = "none";
        if(phaseMsg){ phaseMsg.innerText = "¡PRESIONA AHORA!"; phaseMsg.style.display = "block"; }
        locked = false;
        if(myBtn){ myBtn.classList.add("btn-open"); myBtn.style.opacity="1"; myBtn.style.cursor="pointer"; }
    } else if(gamePhase === "turn"){
        if(adminPanel) adminPanel.style.display = "none";
        if(phaseMsg){ phaseMsg.style.display = "none"; }
        if(myBtn){ myBtn.classList.remove("btn-open"); }
    }
}

socket.on("openPhase", (data)=>{
    gamePhase = "open";
    document.getElementById("openTimer").style.display = "block";
    document.getElementById("openTimerVal").innerText = data.time;
    updatePhaseUI();
});

socket.on("openCountdown", (time)=>{
    document.getElementById("openTimerVal").innerText = time;
    if(time <= 3) document.getElementById("openTimerVal").style.color = "#ff4444";
    else document.getElementById("openTimerVal").style.color = "#00ff88";
});

socket.on("openEnded", ()=>{
    gamePhase = "waiting";
    document.getElementById("openTimer").style.display = "none";
    document.getElementById("openTimerVal").style.color = "#00ff88";
    updatePhaseUI();
});

socket.on("turnStarted", (data)=>{
    locked = true;
    gamePhase = "turn";
    document.getElementById("openTimer").style.display = "none";
    document.getElementById("speaker").innerText = data.user;

    const buttons = document.getElementsByClassName("btn");
    for(let b of buttons){
        if(b.innerText === data.user) b.classList.add("green");
    }
    updatePhaseUI();
});

socket.on("countdown", (time)=>{
    document.getElementById("timer").innerText = " " + time;
});

socket.on("turnEnded", ()=>{
    locked = false;
    gamePhase = "waiting";
    document.getElementById("speaker").innerText = "";
    document.getElementById("timer").innerText = "";

    const buttons = document.getElementsByClassName("btn");
    for(let b of buttons){
        b.classList.remove("green");
        b.classList.remove("btn-open");
    }
    updatePhaseUI();
});

socket.on("autoPress", ()=>{
    socket.emit("pressButton");
});

/* --- CONTROL ADMIN --- */
function saveDurations(){
    const turnDuration = parseInt(document.getElementById("turnDurationInput").value);
    const openDuration = parseInt(document.getElementById("openDurationInput").value);
    if(isNaN(turnDuration) || isNaN(openDuration) || turnDuration <= 0 || openDuration <= 0) return;
    socket.emit("setDurations", { turnDuration, openDuration });
    document.getElementById("savedMsg").style.opacity = "1";
    setTimeout(()=>{ document.getElementById("savedMsg").style.opacity = "0"; }, 1500);
}

function startOpen(){
    socket.emit("startOpenPhase");
}

/* --- ESTRELLAS --- */
function starExplosion(element){
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const centerY = rect.top + rect.height/2;

    for(let i = 0; i < 28; i++){
        const star = document.createElement("div");
        star.className = "star";

        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 140;

        star.style.left = centerX + "px";
        star.style.top = centerY + "px";
        star.style.setProperty("--x", Math.cos(angle)*distance + "px");
        star.style.setProperty("--y", Math.sin(angle)*distance + "px");

        document.body.appendChild(star);
        setTimeout(()=> star.remove(), 900);
    }
}
