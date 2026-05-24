let programData;
let masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]");
let workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
let activeDraft = JSON.parse(localStorage.getItem("activeWorkoutDraft") || "null");
let calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}");
let currentViewDate = new Date();
let currentExerciseCategory = "Ben";

// Timer-variablerrf
let timerInterval = null;
let secondsElapsed = 0;
let isTimerRunning = false;

// --- INIT ---
// ÄNDRING: Initieringslogiken använder nu Supabase som primär datakälla (om tillgänglig via supabase-data.js),
// men faller sömlöst tillbaka på program.json och localStorage precis som förut för att säkra stabilitet.
fetch("program.json")
.then(r => r.json())
.then(async json => {
    const savedProgram = JSON.parse(localStorage.getItem("myCustomProgram"));
    
    if (masterExercises.length === 0) {
        json.routine.forEach(p => {
            p.exercises.forEach(ex => {
                if (!masterExercises.find(m => m.name === ex.name)) {
                    let animFile = "";
                    if (ex.name === "Deadlift") animFile = "Gemini_Generated_Image_sqtn3ksqtn3ksqtn.mp4";
                    if (ex.name === "Barbell Bench Press") animFile = "Skärmbild 2026-05-11 124104.mp4";
                    
                    masterExercises.push({ 
                        ...ex, 
                        id: Date.now() + Math.random(),
                        animation: animFile 
                    });
                }
            });
        });
        localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
    } else {
        masterExercises.forEach(ex => {
            if (ex.name === "Deadlift") ex.animation = "Gemini_Generated_Image_sqtn3ksqtn3ksqtn.mp4";
            if (ex.name === "Barbell Bench Press") ex.animation = "Skärmbild 2026-05-11 124104.mp4";
        });
    }
    
    programData = savedProgram || json;

    // Om användaren är inloggad i Supabase kommer dessa lokala variabler att 
    // skrivas över med färsk molndata direkt efter autentiseringen (via loadUserData).
    if(activeDraft && activeDraft.isStarted) {
        secondsElapsed = activeDraft.secondsElapsed || 0;
        if(activeDraft.wasTimerRunning) {
            startTimer();
        } else {
            updateTimerDisplay();
        }
    }

    renderHome();
});

function saveAll() {
    localStorage.setItem("myCustomProgram", JSON.stringify(programData));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
    
    // Supabase-synk: Båda ligger kvar och sköter sitt i bakgrunden,
    // men eftersom vi städat upp raderingen kommer de inte längre att krocka!
    if (typeof saveCustomProgram === 'function') saveCustomProgram();
    if (typeof saveCalendarOverrides === 'function') saveCalendarOverrides();
}

function showView(id) {
    const target = document.getElementById(id);
    if(!target) return;
    
    if (target.classList.contains("hidden")) {
        document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
        target.classList.remove("hidden");
        target.style.animation = 'none';
        target.offsetHeight; 
        target.style.animation = null;
    }
    window.scrollTo(0, 0);
}

function closeModal() {
    document.getElementById("workout-modal").classList.add("hidden");
    const video = document.querySelector("#modal-body video");
    if(video) video.pause();
    
    // SÄKERHETSÅTGÄRD: Se till att den fasta stäng-knappen ALLTID visas igen
    if (typeof hideDefaultCloseButton === 'function') {
        hideDefaultCloseButton(false);
    }

    // HÄR ÅTERSTÄLLER VI DIN DRAFT
    if (typeof restoreDraftState === 'function') {
        restoreDraftState();
    }
}

function openModal() {
    const modal = document.getElementById("workout-modal");
    if (modal) modal.classList.remove("hidden");

    // Samma logik här för att garantera toppen vid öppning
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) modalContent.scrollTop = 0;
    }, 20);
}

// --- TIMER LOGIK ---
function updateTimerDisplay() {
    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    document.getElementById("workout-timer").textContent = `${hrs}:${mins}:${secs}`;
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    if(activeDraft) activeDraft.wasTimerRunning = true;
    document.getElementById("timer-toggle-btn").textContent = "Pausa ⏸️";
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
        if(activeDraft) {
            activeDraft.secondsElapsed = secondsElapsed;
            if (typeof persistActiveWorkout === 'function') persistActiveWorkout();
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    if(activeDraft) activeDraft.wasTimerRunning = false;
    clearInterval(timerInterval);
    document.getElementById("timer-toggle-btn").textContent = "Fortsätt ▶️";
    if(activeDraft && typeof persistActiveWorkout === 'function') persistActiveWorkout();
}

document.getElementById("timer-toggle-btn").onclick = () => {
    if (isTimerRunning) pauseTimer();
    else startTimer();
};

// --- ÖVNINGAR & INSTÄLLNINGAR ---
function openCreateExerciseModal(callback = null) {
    const body = document.getElementById("modal-body");
    
    let selectedCategory = currentExerciseCategory || "Ben"; 

    const categories = [
        { id: "Ben", icon: "🦵" },
        { id: "Bröst", icon: "🏋️" },
        { id: "Rygg", icon: "🪵" },
        { id: "Axlar", icon: "👐" },
        { id: "Armar", icon: "💪" },
        { id: "Bål", icon: "🧘" }
    ];

    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom: 20px;">Skapa Ny Övning</h3>
        
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <div style="width: 100%; max-width: 300px;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 8px; text-align: center;">Namn på övning</label>
                <input type="text" id="new-ex-name" class="log-input" placeholder="T.ex. Knäböj" style="text-align: center;">
            </div>

            <div style="width: 100%;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 12px; text-align: center;">Välj Kategori</label>
                
                <div id="category-selector-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 10px;">
                    ${categories.map(cat => `
                        <div class="cat-select-item ${cat.id === selectedCategory ? 'active' : ''}" 
                             onclick="window.selectModalCategory('${cat.id}')"
                             id="modal-cat-${cat.id}"
                             style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                            <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div>
                            <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${cat.id}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <button class="mode-btn blue" id="save-new-ex-btn" style="width: 100%; max-width: 300px; margin-top: 10px;">Spara Övning</button>
        </div>

        <style>
            .cat-select-item.active {
                background: rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
            }
            .cat-select-item.active div {
                color: var(--text) !important;
            }
        </style>
    `;

    window.selectModalCategory = (catId) => {
        selectedCategory = catId;
        document.querySelectorAll('.cat-select-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`modal-cat-${catId}`).classList.add('active');
    };

    document.getElementById("save-new-ex-btn").onclick = async () => {
        const name = document.getElementById("new-ex-name").value.trim();
        if(!name) return alert("Ange ett namn!");
        
        // FIX: Om man väljer "Armar", sätter vi target till "Biceps" (eller behåller "Armar" om du ändrar ditt filter)
        // Detta matchar ditt filter: (ex.target === "Biceps" || ex.target === "Triceps")
        let finalTarget = selectedCategory;
        if (selectedCategory === "Armar") {
            finalTarget = "Biceps"; 
        }
        
        const newEx = { 
            id: Date.now(), 
            name, 
            target: finalTarget, 
            defaultSets: 3, 
            animation: "" 
        };
        
        // Peta in i den globala arrayen
        masterExercises.push(newEx);
        
        // Sparar lokalt i localStorage
        if (typeof saveAll === 'function') saveAll();
        
        // Skicka till Supabase direkt
        if (typeof saveCustomProgram === 'function') {
            await saveCustomProgram();
        }
        
        if(callback) {
            callback(newEx);
        } else { 
            closeModal(); 
            
            // Tvinga gränssnittet att hoppa till rätt kategori och rita ut listan på nytt
            if (typeof filterExercises === 'function') {
                filterExercises(selectedCategory); 
            }
        }
    };
    
    openModal();
}

function filterExercises(category) {
    currentExerciseCategory = category;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === category));
    const results = document.getElementById("exercise-results");
    if (!results) return;
    results.innerHTML = "";
    const filtered = masterExercises.filter(ex => category === "Armar" ? (ex.target === "Biceps" || ex.target === "Triceps") : ex.target === category);
    filtered.forEach(ex => {
        const div = document.createElement("div");
        div.className = "card glass";
        div.style.cssText = "padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; cursor:pointer;";
        
        div.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON') {
                showExerciseAnimation(ex.id);
            }
        };

        div.innerHTML = `<div><strong style="font-size:16px;">${ex.name}</strong><br><small style="color:var(--primary); font-weight:800; text-transform:uppercase; font-size:10px;">${ex.target}</small></div>
        <button style="background:none; border:none; font-size:18px; cursor:pointer;" onclick="openEditExerciseModal(${ex.id})"> ⚙️ </button>`;
        results.appendChild(div);
    });
}

function showExerciseAnimation(id) {
    const ex = masterExercises.find(e => e.id == id);
    if(!ex) return;
    
    const body = document.getElementById("modal-body");
    let videoHtml = "";
    
    if(ex.animation) {
        videoHtml = `
            <div style="border-radius:16px; overflow:hidden; background:#000; margin-bottom:15px; border:1px solid var(--glass-border);">
                <video src="${ex.animation}" autoplay loop muted playsinline style="width:100%; display:block;"></video>
            </div>
        `;
    } else {
        videoHtml = `
            <div style="padding:40px 20px; text-align:center; background:rgba(255,255,255,0.05); border-radius:16px; margin-bottom:15px; color:var(--text-light); font-size:14px;">
                Ingen videoanimation tillgänglig för denna övning. 🎥
            </div>
        `;
    }

    body.innerHTML = `
        <h3>${ex.name}</h3>
        ${videoHtml}
        <div style="text-align:left; color:var(--text-light); font-size:14px; padding:10px;">
            <p><strong>Muskelgrupp:</strong> ${ex.target}</p>
        </div>
    `;
    openModal();
}

