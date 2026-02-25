// public/client.js
const socket = io();

let username;
let locked = false;
let gamePhase = "waiting";
let pressCount = {}; // Contadores de pulsaciones
let userAnswers = {}; // Respuestas seleccionadas (readable strings)
let roundStarter = null; // Quién inició la ronda
let selectedLetter = null; // selección local antes de confirmar

function enter(){
    username = document.getElementById("nameInput").value.trim();
    if(!username) return;
    document.getElementById("login").style.display = "none";
    document.getElementById("main").style.display = "block";
    socket.emit("join", username);
}

socket.on("gameState", (data)=>{
    gamePhase = data.phase;
    if(document.getElementById("turnDurationInput")) document.getElementById("turnDurationInput").value = data.customDuration;
    if(document.getElementById("openDurationInput")) document.getElementById("openDurationInput").value = data.openDuration;
    updatePhaseUI();
});

socket.on("usersUpdate", (users)=>{
    const container = document.getElementById("buttons");
    container.innerHTML = "";

    users.forEach(name => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.setAttribute("data-name", name); // Guardar nombre en atributo

        let btnHTML = `<div class="player-name">${name}</div>`;
        if(pressCount[name]){
            btnHTML += `<div class="press-count">${pressCount[name]}</div>`;
        }
        if(userAnswers[name]){
            btnHTML += `<div class="answer-display">${userAnswers[name]}</div>`;
        } else {
            btnHTML += `<div class="answer-display" style="display:none;"></div>`;
        }
        btn.innerHTML = btnHTML;

        if(name === username){
            btn.classList.add("mine");
            btn.onclick = press;
            // Desactivar activación por teclado (Enter, Espacio)
            btn.onkeydown = (e) => {
                if(e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    return false;
                }
            };
        } else {
            btn.classList.add("disabled");
        }

        container.appendChild(btn);
    });

    updatePhaseUI();
});

socket.on("pressCountUpdate", (counts)=>{
    pressCount = counts || {};
    updateButtonsDisplay();
});

socket.on("answersUpdate", (answers)=>{
    // Normalizar: si vienen como objetos {option, truth} convertir a string
    userAnswers = answers || {};
    for(const p in userAnswers){
        const v = userAnswers[p];
        if(typeof v === 'object' && v.option){
            userAnswers[p] = v.truth ? `${v.option} - ${v.truth === 'V' ? 'Verdadero' : 'Falso'}` : `${v.option}`;
        }
    }
    updateAnswersDisplay();
});

function updateButtonsDisplay(){
    const buttons = document.getElementsByClassName("btn");
    for(let btn of buttons){
        const playerName = btn.getAttribute("data-name");
        let btnHTML = `<div class="player-name">${playerName}</div>`;

        if(pressCount[playerName]){
            btnHTML += `<div class="press-count">${pressCount[playerName]}</div>`;
        }

        if(userAnswers[playerName]){
            btnHTML += `<div class="answer-display">${userAnswers[playerName]}</div>`;
        } else {
            btnHTML += `<div class="answer-display" style="display:none;"></div>`;
        }

        btn.innerHTML = btnHTML;
    }
}

function updateAnswersDisplay(){
    const buttons = document.getElementsByClassName("btn");
    for(let btn of buttons){
        const playerName = btn.getAttribute("data-name");
        const answerSpan = btn.querySelector(".answer-display");

        if(answerSpan){
            if(userAnswers[playerName]){
                answerSpan.innerText = userAnswers[playerName];
                answerSpan.style.display = "block";
            } else {
                answerSpan.style.display = "none";
            }
        }
    }
}