function openEditExerciseModal(id) {
    const ex = masterExercises.find(e => e.id == id);
    if(!ex) return;
    const body = document.getElementById("modal-body");
    
    let selectedCategory = ex.target; 

    const categories = [
        { id: "Ben", icon: "🦵" },
        { id: "Bröst", icon: "🏋️" },
        { id: "Rygg", icon: "🪵" },
        { id: "Axlar", icon: "👐" },
        { id: "Armar", icon: "💪" },
        { id: "Bål", icon: "🧘" }
    ];

    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom: 20px;">Redigera Övning</h3>
        
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            
            <div style="width: 100%; max-width: 300px; margin-bottom: 10px;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 8px; text-align: center;">Namn på övning</label>
                <input type="text" id="edit-ex-name" class="log-input" value="${ex.name}" style="text-align: center;">
            </div>

            <div style="width: 100%;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 12px; text-align: center;">Välj Kategori</label>
                
                <div id="edit-category-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 10px;">
                    ${categories.map(cat => `
                        <div class="cat-select-item ${cat.id === selectedCategory ? 'active' : ''}" 
                             onclick="window.selectEditModalCategory('${cat.id}')"
                             id="edit-modal-cat-${cat.id}"
                             style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                            <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div>
                            <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${cat.id}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <button class="mode-btn blue" style="width: 100%; max-width: 300px; margin-top: 15px;" id="update-exercise-confirm-btn">Uppdatera</button>
            <button class="mode-btn" style="color:var(--danger); background:none; font-size:13px; margin-top: 15px; padding: 5px;" onclick="deleteMasterExercise(${id})">Radera övning permanent</button>
        </div>

        <style>
            .cat-select-item.active {
                background: rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
            }
            .cat-select-item.active div {
                color: var(--text) !important;
            }
        </style>
    `;

    window.selectEditModalCategory = (catId) => {
        selectedCategory = catId;
        document.querySelectorAll('#edit-category-grid .cat-select-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`edit-modal-cat-${catId}`).classList.add('active');
    };

    document.getElementById("update-exercise-confirm-btn").onclick = async () => {
        const nameInput = document.getElementById("edit-ex-name").value.trim();
        if(!nameInput) return alert("Namnet får inte vara tomt!");
        
        const exIndex = masterExercises.findIndex(e => e.id == id);
        if(exIndex !== -1) {
            // AUTOMATISERING: Spara det gamla namnet innan det skrivs över, och uppdatera historiken
            const oldName = masterExercises[exIndex].name;
            if (typeof updateExerciseNameInHistory === 'function') {
                updateExerciseNameInHistory(oldName, nameInput);
            }

            // Din befintliga sparlogik
            masterExercises[exIndex].name = nameInput;
            masterExercises[exIndex].target = selectedCategory; 
            saveAll();
            
            // SKOTTSÄKRING: Synka den redigerade övningen till Supabase direkt!
            if (typeof saveCustomProgram === 'function') {
                await saveCustomProgram();
            }
            
            closeModal();
            filterExercises(currentExerciseCategory);
        }
    };

    openModal();
}

function updateExercise(id) {
    const ex = masterExercises.find(e => e.id == id);
    if(!ex) return;
    ex.name = document.getElementById("edit-ex-name").value;
    ex.target = document.getElementById("edit-ex-cat").value;
    ex.animation = document.getElementById("edit-ex-anim").value;
    saveAll(); closeModal(); filterExercises(currentExerciseCategory);
}


// --- KALENDER ---
function renderCalendar(isFromStartBtn = false) {
    const grid = document.getElementById("calendar-grid");
    const label = document.getElementById("month-label");
    const infoBox = document.getElementById("calendar-info-box");
    
    if(!grid || !label || !infoBox) return;
    grid.innerHTML = "";
    infoBox.innerHTML = ""; 
    
    if(isFromStartBtn === true) {
        infoBox.innerHTML = `<div style="background:rgba(34, 211, 238, 0.1); padding:12px; border-radius:12px; margin-bottom:15px; font-size:13px; text-align:center; color:var(--primary); border:1px solid var(--primary);">
            Välj vilken dag du vill starta eller schemalägga ett pass i kalendern nedan 📅
        </div>`;
    }

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const monthText = currentViewDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' });
    label.textContent = monthText.charAt(0).toUpperCase() + monthText.slice(1);
    
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Hämta dagens faktiska datum för att matcha mot loopen
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < offset; i++) grid.innerHTML += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = document.createElement("div");
        cell.className = "calendar-cell";
        
        // NYTT: Kontrollera om denna ruta är dagens datum – lägg i så fall till klassen "today"
        if (dateStr === todayStr) {
            cell.classList.add("today");
        }

        const hasWorkouts = workoutHistory.filter(w => w.date === dateStr);
        const isOngoing = activeDraft && activeDraft.date === dateStr && activeDraft.isStarted;
        const dayOfWeek = new Date(year, month, d).getDay();
        const isAutoDay = [1, 3, 5].includes(dayOfWeek);
        const override = calendarOverrides[dateStr];
        let displayPass = null;
        if (override && override !== "none") displayPass = programData.routine.find(p => p.id === override);
        else if (isAutoDay && override !== "none" && programData && programData.routine.length > 0) displayPass = programData.routine[d % programData.routine.length];
        
        let info = "";
        if (hasWorkouts.length > 0) { cell.classList.add("cell-completed"); info = "✓"; }
        else if (isOngoing && displayPass) { cell.classList.add("cell-ongoing"); info = displayPass.name.split(" ").pop(); }
        else if (displayPass) { cell.classList.add("cell-planned"); info = displayPass.name.split(" ").pop(); }
        
        // Punkt 3: Ändrad struktur för info-ikon för bättre centrering
        cell.innerHTML = `<span>${d}</span><div class="cell-info">${info}</div>`;
        cell.onclick = () => {
            if (typeof openDayManager === 'function') openDayManager(dateStr, displayPass, hasWorkouts, isOngoing);
        };
        grid.appendChild(cell);
    }
    showView("calendar-view");
}

// NY FUNKTION: Öppnar en renodlad popup-ruta med övningarna (Likt showProgramDetails fast som modal)
function openProgramPreviewModal(idx) {
    if(!programData || !programData.routine[idx]) return;
    const pass = programData.routine[idx];
    
    // Skapa ett temporärt modalelement om det inte redan finns
    let previewModal = document.getElementById("preview-modal");
    if (!previewModal) {
        previewModal = document.createElement("div");
        previewModal.id = "preview-modal";
        previewModal.style.position = "fixed";
        previewModal.style.top = "0";
        previewModal.style.left = "0";
        previewModal.style.width = "100vw";
        previewModal.style.height = "100vh";
        previewModal.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
        previewModal.style.backdropFilter = "blur(8px)";
        previewModal.style.display = "flex";
        previewModal.style.justifyContent = "center";
        previewModal.style.alignItems = "center";
        previewModal.style.zIndex = "10000"; // Se till att den hamnar överst av allt
        document.body.appendChild(previewModal);
    }

    // Generera innehållet till popupen
    previewModal.innerHTML = `
        <div class="card glass" style="width: 90%; max-width: 400px; padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.95); animation: modalFadeIn 0.2s ease-out;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <h3 style="margin: 0; font-size: 20px; color: #fff;">${pass.name}</h3>
                <button onclick="document.getElementById('preview-modal').style.display='none'" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-light); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✖</button>
            </div>
            
            <div style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
                ${pass.exercises.map(e => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <span style="font-weight: 600; color: #ffffff; font-size: 14px;">${e.name}</span>
                        <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px; background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px;">${e.target || 'Övning'}</small>
                    </div>
                `).join("")}
            </div>
            
            <button onclick="document.getElementById('preview-modal').style.display='none'" style="width: 100%; margin-top: 20px; padding: 12px; background: var(--primary); color: #0f172a; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Stäng översikt
            </button>
        </div>
    `;

    // Visa modalen
    previewModal.style.display = "flex";
}

// GLOBALA VARIABLER FÖR LÅNGTRYCK OCH SCROLL-ACCURACY
let pressTimer;
let touchTimeout = null;
let isLongPress = false;
let touchStartY = 0;
let hasScrolled = false;

function startPress(idx, event) {
    // 1. SÄKERHETSKONTROLL: Endast för knappar med rätt klass
    if (!event.target.classList.contains('plan-override-btn')) return;

    isLongPress = false;
    hasScrolled = false;
    
    // Spara startposition för att upptäcka scroll
    if (event.touches) {
        touchStartY = event.touches[0].clientY;
    }

    // 2. Starta båda timers (pressTimer för övningar, touchTimeout för preview)
    pressTimer = setTimeout(() => {
        isLongPress = true;
        if (typeof showExercisesForWorkout === 'function') showExercisesForWorkout(idx); 
    }, 500);

    touchTimeout = setTimeout(() => {
        isLongPress = true;
        openProgramPreviewModal(idx);
    }, 500);
}

function cancelPress() {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
}

// ==========================================================================
// DEL 2 AV 4: TOUCH-HANTERING, DAGSHANTERING (MODAL) OCH PROGRAMREDIGERING
// ==========================================================================

function handleTouchMove(event) {
    if (event && event.touches && event.touches[0] && touchStartY > 0) {
        const currentY = event.touches[0].clientY;
        const moveDistance = Math.abs(currentY - touchStartY);
        
        // Om användaren flyttar fingret mer än 6 pixlar, markera som scrollat och avbryt långtryck/klick
        if (moveDistance > 6) { 
            hasScrolled = true;
            cancelPress();
        }
    }
}
 
async function handleTouchEnd(idx, dateStr, programId, event) {
    cancelPress();
    
    // Om användaren har scrollat eller om det var ett långtryck: avbryt klick-aktivering
    if (hasScrolled || isLongPress) {
        if (event) {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
        }
        return false;
    }
    
    // Stoppa eventuella virtuella klick för säkerhets skull på touch-enheter
    if (event && event.cancelable) {
        event.preventDefault();
    }
    
    // Detta var ett rent, snabbt klick utan scroll eller långtryck – utför schemaändringen!
    await setOverrideSilent(dateStr, programId);
}
 
// FUNKTION: Öppnar en renodlad popup-ruta med övningarna (Med mjuk animation vid långtryck)
function openProgramPreviewModal(idx) {
    const pass = programData.routine[idx];
    if (!pass) return;
    
    let previewModal = document.getElementById("preview-modal");
    if (!previewModal) {
        previewModal = document.createElement("div");
        previewModal.id = "preview-modal";
        previewModal.style.position = "fixed";
        previewModal.style.top = "0";
        previewModal.style.left = "0";
        previewModal.style.width = "100vw";
        previewModal.style.height = "100vh";
        previewModal.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
        previewModal.style.backdropFilter = "blur(8px)";
        previewModal.style.display = "flex";
        previewModal.style.justifyContent = "center";
        previewModal.style.alignItems = "flex-start"; 
        previewModal.style.zIndex = "10000"; 
        
        previewModal.style.transition = "opacity 0.2s ease-out";
        document.body.appendChild(previewModal);
    }
 
    previewModal.style.opacity = "0";
    previewModal.style.display = "flex";
 
    previewModal.innerHTML = `
        <div id="preview-modal-card" class="card glass" style="width: 90%; max-width: 400px; padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.95); margin-top: 40px; 
           transition: all 0.2s ease-out; transform: scale(0.95); opacity: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <h3 style="margin: 0; font-size: 20px; color: #fff;">${pass.name}</h3>
                <button onclick="closePreviewModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-light); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✖</button>
            </div>
            
            <div style="max-height: 65vh; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
                ${pass.exercises.map(e => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <span style="font-weight: 600; color: #ffffff; font-size: 14px;">${e.name}</span>
                        <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px; background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px;">${e.target || 'Övning'}</small>
                    </div>
                `).join("")}
            </div>
            
            <button onclick="closePreviewModal()" style="width: 100%; margin-top: 20px; padding: 12px; background: var(--primary); color: #0f172a; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Stäng översikt
            </button>
        </div>
    `;
 
    setTimeout(() => {
        previewModal.style.opacity = "1";
        const card = document.getElementById("preview-modal-card");
        if (card) {
            card.style.opacity = "1";
            card.style.transform = "scale(1)";
        }
    }, 10);
}
 
function closePreviewModal() {
    const previewModal = document.getElementById("preview-modal");
    const card = document.getElementById("preview-modal-card");
    
    if (card && previewModal) {
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        previewModal.style.opacity = "0";
        
        setTimeout(() => {
            previewModal.style.display = "none";
        }, 200);
    }
}

// HUVUDFUNKTIONEN FOR DAGSPLANERING OCH HISTORIKUTLÄSNING
function openDayManager(dateStr, planned, completed, isOngoing) {
    if (typeof hideDefaultCloseButton === 'function') {
        hideDefaultCloseButton(false);
    }
 
    const body = document.getElementById("modal-body");
    
    if (body) {
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.justifyContent = "flex-start"; 
        body.style.alignItems = "stretch";
        body.style.gap = "20px"; 
    }
    
    let html = `
        <div style="text-align: center; margin: 0 !important; padding: 0 !important;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-light); font-weight: 600; display: block; margin: 0 !important; padding: 0 !important;">Valt datum</span>
            <h2 class="section-title modern-header" style="margin: 8px 0 0 0 !important; padding: 0 !important; display: inline-block; font-size: 26px; line-height: 1.1 !important;">
                ${dateStr}
            </h2>
        </div>
    `;
    
    // 1. Slutförda pass på detta datum (Hämtas från det synkroniserade workoutHistory-objektet)
    if (completed && completed.length > 0) {
        completed.forEach((w, idx) => {
            const timeStr = w.totalTime ? `⏱️ ${w.totalTime}` : "";
            html += `
            <div class="card glass" style="border-left: 4px solid #22c55e; text-align: left; margin: 0; padding: 15px; border-radius: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <strong style="font-size: 16px; color: var(--text); display: block;">${w.programName}</strong>
                        <span style="font-size: 11px; color: var(--text-light); font-weight: 500;">${timeStr || 'Slutfört pass ✅'}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="editLoggedWorkout('${dateStr}', ${idx})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--primary); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✏️</button>
                        <button onclick="openConfirmDeleteModal('${dateStr}', ${idx})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--danger); cursor: pointer; font-size: 12px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✖</button>
                    </div>
                </div>
                
                <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px;">`;
            
            w.exercises.forEach(ex => {
                html += `
                <div style="font-size: 13px;">
                    <span style="color: var(--text); font-weight: 600; display: block; margin-bottom: 8px;">${ex.name}</span>
                    <div style="display: flex; flex-direction: column; gap: 6px;">`;
                
                if(ex.sets_data) {
                    ex.sets_data.forEach((s, sIdx) => {
                        const wVal = s.weight || 0;
                        const rVal = s.reps || 0;
                        html += `
                        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid var(--primary); padding: 6px 12px; border-radius: 8px; width: fit-content; display: flex; align-items: center; gap: 8px;">
                            <span style="color: var(--primary); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Set ${sIdx+1}</span> 
                            <span style="color: #ffffff; font-size: 13px; font-weight: 600;">${wVal} <small style="color: var(--primary); font-weight:400;">kg</small></span> 
                            <span style="color: var(--primary); opacity: 0.4;">×</span> 
                            <span style="color: #ffffff; font-size: 13px; font-weight: 600;">${rVal} <small style="color: var(--primary); font-weight:400;">reps</small></span>
                        </div>`;
                    });
                } else {
                    const wVal = ex.weight || 0;
                    const rVal = ex.reps || 0;
                    html += `
                    <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid var(--primary); color: #ffffff; font-size: 12px; padding: 6px 12px; border-radius: 8px; font-weight: 600; width: fit-content;">
                        ${ex.sets} set <span style="color: var(--primary);">×</span> ${wVal}kg <span style="color: var(--primary);">×</span> ${rVal}reps
                    </div>`;
                }
                html += `</div></div>`;
            });
            html += `</div></div>`;
        });
    } 
    // 2. Pågående aktivt utkast (activeDraft)
    else if (isOngoing) {
        html += `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; width: 100%; margin-top: 16px;">
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            <span class="status-box-title" style="font-size: 12px !important; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; margin: 0 !important; white-space: nowrap;">Status</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>
        
        <div class="modern-status-card day-manager-status-box" style="padding: 15px 15px 30px 15px !important; align-items: stretch !important; margin-top: 0 !important;">
            <div class="status-aura" style="background: rgba(245, 158, 11, 0.35);"></div>
            
            <div style="margin: 0 0 15px 0; width: 100%; text-align: center !important;">
                <span class="status-highlight-text" style="color: #f59e0b !important; text-shadow: 0 0 25px rgba(245, 158, 11, 0.8) !important; font-size: 20px; font-weight: 800;">🔥 Pågående Pass</span>
            </div>
            <button class="premium-green-btn" onclick="closeModal(); startWorkout(activeDraft.workout, activeDraft.data, activeDraft.date)" style="border: 2px solid #f59e0b !important; background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%) !important; width: 100% !important;">
                Fortsätt träningen ⏱️
            </button>
        </div>`;
    }
    // 3. Planerad träning eller vila för dagen
    else {
        html += `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; width: 100%; margin-top: 16px;">
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            <span class="status-box-title" style="font-size: 12px !important; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; margin: 0 !important; white-space: nowrap;">Status</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>
        
        <div class="modern-status-card day-manager-status-box" style="padding: 30px 15px 30px 15px !important; align-items: stretch !important; margin-top: -10px !important;">
            
            <p id="current-planned-label" class="status-box-text" style="margin: 0 0 8px 0 !important; text-align: center !important; font-size: 16px; font-weight: 600; padding: 0 !important; line-height: 1.2 !important;">
                ${planned ? `📋 <span class="status-highlight-text">${planned.name}</span>` : '🧘 Planerad Vila'}
            </p>
        
            <div id="day-manager-action-btn-container" class="status-btn-container" style="width: 100% !important; display: flex; flex-direction: column; gap: 10px; margin-top: 5px;">`;
            
            if(planned) {
                html += `
                <button class="mode-btn premium-action-btn premium-green-btn" onclick="prepareStart('${dateStr}', '${planned.id}')" style="width: 100% !important; margin: 0 !important; padding: 12px !important;">
                    Starta Träning 🔥
                </button>`;
            }
            
        html += `
            </div>
            
           <button class="mode-btn premium-action-btn premium-free-btn" 
                onclick="closeModal(); startFreeWorkoutOnDate('${dateStr}')" 
                style="width: 100% !important; margin: 10px 0 0 0 !important; padding: 10px !important; touch-action: manipulation; -webkit-tap-highlight-color: transparent; cursor: pointer;">
                ➕ Starta Fritt Pass
           </button>
        </div>`;

        // ÄNDRA PLANERING - GRID MED ALLA PASS I RUTINEN
        html += `
        <div style="margin-top: 1px; width: 100%;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
                <p style="font-size: 12px; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; margin: 0 !important; white-space: nowrap;">Ändra planering</p>
                <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            </div>
            
            <div style="text-align: center; margin-bottom: 12px;">
                <span style="font-size: 11px; color: var(--text-light); opacity: 0.5; font-weight: 500; letter-spacing: 0.3px;">💡 Håll inne ett pass för att se övningar</span>
            </div>
            
            <div class="plan-override-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%;">`;
            
            programData.routine.forEach((p, idx) => {
                const isSelected = planned && p.id === planned.id;
                
                const colors = [
                    { r: 239, g: 68,  b: 68 },   // Röd
                    { r: 59,  g: 130, b: 246 },  // Blå
                    { r: 16,  g: 185, b: 129 },  // Grön
                    { r: 168, g: 85,  b: 247 }   // Lila
                ];
                
                const colorIndex = idx % colors.length;
                const c = colors[colorIndex];
                const currentOpacity = isSelected ? "1" : "0.25";
                const borderColor = `rgba(${c.r}, ${c.g}, ${c.b}, ${currentOpacity})`;
                const btnBg = `rgba(${c.r}, ${c.g}, ${c.b}, 0.04)`;
 
                html += `
                <button class="mode-btn plan-override-btn ${isSelected ? 'active-choice' : ''}" 
                        id="btn-ovr-${p.id}" 
                        
                        onmousedown="startPress(${idx}, event)"
                        onmouseup="if(!isLongPress && !hasScrolled) setOverrideSilent('${dateStr}', '${p.id}'); cancelPress();"
                        onmouseleave="cancelPress();"
                        
                        ontouchstart="startPress(${idx}, event)"
                        ontouchend="handleTouchEnd(${idx}, '${dateStr}', '${p.id}', event)"
                        ontouchmove="handleTouchMove(event)"
                        
                        style="margin: 0; padding: 15px 12px; font-size: 13px; border-radius: 12px; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 100%;
                               background: ${isSelected ? 'rgba(255,255,255,0.1)' : btnBg} !important;
                               border-top: 2px solid ${borderColor} !important;
                               color: ${isSelected ? '#ffffff' : 'var(--text-light)'} !important;
                               user-select: none !important; -webkit-user-select: none !important; -webkit-touch-callout: none !important;">
                    ${p.name}
                </button>`;
            });
            
            const isRestSelected = !planned;
            const restBorderColor = isRestSelected ? "rgba(253, 224, 71, 1)" : "rgba(253, 224, 71, 0.2)";

            html += `
                <button class="mode-btn plan-override-btn override-rest-btn ${isRestSelected ? 'active-choice' : ''}" 
                        id="btn-ovr-none"
                        onclick="setOverrideSilent('${dateStr}', 'none')"
                        style="margin: 0; padding: 12px; font-size: 13px; border-radius: 12px; font-weight: bold; grid-column: span 2; 
                               border-top: 2px solid ${restBorderColor} !important; 
                               color: #fde047; background: rgba(253, 224, 71, 0.05);">
                    🧘 Vila
                </button>
            `;
            
        html += `
            </div>
        </div>`;
    }
    
    body.innerHTML = html;
    openModal();
}

// ASYNKRON SYNCRONISERING AV KALENDERÄNDRINGAR (Optimistic Update-mönster)
async function setOverrideSilent(date, val) {
    // 1. Uppdatera minnet direkt för direkt respons i UI
    calendarOverrides[date] = val;
    
    // 2. Spara till localStorage omedelbart som blixtsnabb backup
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
    
    // 3. Rendera om gränssnittet direkt utan att blockera tråden (Optimistic update)
    const plannedPass = val === 'none' ? null : programData.routine.find(x => x.id === val);
    openDayManager(date, plannedPass, [], false);
    renderCalendar(false); 
    
    // 4. Skicka ändringen asynkront till Supabase i bakgrunden
    if (typeof currentUser !== 'undefined' && currentUser) {
        try {
            // Kontrollera om posten redan finns för användaren
            const { data: existing } = await supabaseClient
                .from('calendar_overrides')
                .select('id')
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (existing) {
                await supabaseClient
                    .from('calendar_overrides')
                    .update({ data: calendarOverrides })
                    .eq('user_id', currentUser.id);
            } else {
                await supabaseClient
                    .from('calendar_overrides')
                    .insert([{ user_id: currentUser.id, data: calendarOverrides }]);
            }
        } catch (err) {
            console.error("Supabase-synk misslyckades för kalenderändring, kör vidare på lokal backup:", err);
        }
    }
}

function startFreeWorkoutOnDate(date) {
    const freePass = { id: "free-" + Date.now(), name: "Fritt Pass", exercises: [] };
    startWorkout(freePass, null, date, true); 
}

function openMonthPicker() {
    const body = document.getElementById("modal-body");
    let html = `<h3>Välj månad</h3><div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;
    const months = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
    months.forEach((m, i) => { html += `<button class="mode-btn glass-border" style="font-size:14px;" onclick="selectMonth(${i})">${m}</button>`; });
    body.innerHTML = html + `</div>`;
    openModal();
}

function selectMonth(m) { 
    currentViewDate.setMonth(m); 
    closeModal(); 
    renderCalendar(); 
}

// --- PROGRAMVYER & RUTINREDIGERING ---
function renderProgramView(activeIdx = null) {
    const selector = document.getElementById("pass-selector-list");
    if (!selector) return;
    selector.innerHTML = "";
    
    programData.routine.forEach((pass, i) => {
        const div = document.createElement("div");
        div.className = `prog-card ${activeIdx === i ? 'active' : ''}`;
        div.innerHTML = `<div style="font-size:24px;">${['⚡','🔥','🏆','💎'][i % 4]}</div><h4>${pass.name}</h4><div style="font-size:10px; color:var(--primary); margin-top:5px; font-weight:800;">${pass.exercises.length} ÖVNINGAR</div>`;
        div.onclick = () => { 
            document.querySelectorAll(".prog-card").forEach(c => c.classList.remove("active"));
            div.classList.add("active");
            showProgramDetails(i); 
        };
        selector.appendChild(div);
    });
    showView("programs-view");
}

function showProgramDetails(idx) {
    const pass = programData.routine[idx];
    const detailsArea = document.getElementById("program-details-area");
    const list = document.getElementById("program-exercise-list");
    if (!pass || !detailsArea || !list) return;
    
    detailsArea.classList.remove("hidden");
    
    list.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid var(--glass-border);">
            <h3 style="margin:0; text-align:left; font-size:18px;">${pass.name}</h3>
            <button class="order-btn" style="background:var(--primary); color:#0f172a; padding:8px 15px; border-radius:10px; font-weight:800; border:none; cursor:pointer; font-size:12px;" onclick="openEditProgramModal(${idx})">Redigera</button>
        </div>
        ${pass.exercises.map(e => `
            <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
                <span style="font-weight:600;">${e.name}</span>
                <small style="color:var(--primary); font-weight:800; text-transform:uppercase; font-size:9px;">${e.target}</small>
            </div>
        `).join("")}
    `;
}

function renderExercisePickerForEdit(idx, category = "Ben") {
    const container = document.getElementById("modal-exercise-picker-container");
    if (!container) return;

    const categories = [
        { name: "Ben", icon: "🦵" },
        { name: "Bröst", icon: "🏋️" },
        { name: "Rygg", icon: "🪵" },
        { name: "Axlar", icon: "👐" },
        { name: "Armar", icon: "💪" },
        { name: "Bål", icon: "🧘" }
    ];

    let html = `<div class="separator" style="margin: 25px 0;"></div>`;
    html += `<h3 style="margin: 0 0 15px 0; color: var(--primary); font-size: 1.2rem; text-align: center; text-transform: uppercase; letter-spacing: 1px;">LÄGG TILL ÖVNING</h3>`;
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Välj Kategori:</p>`;
    
    html += `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">`;
    categories.forEach(cat => {
        const isActive = cat.name === category;
        html += `
            <button onclick="renderExercisePickerForEdit(${idx}, '${cat.name}')" 
                style="padding:10px 5px; font-size:11px; border-radius:12px; border:1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                background:${isActive ? 'rgba(34, 211, 238, 0.1)' : 'var(--card)'}; color:${isActive ? 'var(--primary)' : 'white'}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:16px;">${cat.icon}</span> ${cat.name}
            </button>`;
    });
    html += `</div>`;

    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Övningar (${category}):</p>`;
    
    html += `<div id="exercise-picker-list" style="max-height:400px; overflow-y:auto; padding-right:5px; background:rgba(0,0,0,0.2); border-radius:15px; padding:10px;">`;
    
    const filtered = masterExercises.filter(ex => category === "Armar" ? (ex.target === "Biceps" || ex.target === "Triceps") : ex.target === category);
    
    if (filtered.length === 0) {
        html += `<p style="text-align:center; font-size:12px; color:var(--text-light); padding:10px;">Inga övningar hittades.</p>`;
    }

    filtered.forEach(ex => {
        html += `
        <div class="card glass" style="padding:12px; margin-bottom:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-radius:12px;" onclick="addExerciseToPassDirectly(${idx}, ${ex.id})">
            <span style="font-size:13px; font-weight:600;">${ex.name}</span>
            <span style="color:var(--primary); font-weight:800; font-size:18px;">+</span>
        </div>`;
    });
    html += `</div>`;

    container.innerHTML = html;

    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }

        const list = document.getElementById("exercise-picker-list");
        if (list) {
            list.scrollTop = 0;
        }
    }, 50);
}

// SKICKAR VALD ÖVNING ASYNKRONT IN I PROGRAMRUTINEN
async function addExerciseToPassDirectly(pIdx, exId) {
    const ex = masterExercises.find(e => e.id == exId);
    if (!ex) return;
    
    // Uppdaterar i minnet direkt
    programData.routine[pIdx].exercises.push({ name: ex.name, target: ex.target, defaultSets: 3 });
    
    // Sparar asynkront till databasen i bakgrunden (Optimistic Update)
    if (typeof saveCustomProgramToSupabase === 'function') {
        saveCustomProgramToSupabase();
    } else {
        localStorage.setItem("myCustomProgram", JSON.stringify(programData));
    }
    
    await openEditProgramModal(pIdx); 
}

async function openEditProgramModal(idx) {
    const pass = programData.routine[idx];
    const body = document.getElementById("modal-body");
    if (!pass || !body) return;
    
    body.innerHTML = `
        <h3>Redigera ${pass.name}</h3>
        <label style="font-size:12px; color:var(--text-light); text-align:left; display:block; margin-left:10px;">NAMN PÅ PASS</label>
        <input type="text" id="edit-pass-name" class="log-input" value="${pass.name}">
        
        <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Nuvarande övningar:</p>
        <div id="edit-pass-exercises">
            ${pass.exercises.map((ex, i) => `
                <div class="edit-item-row">
                    <div style="display:flex; gap:8px;">
                        <button class="reorder-btn" onclick="moveExercise(${idx}, ${i}, -1)">▲</button>
                        <button class="reorder-btn" onclick="moveExercise(${idx}, ${i}, 1)">▼</button>
                    </div>
                    <span style="flex-grow:1; margin-left:15px; font-size:14px; font-weight:600;">${ex.name}</span>
                    <button onclick="removeExFromPass(${idx}, ${i})" style="color:var(--danger); background:none; border:none; font-size:18px;"> ✖ </button>
                </div>`).join("")}
        </div>

        <div id="modal-exercise-picker-container"></div>

        <div style="margin-top:15px;">
            <button class="mode-btn glass-border" style="font-size:13px; padding:10px;" onclick="createNewExForPass(${idx})">+ Skapa helt ny övning till banken</button>
        </div>

        <button class="mode-btn blue" style="margin-top:20px;" onclick="saveProgramEdit(${idx})">Spara alla ändringar</button>
        <button class="mode-btn" style="color:var(--danger); background:none; font-size:14px; margin-top:10px;" onclick="deleteEntireProgram(${idx})">Radera pass permanent</button>
    `;
    
    renderExercisePickerForEdit(idx, "Ben");
    openModal();
}

// ==========================================================================
// DEL 3 AV 4: PROGRAMREDIGERING, HISTORIKHANTERING OCH AKTIVT PASS (DRAFT)
// ==========================================================================

// Central hjälpfunktion för att asynkront spara hela programrutinen till localStorage och Supabase
async function saveCustomProgramToSupabase() {
    console.log("saveCustomProgramToSupabase anropad med aktuell programData:", programData);
    
    // 1. Säkra att fönstret har tillgång till exakt samma data
    window.programData = programData;
    
    // 2. Spara till localStorage direkt för snabb UX
    localStorage.setItem("myCustomProgram", JSON.stringify(programData));
    
    // 3. Använd den centrala, säkra sparfunktionen från supabase-data.js
    if (typeof saveCustomProgram === 'function') {
        await saveCustomProgram();
    } else {
        console.warn("Kunde inte hitta saveCustomProgram i supabase-data.js");
    }
}

// Central hjälpfunktion för att spara det aktiva pågående träningspasset (activeDraft)
async function persistActiveWorkout() {
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));
    
    if (typeof currentUser !== 'undefined' && currentUser) {
        try {
            const { data: existing } = await supabaseClient
                .from('active_draft')
                .select('id')
                .eq('user_id', currentUser.id)
                .maybeSingle();

            const draftDataToSend = activeDraft || {};

            if (existing) {
                await supabaseClient
                    .from('active_draft')
                    .update({ data: draftDataToSend }) // Sparar till 'data'-kolumnen i tabellen active_draft
                    .eq('user_id', currentUser.id);
            } else {
                await supabaseClient
                    .from('active_draft')
                    .insert([{ user_id: currentUser.id, data: draftDataToSend }]);
            }
        } catch (err) {
            console.error("Supabase: Fel vid synkronisering av pågående utkast (active_draft):", err);
        }
    }
}

async function createNewExForPass(pIdx) {
    await openCreateExerciseModal(async (newEx) => {
        programData.routine[pIdx].exercises.push({ name: newEx.name, target: newEx.target, defaultSets: 3 });
        
        // Sparar omedelbart till både localStorage och Supabase
        await saveCustomProgramToSupabase();
        await openEditProgramModal(pIdx);
    });
}

async function moveExercise(pIdx, eIdx, dir) {
    const exercises = programData.routine[pIdx].exercises;
    const newIdx = eIdx + dir;
    if(newIdx < 0 || newIdx >= exercises.length) return;
    
    // KORRIGERING: Rättat bugg från inskickad kod där man destruturerade [newIdx] till [newIdx] istället för [eIdx]
    [exercises[eIdx], exercises[newIdx]] = [exercises[newIdx], exercises[eIdx]];
    
    // Sparar ändringen i ordningsföljd direkt
    await saveCustomProgramToSupabase();
    await openEditProgramModal(pIdx);
}

async function removeExFromPass(pIdx, eIdx) {
    programData.routine[pIdx].exercises.splice(eIdx, 1);
    
    // Sparar efter borttagning av övning från passet
    await saveCustomProgramToSupabase();
    await openEditProgramModal(pIdx);
}

async function saveProgramEdit(idx) {
    programData.routine[idx].name = document.getElementById("edit-pass-name").value;
    
    // Sparar det uppdaterade namnet till databasen och lokalt
    await saveCustomProgramToSupabase();
    closeModal();
    renderProgramView(idx);
    showProgramDetails(idx);
}

function openCreateProgramModal() {
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3>Skapa Nytt Pass</h3>
        <label style="font-size:12px; color:var(--text-light); text-align:left; display:block; margin-left:10px;">NAMN PÅ PASS</label>
        <input type="text" id="new-pass-name" class="log-input" placeholder="T.ex. Överkropp Deluxe">
        <button class="mode-btn blue" onclick="saveNewProgram()">Spara och Redigera</button>
    `;
    openModal();
}

async function saveNewProgram() {
    const name = document.getElementById("new-pass-name").value.trim();
    if(!name) return alert("Ange ett namn!");
    const newPass = { id: "pass-" + Date.now(), name, exercises: [] };
    programData.routine.push(newPass);
    
    // Sparar det nya passet till localStorage och Supabase
    await saveCustomProgramToSupabase();
    const newIdx = programData.routine.length - 1;
    await openEditProgramModal(newIdx);
}

async function updateExerciseNameInHistory(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;

    try {
        const { data: historyData, error: fetchError } = await supabaseClient
            .from('workout_history')
            .select('*')
            .eq('user_id', currentUser.id);

        if (fetchError) throw fetchError;

        let updatedCount = 0;
        const updatedWorkouts = [];

        historyData.forEach(workout => {
            let hasChanges = false;
            // Hämtar från din korrekta JSONB-kolumnstruktur 'workout_data'
            if (workout.workout_data && workout.workout_data.exercises && Array.isArray(workout.workout_data.exercises)) {
                workout.workout_data.exercises.forEach(exercise => {
                    if (exercise.name === oldName) {
                        exercise.name = newName;
                        hasChanges = true;
                        updatedCount++;
                    }
                });
            }
            if (hasChanges) {
                updatedWorkouts.push(workout);
            }
        });

        // Kör uppdateringar mot databasen för påverkade pass
        for (const workout of updatedWorkouts) {
            const { error: updateError } = await supabaseClient
                .from('workout_history')
                .update({ workout_data: workout.workout_data })
                .eq('id', workout.id)
                .eq('user_id', currentUser.id);

            if (updateError) throw updateError;
        }

        if (updatedCount > 0) {
            // Synkar den globala minnesvariabeln med den uppdaterade datan
            workoutHistory = historyData.map(w => ({
                id: w.id,
                date: w.workout_date,
                programName: w.workout_data.programName,
                totalTime: w.workout_data.totalTime,
                exercises: w.workout_data.exercises || []
            }));
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
            console.log(`Historiken uppdaterad i Supabase: Ändrade "${oldName}" till "${newName}" på ${updatedCount} ställen.`);
        }
    } catch (error) {
        console.error('Error updating exercise name in history:', error);
    }
}

// Läser ut historisk data från den lokala variabeln (som är synkad med Supabase vid start)
function getExerciseHistory(exerciseName) {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
        const workout = workoutHistory[i];
        if (!workout.exercises) continue;
        const exMatch = workout.exercises.find(e => e.name === exerciseName);
        if (exMatch) {
            if (!exMatch.sets_data) {
                return Array(parseInt(exMatch.sets || 3)).fill({ weight: exMatch.weight, reps: exMatch.reps });
            }
            return exMatch.sets_data;
        }
    }
    return null;
}

async function startWorkout(workout, data = null, date = null, isImmediateStart = false) {
    if(!activeDraft || !activeDraft.secondsElapsed) {
        secondsElapsed = 0;
    } else {
        secondsElapsed = activeDraft.secondsElapsed;
    }
    
    if(!data) {
        data = workout.exercises.map(ex => {
            const history = getExerciseHistory(ex.name);
            if (history) {
                const historyCopy = JSON.parse(JSON.stringify(history));
                if (Array.isArray(historyCopy)) {
                    historyCopy.forEach(set => {
                        set.userConfirmed = false;
                    });
                }
                // Fixad variabelreferens från din inskickade kod (sets_historyCopy -> sets_data)
                return { sets_data: historyCopy, isCompleted: false };
            }
           return { sets_data: [{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }], isCompleted: false };
        });
    }

    activeDraft = { 
        workout: JSON.parse(JSON.stringify(workout)), 
        data, 
        date: date || new Date().toISOString().split('T')[0],
        secondsElapsed: secondsElapsed,
        isStarted: true, 
        wasTimerRunning: true 
    };
    
    // Sparar det skapade passutkastet direkt till både localStorage och Supabase
    await persistActiveWorkout();
    renderActiveWorkout();
    if (typeof updateTimerDisplay === "function") updateTimerDisplay();
    if (typeof startTimer === "function") startTimer(); 
}