socket.on("openPhase", (data)=>{
    gamePhase = "open";
    roundStarter = data.starter;
    pressCount = {}; // Resetear contadores
    userAnswers = {}; // Resetear respuestas
    document.getElementById("openTimer").style.display = "block";
    document.getElementById("openTimerVal").innerText = data.time;

    // Mostrar starterDisplay por 5 segundos
    const starterDisplay = document.getElementById("starterDisplay");
    if(starterDisplay && roundStarter){
        starterDisplay.innerText = `🎬 ${roundStarter}`;
        starterDisplay.style.display = "block";
        setTimeout(() => {
            if(gamePhase === "open") starterDisplay.style.display = "none";
        }, 5000);
    }

    updatePhaseUI();
    updateButtonsDisplay();
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
        if(b.getAttribute("data-name") === data.user) b.classList.add("green");
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
    hideOptions();
});

socket.on("showOptions", (data)=>{
    // Mostrar opciones si eres el jugador activo
    if(username === data.player){
        showOptions();
    }
});

socket.on("autoPress", ()=>{
    socket.emit("pressButton");
});

function press(){
    if(locked) return;
    if(gamePhase !== "open" && gamePhase !== "turn" && gamePhase !== "waiting") return;

    const myButton = [...document.getElementsByClassName("mine")][0];
    if(myButton) starExplosion(myButton);

    socket.emit("pressButton");
}

function showOptions(){
    const optionsContainer = document.getElementById("optionsContainer");
    if(optionsContainer) {
        // reset visual selection
        selectedLetter = null;
        ['opt-A','opt-B','opt-C','opt-D','tf-V','tf-F'].forEach(id=>{
            const el = document.getElementById(id);
            if(el) {
                el.classList.remove('selected');
            }
        });
        optionsContainer.style.display = "flex";
    }
}

function hideOptions(){
    const optionsContainer = document.getElementById("optionsContainer");
    if(optionsContainer) optionsContainer.style.display = "none";
}

function selectLetter(letter){
    selectedLetter = letter;
    ['opt-A','opt-B','opt-C','opt-D'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.classList.toggle('selected', id === `opt-${letter}`);
    });
}

function selectTruth(truth){
    // truth: 'V' o 'F'
    if(!selectedLetter){
        // opcional: mostrar aviso
        return;
    }

    ['tf-V','tf-F'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.classList.toggle('selected', id === (truth === 'V' ? 'tf-V' : 'tf-F'));
    });

    socket.emit("selectOption", { option: selectedLetter, truth: truth });
    hideOptions();
}

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

function updatePhaseUI(){
    const adminPanel = document.getElementById("adminPanel");
    const phaseMsg = document.getElementById("phaseMessage");
    const myBtn = [...document.getElementsByClassName("mine")][0];
    const starterDisplay = document.getElementById("starterDisplay");

    if(gamePhase === "waiting"){
        if(adminPanel) adminPanel.style.display = "flex";
        if(starterDisplay) starterDisplay.style.display = "none";
        if(phaseMsg){
            phaseMsg.innerText = "Esperando para iniciar...";
            phaseMsg.style.display = "block";
        }
        locked = false;
        if(myBtn){ myBtn.classList.remove("btn-open"); myBtn.style.opacity="0.5"; myBtn.style.cursor="not-allowed"; }
        hideOptions();
    } else if(gamePhase === "open"){
        if(adminPanel) adminPanel.style.display = "none";
        if(starterDisplay && roundStarter){
            starterDisplay.innerText = `🎬 ${roundStarter}`;
            starterDisplay.style.display = "block";
        }
        if(phaseMsg){ phaseMsg.innerText = "¡PRESIONA AHORA!"; phaseMsg.style.display = "block"; }
        locked = false;
        if(myBtn){ myBtn.classList.add("btn-open"); myBtn.style.opacity="1"; myBtn.style.cursor="pointer"; }
        hideOptions();
    } else if(gamePhase === "turn"){
        if(adminPanel) adminPanel.style.display = "none";
        if(starterDisplay) starterDisplay.style.display = "none";
        if(phaseMsg){ phaseMsg.style.display = "none"; }
        if(myBtn){ myBtn.classList.remove("btn-open"); }
    }
}