// Global array för att hålla koll på valda övningar i modalen innan de sparas
let temporarySelectedExercises = [];

function renderActiveWorkout() {
    if (activeDraft && activeDraft.data) {
        activeDraft.data.forEach((exerciseData, i) => {
            if (!exerciseData.isCompleted && exerciseData.sets_data) {
                const hasInputValues = exerciseData.sets_data.some(s => s.weight || s.reps);
                const isBrandNewAndGhostChecked = exerciseData.sets_data.every(s => s.userConfirmed === true) && !activeDraft.ui_state?.openExercises?.includes(i);
                
                if (isBrandNewAndGhostChecked && exerciseData.sets_data.length > 0) {
                    exerciseData.sets_data.forEach(set => {
                        set.userConfirmed = false;
                    });
                }
            }
        });
    }

    document.getElementById("active-title").textContent = activeDraft.workout.name;
    const list = document.getElementById("exercise-list");
    const footer = document.querySelector(".workout-footer");
    if (!list) return;
    list.innerHTML = "";

    if(!activeDraft.isStarted) {
        if (footer) footer.classList.add("hidden");
        list.innerHTML = `
            <div style="text-align:center; padding:20px 0;">
                <button class="mode-btn green" style="width:100%; padding:20px; font-size:18px; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);" onclick="actuallyStartWorkout()">STARTA TRÄNINGSPASSET 🔥</button>
            </div>
            <p style="color:var(--text-light); font-size:13px; text-align:center; margin-top:10px;">Klicka på knappen ovan för att starta klockan.</p>
        `;
        const timerDisp = document.getElementById("workout-timer");
        if (timerDisp) timerDisp.textContent = "00:00:00";
        showView("workout-view");
        return;
    }

    if (footer) footer.classList.remove("hidden");
    const pauseBtn = document.getElementById("pause-workout-btn");
    if (pauseBtn) {
        pauseBtn.innerHTML = `Spara utkast 💾`;
        pauseBtn.className = "mode-btn save-draft-btn";
    }

    if (!activeDraft.ui_state) {
        activeDraft.ui_state = {};
    }
    
    if (!activeDraft.ui_state.openExercises) {
        activeDraft.ui_state.openExercises = [];
    }

    const isFrittPass = activeDraft.workout.name === "Fritt Pass";
    if (!isFrittPass) {
        if (!activeDraft.ui_state.hasOwnProperty('hasInitializedOpen')) {
            activeDraft.ui_state.openExercises = [0];
            activeDraft.ui_state.hasInitializedOpen = true;
            persistActiveWorkout(); // Synkar initierat UI-tillstånd till Supabase
        }
    }
    
    const openExercises = activeDraft.ui_state.openExercises;

    activeDraft.workout.exercises.forEach((ex, i) => {
        const exerciseData = activeDraft.data[i];
        if (!exerciseData) return;
        const isDone = exerciseData.isCompleted;
        const isOpen = openExercises.includes(i);
        
        const div = document.createElement("div");
        div.className = "card glass" + (isDone ? " exercise-done" : "");
        div.style.padding = "0"; 
        div.style.overflow = "hidden";
        
        const completedSets = exerciseData.sets_data ? exerciseData.sets_data.filter(s => s.userConfirmed).length : 0;
        const totalSets = exerciseData.sets_data ? exerciseData.sets_data.length : 0;

        let setsHtml = `<div style="margin-top:10px;">
            <div style="display:grid; grid-template-columns: 40px 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
                <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">SET</small>
                <small style="text-align:center; color:var(--text-light); font-size:9px;">KG</small>
                <small style="text-align:center; color:var(--text-light); font-size:9px;">REPS</small>
                <span></span>
            </div>`;

        if (exerciseData.sets_data) {
            exerciseData.sets_data.forEach((set, sIdx) => {
                let isLocked = false;
                let isCurrent = false;
                if (sIdx > 0 && !isDone) {
                    const prevSet = exerciseData.sets_data[sIdx - 1];
                    if (!prevSet.userConfirmed) isLocked = true;
                }
                if (isDone) isLocked = true;
                if (!set.userConfirmed && !isLocked && !isDone) isCurrent = true;

                const showSuccess = set.userConfirmed || isDone;
                let circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
                const statusContent = showSuccess ? '✅' : `#${sIdx + 1}`;

                setsHtml += `
                <div style="display:grid; grid-template-columns: 40px 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center;">
                    <div onclick="${isLocked && !isDone ? '' : `confirmSet(${i}, ${sIdx})`}" 
                         style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:800; background: ${showSuccess ? 'rgba(34, 197, 94, 0.2)' : (isCurrent ? 'rgba(250, 204, 21, 0.15)' : 'rgba(245, 158, 11, 0.05)')}; color: ${circleColor}; opacity: 1;">
                        ${statusContent}
                    </div>
                    <input type="text" inputmode="decimal" id="w-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'};" value="${set.weight || ''}" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${i}, ${sIdx})">
                    <input type="text" inputmode="decimal" id="r-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'};" value="${set.reps || ''}" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${i}, ${sIdx})">
                    <button onclick="removeSetFromExercise(${i}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity: ${isLocked || showSuccess ? '0.1' : '0.8'};" ${isLocked ? 'disabled' : ''}>×</button>
                </div>`;

                if (isCurrent) {
                    setsHtml += `
                    <div style="grid-column: 2 / span 2; margin:-4px 0 8px 0; padding-left:2px; opacity:0.8; font-size:10px; color:var(--primary); font-weight:600; letter-spacing:0.3px;">
                        💡 Klicka på ${statusContent} för att låsa & gå vidare
                    </div>`;
                }
            });
        }

        div.innerHTML = `
        <div onclick="toggleExercise(${i})" style="padding: 12px 15px; display: flex; align-items: center; cursor: pointer; background: ${isOpen ? 'rgba(250, 204, 21, 0.05)' : 'transparent'}">
            
            <div style="display: flex; gap: 4px; margin-right: 12px; flex-shrink: 0;">
                <button class="reorder-btn" onclick="event.stopPropagation(); moveActiveExercise(${i}, -1)" ${isDone ? 'disabled' : ''} style="padding: 4px 6px; font-size: 10px;">▲</button>
                <button class="reorder-btn" onclick="event.stopPropagation(); moveActiveExercise(${i}, 1)" ${isDone ? 'disabled' : ''} style="padding: 4px 6px; font-size: 10px;">▼</button>
            </div>

            <div style="display: flex; flex-direction: column; min-width:0; flex-grow:1;">
                <strong style="font-size: 14px; color: ${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration: ${isDone ? 'line-through' : 'none'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
                    ${ex.name}
                </strong>
                <small style="color: ${isDone ? '#22c55e' : 'var(--primary)'}; font-size: 10px;">
                    ${isDone ? 'KLAR ✅' : `${completedSets}/${totalSets} set`}
                </small>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 10px;">
                <button onclick="event.stopPropagation(); openReplaceExerciseModal(${i})" style="background:none; border:none; font-size:14px; padding:5px; opacity: 0.7;" ${isDone ? 'disabled' : ''}>🔄</button>
                <button onclick="event.stopPropagation(); removeActiveExercise(${i})" style="background:none; border:none; font-size:14px; padding:5px; opacity: 0.7;" ${isDone ? 'disabled' : ''}>✖</button>
                <span style="font-size: 10px; color: var(--text-light); margin-left: 5px; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0)'}; transition: 0.3s;">▼</span>
            </div>
        </div>

        <div style="padding: 0 15px 15px 15px; display: ${isOpen ? 'block' : 'none'}; border-top: 1px solid rgba(255,255,255,0.05);">
            ${setsHtml}
            <button class="mode-border glass-border" style="padding:8px; font-size:11px; margin-top:10px; border-style:dashed; width:100%;" onclick="addSetToExercise(${i})" ${isDone ? 'disabled' : ''}>+ Lägg till set</button>
            <button class="mode-btn ${isDone ? 'blue' : 'green'}" style="padding:12px; font-size:13px; margin-top:15px; width:100%; font-weight:bold;" onclick="toggleExerciseDone(${i})">
                ${isDone ? 'Ångra Klar ↩️' : 'Markera övning som klar ✅'}
            </button>
        </div>`;
        
        list.appendChild(div);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "mode-btn glass-border";
    addBtn.style.marginTop = "10px";
    addBtn.innerHTML = "➕ Lägg till övning";
    addBtn.onclick = openCustomAddExerciseModal;
    list.appendChild(addBtn);

    const discardBtn = document.createElement("button");
    discardBtn.className = "mode-btn";
    discardBtn.style.cssText = "background:none; color:var(--danger); font-size:14px; margin-top:20px; border:1px solid rgba(239, 68, 68, 0.2);";
    discardBtn.innerHTML = "Radera pass 🗑️";
    discardBtn.onclick = confirmDiscardActiveWorkout;
    list.appendChild(discardBtn);

    showView("workout-view");
}

function openCustomAddExerciseModal() {
    temporarySelectedExercises = []; 
    openAddExerciseToWorkoutModal(); 
}

async function toggleExercise(index) {
    const scrollPos = window.scrollY;
    
    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    if (!activeDraft.ui_state.openExercises) {
        activeDraft.ui_state.openExercises = [];
    }

    const openIdx = activeDraft.ui_state.openExercises.indexOf(index);

    if (openIdx > -1) {
        activeDraft.ui_state.openExercises.splice(openIdx, 1);
    } else {
        activeDraft.ui_state.openExercises.push(index);
    }

    // Sparar UI-tillståndet (öppna/stängda övningar) asynkront
    await persistActiveWorkout();
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
}

async function addSetToExercise(exIdx) {
    const scrollPos = window.scrollY;
    const lastSet = activeDraft.data[exIdx].sets_data[activeDraft.data[exIdx].sets_data.length - 1];
    const newWeight = lastSet ? lastSet.weight : "";
    const newReps = lastSet ? lastSet.reps : "";
    activeDraft.data[exIdx].sets_data.push({ weight: newWeight, reps: newReps });
    
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
    // Synkar utökningen av set asynkront i bakgrunden
    await persistActiveWorkout();
}

async function removeSetFromExercise(exIdx, setIdx) {
    const scrollPos = window.scrollY;
    activeDraft.data[exIdx].sets_data.splice(setIdx, 1);
    
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
    // Synkar borttagningen av set asynkront i bakgrunden
    await persistActiveWorkout();
}

async function toggleExerciseDone(exIdx) {
    const scrollPos = window.scrollY;
    activeDraft.data[exIdx].isCompleted = !activeDraft.data[exIdx].isCompleted;
    
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
    // Synkar tillståndet för slutförd övning asynkront i bakgrunden
    await persistActiveWorkout();
}

async function actuallyStartWorkout() {
    activeDraft.isStarted = true;
    activeDraft.wasTimerRunning = true;
    
    // Aktiverar passet och tidtagningen i bakgrunden mot Supabase
    await persistActiveWorkout();
    renderActiveWorkout();
    if (typeof startTimer === "function") startTimer();
}

function openAddExerciseToWorkoutModal() {
    if (typeof renderExercisePicker === "function") {
        renderExercisePicker("Ben");
    }
    openModal();
}

function openReplaceExerciseModal(index) {
    if (typeof renderExercisePicker === "function") {
        renderExercisePicker("Ben", index);
    }
    openModal();
}

// UPPDATERAD FUNKTION: Renderar nu den visuella listan över valda övningar (Varukorgen)
/**
 * =========================================================================
 * APP.JS - DEL 4 AV 4 (MED KOMPLETT SUPABASE-SYNKRONISERING)
 * =========================================================================
 */

function renderExercisePicker(category, replaceIndex = null) {
    const body = document.getElementById("modal-body");
    
    const categories = [
        { name: "Ben", icon: "🦵" },
        { name: "Bröst", icon: "🏋️" },
        { name: "Rygg", icon: "🪵" },
        { name: "Axlar", icon: "👐" },
        { name: "Armar", icon: "💪" },
        { name: "Bål", icon: "🧘" }
    ];
    
    let html = `<h3>${replaceIndex !== null ? 'Byt ut övning' : 'Välj Övningar'}</h3>`;
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Välj Kategori:</p>`;
    
    html += `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">`;
    categories.forEach(cat => {
        const isActive = cat.name === category;
        html += `
            <button onclick="renderExercisePicker('${cat.name}', ${replaceIndex})" 
                style="padding:10px 5px; font-size:11px; border-radius:12px; border:1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                background:${isActive ? 'rgba(34, 211, 238, 0.1)' : 'var(--card)'}; color:${isActive ? 'var(--primary)' : 'white'}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:16px;">${cat.icon}</span> ${cat.name}
            </button>`;
    });
    html += `</div>`;
    
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Övningar (${category}):</p>`;
    html += `<div style="max-height:280px; overflow-y:auto; padding-right:5px; background:rgba(0,0,0,0.2); border-radius:15px; padding:10px; margin-bottom:15px; display:flex; flex-direction:column; gap:8px;">`;
    
    const filtered = masterExercises.filter(ex => category === "Armar" ? (ex.target === "Biceps" || ex.target === "Triceps") : ex.target === category);
    
    if (filtered.length === 0) {
        html += `<p style="text-align:center; font-size:12px; color:var(--text-light); padding:10px;">Inga övningar hittades.</p>`;
    }

    filtered.forEach(ex => {
        const isSelectedInBatch = replaceIndex === null && temporarySelectedExercises.includes(ex.id);
        const currentBg = isSelectedInBatch ? 'rgba(34, 197, 94, 0.15)' : 'transparent';
        const currentBorder = isSelectedInBatch ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)';
        const currentIcon = replaceIndex !== null ? '🔄' : (isSelectedInBatch ? '✅' : '+');

        const clickHandler = replaceIndex !== null 
            ? `confirmAddExerciseToActive(${ex.id}, ${replaceIndex})` 
            : `toggleSelectExerciseInPicker(${ex.id}, '${category}')`;

        html += `
        <div class="card glass" id="picker-ex-${ex.id}" style="padding:12px; margin:0; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-radius:12px; background: ${currentBg} !important; border: ${currentBorder} !important; transition: all 0.2s;" 
             onclick="${clickHandler}">
            <span style="font-size:13px; font-weight:600;">${ex.name}</span>
            <span id="picker-icon-${ex.id}" style="color:${isSelectedInBatch ? '#22c55e' : 'var(--primary)'}; font-size:18px; font-weight:bold;">${currentIcon}</span>
        </div>`;
    });
    html += `</div>`;

    if (replaceIndex === null) {
        html += `<div id="selected-summary-container" style="margin-bottom:15px;">`;
        html += generateSelectedExercisesSummaryHtml();
        html += `</div>`;
    }

    // ÄNDRING: saveDraftState() gjord asynkron och anropas säkert innan modal öppnas
    html += `
        <div class="separator" style="margin:15px 0;"></div>
        <button class="mode-btn glass-border" 
        style="font-size:13px;" 
        onclick="(async () => { await saveDraftState(); openCreateExerciseModal((newEx) => handleInstantExerciseCreated(newEx, ${replaceIndex})); })()">
    + Skapa ny övning som inte finns
</button>
    `;
    
    body.innerHTML = html;
}

function generateSelectedExercisesSummaryHtml() {
    const hasChoices = temporarySelectedExercises.length > 0;
    if (!hasChoices) return "";

    let summaryHtml = `
        <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); margin-bottom:8px; font-weight:600; letter-spacing:0.5px;">Valda övningar i detta svep:</p>
        <div style="display:flex; flex-wrap:wrap; gap:6px; background:rgba(255,255,255,0.03); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); max-height:100px; overflow-y:auto; margin-bottom:12px;">
    `;

    temporarySelectedExercises.forEach(exId => {
        const ex = masterExercises.find(e => e.id == exId);
        if (ex) {
            summaryHtml += `
                <span style="font-size:12px; background:rgba(34, 197, 94, 0.15); color:#22c55e; border:1px solid rgba(34, 197, 94, 0.3); padding:4px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:4px; font-weight:500;">
                    ${ex.name}
                </span>
            `;
        }
    });

    summaryHtml += `</div>`;
    summaryHtml += `
        <button id="multi-save-exercises-btn" class="mode-btn green" style="width: 100%; padding: 15px; font-weight: bold; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);" onclick="confirmAndAddAllSelectedExercises()">
            Lägg till ${temporarySelectedExercises.length} valda övningar ➕
        </button>
    `;

    return summaryHtml;
}

// ÄNDRING: Sparar utkast för valda övningar i localStorage (lokalt tillfälligt UI-tillstånd)
async function saveDraftState() {
    localStorage.setItem('temp_exercise_draft', JSON.stringify(temporarySelectedExercises));
}

function restoreDraftState() {
    const saved = localStorage.getItem('temp_exercise_draft');
    if (saved) {
        temporarySelectedExercises = JSON.parse(saved);
        localStorage.removeItem('temp_exercise_draft');
        updateExerciseSelectionView(); 
    }
}

function toggleSelectExerciseInPicker(exId, category) {
    const index = temporarySelectedExercises.indexOf(exId);
    const card = document.getElementById(`picker-ex-${exId}`);
    const icon = document.getElementById(`picker-icon-${exId}`);
    
    if (index > -1) {
        temporarySelectedExercises.splice(index, 1);
        if (card) {
            card.style.setProperty('background', 'transparent', 'important');
            card.style.setProperty('border', '1px solid rgba(255,255,255,0.08)', 'important');
        }
        if (icon) {
            icon.textContent = "+";
            icon.style.color = "var(--primary)";
        }
    } else {
        temporarySelectedExercises.push(exId);
        if (card) {
            card.style.setProperty('background', 'rgba(34, 197, 94, 0.15)', 'important');
            card.style.setProperty('border', '1px solid #22c55e', 'important');
        }
        if (icon) {
            icon.textContent = "✅";
            icon.style.color = "#22c55e";
        }
    }
    
    const container = document.getElementById("selected-summary-container");
    if (container) {
        container.innerHTML = generateSelectedExercisesSummaryHtml();
    }
}

// ÄNDRING: Gjord async för att invänta synkning till Supabase via persistActiveWorkout()
async function confirmAndAddAllSelectedExercises() {
    if (temporarySelectedExercises.length === 0) return;
    
    const isFrittPass = activeDraft.workout.name === "Fritt Pass";
    const startIdx = activeDraft.workout.exercises.length;

    temporarySelectedExercises.forEach((exId, loopIdx) => {
        const ex = masterExercises.find(e => e.id == exId);
        if (!ex) return;
        
        const newExObj = { name: ex.name, target: ex.target };
        let newDataEntry;
        const history = getExerciseHistory(ex.name);
        if (history) {
            newDataEntry = { sets_data: JSON.parse(JSON.stringify(history)), isCompleted: false };
        } else {
            newDataEntry = { sets_data: [{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }], isCompleted: false };
        }

        activeDraft.workout.exercises.push(newExObj);
        activeDraft.data.push(newDataEntry);

        if (isFrittPass) {
            const currentInsertedIndex = startIdx + loopIdx;
            if (loopIdx === 0) {
                if (!activeDraft.ui_state.openExercises.includes(currentInsertedIndex)) {
                    activeDraft.ui_state.openExercises.push(currentInsertedIndex);
                }
            }
        }
    });
    
    // Rensa det temporära urvalet när de har lagts till i passet
    temporarySelectedExercises = [];

    await persistActiveWorkout(); // Synkar till både localStorage och Supabase (active_draft)
    closeModal();
    renderActiveWorkout();
}

function handleInstantExerciseCreated(newEx, replaceIndex = null) {
    if (replaceIndex !== null) {
        confirmAddExerciseToActive(newEx.id, replaceIndex);
    } else {
        if (!temporarySelectedExercises.includes(newEx.id)) {
            temporarySelectedExercises.push(newEx.id);
        }
        
        let categoryToOpen = "Ben"; 
        if (newEx.target) {
            if (newEx.target === "Biceps" || newEx.target === "Triceps") {
                categoryToOpen = "Armar";
            } else {
                categoryToOpen = newEx.target; 
            }
        }
        
        renderExercisePicker(categoryToOpen, null);
    }
}

async function confirmAddExerciseToActive(exId, replaceIndex = null) {
    const ex = masterExercises.find(e => e.id == exId);
    const newExObj = { name: ex.name, target: ex.target };
    
    let newDataEntry;
    const history = getExerciseHistory(ex.name);
    if(history) {
        newDataEntry = { sets_data: JSON.parse(JSON.stringify(history)), isCompleted: false };
    } else {
        newDataEntry = { sets_data: [{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }], isCompleted: false };
    }

    if(replaceIndex !== null) {
        activeDraft.workout.exercises[replaceIndex] = newExObj;
        activeDraft.data[replaceIndex] = newDataEntry;
    } else {
        activeDraft.workout.exercises.push(newExObj);
        activeDraft.data.push(newDataEntry);
        
        const newIdx = activeDraft.workout.exercises.length - 1;
        if (activeDraft.workout.name === "Fritt Pass" && !activeDraft.ui_state.openExercises.includes(newIdx)) {
            activeDraft.ui_state.openExercises.push(newIdx);
        }
    }
    
    await persistActiveWorkout(); // Synkar till både localStorage och Supabase (active_draft)
    closeModal();
    renderActiveWorkout();
}

async function updateSetDataOnly(exIdx, setIdx) {
    const wVal = document.getElementById(`w-${exIdx}-${setIdx}`).value;
    const rVal = document.getElementById(`r-${exIdx}-${setIdx}`).value;
    activeDraft.data[exIdx].sets_data[setIdx].weight = wVal;
    activeDraft.data[exIdx].sets_data[setIdx].reps = rVal;
    await persistActiveWorkout(); // Synkar vid ändring av värden i set
}

async function confirmSet(exIdx, setIdx) {
    const scrollPos = window.scrollY;
    const currentState = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    activeDraft.data[exIdx].sets_data[setIdx].userConfirmed = !currentState;
    
    await persistActiveWorkout(); // Synkar vid klarmarkering av set
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
}

// ÄNDRING: Uppdaterad med robust synkronisering mot tabellen public.active_draft i Supabase
async function persistActiveWorkout() {
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));
    
    // Kör även de specifika databas-sparfunktionerna om de är deklarerade globalt
    if (typeof saveActiveDraft === 'function') {
        await saveActiveDraft();
    }
    if (typeof saveAll === "function") {
        await saveAll();
    }

    // Direkt integration om de globala funktionerna ovan inte täcker uppdateringen fullt ut
    if (currentUser) {
        try {
            const draftData = activeDraft || {};
            
            // Kontrollera om det redan finns ett utkast i databasen för att välja INSERT eller UPDATE
            const { data: existing, error: checkError } = await supabaseClient
                .from('active_draft')
                .select('id')
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                const { error: updateError } = await supabaseClient
                    .from('active_draft')
                    .update({ data: draftData }) // Matchar kolumnen 'data' i schemat
                    .eq('user_id', currentUser.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabaseClient
                    .from('active_draft')
                    .insert([{ user_id: currentUser.id, data: draftData }]);
                if (insertError) throw insertError;
            }
        } catch (err) {
            console.error("Fel vid bakgrundssynk av active_draft till Supabase:", err);
        }
    }
}

async function moveActiveExercise(i, dir) {
    const scrollPos = window.scrollY;
    const newIdx = i + dir;
    if (newIdx < 0 || newIdx >= activeDraft.workout.exercises.length) return;
    
    [activeDraft.workout.exercises[i], activeDraft.workout.exercises[newIdx]] = [activeDraft.workout.exercises[newIdx], activeDraft.workout.exercises[i]];
    [activeDraft.data[i], activeDraft.data[newIdx]] = [activeDraft.data[newIdx], activeDraft.data[i]];
    
    if (activeDraft.ui_state && activeDraft.ui_state.openExercises) {
        const openExercises = activeDraft.ui_state.openExercises;
        const iIsOpen = openExercises.includes(i);
        const newIdxIsOpen = openExercises.includes(newIdx);
        
        if (iIsOpen && !newIdxIsOpen) {
            openExercises.splice(openExercises.indexOf(i), 1);
            openExercises.push(newIdx);
        } else if (!iIsOpen && newIdxIsOpen) {
            openExercises.splice(openExercises.indexOf(newIdx), 1);
            openExercises.push(i);
        }
    }
    
    await persistActiveWorkout(); // Synkar ändrad ordning till Supabase
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
}

async function removeActiveExercise(exIdx) {
    if (typeof hideDefaultCloseButton === "function") hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">🗑️</div>
            <h3 style="color:var(--danger);">Ta bort övningen?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Är du säker på att du vill ta bort den här övningen från ditt pågående pass?</p>
            <button class="mode-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;" 
                onclick="(async () => { 
                    activeDraft.workout.exercises.splice(${exIdx}, 1); 
                    activeDraft.data.splice(${exIdx}, 1); 
                    await persistActiveWorkout(); 
                    closeModal(); 
                    renderActiveWorkout(); 
                })()">
                Ja, radera
            </button>
            <button class="mode-btn glass-border" onclick="closeModal()">Avbryt</button>
        </div>
    `;
    openModal();
}

document.getElementById("global-home").addEventListener("click", () => {
    renderHome();
    showView("home-view");
});

document.getElementById("start-new-btn").onclick = () => renderCalendar(true);
document.getElementById("calendar-mode").onclick = () => renderCalendar(false);
document.getElementById("view-exercises-btn").onclick = () => { showView("exercises-view"); filterExercises(currentExerciseCategory); };
document.getElementById("view-programs-btn").onclick = () => renderProgramView();
document.getElementById("stats-mode").onclick = renderStats;
document.getElementById("add-custom-pass-btn").onclick = openCreateProgramModal;

// ==========================================================================
// GRÄNSSNITT & KNAPPHANTERING (HOME & SAVE WORKOUT)
// ==========================================================================

function renderHome() {
    showView("home-view");
    
    const homeView = document.getElementById("home-view");
    const headerP = homeView.querySelector("header p");
    
    homeView.querySelectorAll(".home-separator").forEach(s => s.remove());
    
    if (headerP) {
        const sep = document.createElement("div");
        sep.className = "separator home-separator";
        sep.style.margin = "25px 0";
        headerP.after(sep);
    }

    if(activeDraft) {
        document.getElementById("draft-alert").classList.remove("hidden");
        document.getElementById("start-new-btn").classList.add("hidden");
        document.getElementById("resume-workout-btn").onclick = () => startWorkout(activeDraft.workout, activeDraft.data, activeDraft.date);
    } else {
        document.getElementById("start-new-btn").classList.remove("hidden");
        document.getElementById("draft-alert").classList.add("hidden");
    }
}

// ÄNDRING: Hela flödet vid sparande av träningspass har städats och dubblett-säkrats via supabase-data.js
document.getElementById("save-workout-btn").onclick = async () => {
    if(!activeDraft.isStarted) {
        const body = document.getElementById("modal-body");
        body.innerHTML = `
            <h3>Kasta träningspass</h3>
            <p style="text-align:center; color:var(--text-light);">Du har inte startat passet än. Vill du radera utkastet?</p>
            <button class="mode-btn danger" style="background:var(--danger);" onclick="(async () => { 
                localStorage.removeItem('activeWorkoutDraft'); 
                if (typeof deleteActiveDraft === 'function') await deleteActiveDraft();
                if (currentUser) {
                    try {
                        await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id);
                    } catch(e) { console.error(e); }
                }
                location.reload(); 
            })()">Kasta passet</button>
            <button class="mode-btn glass-border" onclick="closeModal()">Avbryt</button>
        `;
        openModal();
        return;
    }

    pauseTimer();
    const finalTime = document.getElementById("workout-timer").textContent;
    
    // Generera ett unikt ID för passet här så det garanterat hänger med överallt
    const uniqueWorkoutId = "workout_" + Date.now() + "_" + Math.floor(Math.random() * 100);

    const log = {
        id: uniqueWorkoutId, // Unikt ID skickas nu med i logg-objektet
        date: activeDraft.date,
        programName: activeDraft.workout.name,
        totalTime: finalTime,
        exercises: activeDraft.workout.exercises.map((ex, i) => {
            return {
                name: ex.name,
                sets_data: activeDraft.data[i].sets_data  
            };
        })
    };
    
    // CENTRAL SPARFUNKTION: Sköter insättning i Supabase, localStorage samt synk på ett säkert sätt
    if (typeof saveWorkoutHistory === 'function') {
        await saveWorkoutHistory(log);
    }


    // Ta bort det aktiva utkastet lokalt och i molnet
    localStorage.removeItem("activeWorkoutDraft");
    if (typeof deleteActiveDraft === 'function') {
        await deleteActiveDraft();
    }
    
    if (currentUser) {
        try {
            const { error: draftDelErr } = await supabaseClient
                .from('active_draft')
                .delete()
                .eq('user_id', currentUser.id);
            if (draftDelErr) throw draftDelErr;
        } catch (err) {
            console.error("Fel vid radering av utkast i Supabase:", err);
        }
    }
    
    activeDraft = null; 
    secondsElapsed = 0;
    
    // Uppdaterar kalendervyn för att omedelbart reflektera det nya passet
    if (typeof renderCalendar === 'function') renderCalendar();
};

document.getElementById("pause-workout-btn").onclick = () => { 
    location.reload(); 
};

function renderStats() {
    const container = document.getElementById("chart-container");
    container.innerHTML = "";
    const months = {};
    workoutHistory.forEach(w => { 
        if(w.date) {
            const m = w.date.substring(0, 7); 
            months[m] = (months[m] || 0) + 1; 
        }
    });
    Object.entries(months).sort().forEach(([m, val]) => {
        const bar = document.createElement("div");
        bar.className = "chart-bar";
        bar.style.height = (val * 20) + "px";
        bar.innerHTML = `<span style="position:absolute; top:-20px; width:100%; text-align:center; font-size:10px;">${val}</span>`;
        container.appendChild(bar);
    });
    showView("stats-view");
}

// ÄNDRING: Säkerställd med asynkron sparning mot tabellen public.calendar_overrides
async function changeMonth(off) { 
    currentViewDate.setMonth(currentViewDate.getMonth() + off); 
    renderCalendar(); 
}

async function setOverride(date, val) { 
    calendarOverrides[date] = val; 
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
    await saveAll(); 
    
    // Direkt integration mot tabellen calendar_overrides
    if (currentUser) {
        try {
            const { data: existing, error: checkErr } = await supabaseClient
                .from('calendar_overrides')
                .select('id')
                .eq('user_id', currentUser.id)
                .maybeSingle();
                
            if (checkErr) throw checkErr;
            
            if (existing) {
                await supabaseClient
                    .from('calendar_overrides')
                    .update({ data: calendarOverrides })
                    .eq('user_id', currentUser.id);
            } else {
                await supabaseClient
                    .from('calendar_overrides')
                    .insert([{ user_id: currentUser.id, data: calendarOverrides }]);
            }
        } catch (err) {
            console.error("Fel vid synk av kalenderändringar till Supabase:", err);
        }
    }
    
    closeModal(); 
    renderCalendar(); 
}

async function prepareStart(date, id) { 
    const p = programData.routine.find(x => x.id === id); 
    closeModal(); 
    await startWorkout(p, null, date, true); 
}

// ÄNDRING: Korrigerat kolumnnamn (workout_date och workout_data) för att matcha schemat exakt vid radering
async function deleteLoggedWorkout(date, idx) {
    const filtered = workoutHistory.filter(w => w.date === date);
    const item = filtered[idx];
    
    // Lokalt uppdatering (Optimistic)
    workoutHistory = workoutHistory.filter(w => w !== item);
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    
    try {
        if (currentUser && item) {
            // Hämtar rader som matchar datum och det specifika programmets namn inuti jsonb-strukturen
            const { data: historyData, error: fetchError } = await supabaseClient
                .from('workout_history')
                .select('id, workout_data')
                .eq('user_id', currentUser.id)
                .eq('workout_date', date);

            if (fetchError) throw fetchError;

            // Hitta exakt rätt logg genom djupjämförelse av programnamn
            const targetRow = historyData.find(row => row.workout_data && row.workout_data.programName === item.programName);

            if (targetRow) {
                const { error: deleteError } = await supabaseClient
                    .from('workout_history')
                    .delete()
                    .eq('id', targetRow.id)
                    .eq('user_id', currentUser.id);

                if (deleteError) throw deleteError;
            }
        }
    } catch (error) {
        console.error('Error deleting workout from Supabase:', error);
    }

    localStorage.removeItem("activeWorkoutDraft");
    if (typeof deleteActiveDraft === 'function') await deleteActiveDraft();
    
    if (currentUser) {
        try {
            await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id);
        } catch(e) { console.error(e); }
    }
    
    activeDraft = null; 
    await saveAll(); 
    closeModal(); 
    renderCalendar();
}

// ÄNDRING: Åtgärdat den kritiska buggen gällande `dataObj`/`null`-parametern samt synkroniserat raderingen av det gamla passet
async function editLoggedWorkout(date, idx) {
    const filtered = workoutHistory.filter(w => w.date === date);
    const item = filtered[idx];
    if (!item) return;
    
    let savedSeconds = 0;
    if(item.totalTime) {
        const parts = item.totalTime.split(':');
        savedSeconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }

    // Behåll passets ursprungliga ID (viktigt så att vi inte skapar ett nytt pass när vi sparar ediseringen!)
    const workoutObj = { 
        id: item.id, 
        name: item.programName, 
        exercises: item.exercises.map(ex => ({ name: ex.name, target: ex.target || "" })) 
    };
    
    // Strukturera om övningsdatan korrekt till en matris som matchar activeDraft-strukturen
    const formattedDataArray = item.exercises.map(ex => {
        if(ex.sets_data) {
            return { sets_data: JSON.parse(JSON.stringify(ex.sets_data)), isCompleted: true };
        }
        return { 
            sets_data: Array(parseInt(ex.sets || 1)).fill(null).map(() => ({ weight: ex.weight || "", reps: ex.reps || "" })), 
            isCompleted: true 
        };
    });

    // Ta bort det gamla passet från historiken lokalt (Optimistic)
    workoutHistory = workoutHistory.filter(w => w.id !== item.id);
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    
    try {
        if (currentUser) {
            // ÄNDRING: Hämta rader för det specifika datumet
            const { data: historyData, error: fetchError } = await supabaseClient
                .from('workout_history')
                .select('id, workout_data')
                .eq('user_id', currentUser.id)
                .eq('workout_date', date);

            if (fetchError) throw fetchError;

            // ÄNDRING: Hitta exakt rätt rad genom att matcha det unika ID:t istället för bara namnet!
            const targetRow = historyData.find(row => 
                row.workout_data && (row.workout_data.id === item.id || row.id === item.id)
            );

            if (targetRow) {
                const { error: deleteError } = await supabaseClient
                    .from('workout_history')
                    .delete()
                    .eq('id', targetRow.id)
                    .eq('user_id', currentUser.id);

                if (deleteError) throw deleteError;
            }
        }
    } catch (error) {
        console.error('Error removing old workout for edit from Supabase:', error);
    }

    // Rensa eventuella gamla utkast i bakgrunden
    localStorage.removeItem("activeWorkoutDraft");
    if (typeof deleteActiveDraft === 'function') await deleteActiveDraft();
    
    if (currentUser) {
        try {
            await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id);
        } catch(e) { console.error(e); }
    }
    
    closeModal();
    
    // Etablera det nya redigeringsbara utkastet med rätt fältmappningar (och behåll ID:t!)
    secondsElapsed = savedSeconds;
    activeDraft = {
        id: item.id, // ID följer med in i utkastet
        workout: workoutObj,
        data: formattedDataArray, 
        date: date,
        secondsElapsed: savedSeconds,
        isStarted: true,
        wasTimerRunning: false,
        ui_state: { openExercises: [0] }
    };
    
    // Synkronisera det nyskapade redigeringsutkastet till lokal backup och molnet
    if (typeof persistActiveWorkout === 'function') {
        await persistActiveWorkout();
    } else if (typeof saveActiveDraft === 'function') {
        await saveActiveDraft();
    }
    
    if (typeof renderActiveWorkout === 'function') renderActiveWorkout();
    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
    showView("workout-view");
}

function hideDefaultCloseButton(hide) {
    const closeBtn = document.querySelector("#workout-modal .modal-content > button");
    if (closeBtn) {
        if (hide) {
            closeBtn.style.display = "none";
        } else {
            closeBtn.style.display = "block";
        }
    }
}

// ÄNDRING: Synkar borttagning av master_exercises till Supabase baserat på schemats ID
async function deleteMasterExercise(id) {
    hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">🗑️</div>
            <h3 style="color:var(--danger);">Radera övning?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Vill du radera denna övning permanent?</p>
            <button class="mode-btn" id="confirm-delete-ex-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;">
                Ja, radera
            </button>
            
            <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); openEditExerciseModal(${id});">
                Avbryt
            </button>
        </div>
    `;
    
    document.getElementById("confirm-delete-ex-btn").onclick = async () => { 
        // 1. Filtrera bort övningen lokalt
        masterExercises = masterExercises.filter(e => e.id != id); 
        
        // 2. Spara i localStorage direkt för snabb UX
        localStorage.setItem('masterExercises', JSON.stringify(masterExercises));
        
        // 3. Skicka upp den uppdaterade listan direkt till rätt tabell (custom_program) via saveCustomProgram
        if (typeof saveCustomProgram === 'function') {
            await saveCustomProgram(); 
        }
        
        // 4. Stäng modalen och stanna kvar i övningsvyn utan att blinka eller hoppa till hemmenyn!
        hideDefaultCloseButton(false);
        closeModal(); 
        
        if (typeof filterExercises === 'function') {
            filterExercises(currentExerciseCategory);
        }
    };

    openModal();
}

// ÄNDRING: Uppdaterad till att synka hela programstrukturen (custom_program) till Supabase vid radering av ett delpass
async function deleteEntireProgram(idx) {
    hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">🗑️</div>
            <h3 style="color:var(--danger);">Radera permanent?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Vill du radera hela detta pass permanent? Det här valet går inte att ångra.</p>
            <button class="mode-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;" 
                onclick="(async () => { 
                    programData.routine.splice(${idx}, 1); 
                    localStorage.setItem('myCustomProgram', JSON.stringify(programData));
                    await saveAll(); 
                    
                    // Direkt synkronisering av modifierat custom_program till Supabase
                    if (currentUser) {
                        try {
                            const { data: existing } = await supabaseClient
                                .from('custom_program')
                                .select('id')
                                .eq('user_id', currentUser.id)
                                .maybeSingle();
                            if (existing) {
                                await supabaseClient
                                    .from('custom_program')
                                    .update({ data: programData })
                                    .eq('user_id', currentUser.id);
                            }
                        } catch (err) {
                            console.error('Error updating custom_program in Supabase:', err);
                        }
                    }
                    
                    closeModal(); 
                    document.getElementById('program-details-area').classList.add('hidden'); 
                    renderProgramView();
                })()">
                Ja, radera passet
            </button>
            <button class="mode-btn glass-border" onclick="closeModal()">Avbryt</button>
        </div>
    `;
    openModal();
}

function openConfirmDeleteModal(dateStr, idx) {
    hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    if (!body) return;

    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">🗑️</div>
            <h3 style="color:var(--danger);">Radera pass ur historiken?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Detta pass kommer att tas bort från din kalender permanent.</p>
            <button class="mode-btn" id="confirm-delete-history-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;">
                Ja, radera
            </button>
            
            <button class="mode-btn glass-border" id="cancel-delete-history-btn">
                Avbryt
            </button>
        </div>
    `;

    // OM MAN ÅNGRAR SIG: Gå bara tillbaka till dagshanteraren utan blink
    document.getElementById("cancel-delete-history-btn").onclick = () => {
        hideDefaultCloseButton(false);
        const filtered = workoutHistory.filter(w => w.date === dateStr);
        const plannedPass = calendarOverrides[dateStr] === 'none' ? null : programData.routine.find(x => x.id === calendarOverrides[dateStr]);
        openDayManager(dateStr, plannedPass, filtered, false);
    };

    // OM MAN VILL RADERA:
    document.getElementById("confirm-delete-history-btn").onclick = async () => {
        if (typeof deleteWorkoutFromHistory === 'function') {
            // Anropa din säkra funktion från supabase-data.js med await
            await deleteWorkoutFromHistory(dateStr, idx);
        }
        
        // Återställ knapparna och stäng modalen tyst
        hideDefaultCloseButton(false);
        closeModal();
        
        // Tvinga kalendern på skärmen att rita om sig för att ta bort det gröna passet direkt
        if (typeof renderCalendar === 'function') {
            renderCalendar(false); 
        }
    };

    openModal();
}

// ÄNDRING: Rensar utkast i både localStorage och tabellen public.active_draft i Supabase asynkront
async function confirmDiscardActiveWorkout() {
    if (!confirm("Är du säker på att du vill radera och avsluta detta pågående pass? Inga set kommer att sparas.")) return;
    
    // 1. Nollställ det lokala minnet och lokal backup omedelbart
    activeDraft = null;
    localStorage.removeItem("activeWorkoutDraft");
    
    // 2. Stoppa timern i appen (om dina funktioner för detta heter så här)
    if (typeof stopTimer === 'function') stopTimer();
    secondsElapsed = 0;

    // 3. Rensa tabellen 'active_draft' i Supabase asynkront och vänta in svaret (await)
    if (typeof currentUser !== 'undefined' && currentUser) {
        try {
            // Vi gör en direkt radering (eller sätter data till ett tomt objekt) i active_draft-tabellen
            await supabaseClient
                .from('active_draft')
                .delete()
                .eq('user_id', currentUser.id);
                
            console.log("Supabase: Pågående utkast raderat utan anmärkning.");
        } catch (err) {
            console.error("Supabase: Fel vid radering av pågående utkast:", err);
        }
    }

    // 4. Stäng eventuellt öppna modaler/dialogrutor tyst
    closeModal();

    // 5. Istället för en hård reload, skicka användaren mjukt tillbaka till hemvyn
    if (typeof showView === 'function') {
        showView("home-view");
    }
    
    // 6. Rita om startsidan och kalendern så att allt visar rätt status direkt
    if (typeof renderHome === 'function') {
        renderHome();
    } else if (typeof renderCalendar === 'function') {
        renderCalendar(false);
    }
}
