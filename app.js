//// Explicita globala variabler länkade till window-objektet för full Supabase-kompatibilitet
window.programData = JSON.parse(localStorage.getItem("myCustomProgram") || "null");
let restTimerInterval = null;
let restTimerSeconds = 0;
let restTimerActive = false;
let restTimerExIdx = null
let programData = window.programData; // Skapar en lokal referens för smidig användning i app.js
let masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]");
let workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
let activeDraft = JSON.parse(localStorage.getItem("activeWorkoutDraft") || "null");
let calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}");
let currentViewDate = new Date();
let currentExerciseCategory = "Ben";
let currentViewGroupId = null;
// Timer-variablerf
let timerInterval = null;
let secondsElapsed = 0;
let isTimerRunning = false;

const CATEGORY_DISPLAY = {
    "Ben": "Legs",
    "Bröst": "Chest", 
    "Rygg": "Back",
    "Axlar": "Shoulders",
    "Armar": "Arms",
    "Bål": "Core",
    "Biceps": "Biceps",
    "Triceps": "Triceps",
    "Ländrygg": "Lower Back"
};

const SUBCATEGORIES = {
    "Ben": ["Compound", "Quads", "Hamstrings", "Glutes", "Calves"],
    "Bröst": ["Compound", "Upper Chest", "Mid Chest", "Lower Chest"],
    "Rygg": ["Compound", "Lats", "Upper Back", "Lower Back"],
    "Axlar": ["Compound", "Front Delts", "Side Delts", "Rear Delts"],
    "Armar": ["Biceps", "Triceps", "Forearms"],
    "Bål": ["Compound", "Abs", "Obliques"]
};

// --- INIT ---
async function initApp() {
    // 1. Om vi redan har ett sparat program i localStorage, använd det direkt för snabb start
    if (window.programData && window.programData.routine && window.programData.routine.length > 0) {
        console.log(" 📦  Initierar appen med lokalt sparat custom-program.");
        programData = window.programData;
        setupMasterExercisesFallback([]);
    } else {
        // 2. Annars (eller om det är första gången), hämta från program.json
        try {
            console.log(" 🌐  Inget lokalt program hittat. Hämtar från program.json...");
            const r = await fetch("program.json");
            const json = await r.json();
            if (!window.programData) {
                window.programData = json;
                programData = window.programData;
                localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
            }
            setupMasterExercisesFallback(json);
        } catch (e) {
            console.error("Kunde inte ladda program.json:", e);
        }
    }
    // 3. Återställ timer om ett aktivt utkast pågår lokalt
    if (activeDraft && activeDraft.isStarted) {
        secondsElapsed = activeDraft.secondsElapsed || 0;
        if (activeDraft.wasTimerRunning) {
            if (typeof startTimer === 'function') startTimer();
        } else {
            if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
        }
    }
    // 4. Rensa eventuella gamla _isTemp-pass som inte sparades korrekt
    if (programData && programData.routine) {
        const hadTemp = programData.routine.some(p => p._isTemp);
        if (hadTemp) {
            programData.routine = programData.routine.filter(p => !p._isTemp);
            if (typeof saveCustomProgramToSupabase === 'function') {
                saveCustomProgramToSupabase();
            }
        }
    }
    // 5. Rensa eventuellt gammalt edit-state
    window._editPassOriginalState = null;
    // 6. Slutgiltig rendering för startskärmen
    if (typeof renderHome === 'function') renderHome();
}

// Hjälpfunktion för att hantera masterExercises och hålla init-koden ren
function setupMasterExercisesFallback(json) {
    if (masterExercises.length === 0 && json && json.routine) {
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
}

// Kör igång initieringen direkt
initApp();

function saveAll() {
    // KORRIGERING: Säkra upp att den lokala referensen matchar fönstrets master-objekt (från Supabase) innan sparning
    if (window.programData) programData = window.programData;
    localStorage.setItem("myCustomProgram", JSON.stringify(programData || { routine: [] }));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));

    // Supabase-synk: Båda ligger kvar och sköter sitt i bakgrunden
    if (typeof saveCustomProgram === 'function') saveCustomProgram();
    if (typeof saveCalendarOverrides === 'function') saveCalendarOverrides();
}

// 🌍 En global järnridå som förlamar alla bakgrundsskript under sparprocessen
window.blockAllSync = false;
function showView(id) {
    // 🛡️ Om järnridån är aktiv tillåter vi ABSOLUT INGET annat än kalendern.
    if (window.blockAllSync && id !== "calendar-view") {
        console.warn("🛡️ Järnridån blockerade ett eftersläpande skript som försökte visa:", id);
        return;
    }

    const target = document.getElementById(id);
    if(!target) return;
    
    // 🔍 OPTIMERING: Om vyn redan är synlig, gör absolut ingenting. 
    // Detta förhindrar att CSS-animationer nollställs och blinkar till i onödan.
    if (!target.classList.contains("hidden")) {
        return;
    }
    
    if (target.classList.contains("hidden")) {
        document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
        target.classList.remove("hidden");
        target.style.animation = 'none';
        target.offsetHeight; // Tvingar fram reflow för ren CSS-animation
        target.style.animation = null;
    }
    
    // Scrolla till toppen (mobil + desktop)
    setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }, 50);
}

function closeModal() {
    document.getElementById("workout-modal").classList.add("hidden");
    const video = document.querySelector("#modal-body video");
    if (video) video.pause();
    if (typeof hideDefaultCloseButton === 'function') {
        hideDefaultCloseButton(false);
    }
    if (typeof window._returnToEditIdx !== 'undefined' && window._returnToEditIdx !== null) {
        const idx = window._returnToEditIdx;
        window._returnToEditIdx = null;
        openEditProgramModal(idx);
        return;
    }
    if (typeof programData !== 'undefined' && programData && programData.routine) {
        // Hitta det _isTemp-pass som faktiskt är öppet i modalen just nu
        const nameInput = document.getElementById("edit-pass-name");
        const currentName = nameInput ? nameInput.value.trim() : "";
        const tempIdx = programData.routine.findIndex(p => p._isTemp);
        if (tempIdx !== -1) {
            const tempPass = programData.routine[tempIdx];
            // Spara det inskrivna namnet till tempPass direkt
            if (currentName) {
                tempPass.name = currentName;
            }
            const hasContent = (tempPass.exercises && tempPass.exercises.length > 0) ||
                (tempPass.name && tempPass.name !== '' && tempPass.name !== 'New Workout');
            if (hasContent) {
                document.getElementById("workout-modal").classList.remove("hidden");
                if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(true);
                const body = document.getElementById("modal-body");
                body.innerHTML = `
                    <div style="text-align:center; padding:10px;">
                        <div style="width:56px; height:56px; border-radius:16px; background:rgba(34,211,238,0.1); 
                            border:1px solid rgba(34,211,238,0.3); display:flex; align-items:center; 
                            justify-content:center; font-size:26px; margin:0 auto 16px auto;">💾</div>
                        <h3 style="margin:0 0 10px 0; font-size:20px; font-weight:900; color:#fff;">Save your workout?</h3>
                        <p style="color:var(--text-light); font-size:14px; line-height:1.5; margin-bottom:24px;">
                            Unsaved changes. What would you like to do?
                        </p>
                        <button class="mode-btn glass-border" onclick="
                            if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(false);
                            openEditProgramModal(${tempIdx});
                        " style="width:100%; margin-bottom:10px; background:linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); 
                            border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45);">
                            ← Continue Editing
                        </button>
                        <button class="mode-btn blue" onclick="saveProgramEdit(${tempIdx})"
                            style="width:100%; flex-direction:row; gap:8px; padding:14px; margin-bottom:10px;">
                            💾 Save Workout
                        </button>
                        <button class="btn-danger" onclick="
                            programData.routine.splice(${tempIdx}, 1);
                            if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(false);
                            document.getElementById('workout-modal').classList.add('hidden');
                            if (currentViewGroupId) {
                                renderPassesInGroup(currentViewGroupId);
                            } else {
                                renderGroupsView();
                            }
                        ">
                            🗑️ Discard Workout
                        </button>
                    </div>
                `;
                return;
            } else {
                programData.routine.splice(tempIdx, 1);
            }
        }
    }
    if (typeof restoreDraftState === 'function') {
        restoreDraftState();
    }
}

function openModal(preventScroll = false) {
    const modal = document.getElementById("workout-modal");
    if (modal) modal.classList.remove("hidden");
    
    if (!preventScroll) {
        setTimeout(() => {
            const modalContent = document.querySelector('.modal-content');
            if (modalContent) modalContent.scrollTop = 0;
        }, 20);
    }
}

// --- TIMER LOGIK ---
function updateTimerDisplay() {
    if (activeDraft && activeDraft.startTime) {
        const startMs = new Date(activeDraft.startTime).getTime();
        const totalSeconds = Math.floor((Date.now() - startMs) / 1000);
        const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        const el = document.getElementById("workout-timer");
        if (el) el.textContent = `${hrs}:${mins}:${secs}`;
    }
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    const btn = document.getElementById("timer-toggle-btn");
    if (btn) btn.textContent = "Pause  ⏸️ ";
    timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    const btn = document.getElementById("timer-toggle-btn");
    if (btn) btn.textContent = "Continue  ▶️ ";
}

// --- ÖVNINGAR & INSTÄLLNINGAR ---
function openCreateExerciseModal(callback = null) {
    const body = document.getElementById("modal-body");
    let selectedCategory = currentExerciseCategory || "Ben";
    let selectedSubcategory = null;
    const categories = [
        { id: "Ben", icon: "🦵" },
        { id: "Bröst", icon: "🏋️" },
        { id: "Rygg", icon: "🪵" },
        { id: "Axlar", icon: "👐" },
        { id: "Armar", icon: "💪" },
        { id: "Bål", icon: "🧘" }
    ];

    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom: 20px;">Create New Exercise</h3>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <div style="width: 100%; padding: 0 10px; box-sizing: border-box;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 8px; text-align: center;">Exercise name</label>
                <input type="text" id="new-ex-name" class="log-input" placeholder="e.g. Squat" style="text-align: center; width: 100%; box-sizing: border-box;">
            </div>
            <div style="width: 100%;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 12px; text-align: center;">Select Category</label>
                <div id="category-selector-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 10px; box-sizing: border-box;">
                    ${categories.map(cat => `
                    <div class="cat-select-item ${cat.id === selectedCategory ? 'active' : ''}"
                        onclick="window.selectModalCategory('${cat.id}')"
                        id="modal-cat-${cat.id}"
                        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                        <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div>
                        <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${CATEGORY_DISPLAY[cat.id] || cat.id}</div>
                    </div>
                    `).join('')}
                </div>
            </div>
            <div id="subcategory-container" style="width: 100%; padding: 0 10px; box-sizing: border-box;"></div>
            <div style="width: 100%; padding: 0 10px; box-sizing: border-box;">
                <button class="mode-btn blue" id="save-new-ex-btn" style="width: 100%; margin-top: 10px;">Save Exercise</button>
            </div>
        </div>
        <style>
            .cat-select-item.active {
                background: rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
            }
            .cat-select-item.active div { color: var(--text) !important; }
        </style>
    `;

    function renderSubcategories() {
        const container = document.getElementById("subcategory-container");
        if (!container) return;
        const subs = SUBCATEGORIES[selectedCategory];
        if (!subs || subs.length === 0) { container.innerHTML = ""; return; }
        container.innerHTML = `
            <label style="font-size:11px; color:var(--text-light); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:10px; text-align:center; margin-top:8px;">
                Subcategory <span style="opacity:0.5;">(optional)</span>
            </label>
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px;">
                ${subs.map(sub => `
                <button id="sub-${sub.replace(/\s/g,'_')}" onclick="window.selectModalSubcategory('${sub}')"
                    style="padding:6px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:var(--text-light); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s ease;">
                    ${sub}
                </button>`).join('')}
            </div>
        `;
    }

    window.selectModalCategory = (catId) => {
        selectedCategory = catId;
        selectedSubcategory = null;
        document.querySelectorAll('.cat-select-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`modal-cat-${catId}`).classList.add('active');
        renderSubcategories();
    };

    window.selectModalSubcategory = (sub) => {
        const btnId = `sub-${sub.replace(/\s/g,'_')}`;
        if (selectedSubcategory === sub) {
            selectedSubcategory = null;
            const btn = document.getElementById(btnId);
            if (btn) { btn.style.background = "rgba(255,255,255,0.05)"; btn.style.borderColor = "rgba(255,255,255,0.15)"; btn.style.color = "var(--text-light)"; }
        } else {
            selectedSubcategory = sub;
            document.querySelectorAll('[id^="sub-"]').forEach(b => { b.style.background = "rgba(255,255,255,0.05)"; b.style.borderColor = "rgba(255,255,255,0.15)"; b.style.color = "var(--text-light)"; });
            const btn = document.getElementById(btnId);
            if (btn) { btn.style.background = "rgba(34,211,238,0.15)"; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
        }
    };

    renderSubcategories();

    document.getElementById("save-new-ex-btn").onclick = async () => {
        const name = document.getElementById("new-ex-name").value.trim();
        if (!name) return alert("Ange ett namn!");
        const newEx = {
            id: Date.now(),
            name,
            target: selectedCategory,
            subtarget: selectedSubcategory || null,
            defaultSets: 3,
            animation: ""
        };
        masterExercises.push(newEx);
        if (typeof saveAll === 'function') await saveAll();
        if (callback) {
            try { callback(newEx); } catch (callbackError) {
                console.warn("⚠️ Callback error:", callbackError);
                closeModal();
            }
        } else {
            closeModal();
            if (typeof filterExercises === 'function') filterExercises(selectedCategory);
        }
    };

    openModal();
}

function filterExercises(category, subtarget = null) {
    currentExerciseCategory = category;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === category));
    
    const results = document.getElementById("exercise-results");
    if (!results) return;
    results.innerHTML = "";

    const subContainer = document.getElementById("subcategory-filter-container");
    if (subContainer) {
        const subs = SUBCATEGORIES[category] || [];
        subContainer.innerHTML = subs.length === 0 ? "" : `
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                <div style="font-size:9px; color:rgba(255,255,255,0.25); text-transform:uppercase; letter-spacing:2px; text-align:center;">Filter by Muscle</div>
                <div style="display:flex; justify-content:center; align-items:center; margin-bottom:4px;">
                    <button onclick="filterExercises('${category}', null)"
                        style="padding:5px 14px; border-radius:20px; border:1px solid ${!subtarget ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}; 
                        background:${!subtarget ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'}; 
                        color:${!subtarget ? 'var(--primary)' : 'var(--text-light)'}; font-size:12px; font-weight:600; cursor:pointer;">
                        All
                    </button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
                    ${subs.map(sub => `
                    <button onclick="filterExercises('${category}', '${sub}')"
                        style="padding:5px 14px; border-radius:20px; border:1px solid ${subtarget === sub ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}; 
                        background:${subtarget === sub ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'}; 
                        color:${subtarget === sub ? 'var(--primary)' : 'var(--text-light)'}; font-size:12px; font-weight:600; cursor:pointer;">
                        ${sub}
                    </button>`).join('')}
                </div>
            </div>
        `;
    }

    const plusArea = document.getElementById('plus-area');
    if (plusArea && !document.getElementById('plus-hint-bubble')) {
        const hint = document.createElement('div');
        hint.id = 'plus-hint-bubble';
        hint.className = 'hint-bubble';
        hint.style.cssText = 'position:relative; margin-right:-25px;';
        hint.innerHTML = '<span style="font-size:12px; font-weight:700; color:#fff; letter-spacing:0.3px;">Create new exercise</span><div onclick="document.getElementById(\'plus-hint-bubble\').remove()" style="position:absolute; top:-6px; right:-6px; width:16px; height:16px; border-radius:50%; background:#ef4444; border:2px solid #0f172a; display:flex; align-items:center; justify-content:center; font-size:9px; color:#fff; cursor:pointer; font-weight:900;">✕</div>';
        plusArea.insertBefore(hint, plusArea.firstChild);
    }

    const filtered = masterExercises.filter(ex => {
        const matchCategory = category === "Armar"
            ? (ex.target === "Biceps" || ex.target === "Triceps" || ex.target === "Armar")
            : ex.target === category;
        const matchSubtarget = !subtarget || ex.subtarget === subtarget || 
            (category === "Armar" && !ex.subtarget && (ex.target === subtarget));
        return matchCategory && matchSubtarget;
    });

    filtered.forEach(ex => {
        const div = document.createElement("div");
        div.className = "card glass";
        div.id = `ex-lib-row-${filtered.indexOf(ex)}`;
        div.dataset.exId = ex.id;
        div.style.cssText = "padding:15px; display:flex; align-items:center; gap:10px; margin-bottom:10px; overflow: visible;";
        div.innerHTML = `
            <div class="ex-lib-drag-handle" style="
                width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
                background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                display: flex; align-items: center; justify-content: center;
                cursor: grab; font-size: 14px; color: rgba(255,255,255,0.4);
                touch-action: none !important;">⠿</div>
            <div style="flex-grow:1; cursor:pointer;" onclick="showExerciseAnimation(${ex.id})">
                <strong style="font-size:16px;">${ex.name}</strong><br>
                <small style="color:${ex.subtarget === 'Compound' ? '#f59e0b' : 'var(--primary)'}; font-weight:800; text-transform:uppercase; font-size:10px;">
                    ${ex.subtarget ? ex.subtarget : (CATEGORY_DISPLAY[ex.target] || ex.target)}
                </small>
            </div>
            <button style="background:none; border:none; font-size:18px; cursor:pointer;" onclick="openEditExerciseModal(${ex.id})">⚙️</button>`;
        results.appendChild(div);
    });

    setTimeout(() => initExerciseLibraryDragAndDrop(), 50);
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
            No video animation available for this exercise.  🎥
        </div>
        `;
    }
    body.innerHTML = `
        <h3>${ex.name}</h3>
        ${videoHtml}
        <div style="text-align:center; color:var(--text-light); font-size:14px; padding:10px;">
            <p><strong>Muscle Group:</strong> ${CATEGORY_DISPLAY[ex.target] || ex.target}</p>
        </div>
    `;
    openModal();
}

function openEditExerciseModal(id) {
    const ex = masterExercises.find(e => e.id == id);
    if(!ex) return;
    const body = document.getElementById("modal-body");
    let selectedCategory = ex.target;
    let selectedSubcategory = ex.subtarget || null;
    const categories = [
        { id: "Ben", icon: " 🦵 " },
        { id: "Bröst", icon: " 🏋️ " },
        { id: "Rygg", icon: " 🪵 " },
        { id: "Axlar", icon: " 👐 " },
        { id: "Armar", icon: " 💪 " },
        { id: "Bål", icon: " 🧘 " }
    ];
    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom: 20px;">Edit Exercise</h3>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 400px;">
            <div style="width: 100%; max-width: 300px; margin-bottom: 10px;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 8px; text-align: center;">Exercise name</label>
                <input type="text" id="edit-ex-name" class="log-input" value="${ex.name}" style="text-align: center;">
            </div>
            <div style="width: 100%;">
                <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 12px; text-align: center;">Select Category</label>
                <div id="edit-category-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 10px;">
                    ${categories.map(cat => `
                    <div class="cat-select-item ${cat.id === selectedCategory ? 'active' : ''}"
                        onclick="window.selectEditModalCategory('${cat.id}')"
                        id="edit-modal-cat-${cat.id}"
                        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                        <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div>
                        <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${CATEGORY_DISPLAY[cat.id] || cat.id}</div>
                    </div>
                    `).join('')}
                </div>
            </div>
            <div id="edit-subcategory-container" style="width: 100%; padding: 0 10px; box-sizing: border-box; margin-top: 8px;"></div>
            <button class="mode-btn blue" style="width: 100%; margin-top: 15px;" id="update-exercise-confirm-btn">Update</button>
            <button class="btn-danger" onclick="deleteMasterExercise(${id})">Delete Exercise Permanently 🗑️</button>
        </div>
        <style>
            .cat-select-item.active {
                background: rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
            }
            .cat-select-item.active div { color: var(--text) !important; }
        </style>
    `;

    function renderEditSubcategories() {
        const container = document.getElementById("edit-subcategory-container");
        if (!container) return;
        const subs = SUBCATEGORIES[selectedCategory];
        if (!subs || subs.length === 0) { container.innerHTML = ""; return; }
        container.innerHTML = `
            <label style="font-size:11px; color:var(--text-light); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:10px; text-align:center;">
                Subcategory <span style="opacity:0.5;">(optional)</span>
            </label>
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-bottom:10px;">
                ${subs.map(sub => `
                <button id="editsub-${sub.replace(/\s/g,'_')}" onclick="window.selectEditSubcategory('${sub}')"
                    style="padding:6px 14px; border-radius:20px; 
                    border:1px solid ${selectedSubcategory === sub ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}; 
                    background:${selectedSubcategory === sub ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'}; 
                    color:${selectedSubcategory === sub ? 'var(--primary)' : 'var(--text-light)'}; 
                    font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s ease;">
                    ${sub}
                </button>`).join('')}
            </div>
        `;
    }

    window.selectEditModalCategory = (catId) => {
        selectedCategory = catId;
        selectedSubcategory = null;
        document.querySelectorAll('#edit-category-grid .cat-select-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`edit-modal-cat-${catId}`).classList.add('active');
        renderEditSubcategories();
    };

    window.selectEditSubcategory = (sub) => {
        if (selectedSubcategory === sub) {
            selectedSubcategory = null;
        } else {
            selectedSubcategory = sub;
        }
        renderEditSubcategories();
    };

    renderEditSubcategories();

    document.getElementById("update-exercise-confirm-btn").onclick = async () => {
        const nameInput = document.getElementById("edit-ex-name").value.trim();
        if(!nameInput) return alert("Namnet får inte vara tomt!");
        const exIndex = masterExercises.findIndex(e => e.id == id);
        if(exIndex !== -1) {
            const oldName = masterExercises[exIndex].name;
            if (typeof updateExerciseNameInHistory === 'function') {
                await updateExerciseNameInHistory(oldName, nameInput);
            }
            masterExercises[exIndex].name = nameInput;
            masterExercises[exIndex].target = selectedCategory;
            masterExercises[exIndex].subtarget = selectedSubcategory || null;
            saveAll();
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
    showCalendarHint();
    infoBox.innerHTML = "";

    if(isFromStartBtn === true) {
        infoBox.innerHTML = `<div style="background:rgba(34, 211, 238, 0.1); padding:12px; border-radius:12px; margin-bottom:15px; font-size:13px; text-align:center; color:var(--primary); border:1px solid var(--primary);">
        Select the day you want to start or schedule a workout in the calendar below  📅
        </div>`;
    }
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const monthText = currentViewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    label.textContent = monthText.charAt(0).toUpperCase() + monthText.slice(1);

    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < offset; i++) grid.innerHTML += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = document.createElement("div");
        cell.className = "calendar-cell";

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
        else if (isOngoing) { cell.classList.add("cell-ongoing"); info = displayPass ? displayPass.name.split(" ").pop() : "🔥"; }
        else if (displayPass) { cell.classList.add("cell-planned"); info = displayPass.name.split(" ").pop(); }

        cell.innerHTML = `<span>${d}</span><div class="cell-info">${info}</div>`;
        cell.onclick = () => {
            if (typeof openDayManager === 'function') openDayManager(dateStr, displayPass, hasWorkouts, isOngoing);
        };
        grid.appendChild(cell);
    }

    //  ✅   Ä NDRAT: Visa bara om den inte redan  ä r dold
    const calendarView = document.getElementById("calendar-view");
    if (calendarView && calendarView.style.display !== "none") {
        showView("calendar-view");
    }
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
                <button onclick="document.getElementById('preview-modal').style.display='none'" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-light); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"> ✖ </button>
            </div>
            <div style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
                ${pass.exercises.map(e => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <span style="font-weight: 600; color: #ffffff; font-size: 14px;">${e.name}</span>
                    <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px; background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px;">${e.target || 'Exercise'}</small>
                </div>
                `).join("")}
            </div>
            <button onclick="document.getElementById('preview-modal').style.display='none'" style="width: 100%; margin-top: 20px; padding: 12px; background: var(--primary); color: #0f172a; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Close Overview
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
                <button onclick="closePreviewModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-light); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"> ✖ </button>
            </div>
            <div style="max-height: 65vh; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
                ${pass.exercises.map(e => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <span style="font-weight: 600; color: #ffffff; font-size: 14px;">${e.name}</span>
                    <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px; background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px;">${e.target || 'Exercise'}</small>
                </div>
                `).join("")}
            </div>
            <button onclick="closePreviewModal()" style="width: 100%; margin-top: 20px; padding: 12px; background: var(--primary); color: #0f172a; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Close Overview
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
        body.style.gap = "16px";
    }

    const dateObj = new Date(dateStr + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Problem 3 — datum i modern-header-stil
    let html = `
        <div style="text-align: center; margin: 0 !important; padding: 0 !important;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-light); font-weight: 600; display: block; margin: 0 !important; padding: 0 !important;">Selected Date</span>
            <h2 class="section-title modern-header" style="margin: 8px 0 0 0 !important; padding: 0 !important; display: inline-block; font-size: 22px; line-height: 1.1 !important;">
                ${formattedDate}
            </h2>
        </div>
    `;

    const safeCompleted = Array.isArray(completed) ? completed : [];
    const hasCompleted = safeCompleted.length > 0;

 // 1. Workout History
   if (hasCompleted) {
        html += `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; white-space: nowrap;">Workout History</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>`;
        safeCompleted.forEach((w, idx) => {
            const timeStr = w.totalTime ? `⏱️ ${w.totalTime}` : "";
            html += `
            <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-left: 3px solid #22c55e; border-radius: 16px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 15px; color: var(--text); display: block;">${w.programName}</strong>
                        <span style="font-size: 11px; color: #22c55e; font-weight: 600;">${timeStr || 'Completed ✅'}</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="editLoggedWorkout('${dateStr}', ${idx})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--primary); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">✏️</button>
                        <button onclick="openConfirmDeleteModal('${dateStr}', ${idx})" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); cursor: pointer; font-size: 12px; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">✖</button>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">`;
            if (Array.isArray(w.exercises)) {
                w.exercises.forEach((ex, exIdx) => {
                    html += `
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <div style="width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(34,211,238,0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <span style="color: var(--primary); font-size: 10px; font-weight: 800;">${exIdx + 1}</span>
                            </div>
                            <span style="color: var(--primary); font-weight: 700; font-size: 13px;">${ex.name}</span>
                        </div>`;
                    if (ex.sets_data) {
                        const hasRest = ex.sets_data.some((s, i) => s.rest && i < ex.sets_data.length - 1);
                        html += `<div style="display: flex; flex-direction: column; gap: 4px;">`;
                        if (hasRest) {
                            html += `
                            <div style="display: flex; align-items: center; padding: 0 4px; margin-bottom: 2px;">
                                <span style="font-size: 10px; color: rgba(34,211,238,0.6); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 160px;">Set</span>
                                <span style="font-size: 10px; color: rgba(245,158,11,0.6); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 12px;">Rest</span>
                            </div>`;
                        }
                        ex.sets_data.forEach((s, sIdx) => {
                            const wVal = s.weight || 0;
                            const rVal = s.reps || 0;
                            const restVal = s.rest || null;
                            const isLastSet = sIdx === ex.sets_data.length - 1;
                            html += `
                           <div style="display: flex; align-items: center;">
                                <div style="width: 160px; background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.2); padding: 6px 10px; border-radius: 10px; display: flex; align-items: center; gap: 10px;">
                                    <span style="color: rgba(255,255,255,0.5); font-size: 10px; font-weight: 800; min-width: 20px;">#${sIdx+1}</span>
                                    <span style="color: rgba(255,255,255,0.2); font-size: 10px;">|</span>
                                    <span style="color: #fff; font-size: 11px; font-weight: 600;">${wVal} kg × ${rVal} reps</span>
                                </div>
                                ${!isLastSet && restVal ? `
                                <span style="font-size: 10px; color: #f59e0b; font-weight: 600; margin-left: 12px; position: relative; top: 14px;">← ⏱️ ${restVal}s</span>` : ''}
                            </div>`;
                        });
                        html += `</div>`;
                    } else {
                        html += `<div style="background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.2); color: #fff; font-size: 12px; padding: 5px 10px; border-radius: 8px; font-weight: 600;">${ex.sets} set × ${ex.weight || 0}kg × ${ex.reps || 0}</div>`;
                    }
                    html += `</div>`;
                });
            }
            html += `</div></div>`;
        });
    }

   // 2. Ongoing workout
if (isOngoing && typeof activeDraft !== 'undefined' && activeDraft) {
    html += `
    <div onclick="showView('workout-view'); startWorkout(activeDraft.workout, activeDraft.data, activeDraft.date); setTimeout(() => closeModal(), 0)"
        style="
        position: relative; overflow: hidden;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: none; border-left: 4px solid #f59e0b;
        border-radius: 22px; padding: 18px 20px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: space-between;
        cursor: pointer;
    ">
        <div style="position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);"></div>
        <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);"></div>
        <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%);"></div>
        <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:44px; height:44px; border-radius:14px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); display:flex; align-items:center; justify-content:center; font-size:22px;">🔥</div>
            <div style="display:flex; flex-direction:column; gap:2px;">
                <span style="font-size:15px; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:0.5px;">Ongoing Workout</span>
                <span style="font-size:9px; color:#f59e0b; text-transform:uppercase; letter-spacing:2px; font-weight:700;">Tap to continue</span>
            </div>
        </div>
    </div>`;
}

    // 3. Status + Start Workout — Problem 4: samma stil som startsidan
       if (!isOngoing && !hasCompleted) {
        const isRest = !planned;
        html += `
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; white-space: nowrap;">Status</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>
           <div style="
            position: relative; overflow: hidden;
            background: linear-gradient(135deg, rgba(16,44,30,0.9) 0%, rgba(10,26,18,0.95) 100%);
            border: none; border-left: 4px solid ${isRest ? '#fde047' : '#22c55e'};
            border-radius: 22px; padding: 18px 20px;
            box-shadow: 0 8px 25px rgba(34,197,94,0.12);
        ">
            <div style="position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);"></div>
            <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);"></div>
            <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%);"></div>

            <div id="current-planned-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: ${planned ? '16px' : '0'};">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div style="width:44px; height:44px; border-radius:14px; background:${isRest ? 'rgba(253,224,71,0.1)' : 'rgba(34,211,238,0.1)'}; border:1px solid ${isRest ? 'rgba(253,224,71,0.3)' : 'rgba(34,211,238,0.3)'}; display:flex; align-items:center; justify-content:center; font-size:22px;">${isRest ? '🧘' : '📋'}</div>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span style="font-size:15px; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:0.5px;">${planned ? planned.name : 'Rest Day'}</span>
                        <span style="font-size:9px; color:${isRest ? '#fde047' : '#22d3ee'}; text-transform:uppercase; letter-spacing:2px; font-weight:700;">${isRest ? 'Recovery' : 'Planned workout'}</span>
                    </div>
                </div>
            </div>

            <div id="day-manager-action-btn-container" style="display:flex; flex-direction:column; gap:8px;">
                ${planned ? `
                <button onclick="prepareStart('${dateStr}', '${planned.id}')"
                    style="width:100%; padding:14px; border-radius:14px; border:none;
                    background: linear-gradient(135deg, #15803d 0%, #22c55e 100%);
                    color:#fff; font-weight:900; font-size:14px; cursor:pointer;
                    text-transform:uppercase; letter-spacing:0.5px;
                    box-shadow: 0 4px 15px rgba(34,197,94,0.3);
                    transition: filter 0.3s ease;"
                    onmouseenter="this.style.filter='brightness(1.15)'"
                    onmouseleave="this.style.filter='brightness(1)'">
                    Start Workout 🔥
                </button>` : ''}
                <button onclick="closeModal(); startFreeWorkoutOnDate('${dateStr}')"
                    style="width:100%; padding:11px; border-radius:14px;
                    border: 1px dashed rgba(34,211,238,0.4); color:var(--primary);
                    background: rgba(34,211,238,0.03); font-weight:700; font-size:13px; cursor:pointer;">
                    + Start Free Workout
                </button>
            </div>
        </div>`;
    }

    // 4. Edit Plan — gruppbaserad med animationer
    if (!isOngoing && !hasCompleted) {
        const customGroups = programData.customGroups || [];
        const ALL_GROUPS = [...PREDEFINED_GROUPS, ...customGroups];

        const groupMap = {};
        ALL_GROUPS.forEach(g => { groupMap[g.id] = []; });
        programData.routine.forEach(p => {
            if (Array.isArray(p.groups) && p.groups.length > 0) {
                p.groups.forEach(gId => {
                    if (!groupMap[gId]) groupMap[gId] = [];
                    groupMap[gId].push(p);
                });
            }
        });

        const groupsWithPasses = ALL_GROUPS.filter(g => groupMap[g.id] && groupMap[g.id].length > 0);
        const ungrouped = programData.routine.filter(p => !Array.isArray(p.groups) || p.groups.length === 0);

       html += `
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;">
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; white-space: nowrap;">Edit Plan</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>
        <div style="text-align:center;">
            <div class="hint-bubble hint-centered" style="position:relative !important; right:auto !important; display:inline-flex !important; margin:0 auto 8px auto !important;">
                <span style="font-size:13px; font-weight:700; color:#fff; letter-spacing:0.3px;">Tap a group to change workout</span>
            </div>
        </div>
        <div id="day-manager-group-container" style="display: flex; flex-direction: column; gap: 8px;">`;

        const renderGroupSection = (g, passes, isUngrouped = false) => {
            const sectionId = `dm-group-${g.id}`;
            return `
            <div style="
                border-radius: 16px; overflow: hidden;
                position: relative;
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                border: none;
                border-left: 4px solid ${isUngrouped ? 'rgba(255,255,255,0.1)' : 'rgba(34,211,238,0.4)'};
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <div style="position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);"></div>
                <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%);"></div>
                <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);"></div>

                <div onclick="toggleDayManagerGroup('${g.id}')" style="
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 13px 16px; cursor: pointer;
                    position: relative; z-index: 1;
                ">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:10px; 
                            background:${isUngrouped ? 'rgba(255,255,255,0.05)' : 'rgba(34,211,238,0.08)'}; 
                            border:1px solid ${isUngrouped ? 'rgba(255,255,255,0.1)' : 'rgba(34,211,238,0.25)'}; 
                            display:flex; align-items:center; justify-content:center; font-size:16px;">
                            ${g.icon}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span style="font-weight:800; font-size:13px; color:${isUngrouped ? 'var(--text-light)' : 'var(--text)'};">${g.name}</span>
                            <span style="font-size:9px; color:${isUngrouped ? 'var(--text-light)' : 'var(--primary)'}; font-weight:700; text-transform:uppercase; letter-spacing:1px; opacity:${isUngrouped ? '0.5' : '1'};">${passes.length} workout${passes.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <span id="dm-arrow-${g.id}" style="color:${isUngrouped ? 'rgba(255,255,255,0.2)' : 'rgba(34,211,238,0.5)'}; font-size:12px; transition: transform 0.3s ease;">▼</span>
                </div>

            <div id="${sectionId}" style="
                                height: 0; overflow: hidden;
                                opacity: 0;
                                display: none;
                ">
                    <div style="padding: 6px 10px 10px 10px; background: rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:6px;">
                        <div style="font-size:10px; color:var(--text-light); opacity:0.4; text-align:center; padding: 4px 0 6px 0; font-weight:600; letter-spacing:0.3px;">
                            💡 Hold to preview exercises
                        </div>
                        ${passes.map(p => {
                            const isSelected = planned && p.id === planned.id;
                            return `
                            <button class="mode-btn plan-override-btn ${isSelected ? 'active-choice' : ''}"
                                id="btn-ovr-${p.id}"
                                data-name="${p.name}"
                                onclick="if(!isLongPress) { setOverrideSilent('${dateStr}', '${p.id}'); cancelPress(); }"
                                onmousedown="startPress(${programData.routine.indexOf(p)}, event)"
                                onmouseup="if(!isLongPress && !hasScrolled) setOverrideSilent('${dateStr}', '${p.id}'); cancelPress();"
                                onmouseleave="cancelPress();"
                                ontouchstart="startPress(${programData.routine.indexOf(p)}, event)"
                                ontouchend="handleTouchEnd(${programData.routine.indexOf(p)}, '${dateStr}', '${p.id}', event)"
                                ontouchmove="handleTouchMove(event)"
                                style="margin:0; padding:12px 14px; font-size:13px; border-radius:10px; font-weight:600;
                                text-overflow:ellipsis; overflow:hidden; white-space:nowrap; width:100%; text-align:left;
                                background: ${isSelected ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)'} !important;
                                border: 1px solid ${isSelected ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.06)'} !important;
                                border-top: 1px solid ${isSelected ? 'rgba(34,211,238,0.6)' : 'rgba(255,255,255,0.12)'} !important;
                                color: ${isSelected ? 'var(--primary)' : 'var(--text)'} !important;
                                user-select:none; -webkit-user-select:none;">
                                ${isSelected ? '✓ ' : ''}${p.name}
                            </button>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        };

        groupsWithPasses.forEach(g => {
            html += renderGroupSection(g, groupMap[g.id]);
        });

        if (ungrouped.length > 0) {
            html += renderGroupSection({ id: '__other__', name: 'Other', icon: '📁' }, ungrouped, true);
        }

        const isRestSelected = !planned;
        html += `
        <div class="separator" style="margin: 10px 0;"></div>
            <button class="mode-btn plan-override-btn override-rest-btn ${isRestSelected ? 'active-choice' : ''}"
                id="btn-ovr-none"
                onclick="setOverrideSilent('${dateStr}', 'none')"
                style="margin:0; padding:12px; font-size:13px; border-radius:12px; font-weight:700;
                border-top: 2px solid ${isRestSelected ? 'rgba(253,224,71,1)' : 'rgba(253,224,71,0.2)'} !important;
                color: #fde047; background: rgba(253,224,71,0.05);">
                🧘 Rest Day
            </button>
        </div>`;
    }

    body.innerHTML = html;
    openModal();
    console.log("hasCompleted:", hasCompleted, "_showFireworksOnOpen:", window._showFireworksOnOpen);
    if (hasCompleted && window._showFireworksOnOpen) {
        window._showFireworksOnOpen = false;
        setTimeout(() => showFireworks(), 200);
    }
}

function toggleDayManagerGroup(groupId) {
    const section = document.getElementById(`dm-group-${groupId}`);
    const arrow = document.getElementById(`dm-arrow-${groupId}`);
    if (!section) return;
    const isOpen = section.classList.contains('is-open');

    if (isOpen) {
        gsap.to(section, {
            height: 0,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.inOut',
            onComplete: () => {
                section.style.display = 'none';
                section.classList.remove('is-open');
            }
        });
        if (arrow) gsap.to(arrow, { rotation: 0, duration: 0.3 });
    } else {
        section.style.visibility = 'hidden';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.height = 'auto';
        const targetHeight = section.scrollHeight;
        section.style.height = '0px';
        section.style.opacity = '0';
        section.style.visibility = 'visible';
        section.classList.add('is-open');

        gsap.to(section, {
            height: targetHeight,
            opacity: 1,
            duration: 0.3,
            ease: 'power2.inOut',
            onComplete: () => {
                section.style.height = 'auto';
            }
        });
        if (arrow) gsap.to(arrow, { rotation: 180, duration: 0.3 });
    }
}

// --- SYNKRONISERADE OCH LIVE-UPPDATERANDE OVERRIDES ---
function setOverrideSilent(dateStr, programId) {
    // 1. Uppdatera det lokala tillståndet OMEDELBART
    if (programId === "none" || programId === "") {
        calendarOverrides[dateStr] = "none";
    } else {
        calendarOverrides[dateStr] = programId;
    }

    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));

    // 2. Uppdatera bakomliggande kalendervy direkt
    if (typeof renderCalendar === "function") {
        renderCalendar();
    }

    // 3. UPPDATERA ENDAST VISUELLT UTAN ATT RITA OM HELA MODALEN
    let nextPlannedProgram = null;
    if (programId !== "none" && programId !== "") {
        nextPlannedProgram = programData.routine.find(p => p.id === programId) || null;
    }

    // Uppdatera texten för planerad status
    const plannedLabel = document.getElementById("current-planned-label");
    if (plannedLabel) {
        const isRest = !nextPlannedProgram;
        plannedLabel.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px;">
                <div style="width:44px; height:44px; border-radius:14px; background:${isRest ? 'rgba(253,224,71,0.1)' : 'rgba(34,211,238,0.1)'}; border:1px solid ${isRest ? 'rgba(253,224,71,0.3)' : 'rgba(34,211,238,0.3)'}; display:flex; align-items:center; justify-content:center; font-size:22px;">${isRest ? '🧘' : '📋'}</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:15px; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:0.5px;">${isRest ? 'Rest Day' : nextPlannedProgram.name}</span>
                    <span style="font-size:9px; color:${isRest ? '#fde047' : '#22d3ee'}; text-transform:uppercase; letter-spacing:2px; font-weight:700;">${isRest ? 'Recovery day' : 'Planned workout'}</span>
                </div>
            </div>
        `;
        // Uppdatera också kantlinjens färg
        const statusBox = plannedLabel.closest('div[style*="border-left"]');
        if (statusBox) {
            statusBox.style.borderLeft = `4px solid ${isRest ? '#fde047' : '#22c55e'}`;
        }
    }

    // Uppdatera "Starta Träning"-knappen
    const actionBtnContainer = document.getElementById("day-manager-action-btn-container");
    if (actionBtnContainer) {
        if (nextPlannedProgram) {
            actionBtnContainer.innerHTML = `
                <button onclick="prepareStart('${dateStr}', '${nextPlannedProgram.id}')"
                    style="width:100%; padding:14px; border-radius:14px; border:none;
                    background: linear-gradient(135deg, #15803d 0%, #22c55e 100%);
                    color:#fff; font-weight:900; font-size:14px; cursor:pointer;
                    text-transform:uppercase; letter-spacing:0.5px;
                    box-shadow: 0 4px 15px rgba(34,197,94,0.3);
                    transition: filter 0.3s ease;"
                    onmouseenter="this.style.filter='brightness(1.15)'"
                    onmouseleave="this.style.filter='brightness(1)'">
                    Start Workout 🔥
                </button>
                <button onclick="closeModal(); startFreeWorkoutOnDate('${dateStr}')"
                    style="width:100%; padding:11px; border-radius:14px;
                    border: 1px dashed rgba(34,211,238,0.4); color:var(--primary);
                    background: rgba(34,211,238,0.03); font-weight:700; font-size:13px; cursor:pointer;">
                    + Start Free Workout
                </button>`;
        } else {
            actionBtnContainer.innerHTML = `
                <button onclick="closeModal(); startFreeWorkoutOnDate('${dateStr}')"
                    style="width:100%; padding:11px; border-radius:14px;
                    border: 1px dashed rgba(34,211,238,0.4); color:var(--primary);
                    background: rgba(34,211,238,0.03); font-weight:700; font-size:13px; cursor:pointer;">
                    + Start Free Workout
                </button>`;
        }
    }

    // Nollställ alla pass-knappar — återställ till originalnamnet via data-name
    document.querySelectorAll('.plan-override-btn').forEach(btn => {
        btn.classList.remove('active-choice');
        if (!btn.classList.contains('override-rest-btn')) {
            btn.style.setProperty('background', 'rgba(255,255,255,0.04)', 'important');
            btn.style.setProperty('border', '1px solid rgba(255,255,255,0.06)', 'important');
            btn.style.setProperty('border-top', '1px solid rgba(255,255,255,0.12)', 'important');
            btn.style.color = 'var(--text)';
            // Återställ alltid till originalnamnet
            if (btn.dataset.name) {
                btn.textContent = btn.dataset.name;
            }
        }
    });
    // Markera den valda knappen
    if (programId === "none") {
        const restBtn = document.getElementById("btn-ovr-none");
        if (restBtn) restBtn.classList.add('active-choice');
    } else {
            const selectedBtn = document.getElementById(`btn-ovr-${programId}`);
            if (selectedBtn) {
                selectedBtn.classList.add('active-choice');
                selectedBtn.style.setProperty('background', 'rgba(34,211,238,0.12)', 'important');
                selectedBtn.style.setProperty('border', '1px solid rgba(34,211,238,0.4)', 'important');
                selectedBtn.style.setProperty('border-top', '1px solid rgba(34,211,238,0.6)', 'important');
                selectedBtn.style.color = 'var(--primary)';
                // Sätt alltid ✓ + originalnamnet
                const name = selectedBtn.dataset.name || selectedBtn.textContent.trim();
                selectedBtn.textContent = '✓ ' + name;
            }
        }
    

    // 4. KÖR SUPABASE-SYNK I BAKGRUNDEN
    setTimeout(async () => {
        try {
            await saveAll();

            if (typeof currentUser !== 'undefined' && currentUser) {
                const { existingRows, error: checkErr } = await supabaseClient
                    .from('calendar_overrides')
                    .select('id')
                    .eq('user_id', currentUser.id);

                if (checkErr) throw checkErr;

                if (existingRows && existingRows.length > 0) {
                    await supabaseClient
                        .from('calendar_overrides')
                        .update({ calendarOverrides })
                        .eq('user_id', currentUser.id);
                } else {
                    await supabaseClient
                        .from('calendar_overrides')
                        .insert([{ user_id: currentUser.id, calendarOverrides }]);
                }
            }
        } catch (err) {
            console.error("Fel vid bakgrundssynk av kalenderändringar till Supabase:", err);
        }
    }, 0);
}

function startFreeWorkoutOnDate(date) {
    console.log(" 🚀  Initierar Fritt Pass för datum:", date);

    //  ✅  Byt vy F Ö RST
    showView('workout-view');

    const freePass = {
        id: "free-" + Date.now(),
        name: "Free Workout",
        exercises: []
    };

    // Nollställ eventuella gamla rester i data och tvinga igång tillståndet ordentligt
    if (typeof startWorkout === 'function') {
        startWorkout(freePass, [], date, true);

        // Sätt flaggan direkt så att renderActiveWorkout inte fastnar på startskärmen
        if (activeDraft) {
            activeDraft.isStarted = true;
            if (typeof persistActiveWorkout === 'function') {
                persistActiveWorkout();
            }
        }

        // Kör renderingen direkt för att hoppa förbi klockstart-knappen om det behövs
        if (typeof renderActiveWorkout === 'function') {
            renderActiveWorkout();
        }
    } else {
        console.error(" ❌  startWorkout-funktionen saknas i appen!");
    }

    //  ✅  St ä ng modal SIST (i bakgrunden)
    setTimeout(() => closeModal(), 0);
}

function openMonthPicker() {
    const body = document.getElementById("modal-body");
    const currentYear = currentViewDate.getFullYear();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // Vi skapar en temporär variabel för att hålla koll på valt år i modalen
    // Vi använder en dold input eller data-attribut för att komma ihåg året
    let html = `
        <div style="text-align:center; margin-bottom:20px;">
            <div class="calendar-nav" style="justify-content:center; gap:20px; margin-bottom:10px;">
                <button class="nav-arrow" onclick="changePickerYear(-1)">❮</button>
                <h3 id="picker-year-label" style="margin:0; min-width:60px;">${currentYear}</h3>
                <button class="nav-arrow" onclick="changePickerYear(1)">❯</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;

    months.forEach((m, i) => { 
        html += `<button class="mode-btn glass-border" style="font-size:14px;" onclick="selectMonth(${i})">${m}</button>`; 
    });
    
    body.innerHTML = html + `</div>`;
    openModal();
}

function changePickerYear(delta) {
    const label = document.getElementById("picker-year-label");
    let year = parseInt(label.innerText) + delta;
    label.innerText = year;
}

function selectMonth(m) {
    const year = parseInt(document.getElementById("picker-year-label").innerText);
    
    currentViewDate.setFullYear(year);
    currentViewDate.setMonth(m);
    
    closeModal();
    renderCalendar();
}

// --- PROGRAMVYER & RUTINREDIGERING ---
// Fördefinierade grupper
const PREDEFINED_GROUPS = [
    { id: "fullbody", name: "Full Body", icon: "🏋️" },
    { id: "upperbody", name: "Upper Body", icon: "💪" },
    { id: "lowerbody", name: "Lower Body", icon: "🦵" },
    { id: "pushbody", name: "Push", icon: "👐" },
    { id: "pullbody", name: "Pull", icon: "🫳" },
    { id: "superset", name: "Superset", icon: "🔥" }
];

function renderGroupsView() {
    const selector = document.getElementById("pass-selector-list");
    if (!selector) return;
    selector.innerHTML = "";
    selector.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;";

    // Hint ligger utanför selector i ett eget element
    const programsView = document.getElementById("programs-view");
    let hintWrap = document.getElementById('groups-hint-wrap');
    if (!hintWrap) {
        hintWrap = document.createElement('div');
        hintWrap.id = 'groups-hint-wrap';
        hintWrap.style.cssText = 'text-align:center; width:100%; margin-bottom:12px;';
        programsView.insertBefore(hintWrap, selector);
    }
    const existingHint = document.getElementById('groups-hint-bubble');
    if (!existingHint) {
        const hint = document.createElement('div');
        hint.id = 'groups-hint-bubble';
        hint.className = 'hint-bubble hint-centered';
        hint.innerHTML = '<span style="font-size:13px; font-weight:700; color:#fff; letter-spacing:0.3px;">Tap a group to see its workouts</span>';
        hintWrap.appendChild(hint);
    } else {
        const span = existingHint.querySelector('span');
        if (span) span.textContent = 'Tap a group to see its workouts';
    }
    if (!programData.groups) programData.groups = [];
    const usedGroupIds = new Set();
    programData.routine.forEach(pass => {
        if (Array.isArray(pass.groups)) {
            pass.groups.forEach(g => usedGroupIds.add(g));
        }
    });
    const customGroups = (programData.customGroups || []);
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...customGroups];
    const allGroupIds = [...new Set([...ALL_GROUPS.map(g => g.id), ...usedGroupIds])];
    allGroupIds.forEach(groupId => {
        const groupDef = ALL_GROUPS.find(g => g.id === groupId) || { id: groupId, name: groupId, icon: "⚠️" };
        const passesInGroup = programData.routine.filter(p => Array.isArray(p.groups) && p.groups.includes(groupId));
        const isKnownGroup = ALL_GROUPS.find(g => g.id === groupId);
        if (passesInGroup.length === 0 && !isKnownGroup) return;
        const isEmpty = passesInGroup.length === 0;
        const groupCard = document.createElement("div");
       groupCard.style.cssText = `
            position: relative; overflow: hidden;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-top: 3px solid #f59e0b;
            border-left: none;
            border-right: none;
            border-bottom: none;
            border-radius: 16px;
            padding: 20px 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
       groupCard.innerHTML = `
            <div style="position:absolute; left:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; right:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.3) 50%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="font-size: 32px; margin-bottom: 10px;">${groupDef.icon}</div>
            <div style="font-weight: 800; font-size: 15px; color: var(--text); margin-bottom: 4px;">${groupDef.name}</div>
            <div style="font-size: 10px; color: ${isEmpty ? 'rgba(255,255,255,0.3)' : 'var(--primary)'}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                ${isEmpty ? 'No workouts yet' : `${passesInGroup.length} ${passesInGroup.length === 1 ? 'workout' : 'workouts'}`}
            </div>
        `;
        
        groupCard.onclick = () => renderPassesInGroup(groupId);
        
        
        const editBtn = document.createElement("div");
        editBtn.innerHTML = "⚙️";
        editBtn.style.cssText = `
            position: absolute; top: 8px; right: 8px;
            font-size: 14px; opacity: 0.5; cursor: pointer;
            padding: 2px 4px; border-radius: 6px;
            background: rgba(255,255,255,0.05);
            transition: opacity 0.2s ease;
        `;
        editBtn.addEventListener('mouseenter', () => editBtn.style.opacity = '1');
        editBtn.addEventListener('mouseleave', () => editBtn.style.opacity = '0.5');
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditGroupModal(groupId, groupDef);
        };
        groupCard.appendChild(editBtn);
        selector.appendChild(groupCard);
    });
    // Utan grupp
    const ungroupedPasses = programData.routine.filter(p => !Array.isArray(p.groups) || p.groups.length === 0);
    if (true) {
        const ungroupedCard = document.createElement("div");
        ungroupedCard.style.cssText = `
            position: relative; overflow: hidden;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-top: 3px solid #f59e0b;
            border-left: none;
            border-right: none;
            border-bottom: none;
            border-radius: 16px;
            padding: 20px 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
            ungroupedCard.innerHTML = `
            <div style="position:absolute; left:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; right:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.3) 50%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="font-size: 32px; margin-bottom: 10px;">📁</div>
            <div style="font-weight: 800; font-size: 15px; color: var(--text); margin-bottom: 4px;">Other</div>
            <div style="font-size: 10px; color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                ${ungroupedPasses.length} ${ungroupedPasses.length === 1 ? 'workout' : 'workouts'}
            </div>
        `;
        ungroupedCard.onclick = () => renderPassesInGroup('__ungrouped__');
        selector.appendChild(ungroupedCard);
    }
   const backBtn = document.getElementById("group-back-btn");
    if (backBtn) backBtn.style.display = 'none';
    const detailsArea = document.getElementById("program-details-area");
    if (detailsArea) detailsArea.classList.add("hidden");
    const addGroupBtn = document.getElementById("add-custom-group-btn");
    if (addGroupBtn) addGroupBtn.style.display = 'block';
    const addPassBtn = document.getElementById("add-custom-pass-btn");
    if (addPassBtn) addPassBtn.style.display = 'block';
    showView("programs-view");
}

function renderPassesInGroup(groupId) {
    const selector = document.getElementById("pass-selector-list");
    if (!selector) return;
    const customGroups = programData.customGroups || [];
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...customGroups];
    const groupDef = ALL_GROUPS.find(g => g.id === groupId) || { id: groupId, name: groupId === '__ungrouped__' ? 'Other' : groupId, icon: groupId === '__ungrouped__' ? '📁' : '📁' };
    currentViewGroupId = groupId;
    const hint = document.getElementById('groups-hint-bubble');
    if (hint) {
        hint.querySelector('span').textContent = 'Tap a workout to see its exercises';
    }
    const passesInGroup = groupId === '__ungrouped__'
        ? programData.routine.filter(p => !Array.isArray(p.groups) || p.groups.length === 0)
        : programData.routine.filter(p => Array.isArray(p.groups) && p.groups.includes(groupId));
    selector.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    selector.style.transform = 'translateX(30px)';
    selector.style.opacity = '0';
    setTimeout(() => {
        const addGroupBtn = document.getElementById("add-custom-group-btn");
        if (addGroupBtn) addGroupBtn.style.display = 'none';
        selector.innerHTML = "";
        selector.style.cssText = "display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; transition: transform 0.3s ease, opacity 0.3s ease; transform: translateX(30px); opacity: 0;";
        let backBtn = document.getElementById("group-back-btn");
        if (!backBtn) {
            backBtn = document.createElement("button");
            backBtn.id = "group-back-btn";
            selector.parentElement.insertBefore(backBtn, selector);
        }
        backBtn.style.cssText = `
            display: flex; align-items: center; gap: 8px;
            background: none; border: none; color: var(--primary);
            font-size: 14px; font-weight: 700; cursor: pointer;
            padding: 0 0 16px 0; width: 100%;
        `;
        backBtn.innerHTML = `← ${groupDef.icon} ${groupDef.name}`;
        backBtn.onclick = () => {
            backBtn.style.transition = 'opacity 0.25s ease';
            backBtn.style.opacity = '0';
            const addPassBtn = document.getElementById("add-custom-pass-btn");
            if (addPassBtn) {
                addPassBtn.style.transition = 'opacity 0.25s ease';
                addPassBtn.style.opacity = '0';
            }
            selector.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
            selector.style.transform = 'translateX(60px)';
            selector.style.opacity = '0';
            setTimeout(() => {
                const detailsArea = document.getElementById("program-details-area");
                if (detailsArea) detailsArea.classList.add("hidden");
                backBtn.style.display = 'none';
                backBtn.style.opacity = '1';
                backBtn.style.transition = '';
                selector.innerHTML = "";
                selector.style.transition = 'none';
                selector.style.transform = 'translateX(-60px)';
                selector.style.opacity = '0';
                // Visa båda knapparna samtidigt med samma transition
                const addGroupBtn = document.getElementById("add-custom-group-btn");
                const addPassBtn2 = document.getElementById("add-custom-pass-btn");
                [addGroupBtn, addPassBtn2].forEach(btn => {
                    if (btn) {
                        btn.style.opacity = '0';
                        btn.style.display = 'block';
                        btn.style.transition = 'opacity 0.35s ease';
                    }
                });
                currentViewGroupId = null;
                renderGroupsView();
                setTimeout(() => {
                    [addGroupBtn, addPassBtn2].forEach(btn => {
                        if (btn) btn.style.opacity = '1';
                    });
                    selector.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
                    selector.style.transform = 'translateX(0)';
                    selector.style.opacity = '1';
                }, 30);
            }, 300);
        };
        const icons = [' ⚡ ', ' 🔥 ', ' 🏆 ', ' 💎 '];
        passesInGroup.forEach(pass => {
            const passIdx = programData.routine.indexOf(pass);
            const passCard = document.createElement("div");
            passCard.className = "prog-card";
           passCard.style.cssText = `
                position: relative; min-height: 120px; overflow: hidden;
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                border-top: 3px solid #f59e0b;
                border-left: none;
                border-right: none;
                border-bottom: none;
                border-radius: 16px;
            `;
passCard.innerHTML = `
                <div style="position:absolute; left:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
                <div style="position:absolute; right:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
                <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.3) 50%, rgba(245,158,11,0.1) 100%);"></div>
                <div style="font-size:28px;">${icons[passIdx % 4]}</div>
                <h4 style="font-size: 14px; margin: 8px 0 4px 0; line-height: 1.3;">${pass.name}</h4>
                <div style="font-size:10px; color:var(--primary); font-weight:800;">${pass.exercises.length} ${pass.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</div>
                ${pass.duration ? `<div style="position:absolute; top:8px; left:10px; font-size:10px; color:#f59e0b; font-weight:600; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); padding: 3px 7px; border-radius: 8px;">⏱️ ~${pass.duration} min</div>` : ''}
                <div onclick="event.stopPropagation(); openEditProgramModal(${passIdx})"
                    style="position: absolute; top: 6px; right: 6px; font-size: 12px; opacity: 0.6; cursor: pointer; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);">✏️</div>
            `;
            passCard.onclick = () => {
                document.querySelectorAll(".prog-card").forEach(c => c.classList.remove("active"));
                passCard.classList.add("active");
                showProgramDetails(passIdx);
            };
            selector.appendChild(passCard);
        });
        if (passesInGroup.length === 0) {
            const emptyCard = document.createElement("div");
            emptyCard.style.cssText = `
                grid-column: span 2;
                padding: 40px 20px;
                text-align: center;
                background: rgba(255,255,255,0.03);
                border: 1px dashed rgba(255,255,255,0.1);
                border-radius: 20px;
            `;
            emptyCard.innerHTML = `
                <div style="font-size: 36px; margin-bottom: 12px; opacity: 0.4;">🏋️</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-light); margin-bottom: 8px;">No workouts yet</div>
                <div style="font-size: 12px; color: var(--text-light); opacity: 0.6;">Add a workout to this group via the button below</div>
                <div style="font-size: 24px; margin-top: 8px;">👇</div>
            `;
            selector.appendChild(emptyCard);
        }
        setTimeout(() => {
            selector.style.transform = 'translateX(0)';
            selector.style.opacity = '1';
        }, 50);
    }, 200);
    const detailsArea = document.getElementById("program-details-area");
    if (detailsArea) detailsArea.classList.add("hidden");
    showView("programs-view");
}

// Snabbmeny för grupptilldelning direkt från passkortet
function openGroupPickerForPass(passIdx) {
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(true);
    const pass = programData.routine[passIdx];
    if (!pass) return;
    if (!Array.isArray(pass.groups)) pass.groups = [];
    const customGroups = programData.customGroups || [];
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...customGroups];
    pass.groups.forEach(gId => {
        if (!ALL_GROUPS.find(g => g.id === gId)) {
            ALL_GROUPS.push({ id: gId, name: gId, icon: "⚠️" });
        }
    });
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom:8px;">Select Group</h3>
        <p style="text-align:center; font-size:12px; color:var(--text-light); margin-bottom:20px;">${pass.name}</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            ${ALL_GROUPS.map(g => {
                const isSelected = pass.groups.includes(g.id);
                const isUnknown = g.icon === "⚠️";
                return `
                <button onclick="togglePassGroup(${passIdx}, '${g.id}')" id="grouppicker-${g.id}"
                    style="padding: 14px 10px; border-radius: 14px; 
                    border: 1px solid ${isSelected ? (isUnknown ? 'var(--danger)' : 'var(--primary)') : 'rgba(255,255,255,0.1)'}; 
                    background: ${isSelected ? (isUnknown ? 'rgba(239,68,68,0.15)' : 'rgba(34,211,238,0.15)') : 'rgba(255,255,255,0.04)'}; 
                    color: ${isSelected ? (isUnknown ? 'var(--danger)' : 'var(--primary)') : 'var(--text-light)'}; 
                    font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s ease;
                    display: flex; flex-direction: column; align-items: center; gap: 6px;">
                    <span style="font-size: 22px;">${g.icon}</span>
                    ${isUnknown ? `<span style="font-size:9px; color:var(--danger);">Old group</span>` : ''}
                    ${g.name}
                    ${isSelected ? '<span style="font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px;">✓ Selected</span>' : ''}
                </button>`;
            }).join('')}
        </div>
       <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); margin: 4px 0 16px 0;"></div>
        <button class="btn-danger" onclick="confirmDeleteWorkoutFromPicker(${passIdx})">🗑️ Delete Workout Permanently</button>
        <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); closeModal(); renderGroupsView();"
            style="width:100%; margin-top:10px; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); 
            border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45); 
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
            Close
        </button>
    `;
    openModal();
}

async function createCustomGroup(passIdx) {
    const input = document.getElementById("new-group-input");
    const name = input ? input.value.trim() : "";
    if (!name) return;

    const pass = programData.routine[passIdx];
    if (!Array.isArray(pass.groups)) pass.groups = [];

    // Använd namnet som id (lowercase, inga mellanslag)
    const id = name.toLowerCase().replace(/\s+/g, "-");

    if (!pass.groups.includes(id)) {
        pass.groups.push(id);
    }

    await saveCustomProgramToSupabase();

    // Öppna pickern igen så den nya gruppen syns
    openGroupPickerForPass(passIdx);
}

async function togglePassGroup(passIdx, groupId) {
    const pass = programData.routine[passIdx];
    if (!Array.isArray(pass.groups)) pass.groups = [];

    const idx = pass.groups.indexOf(groupId);
    if (idx > -1) {
        pass.groups.splice(idx, 1);
    } else {
        pass.groups.push(groupId);
    }

    // Uppdatera knappens utseende DIREKT (innan Supabase-sparning)
    const isSelected = pass.groups.includes(groupId);
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...(programData.customGroups || [])];
    const groupDef = ALL_GROUPS.find(g => g.id === groupId) || { id: groupId, name: groupId, icon: "📁" };
    const btn = document.getElementById(`grouppicker-${groupId}`);
    if (btn) {
        btn.style.border = `1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`;
        btn.style.background = isSelected ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)';
        btn.style.color = isSelected ? 'var(--primary)' : 'var(--text-light)';
        btn.innerHTML = `
            <span style="font-size: 22px;">${groupDef.icon}</span>
            ${groupDef.name}
            ${isSelected ? '<span style="font-size:9px; color:var(--primary); font-weight:900; text-transform:uppercase; letter-spacing:1px;">✓ Selected</span>' : ''}
        `;
    }

    // Spara till Supabase i bakgrunden utan att blockera UI
    saveCustomProgramToSupabase();
}

function showProgramDetails(idx) {
    const pass = programData.routine[idx];
    const detailsArea = document.getElementById("program-details-area");
    const list = document.getElementById("program-exercise-list");
    const actionBtns = document.getElementById("programs-action-btns");
    if (!pass || !detailsArea || !list) return;

    if (!detailsArea.classList.contains("hidden") && detailsArea.dataset.openIdx == idx) {
        // Avmarkera passet direkt
        document.querySelectorAll(".prog-card").forEach(c => c.classList.remove("active"));
        detailsArea.dataset.openIdx = "";

        // Fade ut mjukt
        detailsArea.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        detailsArea.style.opacity = '0';
        detailsArea.style.transform = 'translateY(8px)';

        // Glid in knapparna mjukt samtidigt
        if (actionBtns) {
            actionBtns.style.transition = 'opacity 0.25s ease';
            actionBtns.style.opacity = '0';
        }

        setTimeout(() => {
            detailsArea.classList.add("hidden");
            detailsArea.style.opacity = '';
            detailsArea.style.transform = '';
            if (actionBtns) {
                actionBtns.style.opacity = '1';
            }
        }, 100);
        return;
    }

    // Öppna med animation
    detailsArea.dataset.openIdx = idx;
    detailsArea.style.opacity = '0';
    detailsArea.style.transform = 'translateY(10px)';
    detailsArea.classList.remove("hidden");

    list.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid var(--glass-border);">
            <h3 style="margin:0; text-align:left; font-size:18px;">${pass.name}</h3>
            <button class="order-btn" style="background:var(--primary); color:#0f172a; padding:8px 15px; border-radius:10px; font-weight:800; border:none; cursor:pointer; font-size:12px;" onclick="openEditProgramModal(${idx})">Edit</button>
        </div>
        ${pass.exercises.map(e => `
        <div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
            <span style="font-weight:600;">${e.name}</span>
            <small style="color:var(--primary); font-weight:800; text-transform:uppercase; font-size:9px;">${CATEGORY_DISPLAY[e.target] || e.target}</small>
        </div>
        `).join("")}
    `;

    setTimeout(() => {
        detailsArea.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        detailsArea.style.opacity = '1';
        detailsArea.style.transform = 'translateY(0)';
    }, 30);
}

function openCreateGroupModal() {
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align:center; margin-bottom: 24px;">
            <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto 14px auto;">📁</div>
            <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #fff;">Create your own Group</h3>
            <p style="margin: 0; font-size: 12px; color: var(--text-light);">Give your group a name that makes sense to you</p>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
            <label style="font-size:10px; color:var(--primary); text-transform:uppercase; letter-spacing:2px; display:block; text-align:center; margin-bottom:10px; font-weight:700;">Group Name</label>
            <input type="text" id="custom-group-name-input" class="log-input" 
                placeholder="e.g. Arms, Core, Cardio..." 
                style="text-align:center; margin:0; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
        </div>

                <button class="mode-btn blue" onclick="saveCustomGroupFromModal()" style="
            width:100%; flex-direction: row; gap: 10px; padding: 16px;
            position: relative; overflow: hidden;
            border-left: 4px solid rgba(34,211,238,0.8);
            border-radius: 16px;
        ">
            <div style="position:absolute; top:0; left:0; right:0; height:2px; background: linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 100%);"></div>
            <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 100%);"></div>
            <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);"></div>
            <span style="font-size: 18px;">✚</span>
            <span style="font-size: 15px; font-weight: 400; letter-spacing: 0.5px;">Add Group</span>
        </button>
    `;
    openModal();
}

function openEditGroupModal(groupId, groupDef) {
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom:20px;">
            <span style="font-size:28px; display:block; margin-bottom:8px;">${groupDef.icon}</span>
            Edit Group
        </h3>
        <label style="font-size:11px; color:var(--text-light); text-transform:uppercase; letter-spacing:1px; display:block; text-align:center; margin-bottom:8px;">Group Name</label>
        <input type="text" id="edit-group-name-input" class="log-input" value="${groupDef.name}" style="text-align:center; margin-bottom:20px;">
        <button class="mode-btn blue" onclick="saveGroupNameEdit('${groupId}')" style="width:100%; margin-bottom:10px;">
            Save New Name
        </button>
        <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); margin: 16px 0;"></div>
        <button class="btn-danger" onclick="confirmDeleteGroup('${groupId}')">🗑️ Delete Group</button>
        <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); closeModal();" 
            style="width:100%; margin-top:10px; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45);">
            Close
        </button>
    `;
    openModal();
}

async function saveGroupNameEdit(groupId) {
    const input = document.getElementById("edit-group-name-input");
    const newName = input ? input.value.trim() : "";
    if (!newName) {
        if (input) input.style.border = '1px solid var(--danger)';
        return;
    }

    // Uppdatera i customGroups om det är en egen grupp
    if (programData.customGroups) {
        const customGroup = programData.customGroups.find(g => g.id === groupId);
        if (customGroup) {
            customGroup.name = newName;
            await saveCustomProgramToSupabase();
            closeModal();
            renderGroupsView();
            return;
        }
    }

    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(false);
    closeModal();
    renderGroupsView();
}

async function confirmDeleteGroup(groupId) {
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">🗑️</div>
            <h3 style="color:var(--danger); margin: 0 0 10px 0;">Delete Group?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px; line-height:1.4;">
                Workout Group will be deleted, but all workouts will remain — they will be moved to "Other".
            </p>
            <button class="mode-btn" onclick="deleteGroup('${groupId}')" 
                style="width:100%; background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700; padding:14px;">
                Yes, delete group!
            </button>
            <button class="mode-btn glass-border" onclick="closeModal()" style="width:100%; padding:12px;">
                Cancel
            </button>
        </div>
    `;
}

async function deleteGroup(groupId) {
    // Ta bort grupptillhörighet från alla pass
    programData.routine.forEach(pass => {
        if (Array.isArray(pass.groups)) {
            pass.groups = pass.groups.filter(g => g !== groupId);
        }
    });

    // Ta bort från customGroups om det är en egen grupp
    if (programData.customGroups) {
        programData.customGroups = programData.customGroups.filter(g => g.id !== groupId);
    }

    await saveCustomProgramToSupabase();
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(false);
    closeModal();
    renderGroupsView();
}

function selectPredefinedGroup(groupId) {
    const btn = document.getElementById(`predef-${groupId}`);
    if (btn) {
        btn.style.border = '1px solid var(--primary)';
        btn.style.background = 'rgba(34, 211, 238, 0.15)';
        btn.style.color = 'var(--primary)';
    }
    setTimeout(() => {
        closeModal();
        renderGroupsView();
    }, 400);
}

async function saveCustomGroupFromModal() {
    const input = document.getElementById("custom-group-name-input");
    const name = input ? input.value.trim() : "";
    if (!name) {
        if (input) input.style.border = '1px solid var(--danger)';
        return;
    }
    if (!programData.customGroups) programData.customGroups = [];
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[åä]/g, "a").replace(/ö/g, "o");
    if (!programData.customGroups.find(g => g.id === id)) {
        programData.customGroups.push({ id, name, icon: "📁" });
        await saveCustomProgramToSupabase();
    }
    closeModal();
    renderGroupsView();
}


// Motsvarar generateSelectedExercisesSummaryHtml
function generateSelectedExercisesSummaryHtmlForEdit(idx) {
    const hasChoices = window.temporarySelectedExercisesForEdit.length > 0;
    if (!hasChoices) return "";

    let summaryHtml = `
    <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); margin-bottom:8px; text-align:center; font-weight:600; letter-spacing:0.5px;">Selected exercises in this set</p>
    <div style="display:flex; flex-wrap:wrap; gap:6px; background:rgba(255,255,255,0.03); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); max-height:100px; overflow-y:auto; margin-bottom:12px;">
    `;
    
    window.temporarySelectedExercisesForEdit.forEach(exId => {
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
    <button id="multi-save-edit-exercises-btn" class="mode-btn green" style="width: 100%; padding: 15px; font-weight: bold; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);" onclick="confirmAndAddAllSelectedExercisesForEdit(${idx})">
        Add ${window.temporarySelectedExercisesForEdit.length} selected exercises  ➕
    </button>
    `;
    return summaryHtml;
}

// Motsvarar toggleSelectExerciseInPicker
function toggleSelectExerciseInPickerForEdit(idx, exId, category) {
    const index = window.temporarySelectedExercisesForEdit.indexOf(exId);
    const card = document.getElementById(`picker-edit-ex-${exId}`);
    const icon = document.getElementById(`picker-edit-icon-${exId}`);

    if (index > -1) {
        window.temporarySelectedExercisesForEdit.splice(index, 1);
        if (card) {
            card.style.setProperty('background', 'transparent', 'important');
            card.style.setProperty('border', '1px solid rgba(255,255,255,0.08)', 'important');
        }
        if (icon) {
            icon.textContent = "+";
            icon.style.color = "var(--primary)";
        }
    } else {
        window.temporarySelectedExercisesForEdit.push(exId);
        if (card) {
            card.style.setProperty('background', 'rgba(34, 197, 94, 0.15)', 'important');
            card.style.setProperty('border', '1px solid #22c55e', 'important');
        }
        if (icon) {
            
            icon.textContent = " ✅ ";
            icon.style.color = "#22c55e";
        }
    }

    const container = document.getElementById("selected-edit-summary-container");
    if (container) {
        container.innerHTML = generateSelectedExercisesSummaryHtmlForEdit(idx);
    }
}

// Motsvarar confirmAndAddAllSelectedExercises - sparar ner alla valda och laddar om vyn
function confirmAndAddAllSelectedExercisesForEdit(idx) {
    if (!window.temporarySelectedExercisesForEdit || window.temporarySelectedExercisesForEdit.length === 0) return;
    const pass = programData.routine[idx];
    if (!pass) return;
    window.temporarySelectedExercisesForEdit.forEach(exId => {
        const ex = masterExercises.find(e => e.id == exId);
        if (ex) {
            pass.exercises.push({ id: ex.id, name: ex.name, target: ex.target });
        }
    });
    window.temporarySelectedExercisesForEdit = [];
    localStorage.removeItem('temp_exercise_edit_draft');
    const exercisesDiv = document.getElementById("edit-pass-exercises");
    if (exercisesDiv) {
        exercisesDiv.innerHTML = pass.exercises.length === 0 ? `
            <div style="text-align:center; padding:20px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.08); border-radius:14px; margin-bottom:10px;">
                <div style="font-size:24px; margin-bottom:8px; opacity:0.4;">🏋️</div>
                <div style="font-size:13px; color:var(--text-light); opacity:0.6;">No exercises added yet — use the section above</div>
            </div>
        ` : pass.exercises.map((ex, i) => `
            <div class="edit-item-row" id="edit-ex-row-${i}" style="cursor: default;">
                <div class="edit-drag-handle" style="
                    width: 28px; height: 28px; border-radius: 8px;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                    cursor: grab; font-size: 14px; color: rgba(255,255,255,0.4);
                    flex-shrink: 0;">⠿</div>
                <span style="flex-grow:1; margin-left:15px; font-size:14px; font-weight:600;">${ex.name}</span>
                <button onclick="removeExFromPass(${idx}, ${i})" style="color:var(--danger); background:none; border:none; font-size:18px;">✖</button>
            </div>`).join("");
    }
    const summaryContainer = document.getElementById("selected-edit-summary-container");
    if (summaryContainer) summaryContainer.innerHTML = "";
    saveCustomProgramToSupabase();
    setTimeout(() => {
        initEditExerciseDragAndDrop(idx);
        const exercisesDiv = document.getElementById("edit-pass-exercises");
        const modalContent = document.querySelector('.modal-content');
        if (exercisesDiv && modalContent) {
            const lastRow = exercisesDiv.lastElementChild;
            if (lastRow) {
                const rowRect = lastRow.getBoundingClientRect();
                const modalRect = modalContent.getBoundingClientRect();
                const scrollTarget = modalContent.scrollTop + rowRect.bottom - modalRect.bottom + 20;
                modalContent.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }
        }
    }, 100);
}

function saveEditDraftStateAndCreateNew(idx) {
    localStorage.setItem('temp_exercise_edit_draft', JSON.stringify(window.temporarySelectedExercisesForEdit || []));
    
    const nameInput = document.getElementById("edit-pass-name");
    if (nameInput && nameInput.value.trim()) {
        programData.routine[idx].name = nameInput.value.trim();
    }

    const modalContent = document.querySelector('.modal-content');
    window._savedEditScrollPos = modalContent ? modalContent.scrollTop : 0;
    window._returnToEditIdx = idx;
    
    if (typeof openCreateExerciseModal === 'function') {
        openCreateExerciseModal((newEx) => {
            window._returnToEditIdx = null;
            window._scrollToExercises = true;  // Sätt flaggan här
            const saved = localStorage.getItem('temp_exercise_edit_draft');
            let currentDraft = saved ? JSON.parse(saved) : [];
            if (newEx && newEx.id) {
                currentDraft.push(newEx.id);
            }
            localStorage.setItem('temp_exercise_edit_draft', JSON.stringify(currentDraft));
            openEditProgramModal(idx);
        });
    }
    // Säkerställ att Close-knappen alltid är synlig i create exercise-vyn
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(false);
}

// SKICKAR VALD ÖVNING ASYNKRONT IN I PROGRAMRUTINEN
async function addExerciseToPassDirectly(pIdx, exId) {
    const ex = masterExercises.find(e => e.id == exId);
    if (!ex) return;

    programData.routine[pIdx].exercises.push({ name: ex.name, target: ex.target, defaultSets: 3 });

    if (typeof saveCustomProgramToSupabase === 'function') {
        saveCustomProgramToSupabase();
    } else {
        localStorage.setItem("myCustomProgram", JSON.stringify(programData));
    }

    await openEditProgramModal(pIdx);
}

async function openEditProgramModal(idx) {
    console.log("openEditProgramModal anropad med idx:", idx);
    const pass = programData.routine[idx];
    console.log("pass:", pass);
    const body = document.getElementById("modal-body");
    console.log("body:", body);
    if (!pass || !body) {
        console.log("RETURNERAR TIDIGT - pass eller body saknas");
        return;
    }
    
    // Spara originalstate bara om det inte redan finns ett (bevara genom Continue Editing)
    if (!window._editPassOriginalState) {
        window._editPassOriginalState = JSON.stringify({
            name: pass.name,
            exercises: pass.exercises
        });
    }
    
    body.style.display = "";
    body.style.flexDirection = "";
    body.style.justifyContent = "";
    body.style.alignItems = "";
    body.style.gap = "";
    const savedDraft = localStorage.getItem('temp_exercise_edit_draft');
    if (savedDraft) {
        window.temporarySelectedExercisesForEdit = JSON.parse(savedDraft);
        localStorage.removeItem('temp_exercise_edit_draft');
    } else {
        window.temporarySelectedExercisesForEdit = [];
    }
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...(programData.customGroups || []), { id: '__ungrouped__', name: 'Other', icon: '📁' }];
    body.innerHTML = `
        <h3 style="margin-bottom: 8px;">Workout Name</h3>
        <input type="text" id="edit-pass-name" class="log-input" placeholder="e.g. Upper Body A, Leg Day..." value="${pass.name === 'New Workout' ? '' : pass.name}" style="text-align: center;">
        <div id="modal-exercise-picker-container"></div>
        <div class="separator" style="margin: 25px 0;"></div>
        <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Current Exercises</p>
        <div id="edit-pass-exercises">
        ${pass.exercises.length === 0 ? `
            <div style="text-align:center; padding:20px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.08); border-radius:14px; margin-bottom:10px;">
                <div style="font-size:24px; margin-bottom:8px; opacity:0.4;">🏋️</div>
                <div style="font-size:13px; color:var(--text-light); opacity:0.6;">No exercises added yet — use the section above</div>
            </div>
        ` : pass.exercises.map((ex, i) => `
            <div class="edit-item-row" id="edit-ex-row-${i}" style="cursor: default;">
                <div class="edit-drag-handle" style="
                    width: 28px; height: 28px; border-radius: 8px;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                    cursor: grab; font-size: 14px; color: rgba(255,255,255,0.4);
                    flex-shrink: 0;">⠿</div>
                <span style="flex-grow:1; margin-left:15px; font-size:14px; font-weight:600;">${ex.name}</span>
                <button onclick="removeExFromPass(${idx}, ${i})" style="color:var(--danger); background:none; border:none; font-size:18px;">✖</button>
            </div>`).join("")}
        </div>
        <div class="separator" style="margin: 25px 0;"></div>
        <div>
            <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px; letter-spacing:1px;">Select Group to Organize Workout</p>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
                ${ALL_GROUPS.map(g => {
                    const isSelected = Array.isArray(pass.groups) && pass.groups.includes(g.id);
                    return `
                    <button id="editgroup-${g.id}"
                        onclick="(async () => { 
                            await togglePassGroup(${idx}, '${g.id}'); 
                            const isNow = Array.isArray(programData.routine[${idx}].groups) && programData.routine[${idx}].groups.includes('${g.id}'); 
                            const b = document.getElementById('editgroup-${g.id}'); 
                            if(b) { 
                                b.style.border = '1px solid ' + (isNow ? 'var(--primary)' : 'rgba(255,255,255,0.1)'); 
                                b.style.background = isNow ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)'; 
                                b.style.color = isNow ? 'var(--primary)' : 'var(--text-light)'; 
                            } 
                        })()"
                        style="padding: 10px 5px; border-radius: 12px; width: 72px; 
                        border: 1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; 
                        background: ${isSelected ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)'}; 
                        color: ${isSelected ? 'var(--primary)' : 'var(--text-light)'}; 
                        font-size: 11px; font-weight: 700; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <span style="font-size:18px;">${g.icon}</span>
                        ${g.name}
                    </button>`;
                }).join('')}
            </div>
        </div>
       <div class="separator" style="margin: 25px 0;"></div>
        <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px; letter-spacing:1px;">Estimated Workout Duration</p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px;">
            <span style="font-size: 20px;">⏱️</span>
            <input type="number" id="edit-pass-duration" class="log-input" placeholder="e.g. 60" value="${pass.duration || ''}" 
                style="margin: 0; text-align: center; width: 80px; -moz-appearance: textfield;"
                onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)">
            <span style="font-size: 12px; color: var(--text-light); font-weight: 700;">min</span>
        </div>
        <div class="separator" style="margin: 25px 0;"></div>
        <div>
            <button class="mode-btn glass-border" style="font-size:13px; padding:10px; border: 2px dashed rgba(34, 211, 238, 0.4); color: var(--primary); background: rgba(34, 211, 238, 0.04); font-weight: 700;" 
                   onclick="saveEditDraftStateAndCreateNew(${idx})">+ Create new exercise to the library</button>
        </div>
        <button class="mode-btn blue" style="margin-top:20px;" onclick="saveProgramEdit(${idx})">Save all changes</button>
        <button class="btn-danger" onclick="deleteEntireProgram(${idx})">🗑️ Delete Workout Permanently</button>
        <button onclick="closeEditProgramModal(${idx})" style="margin-top: 15px; width:100%; padding:14px; border-radius:16px; border:1px solid rgba(255,255,255,0.25); border-top:1px solid rgba(255,255,255,0.45); background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); color:white; font-weight:700; cursor:pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">Close</button>
    `;
    openModal(true);
    // Dölj den globala Close-knappen så bara vår egna syns
    hideDefaultCloseButton(true);
    setTimeout(() => {
        if (typeof renderExercisePickerForEdit === 'function') {
            renderExercisePickerForEdit(idx, "Legs");
        }
        if (typeof window._savedEditScrollPos !== 'undefined' && window._savedEditScrollPos > 0) {
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = window._savedEditScrollPos;
            window._savedEditScrollPos = 0;
        }
        if (window._scrollToExercises) {
            window._scrollToExercises = false;
            setTimeout(() => {
                const summaryContainer = document.getElementById("selected-edit-summary-container");
                const modalContent = document.querySelector('.modal-content');
                if (summaryContainer && modalContent) {
                    const rect = summaryContainer.getBoundingClientRect();
                    const modalRect = modalContent.getBoundingClientRect();
                    const scrollTarget = modalContent.scrollTop + rect.top - modalRect.top - 20;
                    modalContent.scrollTo({ top: scrollTarget, behavior: 'smooth' });
                }
            }, 100);
        }       
        initEditExerciseDragAndDrop(idx);
    }, 50);
}

function renderExercisePickerForEdit(idx, category = "Ben", subtarget = null) {
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
    let html = `<div class="separator" style="margin: 12px 0 18px 0;"></div>`;
    html += `<h3 style="margin: 0 0 15px 0; color: var(--primary); font-size: 1.2rem; text-align: center; text-transform: uppercase; letter-spacing: 1px;">ADD EXERCISES</h3>`;
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Select Category</p>`;
    html += `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">`;
    categories.forEach(cat => {
        const isActive = cat.name === category;
        html += `
        <button onclick="renderExercisePickerForEdit(${idx}, '${cat.name}', null)"
            style="padding:10px 5px; font-size:11px; border-radius:12px; border:1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
            background:${isActive ? 'rgba(34, 211, 238, 0.1)' : 'var(--card)'}; color:${isActive ? 'var(--primary)' : 'white'}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:16px;">${cat.icon}</span> ${CATEGORY_DISPLAY[cat.name] || cat.name}
        </button>`;
    });
    html += `</div>`;

    const subs = SUBCATEGORIES[category] || [];
    if (subs.length > 0) {
        html += `<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:15px;">`;
        html += `<div style="font-size:9px; color:rgba(255,255,255,0.25); text-transform:uppercase; letter-spacing:2px; text-align:center;">Filter by Muscle</div>`;
        html += `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:6px;">`;
        html += `<button onclick="renderExercisePickerForEdit(${idx}, '${category}', null)"
            style="padding:4px 12px; border-radius:20px; border:1px solid ${!subtarget ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}; 
            background:${!subtarget ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'}; 
            color:${!subtarget ? 'var(--primary)' : 'var(--text-light)'}; font-size:11px; font-weight:600; cursor:pointer;">All</button>`;
        subs.forEach(sub => {
            html += `<button onclick="renderExercisePickerForEdit(${idx}, '${category}', '${sub}')"
                style="padding:4px 12px; border-radius:20px; border:1px solid ${subtarget === sub ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}; 
                background:${subtarget === sub ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'}; 
                color:${subtarget === sub ? 'var(--primary)' : 'var(--text-light)'}; font-size:11px; font-weight:600; cursor:pointer;">${sub}</button>`;
        });
        html += `</div></div>`;
    }

    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px; margin-top: 18px;">Exercises</p>`;
    html += `<div style="max-height:280px; overflow-y:auto; padding-right:5px; background:rgba(0,0,0,0.2); border-radius:15px; padding:10px; margin-bottom:15px; display:flex; flex-direction:column; gap:8px;">`;
    
    const filtered = masterExercises.filter(ex => {
        const matchCategory = category === "Armar"
            ? (ex.target === "Biceps" || ex.target === "Triceps" || ex.target === "Armar")
            : ex.target === category;
        const matchSubtarget = !subtarget || ex.subtarget === subtarget ||
            (category === "Armar" && !ex.subtarget && ex.target === subtarget);
        return matchCategory && matchSubtarget;
    });

    if (filtered.length === 0) {
        html += `<p style="text-align:center; font-size:12px; color:var(--text-light); padding:10px;">No exercises found.</p>`;
    }
    filtered.forEach(ex => {
        const isSelectedInBatch = window.temporarySelectedExercisesForEdit.includes(ex.id);
        const currentBg = isSelectedInBatch ? 'rgba(34, 197, 94, 0.15)' : 'transparent';
        const currentBorder = isSelectedInBatch ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)';
        const currentIcon = isSelectedInBatch ? '✅' : '+';
        html += `
        <div class="card glass" id="picker-edit-ex-${ex.id}" style="padding:12px; margin:0; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-radius:12px; background: ${currentBg} !important; border: ${currentBorder} !important; transition: all 0.2s;"
            onclick="toggleSelectExerciseInPickerForEdit(${idx}, ${ex.id}, '${category}')">
            <div>
                <span style="font-size:13px; font-weight:600;">${ex.name}</span><br>
                <small style="color:${ex.subtarget === 'Compound' ? '#f59e0b' : 'var(--primary)'}; font-size:10px; font-weight:700; text-transform:uppercase;">
                    ${ex.subtarget ? ex.subtarget : (CATEGORY_DISPLAY[ex.target] || ex.target)}
                </small>
            </div>
            <span id="picker-edit-icon-${ex.id}" style="color:${isSelectedInBatch ? '#22c55e' : 'var(--primary)'}; font-size:18px; font-weight:bold;">${currentIcon}</span>
        </div>`;
    });
    html += `</div>`;
    html += `<div id="selected-edit-summary-container" style="margin-bottom:15px;">`;
    html += generateSelectedExercisesSummaryHtmlForEdit(idx);
    html += `</div>`;
    container.innerHTML = html;
}




// ==========================================================================
// DEL 3 AV 4: PROGRAMREDIGERING, HISTORIKHANTERING OCH AKTIVT PASS (DRAFT)
// ==========================================================================
// Central hjälpfunktion för att spara det aktiva pågående träningspasset (activeDraft)
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
    saveCustomProgramToSupabase();
    const pass = programData.routine[pIdx];
    const exercisesDiv = document.getElementById("edit-pass-exercises");
    if (exercisesDiv) {
        exercisesDiv.innerHTML = pass.exercises.length === 0 ? `
            <div style="text-align:center; padding:20px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.08); border-radius:14px; margin-bottom:10px;">
                <div style="font-size:24px; margin-bottom:8px; opacity:0.4;">🏋️</div>
                <div style="font-size:13px; color:var(--text-light); opacity:0.6;">No exercises added yet — use the section above</div>
            </div>
        ` : pass.exercises.map((ex, i) => `
            <div class="edit-item-row" id="edit-ex-row-${i}" style="cursor: default;">
                <div class="edit-drag-handle" style="
                    width: 28px; height: 28px; border-radius: 8px;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    display: flex; align-items: center; justify-content: center;
                    cursor: grab; font-size: 14px; color: rgba(255,255,255,0.4);
                    flex-shrink: 0;">⠿</div>
                <span style="flex-grow:1; margin-left:15px; font-size:14px; font-weight:600;">${ex.name}</span>
                <button onclick="removeExFromPass(${pIdx}, ${i})" style="color:var(--danger); background:none; border:none; font-size:18px;">✖</button>
            </div>`).join("");
    }
    setTimeout(() => initEditExerciseDragAndDrop(pIdx), 50);
}

function openCreateProgramModal() {
    // Skapa ett temporärt pass i minnet men spara det INTE än
    const tempPass = { 
        id: "pass-" + Date.now(), 
        name: "", 
        exercises: [], 
        groups: currentViewGroupId && currentViewGroupId !== '__ungrouped__' ? [currentViewGroupId] : [],
        _isTemp: true  // Flagga för att markera att det är temporärt
    };
    programData.routine.push(tempPass);
    const tempIdx = programData.routine.length - 1;
    openEditProgramModal(tempIdx);
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

async function updateWorkoutNameInHistory(oldName, newName) {
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
            if (workout.workout_data && workout.workout_data.programName === oldName) {
                workout.workout_data.programName = newName;
                updatedWorkouts.push(workout);
                updatedCount++;
            }
        });
        for (const workout of updatedWorkouts) {
            const { error: updateError } = await supabaseClient
                .from('workout_history')
                .update({ workout_data: workout.workout_data })
                .eq('id', workout.id)
                .eq('user_id', currentUser.id);
            if (updateError) throw updateError;
        }
        if (updatedCount > 0) {
            workoutHistory = historyData.map(w => ({
                id: w.id,
                date: w.workout_date,
                programName: w.workout_data.programName,
                totalTime: w.workout_data.totalTime,
                exercises: w.workout_data.exercises || []
            }));
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
            console.log(`Historiken uppdaterad: Ändrade "${oldName}" till "${newName}" på ${updatedCount} pass.`);
        }
    } catch (error) {
        console.error('Error updating workout name in history:', error);
    }
}

// Läser ut historisk data från den lokala variabeln (som är synkad med Supabase vid start)
function getExerciseHistory(exerciseName) {
  if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) return null;

  // försök tolka datum och hitta senaste passet
  const withDates = workoutHistory
    .map(w => ({ w, dt: w.date ? new Date(w.date) : new Date(0) }))
    .filter(x => x.dt.toString() !== 'Invalid Date');

  if (withDates.length === 0) return null;

  withDates.sort((a, b) => b.dt - a.dt); // nyast först
  const latest = withDates[0].w;

  if (!latest.exercises) return null;
  const exMatch = latest.exercises.find(e => e.name === exerciseName);
  if (!exMatch) return null;

  if (exMatch.sets_data && Array.isArray(exMatch.sets_data)) {
    return JSON.parse(JSON.stringify(exMatch.sets_data)); // deep copy
  }

  const count = parseInt(exMatch.sets || 3, 10) || 3;
  return Array.from({ length: count }, (_, i) => ({
    weight: exMatch.weight || "",
    reps: exMatch.reps || "",
    userConfirmed: false
  }));
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
                return { sets_data: historyCopy, isCompleted: false };
            }
            return { sets_data: [{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }], isCompleted: false };
        });
    }

    // Bevara befintligt ui_state om passet redan har ett (återkomst till pågående pass)
    const existingUiState = (activeDraft && activeDraft.ui_state) ? activeDraft.ui_state : null;

   activeDraft = {
        workout: JSON.parse(JSON.stringify(workout)),
        data,
        date: date || new Date().toISOString().split('T')[0],
        startTime: activeDraft?.startTime || new Date().toISOString(),
        secondsElapsed: secondsElapsed,
        isStarted: true,
        wasTimerRunning: true,
        ui_state: existingUiState || {}
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
    if (!activeDraft || !activeDraft.workout) {
        console.warn(" ⚠️  Inget aktivt utkast tillgängligt.");
        return;
    }
    if (activeDraft.data) {
        activeDraft.data.forEach((exerciseData, i) => {
            if (!exerciseData.isCompleted && exerciseData.sets_data) {
                const allConfirmed = exerciseData.sets_data.every(s => s.userConfirmed === true);
                const isOpen = activeDraft.ui_state?.openExercises?.includes(i);
                const hasWeightOrReps = exerciseData.sets_data.some(s => s.weight || s.reps);
                const isBrandNewAndGhostChecked = allConfirmed && !isOpen && !hasWeightOrReps;
                if (isBrandNewAndGhostChecked && exerciseData.sets_data.length > 0) {
                    exerciseData.sets_data.forEach(set => { set.userConfirmed = false; });
                }
            }
        });
    }
    document.getElementById("active-title").textContent = activeDraft.workout.name;
    const oldBadge = document.getElementById("start-time-badge");
    if (oldBadge) oldBadge.remove();
    const startTimeStr = activeDraft.startTime 
        ? new Date(activeDraft.startTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})
        : '';
    if (startTimeStr) {
        const startBadge = document.createElement("div");
        startBadge.id = "start-time-badge";
        startBadge.style.cssText = "display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:20px; padding:4px 12px; margin: 0 0 16px 15px;";
        startBadge.innerHTML = `<span style="font-size:14px;">⏱️</span><span style="font-size:11px; color:#22c55e; font-weight:600;">Workout Started ${startTimeStr}</span>`;
        document.getElementById("active-title").insertAdjacentElement('afterend', startBadge);
    }
    const list = document.getElementById("exercise-list");
    const footer = document.querySelector(".workout-footer");
    if (!list) return;
    list.innerHTML = "";
    if (!activeDraft.isStarted) {
        if (footer) footer.classList.add("hidden");
        list.innerHTML = `
        <div style="text-align:center; padding:20px 0;">
            <button class="mode-btn green" style="width:100%; padding:20px; font-size:18px; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);" onclick="actuallyStartWorkout()">START WORKOUT  🔥 </button>
        </div>
        <p style="color:var(--text-light); font-size:13px; text-align:center; margin-top:10px;">Klicka på knappen ovan för att starta klockan.</p>
        `;
        showView("workout-view");
        renderRestTimer();
        setTimeout(() => restoreRestTimerIfActive(), 50);
        return;
    }
    if (typeof renderCalendar === 'function') {
        const calendarView = document.getElementById("calendar-view");
        if (calendarView) {
            const originalDisplay = calendarView.style.display;
            calendarView.style.display = "none";
            renderCalendar();
            calendarView.style.display = originalDisplay;
        }
    }
    if (footer) {
        footer.classList.remove("hidden");
        footer.style.display = "flex";
        footer.style.alignItems = "center";
        footer.style.gap = "12px";
        footer.innerHTML = `
            <button id="pause-workout-btn" class="mode-btn save-draft-btn" onclick="saveDraftAndGoHome()" style="flex: 1;">Save draft  💾 </button>
            <button class="mode-btn green" onclick="finishWorkout()" style="flex: 1; font-weight: bold;">Finish Workout  ✅</button>
        `;
    }
    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    if (!activeDraft.ui_state.openExercises) activeDraft.ui_state.openExercises = [];
    const isFrittPass = activeDraft.workout.name === "Free Workout";
    const isReturning = activeDraft.ui_state.hasOwnProperty('hasInitializedOpen');
    if (!isFrittPass) {
        if (!activeDraft.ui_state.hasOwnProperty('hasInitializedOpen')) {
            activeDraft.ui_state.openExercises = [0];
            activeDraft.ui_state.hasInitializedOpen = true;
            if (typeof persistActiveWorkout === 'function') persistActiveWorkout();
        }
    }
    const openExercises = activeDraft.ui_state.openExercises;
    if (activeDraft.workout.exercises && activeDraft.workout.exercises.length > 0) {
        activeDraft.workout.exercises.forEach((ex, i) => {
            const exerciseData = activeDraft.data[i];
            if (!exerciseData) return;
            const isDone = exerciseData.isCompleted;
            const isOpen = openExercises.includes(i);
            const div = document.createElement("div");
            div.className = (isDone ? "exercise-done" : "");
            div.style.cssText = `
                position: relative;
                overflow: hidden;
                margin-bottom: 12px;
                padding: 0;
                border-radius: 16px;
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                border: none;
                border-left: 4px solid ${isDone ? '#22c55e' : isOpen ? '#22d3ee' : 'rgba(250,204,21,0.3)'};
                box-shadow: ${isDone ? '0 4px 12px rgba(34,197,94,0.08)' : isOpen ? '0 4px 12px rgba(34,211,238,0.08)' : '0 4px 12px rgba(0,0,0,0.3)'};
            `;
            div.id = `exercise-card-${i}`;
            const completedSets = exerciseData.sets_data ? exerciseData.sets_data.filter(s => s.userConfirmed).length : 0;
            const totalSets = exerciseData.sets_data ? exerciseData.sets_data.length : 0;
            const firstUnconfirmed = exerciseData.sets_data ? exerciseData.sets_data.findIndex(s => !s.userConfirmed) : -1;
            let setsHtml = `<div style="margin-top:10px;">
                <div style="display:grid; grid-template-columns: 40px 1fr 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
                    <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">SET</small>
                    <small style="text-align:center; color:var(--text-light); font-size:9px;">KG</small>
                    <small style="text-align:center; color:var(--text-light); font-size:9px;">REPS</small>
                    <small style="text-align:center; color:var(--text-light); font-size:9px;">REST (S)</small>
                    <span></span>
                </div>`;
            if (exerciseData.sets_data) {
                exerciseData.sets_data.forEach((set, sIdx) => {
                    const isLocked = isDone;
                    const isCurrent = !set.userConfirmed && !isDone;
                    const showSuccess = set.userConfirmed || isDone;
                    const circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
                    const statusContent = showSuccess ? ' ✅ ' : `#${sIdx + 1}`;
                    const showArrow = !isDone && isOpen && sIdx === firstUnconfirmed;
                    setsHtml += `
                    <div style="display:grid; grid-template-columns: 40px 1fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center; opacity: ${showSuccess ? '1' : isCurrent ? '1' : '0.35'}; transition: opacity 0.2s ease; position:relative; overflow:visible;">
                        ${showArrow ? '<div class="set-arrow">➔</div>' : ''}
                        <div onclick="${isLocked && !isDone ? '' : `confirmSet(${i}, ${sIdx})`}"
                            style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:800; background: ${showSuccess ? 'rgba(34, 197, 94, 0.2)' : (isCurrent ? 'rgba(250, 204, 21, 0.15)' : 'rgba(245, 158, 11, 0.05)')}; color: ${circleColor}; opacity: 1;">
                            ${statusContent}
                        </div>
                        <input type="text" inputmode="decimal" id="w-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'};" value="${set.weight || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${i}, ${sIdx})" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">
                        <input type="text" inputmode="decimal" id="r-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'};" value="${set.reps || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${i}, ${sIdx})" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">
                        ${sIdx < exerciseData.sets_data.length - 1 ? `<input type="text" inputmode="decimal" id="v-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'}; border-color: rgba(52, 152, 219, 0.3);" value="${set.rest || '120'}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${i}, ${sIdx})" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">` : `<div></div>`}
                        <button onclick="removeSetFromExercise(${i}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity: ${showSuccess ? '0.1' : isCurrent ? '0.8' : '0.4'};" ${showSuccess ? 'disabled' : ''}>×</button>
                    </div>`;
                    if (isCurrent && sIdx === firstUnconfirmed) {
                        setsHtml += `
                        <div style="grid-column: 2 / span 3; margin:-4px 0 8px 0; padding-left:2px; opacity:0.8; font-size:10px; color:var(--primary); font-weight:600; letter-spacing:0.3px;">
                            💡 Select ${statusContent} to lock & continue
                        </div>`;
                    }
                });
            }
            div.innerHTML = `
                <div style="position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 100%); pointer-events:none; z-index:2;"></div>
                <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%); pointer-events:none; z-index:2;"></div>
                <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%); pointer-events:none; z-index:2;"></div>
                <div onclick="toggleExercise(${i})" style="padding: 12px 15px; display: flex; align-items: center; cursor: pointer; background: ${isOpen ? 'rgba(250, 204, 21, 0.05)' : 'transparent'}">
                    <div style="width: 8px; flex-shrink: 0;"></div>
                    <div style="display: flex; flex-direction: column; min-width:0; flex-grow:1;">
                        <strong style="font-size: 14px; color: ${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration: ${isDone ? 'line-through' : 'none'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${ex.name}</strong>
                        <small style="color: ${isDone ? '#22c55e' : 'var(--primary)'}; font-size: 10px;">${isDone ? 'DONE  ✅ ' : `${completedSets}/${totalSets} set`}</small>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 10px;">
                        <button onclick="event.stopPropagation(); openReplaceExerciseModal(${i})" style="background:none; border:none; font-size:14px; padding:5px; opacity: 0.7;" ${isDone ? 'disabled' : ''}> 🔄 </button>
                        <button onclick="event.stopPropagation(); removeActiveExercise(${i})" style="background:none; border:none; font-size:14px; padding:5px; opacity: 0.7;" ${isDone ? 'disabled' : ''}> ✖ </button>
                        <span style="font-size: 10px; color: var(--text-light); margin-left: 5px; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0)'}; transition: 0.3s;"> ▼ </span>
                    </div>
                </div>
                <div style="padding: 0 15px 15px 15px; display: ${isOpen ? 'block' : 'none'}; border-top: 1px solid rgba(255,255,255,0.05);">
                    ${setsHtml}
                    <button class="mode-border glass-border" style="padding:8px; font-size:11px; margin-top:10px; border-style:dashed; width:100%;" onclick="addSetToExercise(${i})" ${isDone ? 'disabled' : ''}>+ Add set</button>
                    <button class="mode-btn ${isDone ? 'blue' : 'green'}" style="padding:12px; font-size:13px; margin-top:15px; width:100%; font-weight:bold;" onclick="toggleExerciseDone(${i})">
                        ${isDone ? 'Undo  ↩️ ' : 'Mark as Complete  ✅ '}
                    </button>
                </div>`;
            list.appendChild(div);
        });
    } else {
        const emptyNotice = document.createElement("p");
        emptyNotice.style.cssText = "color: var(--text-light); text-align: center; padding: 30px 10px; font-size: 14px;";
        emptyNotice.innerHTML = "This workout is empty. Click the button below to add your exercises!  👇 ";
        list.appendChild(emptyNotice);
    }
    const addBtn = document.createElement("button");
    addBtn.className = "mode-btn glass-border";
    addBtn.style.cssText = "margin-top:10px; margin-bottom: 25px; border: 2px dashed rgba(34, 211, 238, 0.4); color: var(--primary); background: rgba(34, 211, 238, 0.04); font-weight: 700; width:100%;";
    addBtn.innerHTML = " ➕ Add Exercise";
    addBtn.onclick = openCustomAddExerciseModal;
    list.appendChild(addBtn);
    const viewContainer = document.getElementById("workout-view");
    if (viewContainer) {
        const oldContainer = document.getElementById("discard-button-container");
        if (oldContainer) oldContainer.remove();
        const discardContainer = document.createElement("div");
        discardContainer.id = "discard-button-container";
        discardContainer.style.cssText = "width: 100%; padding: 0 10px; margin-top: 40px; margin-bottom: 20px; box-sizing: border-box;";
        const discardBtn = document.createElement("button");
        discardBtn.className = "btn-danger";
        discardBtn.style.cssText = "margin-top:20px;";
        discardBtn.innerHTML = "Delete Workout 🗑️";
        discardBtn.onclick = confirmDiscardActiveWorkout;
        discardContainer.appendChild(discardBtn);
        viewContainer.appendChild(discardContainer);
    }
    showView("workout-view");
    renderRestTimer();
    setTimeout(() => initDragAndDrop(), 50);
    if (isReturning && openExercises.length > 0 && !window._suppressAutoScroll) {
        const firstOpenIndex = openExercises.slice().sort((a, b) => a - b)[0];
        setTimeout(() => {
            window._suppressAutoScroll = false;
            const targetCard = document.getElementById(`exercise-card-${firstOpenIndex}`);
            if (targetCard) targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
    } else {
        window._suppressAutoScroll = false;
    }
}

function initDragAndDrop() {
    const list = document.getElementById("exercise-list");
    if (!list || typeof gsap === 'undefined' || typeof Draggable === 'undefined') return;
    const cards = Array.from(list.querySelectorAll("[id^='exercise-card-']"));
    if (cards.length === 0) return;
    list.querySelectorAll('.drag-handle').forEach(h => h.remove());
    cards.forEach((card, i) => {
        const handle = document.createElement("div");
        handle.style.cssText = `
            width: 28px; height: 28px; border-radius: 8px;
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
            display: flex; align-items: center; justify-content: center;
            cursor: grab; z-index: 10; font-size: 14px; color: rgba(255,255,255,0.4);
            flex-shrink: 0;
        `;
        handle.innerHTML = "⠿";
        handle.className = "drag-handle";
        const header = card.querySelector('div[onclick^="toggleExercise"]');
        if (header) {
            header.style.position = "relative";
            header.insertBefore(handle, header.firstChild);
        }
        let currentOrder = [...cards];
        const cardHeight = () => card.offsetHeight + 12;
        Draggable.create(card, {
            type: "y",
            trigger: handle,
            bounds: list,
            zIndexBoost: false,
            onDragStart: function() {
                window._isDragging = true;
                currentOrder = Array.from(list.querySelectorAll("[id^='exercise-card-']"));
                gsap.to(card, {
                    scale: 1.02,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                    duration: 0.2,
                    ease: "power2.out"
                });
                gsap.set(card, { zIndex: 100 });
            },
            onDrag: function() {
                const draggedIdx = currentOrder.indexOf(card);
                const movedSteps = Math.round(this.y / cardHeight());
                currentOrder.forEach((otherCard, otherIdx) => {
                    if (otherCard === card) return;
                    const diff = otherIdx - draggedIdx;
                    if (movedSteps > 0 && diff > 0 && diff <= movedSteps) {
                        gsap.to(otherCard, { y: -cardHeight(), duration: 0.2, ease: "power2.out" });
                    } else if (movedSteps < 0 && diff < 0 && diff >= movedSteps) {
                        gsap.to(otherCard, { y: cardHeight(), duration: 0.2, ease: "power2.out" });
                    } else {
                        gsap.to(otherCard, { y: 0, duration: 0.2, ease: "power2.out" });
                    }
                });
            },
            onDragEnd: async function() {
                const draggedIdx = currentOrder.indexOf(card);
                const movedSteps = Math.round(this.y / cardHeight());
                let newIdx = Math.max(0, Math.min(currentOrder.length - 1, draggedIdx + movedSteps));
                gsap.killTweensOf(card);
                currentOrder.forEach(c => {
                    gsap.killTweensOf(c);
                    gsap.set(c, { clearProps: "transform,zIndex,scale,boxShadow,opacity" });
                });
                setTimeout(() => { window._isDragging = false; }, 300);
                if (newIdx !== draggedIdx) {
                    const exArr = activeDraft.workout.exercises;
                    const dataArr = activeDraft.data;
                    const [movedEx] = exArr.splice(draggedIdx, 1);
                    const [movedData] = dataArr.splice(draggedIdx, 1);
                    exArr.splice(newIdx, 0, movedEx);
                    dataArr.splice(newIdx, 0, movedData);
                    if (activeDraft.ui_state && activeDraft.ui_state.openExercises) {
                        activeDraft.ui_state.openExercises = activeDraft.ui_state.openExercises.map(idx => {
                            if (idx === draggedIdx) return newIdx;
                            if (draggedIdx < newIdx && idx > draggedIdx && idx <= newIdx) return idx - 1;
                            if (draggedIdx > newIdx && idx < draggedIdx && idx >= newIdx) return idx + 1;
                            return idx;
                        });
                    }
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    if (newIdx > draggedIdx) {
                        list.insertBefore(card, currentOrder[newIdx].nextSibling);
                    } else {
                        list.insertBefore(card, currentOrder[newIdx]);
                    }
                    Array.from(list.querySelectorAll("[id^='exercise-card-']")).forEach((c, idx) => {
                        c.id = `exercise-card-${idx}`;

                        const header = c.querySelector('div[onclick^="toggleExercise"]');
                        if (header) header.setAttribute('onclick', `toggleExercise(${idx})`);

                        const moveUpBtn = c.querySelector('button[onclick*="moveActiveExercise"][onclick*="-1"]');
                        if (moveUpBtn) moveUpBtn.setAttribute('onclick', `event.stopPropagation(); moveActiveExercise(${idx}, -1)`);
                        const moveDownBtn = c.querySelector('button[onclick*="moveActiveExercise"][onclick*="1"]');
                        if (moveDownBtn) moveDownBtn.setAttribute('onclick', `event.stopPropagation(); moveActiveExercise(${idx}, 1)`);

                        const replaceBtn = c.querySelector('button[onclick*="openReplaceExerciseModal"]');
                        if (replaceBtn) replaceBtn.setAttribute('onclick', `event.stopPropagation(); openReplaceExerciseModal(${idx})`);
                        const removeBtn = c.querySelector('button[onclick*="removeActiveExercise"]');
                        if (removeBtn) removeBtn.setAttribute('onclick', `event.stopPropagation(); removeActiveExercise(${idx})`);

                        const addSetBtn = c.querySelector('button[onclick*="addSetToExercise"]');
                        if (addSetBtn) addSetBtn.setAttribute('onclick', `addSetToExercise(${idx})`);
                        const doneBtn = c.querySelector('button[onclick*="toggleExerciseDone"]');
                        if (doneBtn) doneBtn.setAttribute('onclick', `toggleExerciseDone(${idx})`);

                        // Uppdatera confirmSet-cirklar
                        c.querySelectorAll('div[onclick*="confirmSet"]').forEach(circle => {
                            const onclickVal = circle.getAttribute('onclick');
                            const setIdxMatch = onclickVal.match(/confirmSet\(\d+,\s*(\d+)\)/);
                            if (setIdxMatch) {
                                const sIdx = setIdxMatch[1];
                                circle.setAttribute('onclick', `confirmSet(${idx}, ${sIdx})`);
                            }
                        });

                        // Uppdatera removeSetFromExercise
                        c.querySelectorAll('button[onclick*="removeSetFromExercise"]').forEach(btn => {
                            const onclickVal = btn.getAttribute('onclick');
                            const setIdxMatch = onclickVal.match(/removeSetFromExercise\(\d+,\s*(\d+)\)/);
                            if (setIdxMatch) {
                                const sIdx = setIdxMatch[1];
                                btn.setAttribute('onclick', `removeSetFromExercise(${idx}, ${sIdx})`);
                            }
                        });

                        // Uppdatera updateSetDataOnly och input-id:n
                        c.querySelectorAll('input[oninput*="updateSetDataOnly"]').forEach(inp => {
                            const oninputVal = inp.getAttribute('oninput');
                            const setIdxMatch = oninputVal.match(/updateSetDataOnly\(\d+,\s*(\d+)\)/);
                            if (setIdxMatch) {
                                const sIdx = setIdxMatch[1];
                                inp.setAttribute('oninput', `updateSetDataOnly(${idx}, ${sIdx})`);
                                const inputId = inp.id;
                                if (inputId) {
                                    const parts = inputId.split('-');
                                    if (parts.length === 3) {
                                        inp.id = `${parts[0]}-${idx}-${parts[2]}`;
                                    }
                                }
                            }
                        });
                    });

                    await persistActiveWorkout();
                    setTimeout(() => initDragAndDrop(), 50);
                }
            }
        });
    });
}


function openCustomAddExerciseModal() {
    temporarySelectedExercises = [];
    openAddExerciseToWorkoutModal();
}

async function toggleExercise(index) {
    if (window._isDragging) return;
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
    window._suppressAutoScroll = true;
    await persistActiveWorkout();
    renderActiveWorkout();
    setTimeout(() => restoreRestTimerIfActive(), 50);
    requestAnimationFrame(() => initDragAndDrop());
    window.scrollTo(0, scrollPos);
}

async function addSetToExercise(exIdx) {
    const scrollPos = window.scrollY;
    const lastSet = activeDraft.data[exIdx].sets_data[activeDraft.data[exIdx].sets_data.length - 1];
    const newWeight = lastSet ? lastSet.weight : "";
    const newReps = lastSet ? lastSet.reps : "";
    activeDraft.data[exIdx].sets_data.push({ weight: newWeight, reps: newReps });
    window._suppressAutoScroll = true;
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
    await persistActiveWorkout();
}

async function removeSetFromExercise(exIdx, setIdx) {
    const scrollPos = window.scrollY;
    activeDraft.data[exIdx].sets_data.splice(setIdx, 1);
    window._suppressAutoScroll = true;
    renderActiveWorkout();
    window.scrollTo(0, scrollPos);
    await persistActiveWorkout();
}

async function toggleExerciseDone(exIdx) {
    const scrollPos = window.scrollY;
    activeDraft.data[exIdx].isCompleted = !activeDraft.data[exIdx].isCompleted;
        if (activeDraft.data[exIdx].isCompleted) {
        stopRestTimer();
    }

    // Spara handtaget innan omritning
    const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;

    updateSingleExerciseCard(exIdx);

    // Återlägg handtaget direkt
    if (existingHandle) {
        const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
        if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
            updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
        }
    }

    window.scrollTo(0, scrollPos);
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
        { name: "Ben", icon: " 🦵 " },
        { name: "Bröst", icon: " 🏋️ " },
        { name: "Rygg", icon: " 🪵 " },
        { name: "Axlar", icon: " 👐 " },
        { name: "Armar", icon: " 💪 " },
        { name: "Bål", icon: " 🧘 " }
    ];

    let html = `<h3>${replaceIndex !== null ? 'Change Exercise' : 'Select Exercise'}</h3>`;
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Select Category</p>`;

    html += `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">`;
    categories.forEach(cat => {
        const isActive = cat.name === category;
        html += `
        <button onclick="renderExercisePicker('${cat.name}', ${replaceIndex})"
            style="padding:10px 5px; font-size:11px; border-radius:12px; border:1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
            background:${isActive ? 'rgba(34, 211, 238, 0.1)' : 'var(--card)'}; color:${isActive ? 'var(--primary)' : 'white'}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:16px;">${cat.icon}</span> ${CATEGORY_DISPLAY[cat.name] || cat.name}
        </button>`;
    });
    html += `</div>`;

    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Exercises (${CATEGORY_DISPLAY[category] || category}):</p>`;
    html += `<div style="max-height:280px; overflow-y:auto; padding-right:5px; background:rgba(0,0,0,0.2); border-radius:15px; padding:10px; margin-bottom:15px; display:flex; flex-direction:column; gap:8px;">`;

    const filtered = masterExercises.filter(ex => category === "Armar" ? (ex.target === "Biceps" || ex.target === "Triceps") : ex.target === category);

    if (filtered.length === 0) {
        html += `<p style="text-align:center; font-size:12px; color:var(--text-light); padding:10px;">Select category to view exercises.</p>`;
    }
    filtered.forEach(ex => {
        const isSelectedInBatch = replaceIndex === null && temporarySelectedExercises.includes(ex.id);
        const currentBg = isSelectedInBatch ? 'rgba(34, 197, 94, 0.15)' : 'transparent';
        const currentBorder = isSelectedInBatch ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)';
        const currentIcon = replaceIndex !== null ? ' 🔄 ' : (isSelectedInBatch ? ' ✅ ' : '+');
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
        + Create new exercise to the library
    </button>
    `;

    body.innerHTML = html;
}

function generateSelectedExercisesSummaryHtml() {
    const hasChoices = temporarySelectedExercises.length > 0;
    if (!hasChoices) return "";
    let summaryHtml = `
    <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); margin-bottom:8px; text-align:center; font-weight:600; letter-spacing:0.5px;">Selected exercises in this set:</p>
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
        Add ${temporarySelectedExercises.length} selected exercises  ➕
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
        
        // Vi kollar om funktionen finns. Finns den inte (vilket den inte gör) 
        // så kör vi filterExercises istället som också ritar om listan!
        if (typeof updateExerciseSelectionView === 'function') {
            updateExerciseSelectionView();
        } else if (typeof filterExercises === 'function') {
            const cat = typeof currentExerciseCategory !== 'undefined' ? currentExerciseCategory : 'Ben';
            filterExercises(cat);
        }
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
            icon.textContent = " ✅ ";
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

    const isFrittPass = activeDraft.workout.name === "Free Workout";
    const startIdx = activeDraft.workout.exercises.length;
    temporarySelectedExercises.forEach((exId, loopIdx) => {
        const ex = masterExercises.find(e => e.id == exId);
        if (!ex) return;

        const newExObj = { name: ex.name, target: ex.target };
        let newDataEntry;
        const history = getExerciseHistory(ex.name);
        
        if (history) {
            // Skapa en djupkopia av historiken
            let historyCopy = JSON.parse(JSON.stringify(history));
            // Nollställ klarmarkeringar för att övningen ska börja "fräsch"
            historyCopy.forEach(set => set.userConfirmed = false);
            newDataEntry = { sets_data: historyCopy, isCompleted: false };
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

    temporarySelectedExercises = [];
    await persistActiveWorkout();
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
    
    if (history) {
        // Skapa en djupkopia av historiken
        let historyCopy = JSON.parse(JSON.stringify(history));
        // Nollställ klarmarkeringar
        historyCopy.forEach(set => set.userConfirmed = false);
        newDataEntry = { sets_data: historyCopy, isCompleted: false };
    } else {
        newDataEntry = { sets_data: [{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }], isCompleted: false };
    }
    
    if (replaceIndex !== null) {
        activeDraft.workout.exercises[replaceIndex] = newExObj;
        activeDraft.data[replaceIndex] = newDataEntry;
    } else {
        activeDraft.workout.exercises.push(newExObj);
        activeDraft.data.push(newDataEntry);

        const newIdx = activeDraft.workout.exercises.length - 1;
        if (activeDraft.workout.name === "Free Workout" && !activeDraft.ui_state.openExercises.includes(newIdx)) {
            activeDraft.ui_state.openExercises.push(newIdx);
        }
    }
    
    await persistActiveWorkout();
    closeModal();
    renderActiveWorkout();
}

// Debounce-helper (lägg en gång i filen, ovanför eller bredvid funktionen)
function debounce(fn, wait = 700) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
const debouncedPersistActiveWorkout = debounce(() => {
  if (typeof persistActiveWorkout === 'function') {
    try { persistActiveWorkout(); } catch (e) { console.error(e); }
  }
}, 700);

function handleInputFocus(el) {
    const current = el.value;
    if (current !== '') {
        el.dataset.prevValue = current;
        el.value = '';
        el.placeholder = current;
        el.style.opacity = '1';
    }
}

function handleInputBlur(el) {
    if (el.value === '' && el.dataset.prevValue !== undefined) {
        el.value = el.dataset.prevValue;
        el.placeholder = '';
        delete el.dataset.prevValue;
    } else if (el.value !== '') {
        el.placeholder = '';
        delete el.dataset.prevValue;
    }
}

function flushFocusedInputs() {
    document.querySelectorAll('.log-input').forEach(el => {
        if (el.dataset.prevValue !== undefined && el.value === '') {
            el.value = el.dataset.prevValue;
            el.placeholder = '';
            delete el.dataset.prevValue;
        }
    });
}

async function updateSetDataOnly(exIdx, setIdx) {
    const wInp = document.getElementById(`w-${exIdx}-${setIdx}`);
    const rInp = document.getElementById(`r-${exIdx}-${setIdx}`);
    if (!wInp || !rInp) return;

    if (!activeDraft || !activeDraft.data || !activeDraft.data[exIdx]) return;
    const setsArray = activeDraft.data[exIdx].sets_data || [];

    setsArray[setIdx] = Object.assign({}, setsArray[setIdx] || {});
    const setObj = setsArray[setIdx];

    setObj.weight = wInp.value;
    setObj.reps = rInp.value;
    if (typeof setObj.userConfirmed === "undefined") setObj.userConfirmed = false;

    // Autofyll-logik: Kopiera direkt till DOM för omedelbar visuell feedback,
    // men spara till activeDraft först när användaren slutat skriva (via debounce-timern nedan)
    if (setIdx === 0) {
        const shouldCopyWeight = setsArray.slice(1).every(s => {
            return (s.weight === "" || s.weight === null || s.weight === undefined);
        });

        const shouldCopyReps = setsArray.slice(1).every(s => {
            return (s.reps === "" || s.reps === null || s.reps === undefined);
        });

        for (let i = 1; i < setsArray.length; i++) {
            if (shouldCopyWeight) {
                const wEl = document.getElementById(`w-${exIdx}-${i}`);
                if (wEl) wEl.value = wInp.value || "";
            }
            if (shouldCopyReps) {
                const rEl = document.getElementById(`r-${exIdx}-${i}`);
                if (rEl) rEl.value = rInp.value || "";
            }
        }

        // Spara det slutgiltiga värdet till activeDraft efter att användaren slutat skriva
        clearTimeout(updateSetDataOnly._copyTimer);
        updateSetDataOnly._copyTimer = setTimeout(() => {
            for (let i = 1; i < setsArray.length; i++) {
                setsArray[i] = Object.assign({}, setsArray[i] || {});
                if (shouldCopyWeight) {
                    setsArray[i].weight = wInp.value;
                }
                if (shouldCopyReps) {
                    setsArray[i].reps = rInp.value;
                }
                if (shouldCopyWeight || shouldCopyReps) {
                    setsArray[i].userConfirmed = false;
                }
            }
        }, 600);
    }

    debouncedPersistActiveWorkout();
}

async function confirmSet(exIdx, setIdx) {
    flushFocusedInputs();
    const vInp = document.getElementById(`v-${exIdx}-${setIdx}`);
    if (vInp) activeDraft.data[exIdx].sets_data[setIdx].rest = vInp.value;
    const currentState = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    activeDraft.data[exIdx].sets_data[setIdx].userConfirmed = !currentState;
    // Starta vila-timer om setet bekräftades (inte avbekräftades) och det finns en nästa set
    const isNowConfirmed = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    const restValue = parseInt(activeDraft.data[exIdx].sets_data[setIdx].rest) || 120;
    const isLastSet = setIdx === activeDraft.data[exIdx].sets_data.length - 1;
    if (isNowConfirmed && !isLastSet) {
        startRestTimer(restValue, exIdx);
    } else if (!isNowConfirmed) {
        stopRestTimer();
    }
    await persistActiveWorkout();

    // Spara handtaget innan omritning
    const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;
    
    updateSingleExerciseCard(exIdx);
    
    // Återlägg det sparade handtaget direkt utan att skapa nytt
    if (existingHandle) {
        const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
        if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
            updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
        }
    }
}

function updateSingleExerciseCard(exIdx) {
    const exerciseData = activeDraft.data[exIdx];
    const ex = activeDraft.workout.exercises[exIdx];
    const isDone = exerciseData.isCompleted;
    const openExercises = activeDraft.ui_state.openExercises || [];
    const isOpen = openExercises.includes(exIdx);
    const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    if (!targetCard) return;
    targetCard.style.borderLeft = `4px solid ${isDone ? '#22c55e' : isOpen ? '#22d3ee' : 'rgba(250,204,21,0.3)'}`;
    targetCard.style.boxShadow = isDone ? '0 4px 12px rgba(34,197,94,0.08)' : isOpen ? '0 4px 12px rgba(34,211,238,0.08)' : '0 4px 12px rgba(0,0,0,0.3)';
    const completedSets = exerciseData.sets_data ? exerciseData.sets_data.filter(s => s.userConfirmed).length : 0;
    const totalSets = exerciseData.sets_data ? exerciseData.sets_data.length : 0;
    const firstUnconfirmed = exerciseData.sets_data ? exerciseData.sets_data.findIndex(s => !s.userConfirmed) : -1;
    let setsHtml = `<div style="margin-top:10px;">
        <div style="display:grid; grid-template-columns: 40px 1fr 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
            <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">SET</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">KG</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">REPS</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">REST (S)</small>
            <span></span>
        </div>`;
    if (exerciseData.sets_data) {
        exerciseData.sets_data.forEach((set, sIdx) => {
            const isLocked = isDone;
            const isCurrent = !set.userConfirmed && !isDone;
            const showSuccess = set.userConfirmed || isDone;
            const circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
            const statusContent = showSuccess ? ' ✅ ' : `#${sIdx + 1}`;
            const showArrow = !isDone && isOpen && sIdx === firstUnconfirmed;
            setsHtml += `
            <div style="display:grid; grid-template-columns: 40px 1fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center; opacity: ${showSuccess ? '1' : isCurrent ? '1' : '0.35'}; transition: opacity 0.2s ease; position:relative; overflow:visible;">
                ${showArrow ? '<div class="set-arrow">➔</div>' : ''}
                <div onclick="${isLocked && !isDone ? '' : `confirmSet(${exIdx}, ${sIdx})`}"
                    style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:800; background: ${showSuccess ? 'rgba(34, 197, 94, 0.2)' : (isCurrent ? 'rgba(250, 204, 21, 0.15)' : 'rgba(245, 158, 11, 0.05)')}; color: ${circleColor}; opacity: 1;">
                    ${statusContent}
                </div>
                <input type="text" inputmode="decimal" id="w-${exIdx}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'};" value="${set.weight || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${exIdx}, ${sIdx})" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">
                <input type="text" inputmode="decimal" id="r-${exIdx}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'};" value="${set.reps || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${exIdx}, ${sIdx})" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">
                ${sIdx < exerciseData.sets_data.length - 1 ? `<input type="text" inputmode="decimal" id="v-${exIdx}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity: ${isCurrent ? '1' : '0.3'}; border-color: rgba(52, 152, 219, 0.3);" value="${set.rest || '120'}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(${exIdx}, ${sIdx})" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">` : `<div></div>`}
                <button onclick="removeSetFromExercise(${exIdx}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity: ${showSuccess ? '0.1' : isCurrent ? '0.8' : '0.4'};" ${showSuccess ? 'disabled' : ''}>×</button>
            </div>`;
            if (isCurrent && sIdx === firstUnconfirmed) {
                setsHtml += `
                <div style="grid-column: 2 / span 3; margin:-4px 0 8px 0; padding-left:2px; opacity:0.8; font-size:10px; color:var(--primary); font-weight:600; letter-spacing:0.3px;">
                    💡 Select ${statusContent} to lock & continue
                </div>`;
            }
        });
    }
    targetCard.innerHTML = `
        <div style="position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 100%); pointer-events:none; z-index:2;"></div>
        <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%); pointer-events:none; z-index:2;"></div>
        <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%); pointer-events:none; z-index:2;"></div>
        <div onclick="toggleExercise(${exIdx})" style="padding: 12px 15px; display: flex; align-items: center; cursor: pointer; background: ${isOpen ? 'rgba(250, 204, 21, 0.05)' : 'transparent'}">
            <div style="width: 8px; flex-shrink: 0;"></div>
            <div style="display: flex; flex-direction: column; min-width:0; flex-grow:1;">
                <strong style="font-size: 14px; color: ${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration: ${isDone ? 'line-through' : 'none'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${ex.name}</strong>
                <small style="color: ${isDone ? '#22c55e' : 'var(--primary)'}; font-size: 10px;">${isDone ? 'DONE ✅' : `${completedSets}/${totalSets} set`}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 10px;">
                <button onclick="event.stopPropagation(); openReplaceExerciseModal(${exIdx})" style="background:none; border:none; font-size:14px; padding:5px; opacity: 0.7;" ${isDone ? 'disabled' : ''}> 🔄 </button>
                <button onclick="event.stopPropagation(); removeActiveExercise(${exIdx})" style="background:none; border:none; font-size:14px; padding:5px; opacity: 0.7;" ${isDone ? 'disabled' : ''}> ✖ </button>
                <span style="font-size: 10px; color: var(--text-light); margin-left: 5px; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0)'}; transition: 0.3s;"> ▼ </span>
            </div>
        </div>
        <div style="padding: 0 15px 15px 15px; display: ${isOpen ? 'block' : 'none'}; border-top: 1px solid rgba(255,255,255,0.05);">
            ${setsHtml}
            <button class="mode-border glass-border" style="padding:8px; font-size:11px; margin-top:10px; border-style:dashed; width:100%;" onclick="addSetToExercise(${exIdx})" ${isDone ? 'disabled' : ''}>+ Add set</button>
            <button class="mode-btn ${isDone ? 'blue' : 'green'}" style="padding:12px; font-size:13px; margin-top:15px; width:100%; font-weight:bold;" onclick="toggleExerciseDone(${exIdx})">
                ${isDone ? 'Undo ↩️' : 'Mark as Complete ✅'}
            </button>
        </div>`;
    restoreRestTimerIfActive();
}

// Vi skapar en global flagga längst upp (utanför funktionen)
let isSyncingWithSupabase = false;

async function persistActiveWorkout() {
    // SÄKERHETSSPÄRR: Om activeDraft inte finns eller inte är startat, avbryt omedelbart
    if (!activeDraft || !activeDraft.isStarted) {
        localStorage.removeItem("activeWorkoutDraft");
        return;
    }

    localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));
    if (!currentUser) return;
    
    // DÖRRVAKT: Om ett anrop redan pågår, avbryt detta anrop direkt!
    if (isSyncingWithSupabase) {
        console.log(" ⏳ [DEBUG] Synk pågår redan, hoppar över detta anrop för att förhindra krock.");
        return;
    }

    // Nu låser vi dörren för efterföljande anrop
    isSyncingWithSupabase = true;
    
    try {
        // 1. Försök uppdatera raden som hör till user_id
        const { data, error: updateError } = await supabaseClient
            .from('active_draft')
            .update({ data: activeDraft })
            .eq('user_id', currentUser.id)
            .select();
            
        // 2. Om update misslyckas eller inte returnerar något (ingen rad fanns), gör en insert
        if (updateError || !data || data.length === 0) {
            console.log(" 🔍 [DEBUG] Ingen rad fanns att uppdatera i active_draft, försöker insert...");
            const { error: insertError } = await supabaseClient
                .from('active_draft')
                .insert([{ user_id: currentUser.id, data: activeDraft }]);
            if (insertError) throw insertError;
            console.log(" ✅ [DEBUG] Nytt utkast skapat i active_draft!");
        } else {
            console.log(" ✅ [DEBUG] Befintligt utkast uppdaterat i active_draft!");
        }
    } catch (err) {
        console.error(" ❌ Kritiskt fel i persistActiveWorkout:", err);
    } finally {
        // Oavsett om det gick bra eller fel, lås upp dörren när vi är helt klara
        isSyncingWithSupabase = false;
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
            <div style="font-size:40px; margin-bottom:15px;"> 🗑️ </div>
            <h3 style="color:var(--danger);">Delete Exercise?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Are you sure you want to remove this exercise from your current workout?</p>
            <button class="mode-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;"
                onclick="(async () => {
                    activeDraft.workout.exercises.splice(${exIdx}, 1);
                    activeDraft.data.splice(${exIdx}, 1);
                    await persistActiveWorkout();
                    closeModal();
                    renderActiveWorkout();
                })()">
                Yes, delete!
            </button>
            <button class="mode-btn glass-border" onclick="closeModal()">Cancel</button>
        </div>
    `;
    openModal();
}

document.getElementById("global-home").addEventListener("click", () => {
    //  ✅  Blockera om anv ä ndaren redan  ä r p å  home-view
    const homeView = document.getElementById("home-view");
    if (homeView && !homeView.classList.contains("hidden")) {
        return; // Gör ingenting om vi redan är hemma
    }

    renderHome();
    showView("home-view");
});
document.getElementById("start-new-btn").onclick = () => renderCalendar(true);
document.getElementById("calendar-mode").onclick = () => renderCalendar(false);
document.getElementById("view-exercises-btn").onclick = () => { showView("exercises-view"); filterExercises(currentExerciseCategory); };
document.getElementById("view-programs-btn").onclick = () => renderGroupsView();
document.getElementById("stats-mode").onclick = renderStats;
document.getElementById("add-custom-pass-btn").onclick = openCreateProgramModal;
document.getElementById("add-custom-group-btn").onclick = openCreateGroupModal;

// ==========================================================================
// GRÄNSSNITT & KNAPPHANTERING (HOME & SAVE WORKOUT)
// ==========================================================================
function renderHome() {
    // 🛡️ Om järnridån är aktiv, totalvägra att köra startsidans logik överhuvudtaget!
    if (window.blockAllSync) return;
 
    // Scrolla till toppen (mobil + desktop)
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
 
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

    let currentDraft = null;
    if (typeof activeDraft !== 'undefined' && activeDraft) {
        currentDraft = activeDraft;
    } else {
        const localSaved = localStorage.getItem("activeWorkoutDraft");
        if (localSaved) {
            try {
                currentDraft = JSON.parse(localSaved);
                activeDraft = currentDraft; 
            } catch (e) {
                console.error("Kunde inte tolka sparat utkast från localStorage", e);
            }
        }
    }

    const draftAlertEl = document.getElementById("draft-alert");
    const startNewBtnEl = document.getElementById("start-new-btn");
    const resumeBtnEl = document.getElementById("resume-workout-btn");

    if (currentDraft) {
        if (draftAlertEl) draftAlertEl.classList.remove("hidden");
        if (startNewBtnEl) startNewBtnEl.classList.add("hidden");
        
        if (resumeBtnEl) {
            resumeBtnEl.onclick = () => {
                if (typeof startWorkout === 'function') {
                    startWorkout(currentDraft.workout, currentDraft.data, currentDraft.date);
                }
            };
        }
    } else {
        if (startNewBtnEl) startNewBtnEl.classList.remove("hidden");
        if (draftAlertEl) draftAlertEl.classList.add("hidden");
    }
}

// 💥 HÄR LIGGER HELA DITT SPARFLÖDE DIREKT I FUNKTIONEN SOM HTML-KNAPPEN ANROPAR
async function finishWorkout(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
 
    // 🔒 AKTIVERA JÄRNRIDÅN: Frys gränssnittet från omvärldens skript direkt
    window.blockAllSync = true;
 
    console.log("🚀 [SPÅRNING] STEG 1: finishWorkout triggad. Blockerar standardbeteenden.");
 
    try {
        if(!activeDraft || !activeDraft.isStarted) {
            window.blockAllSync = false; 
            const body = document.getElementById("modal-body");
            if (body) {
                body.innerHTML = `
                    <h3>Kasta träningspass</h3>
                    <p style="text-align:center; color:var(--text-light);">You haven't started the workout yet. Do you want to delete the draft?</p>
                    <button class="mode-btn danger" style="background:var(--danger);" onclick="(async () => { 
                        localStorage.removeItem('activeWorkoutDraft'); 
                        if (typeof deleteActiveDraft === 'function') await deleteActiveDraft();
                        if (currentUser) {
                            try { await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id); } catch(e) { console.error(e); }
                        }
                        location.reload(); 
                    })()">Kasta passet</button>
                    <button class="mode-btn glass-border" onclick="closeModal()">Cancel</button>
                `;
                openModal();
            }
            return;
        }
 
        console.log("🚀 [SPÅRNING] STEG 2: Stoppar timers och bygger logg-objektet.");
        if (typeof stopTimer === 'function') stopTimer();
        if (typeof pauseTimer === 'function') pauseTimer(); 
        if (typeof saveInterval !== 'undefined' && saveInterval) clearInterval(saveInterval);
 
       // Om detta är en redigering av ett historiskt pass, behåll originaltiden
        let finalTime = activeDraft.totalTime || "00:00:00";
        if (!activeDraft.totalTime && activeDraft.startTime) {
            const startMs = new Date(activeDraft.startTime).getTime();
            const endMs = Date.now();
            const totalSeconds = Math.floor((endMs - startMs) / 1000);
            const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(totalSeconds % 60).padStart(2, '0');
            finalTime = `${hrs}:${mins}:${secs}`;
        }
         
        let workoutId = (activeDraft.id && workoutHistory.some(w => w.id === activeDraft.id)) 
            ? activeDraft.id 
            : "workout_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
 
        const log = {
            id: workoutId,
            date: activeDraft.date || new Date().toISOString().split('T')[0],
            programName: activeDraft.programName || activeDraft.workout.name,
            totalTime: finalTime,
            startTime: activeDraft.startTime || null,
            exercises: activeDraft.workout.exercises.map((ex, i) => {
                const setsData = activeDraft.data[i] ? activeDraft.data[i].sets_data : [];
                // Hämta vila från vila-inputs direkt från DOM innan de försvinner
                const setsWithRest = setsData.map((set, sIdx) => {
                    const vInp = document.getElementById(`v-${i}-${sIdx}`);
                    return {
                        ...set,
                        rest: vInp ? vInp.value : (set.rest || null)
                    };
                });
                return {
                    name: ex.name,
                    sets_data: setsWithRest
                };
            })
        };
 
        console.log("🚀 [SPÅRNING] STEG 3: Sparar passet till historiken.");
        if (typeof saveWorkoutHistory === 'function') {
            await saveWorkoutHistory(log); 
        }
 
        console.log("🚀 [SPÅRNING] STEG 4: Sparning klar. Rensar utkast lokalt.");
        activeDraft = null;
        localStorage.removeItem("activeWorkoutDraft");
        secondsElapsed = 0;
 
        console.log("🚀 [SPÅRNING] STEG 5: Rensar databasens active_draft.");
        if (currentUser) {
            await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id);
        }
 
        console.log("🚀 [SPÅRNING] STEG 6: Stänger modaler och förbereder kalendervyn.");
        if (typeof closeModal === 'function') closeModal();
        if (typeof renderCalendar === 'function') renderCalendar(false);
 
        console.log("🚀 [SPÅRNING] STEG 7: Tvingar fram kalendervyn.");
        showView("calendar-view");
        renderCalendar(false);
        const todayStr = log.date;
        const todayWorkouts = workoutHistory.filter(w => w.date === todayStr);
        window._showFireworksOnOpen = true;
        openDayManager(todayStr, null, todayWorkouts, false);
         
        if (typeof window.currentView !== 'undefined') window.currentView = "calendar-view";
        document.body.setAttribute("data-current-view", "calendar-view");
         
        console.log("✅ [SPÅRNING] KLAR. Sparat och klart.");
 
    } catch (error) {
        console.error("❌ [SPÅRNING] ETT FEL INTRÄFFADE:", error);
        showView("calendar-view");
    } finally {
        setTimeout(() => {
            window.blockAllSync = false;
            console.log("🔓 [SPÅRNING] Järnridån helt borttagen. Appen är i normalläge.");
        }, 250);
    }
}

// Global lyssnare för bakåtkompatibilitet och andra element
document.addEventListener("click", async function(e) {
    // Om knappen faktiskt har ID:t kör vi funktionen härifrån också
    if (e.target && e.target.id === "save-workout-btn") {
        await finishWorkout(e);
    }
    if (e.target && e.target.id === "pause-workout-btn") {
        location.reload();
    }
});

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

function setOverride(date, val) {
    calendarOverrides[date] = val;
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));

    // Stäng rutan och uppdatera kalendern OMEDELBART (Ingen väntetid för användaren)
    closeModal();
    if (typeof renderCalendar === "function") {
        renderCalendar();
    }

    // Spara till servern och Supabase i bakgrunden utan att blockera appen
    setTimeout(async () => {
        try {
            await saveAll();

            if (currentUser) {
                const { data: existingRows, error: checkErr } = await supabaseClient
                    .from('calendar_overrides')
                    .select('id')
                    .eq('user_id', currentUser.id);

                if (checkErr) throw checkErr;

                if (existingRows && existingRows.length > 0) {
                    await supabaseClient
                        .from('calendar_overrides')
                        .update({ data: calendarOverrides })
                        .eq('user_id', currentUser.id);
                } else {
                    await supabaseClient
                        .from('calendar_overrides')
                        .insert([{ user_id: currentUser.id, data: calendarOverrides }]);
                }
            }
        } catch (err) {
            console.error("Bakgrundssynk av setOverride misslyckades:", err);
        }
    }, 0);
}

async function prepareStart(date, id) {
    const p = programData.routine.find(x => x.id === id);

    //  ✅  Byt vy F Ö RST
    showView('workout-view');

    //  ✅  Starta tr ä ning
    await startWorkout(p, null, date, true);

    //  ✅  St ä ng modal SIST (i bakgrunden)
    setTimeout(() => closeModal(), 0);
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

// ==========================================================================
// CENTRAL HANTERING AV RADERING OCH EDITERING (ÅTERSTÄLLD TILL ORIGINALDESIGN)
// ==========================================================================
// 1. ÖPPNA EDITERINGSLÄGET FÖR ETT HISTORISKT PASS (ÅTERSTÄLLD TILL STANDARD)
async function editLoggedWorkout(date, idx) {
    // 1. Hitta rätt pass baserat på datum och dess lokala index för dagen
    const filtered = workoutHistory.filter(w => w.date === date);
    const item = filtered[idx];
    if (!item) {
        console.error("Hittade inte det loggade passet för editering.");
        return;
    }

    // Hitta det exakta globala indexet i workoutHistory via dess unika ID (eller referens)
    // Detta är KRITISKT för att appens sparfunktion ska kunna skriva över rätt rad i databasen sen!
    const globalIdx = workoutHistory.findIndex(w => w === item || (w.id && w.id === item.id));

    let savedSeconds = 0;
    if(item.totalTime) {
        const parts = item.totalTime.split(':');
        savedSeconds = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    }
    // Behåll passets ursprungliga ID och dess globala position i historiken
    const workoutObj = {
        id: item.id,
        name: item.programName,
        programName: item.programName,  // ← LÄGG TILL DENNA RAD
        exercises: item.exercises.map(ex => ({ name: ex.name, target: ex.target || "" }))
    };

    // Strukturera om övningsdatan korrekt till en matris som matchar activeDraft-strukturen
    const formattedDataArray = item.exercises.map(ex => {
        if(ex.sets_data) {
            return { sets_data: JSON.parse(JSON.stringify(ex.sets_data)), isCompleted: false };
        }
        return {
            sets_data: Array(parseInt(ex.sets || 1)).fill(null).map(() => ({ weight: ex.weight || "", reps: ex.reps || "" })),
            isCompleted: false
        };
    });
    // Rensa eventuella gamla utkast i bakgrunden utan att frysa appen
    localStorage.removeItem("activeWorkoutDraft");

    if (typeof deleteActiveDraft === 'function') deleteActiveDraft();

    // FIX: Kör borttagningen av utkastet i en isolerad bakgrundstråd med korrekt try/catch
    setTimeout(async () => {
        if (currentUser && typeof supabaseClient !== 'undefined') {
            try {
                await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id);
            } catch (e) {
                console.error("Fel vid borttagning av gammalt utkast i Supabase:", e);
            }
        }
    }, 0);

    // Etablera det nya redigeringsbara utkastet
    secondsElapsed = savedSeconds;
    activeDraft = {
        id: item.id,
        db_id: item.id,
        historyIndex: globalIdx,
        workout: workoutObj,
        data: formattedDataArray,
        date: date,
        secondsElapsed: savedSeconds,
        startTime: item.startTime || null,
        totalTime: item.totalTime || null,
        isStarted: true,
        wasTimerRunning: false,
        ui_state: { openExercises: [0] }
    };

    // Spara utkastet till localStorage
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));

    // Hantera sparning av utkastet till servern (asynkront)
    if (typeof persistActiveWorkout === 'function') {
        await persistActiveWorkout();
    } else if (typeof saveActiveDraft === 'function') {
        await saveActiveDraft();
    }

    if (typeof renderActiveWorkout === 'function') renderActiveWorkout();
    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
    if (typeof showView === 'function') showView("workout-view");
    closeModal();
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
            <div style="font-size:40px; margin-bottom:15px;"> 🗑️ </div>
            <h3 style="color:var(--danger);">Delete Exercise?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Do you want to delete this workout permanently?</p>
            <button class="mode-btn" id="confirm-delete-ex-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;">
                Yes, delete!
            </button>
            <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); openEditExerciseModal(${id});">
                Cancel
            </button>
        </div>
    `;

    document.getElementById("confirm-delete-ex-btn").onclick = async () => {
        masterExercises = masterExercises.filter(e => e.id != id);
        localStorage.setItem('masterExercises', JSON.stringify(masterExercises));

        if (typeof saveCustomProgram === 'function') {
            await saveCustomProgram();
        }

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
            <h3 style="color:var(--danger);">Delete permanently?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px;">Do you want to delete this entire workout permanently? This action cannot be undone.</p>
            <button class="mode-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700;"
                onclick="(async () => {
                    programData.routine.splice(${idx}, 1);
                    localStorage.setItem('myCustomProgram', JSON.stringify(programData));
                    await saveAll();
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
                    hideDefaultCloseButton(false);
                    closeModal();
                    document.getElementById('program-details-area').classList.add('hidden');
                    renderGroupsView();
                })()">
                Yes, delete workout
            </button>
            <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); openEditProgramModal(${idx});">Cancel</button>
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
            <div style="font-size:40px; margin-bottom:15px;"> 🗑️ </div>
            <h3 style="color:var(--danger); margin: 0 0 10px 0; font-size:22px;">Delete workout from history?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px; line-height:1.4;">
                This pass will be permanently removed from your calendar and disappear from the database.
            </p>
            <button class="mode-btn" id="confirm-delete-history-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700; width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer;">
                Yes, delete workout
            </button>

            <button class="mode-btn glass-border" id="cancel-delete-history-btn" style="width:100%; padding:12px; border-radius:12px; background:rgba(255,255,255,0.05); color:var(--text); cursor:pointer;">
                Cancel
            </button>
        </div>
    `;
    document.getElementById("cancel-delete-history-btn").onclick = () => {
        hideDefaultCloseButton(false);
        const filtered = workoutHistory.filter(w => w.date === dateStr);
        const plannedPass = calendarOverrides[dateStr] === 'none' ? null : programData.routine.find(x => x.id === calendarOverrides[dateStr]);
        openDayManager(dateStr, plannedPass, filtered, false);
    };

    // ÄNDRING: Gjorde klick-hanteraren till en async-funktion för stabil hantering av Supabase
    document.getElementById("confirm-delete-history-btn").onclick = async () => {
        console.log(" 👉  [MODAL] Klickade på BEKRÄFTA RADERA. Datum:", dateStr, "Index för dagen:", idx);
        // 1. Hitta passet i den filtrerade listan för dagen innan vi rör något
        const filtered = workoutHistory.filter(w => w.date === dateStr);
        const itemToDelete = filtered[idx];

        if (!itemToDelete) {
            console.error(" ❌  [MODAL] Kunde inte hitta n å got pass p å  index", idx, "f ö r datum", dateStr);
            hideDefaultCloseButton(false);
            closeModal();
            return;
        }
        const targetId = itemToDelete.id;
        console.log(" 👉  [MODAL] Hittade passet som ska raderas. Unikt ID:", targetId);
        // 2. Skicka raderingen till Supabase FÖRST (eller synkront) så databasen hinner med
        if (typeof deleteWorkoutFromHistoryV2 === 'function') {
            console.log(" 🚀  [MODAL] Anropar deleteWorkoutFromHistoryV2 med ID:", targetId);
            try {
                // Vi väntar in Supabase här så att databasen tas bort i rätt ordning
                await deleteWorkoutFromHistoryV2(dateStr, idx, targetId);
            } catch (err) {
                console.error(" ❌  [MODAL] Fel vid radering i Supabase:", err);
            }
        } else {
            console.error(" ❌  [MODAL] Hittade inte funktionen deleteWorkoutFromHistoryV2!");
        }
        // 3. Uppdatera den lokala arrayen efteråt med hjälp av det unika ID:t
        const globalIdx = workoutHistory.findIndex(w => w.id === targetId);
        if (globalIdx !== -1) {
            workoutHistory.splice(globalIdx, 1);
            console.log(" ✅  [MODAL] Passet borttaget ur lokal workoutHistory-array.");
        }

        // 4. Spara lokalt och stäng ner modalen säkert
        localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        hideDefaultCloseButton(false);
        closeModal();

        // 5. Rita om gränssnittet baserat på det nya stabila läget
        if (typeof renderCalendar === 'function') {
            renderCalendar(false);
        }
    };
    openModal();
}

// PREMIUM POPUP: Den snygga informationsrutan när man väljer att avbryta eller radera inifrån ett pass (PUNKT 1 & 2)
function confirmDiscardActiveWorkout() {
    hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    if (!body) return;
    const isEditingHistorical = (activeDraft && activeDraft.date);
    const titleText = isEditingHistorical ? "Delete workout?" : "Cancel workout?";
    const bodyText = isEditingHistorical
        ? "Are you sure you want to delete this saved workout from your history? This cannot be undone."
        : "Are you sure you want to delete and cancel this ongoing workout? No sets will be saved to your history.";
    const mainBtnText = isEditingHistorical ? "Yes, delete workout permanently" : "Yes, delete workout";
    const cancelBtnText = isEditingHistorical ? "Cancel" : "No, continue training";
    const icon = isEditingHistorical ? " 🗑️ " : " ⚠️ ";
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">${icon}</div>
            <h3 style="color:var(--danger); margin: 0 0 10px 0; font-size:22px;">${titleText}</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px; line-height:1.4;">
                ${bodyText}
            </p>
            <button class="mode-btn" id="confirm-discard-draft-btn" style="background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color:white; margin-bottom:12px; font-weight:700; width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer;">
                ${mainBtnText}
            </button>

            <button class="mode-btn glass-border" id="cancel-discard-draft-btn" style="width:100%; padding:12px; border-radius:12px; background:rgba(255,255,255,0.05); color:var(--text); cursor:pointer;">
                ${cancelBtnText}
            </button>
        </div>
    `;
    document.getElementById("cancel-discard-draft-btn").onclick = () => {
        hideDefaultCloseButton(false);
        closeModal();
    };
    document.getElementById("confirm-discard-draft-btn").onclick = async () => {
        if (isEditingHistorical) {
            const dateStr = activeDraft.date;
            const workoutId = activeDraft.id;

            workoutHistory = workoutHistory.filter(w => w.id !== workoutId);
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));

            if (currentUser) {
                try {
                    const { data: historyData } = await supabaseClient
                        .from('workout_history')
                        .select('id, workout_data')
                        .eq('user_id', currentUser.id)
                        .eq('workout_date', dateStr);
                    const targetRow = historyData?.find(row =>
                        row.workout_data && (row.workout_data.id === workoutId || row.id === workoutId)
                    );
                    if (targetRow) {
                        await supabaseClient
                            .from('workout_history')
                            .delete()
                            .eq('id', targetRow.id)
                            .eq('user_id', currentUser.id);
                    }
                } catch (error) {
                    console.error('Error removing old workout from database:', error);
                }
            }
        }
        activeDraft = null;
        localStorage.removeItem("activeWorkoutDraft");

        if (typeof stopTimer === 'function') stopTimer();
        secondsElapsed = 0;
        if (currentUser !== 'undefined' && currentUser) {
            try {
                await supabaseClient
                    .from('active_draft')
                    .delete()
                    .eq('user_id', currentUser.id);
            } catch (err) {
                console.error("Supabase: Fel vid radering av pågående utkast:", err);
            }
        }
       // UX-OPTIMERING: Skifta gränssnittet till kalendern innan vi stänger modalen.
        if (typeof showView === 'function') showView("calendar-view");
        
        // Uppdatera kalendervyn så att det raderade passet försvinner direkt
        if (typeof renderCalendar === 'function') renderCalendar();

        hideDefaultCloseButton(false);
        closeModal();
    };
    openModal();
}

// NY FUNKTION (Punkt 3): Denna funktion kopplar du till din "Spara utkast"-knapp i HTML/Vyn.
// Den sparar ner tillståndet exakt som hemknappen gör och lämnar utkastet redo på startsidan.
async function saveDraftAndGoHome() {
    if (!activeDraft) return;
    // Spara klockans aktuella tid
    activeDraft.secondsElapsed = secondsElapsed;
    // Lagra tillståndet lokalt
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));

    // Synka med Supabase/molnet
    if (typeof persistActiveWorkout === 'function') {
        await persistActiveWorkout();
    } else if (typeof saveActiveDraft === 'function') {
        await saveActiveDraft();
    }
    // Stoppa klockan utan att nollställa
    if (typeof stopTimer === 'function') {
        stopTimer();
    }
    // UX-OPTIMERING: Vi skiftar vyn till "home-view" FÖRST. På så sätt döljs själva omritningen av DOM-trädet (\`renderHome()\`) bakom rätt skärmläge.
    if (typeof showView === 'function') showView("home-view");
    if (typeof renderHome === 'function') renderHome();
}

// ==========================================================================
// TILLAGDA SPAR- OCH PROGRAMFUNKTIONER (EXAKT BIBEHÅLLEN ORIGINALFUNKTIONALITET)
// ==========================================================================
// Central spara-allt-funktion för lokal lagring och bakgrundssynk
function saveAll() {
    // FIX: Säkra upp att den lokala referensen matchar fönstrets master-objekt (från Supabase) innan sparning
    if (window.programData) programData = window.programData;
    localStorage.setItem("myCustomProgram", JSON.stringify(programData || { routine: [] }));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));

    // Supabase-synk: Båda ligger kvar och sköter sitt i bakgrunden,
    // men eftersom vi städat upp raderingen kommer de inte längre att krocka!
    if (typeof saveCustomProgram === 'function') saveCustomProgram();
    if (typeof saveCalendarOverrides === 'function') saveCalendarOverrides();
}

// Skapar och sparar ett helt nytt träningspass/program till lokal lagring och databas
async function saveNewProgram() {
    const name = document.getElementById("new-pass-name").value.trim();
    if(!name) return alert("Enter a name!");
    const newPass = { id: "pass-" + Date.now(), name, exercises: [] };
    if (currentViewGroupId && currentViewGroupId !== '__ungrouped__') {
        newPass.groups = [currentViewGroupId];
    } else {
        newPass.groups = [];
    }
    programData.routine.push(newPass);
    await saveCustomProgramToSupabase();
    const newIdx = programData.routine.length - 1;
    renderGroupsView();
    await openEditProgramModal(newIdx);
}

// Sparar ändringar av ett befintligt programnamn till lokal lagring och databas
async function saveProgramEdit(idx) {
    if (window.programData) programData = window.programData;
    const oldName = programData.routine[idx].name;
    
    // Försök läsa från inputfältet om det finns, annars använd det redan sparade namnet
    const nameInput = document.getElementById("edit-pass-name");
    const newName = nameInput ? nameInput.value.trim() : programData.routine[idx].name;
    
    if (!newName) {
        const existingWarning = document.getElementById("name-warning-modal");
        if (existingWarning) return;
        const warning = document.createElement("div");
        warning.id = "name-warning-modal";
        warning.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); 
            backdrop-filter: blur(6px); display: flex; align-items: center; 
            justify-content: center; z-index: 99999; padding: 20px;
        `;
        warning.innerHTML = `
            <div style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); 
                border: 1px solid var(--glass-border); border-top: 2px solid rgba(255,255,255,0.25);
                border-radius: 24px; padding: 30px 24px; max-width: 340px; width: 100%; text-align: center;
                box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
                <div style="width: 56px; height: 56px; border-radius: 16px; background: rgba(34,211,238,0.1); 
                    border: 1px solid rgba(34,211,238,0.3); display: flex; align-items: center; 
                    justify-content: center; font-size: 26px; margin: 0 auto 16px auto;">ℹ️</div>
                <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 900; color: #fff;">Workout Name Required</h3>
                <p style="color: var(--text-light); font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
                    Please enter a name for your workout before saving.
                </p>
                <button class="mode-btn blue" onclick="document.getElementById('name-warning-modal').remove(); openEditProgramModal(${idx});"
                    style="width: 100%; flex-direction: row; gap: 8px; padding: 14px;">
                    OK, got it!
                </button>
            </div>
        `;
        document.body.appendChild(warning);
        return;
    }
    
   programData.routine[idx].name = newName;
    const durationInput = document.getElementById("edit-pass-duration");
    if (durationInput && durationInput.value) {
        programData.routine[idx].duration = parseInt(durationInput.value);
    } else {
        programData.routine[idx].duration = null;
    }
    delete programData.routine[idx]._isTemp;
    window._editPassOriginalState = null;
    
    if (oldName !== newName && typeof updateWorkoutNameInHistory === 'function') {
        await updateWorkoutNameInHistory(oldName, newName);
    }
    await saveCustomProgramToSupabase();
    hideDefaultCloseButton(false);
    closeModal();
    const savedGroups = programData.routine[idx].groups;
    if (Array.isArray(savedGroups) && savedGroups.length > 0) {
        const groupId = savedGroups[0];
        renderPassesInGroup(groupId);
        setTimeout(() => {
            showProgramDetails(idx);
        }, 400);
    } else {
        renderGroupsView();
    }
}


// Central, säker synkronisering av hela programstrukturen (custom_program) till Supabase
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
    // FIX: Se till att den lokala referensen uppdateras
    if (window.programData) programData = window.programData;
}

// SCROLL-ÅTERKOMST: Scrollar till rätt övning när användaren återvänder till appen/fliken
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;

    const workoutView = document.getElementById('workout-view');
    if (!workoutView || workoutView.classList.contains('hidden')) return;

    if (!activeDraft || !activeDraft.ui_state) return;

    const openExercises = activeDraft.ui_state.openExercises;
    if (!openExercises || openExercises.length === 0) return;

    const firstOpenIndex = openExercises.slice().sort((a, b) => a - b)[0];

    setTimeout(() => {
        const targetCard = document.getElementById(`exercise-card-${firstOpenIndex}`);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 120);
});

function confirmDeleteWorkoutFromPicker(passIdx) {
    const pass = programData.routine[passIdx];
    if (!pass) return;
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="font-size:40px; margin-bottom:15px;">🗑️</div>
            <h3 style="color:var(--danger); margin: 0 0 10px 0; font-size:22px;">Delete Workout?</h3>
            <p style="color:var(--text-light); margin-bottom:25px; font-size:14px; line-height:1.4;">
                <strong style="color:var(--text);">${pass.name}</strong><br>
                This workout will be permanently deleted.
            </p>
            <button class="btn-danger" onclick="(async () => {
                programData.routine.splice(${passIdx}, 1);
                localStorage.setItem('myCustomProgram', JSON.stringify(programData));
                await saveCustomProgramToSupabase();
                hideDefaultCloseButton(false);
                closeModal();
                if (currentViewGroupId) {
                    renderPassesInGroup(currentViewGroupId);
                } else {
                    renderGroupsView();
                }
            })()">🗑️ Yes, Delete Permanently</button>
           <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); openGroupPickerForPass(${passIdx})"
                style="width:100%; margin-top:10px; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); 
                border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45);">
                Cancel
            </button>
        </div>
    `;
}

function initEditExerciseDragAndDrop(passIdx) {
    const container = document.getElementById("edit-pass-exercises");
    if (!container || typeof gsap === 'undefined' || typeof Draggable === 'undefined') return;
    const rows = Array.from(container.querySelectorAll("[id^='edit-ex-row-']"));
    if (rows.length === 0) return;
    rows.forEach((row) => {
        const handle = row.querySelector('.edit-drag-handle');
        if (!handle) return;
        handle.style.touchAction = "none";
        let currentOrder = [...rows];
        const rowHeight = () => row.offsetHeight + 10;
        Draggable.create(row, {
            type: "y",
            trigger: handle,
            zIndexBoost: false,
            allowEventDefault: true,
            lockAxis: true,
            onDragStart: function() {
                currentOrder = Array.from(container.querySelectorAll("[id^='edit-ex-row-']"));
                gsap.to(row, { scale: 1.02, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", duration: 0.2 });
                gsap.set(row, { zIndex: 100 });
            },
            onDrag: function() {
                const dragY = this.y;
                const liveOrder = Array.from(container.querySelectorAll("[id^='edit-ex-row-']"));
                const draggedIdx = liveOrder.indexOf(row);
                const movedSteps = Math.round(dragY / rowHeight());
                liveOrder.forEach((otherRow, otherIdx) => {
                    if (otherRow === row) return;
                    const diff = otherIdx - draggedIdx;
                    if (movedSteps > 0 && diff > 0 && diff <= movedSteps) {
                        gsap.to(otherRow, { y: -rowHeight(), duration: 0.2, ease: "power2.out" });
                    } else if (movedSteps < 0 && diff < 0 && diff >= movedSteps) {
                        gsap.to(otherRow, { y: rowHeight(), duration: 0.2, ease: "power2.out" });
                    } else {
                        gsap.to(otherRow, { y: 0, duration: 0.2, ease: "power2.out" });
                    }
                });
            },
            onDragEnd: async function() {
                const draggedIdx = currentOrder.indexOf(row);
                const movedSteps = Math.round(this.y / rowHeight());
                let newIdx = Math.max(0, Math.min(currentOrder.length - 1, draggedIdx + movedSteps));
                gsap.killTweensOf(row);
                currentOrder.forEach(r => {
                    gsap.killTweensOf(r);
                    gsap.set(r, { clearProps: "transform,zIndex,scale,boxShadow,opacity" });
                });
                if (newIdx !== draggedIdx) {
                    const exercises = programData.routine[passIdx].exercises;
                    const [moved] = exercises.splice(draggedIdx, 1);
                    exercises.splice(newIdx, 0, moved);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    if (newIdx > draggedIdx) {
                        container.insertBefore(row, currentOrder[newIdx].nextSibling);
                    } else {
                        container.insertBefore(row, currentOrder[newIdx]);
                    }
                    Array.from(container.querySelectorAll("[id^='edit-ex-row-']")).forEach((r, i) => {
                        r.id = `edit-ex-row-${i}`;
                        const removeBtn = r.querySelector('button[onclick*="removeExFromPass"]');
                        if (removeBtn) removeBtn.setAttribute('onclick', `removeExFromPass(${passIdx}, ${i})`);
                    });
                    saveCustomProgramToSupabase();
                }
            }
        });
    });
}

function initExerciseLibraryDragAndDrop() {
    const container = document.getElementById("exercise-results");
    if (!container || typeof gsap === 'undefined' || typeof Draggable === 'undefined') return;
    container.style.overflow = "visible";
    const rows = Array.from(container.querySelectorAll("[id^='ex-lib-row-']"));
    if (rows.length === 0) return;
    rows.forEach((row) => {
        const handle = row.querySelector('.ex-lib-drag-handle');
        if (!handle) return;
        handle.style.touchAction = "none";
        let currentOrder = [...rows];
        const rowHeight = () => row.offsetHeight + 10;
        row.style.touchAction = "none";
        Draggable.create(row, {
            type: "y",
            trigger: handle,
            zIndexBoost: false,
            allowEventDefault: true,
            lockAxis: true,
            onDragStart: function() {
                currentOrder = Array.from(container.querySelectorAll("[id^='ex-lib-row-']"));
                gsap.to(row, {
                    scale: 1.02,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    duration: 0.2,
                    ease: "power2.out"
                });
                gsap.set(row, { zIndex: 100, position: "relative" });
            },
            onDrag: function() {
                const dragY = this.y;
                const liveOrder = Array.from(container.querySelectorAll("[id^='ex-lib-row-']"));
                const draggedIdx = liveOrder.indexOf(row);
                const movedSteps = Math.round(dragY / rowHeight());
                liveOrder.forEach((otherRow, otherIdx) => {
                    if (otherRow === row) return;
                    const diff = otherIdx - draggedIdx;
                    if (movedSteps > 0 && diff > 0 && diff <= movedSteps) {
                        gsap.to(otherRow, { y: -rowHeight(), duration: 0.2, ease: "power2.out" });
                    } else if (movedSteps < 0 && diff < 0 && diff >= movedSteps) {
                        gsap.to(otherRow, { y: rowHeight(), duration: 0.2, ease: "power2.out" });
                    } else {
                        gsap.to(otherRow, { y: 0, duration: 0.2, ease: "power2.out" });
                    }
                });
            },
            onDragEnd: async function() {
                const draggedIdx = currentOrder.indexOf(row);
                const movedSteps = Math.round(this.y / rowHeight());
                let newIdx = Math.max(0, Math.min(currentOrder.length - 1, draggedIdx + movedSteps));
                gsap.killTweensOf(row);
                currentOrder.forEach(r => {
                    gsap.killTweensOf(r);
                    gsap.set(r, { clearProps: "transform,zIndex,scale,boxShadow,opacity,position" });
                });
                if (newIdx !== draggedIdx) {
                    const draggedId = parseInt(row.dataset.exId);
                    const targetId = parseInt(currentOrder[newIdx].dataset.exId);
                    const globalDraggedIdx = masterExercises.findIndex(e => e.id == draggedId);
                    const globalTargetIdx = masterExercises.findIndex(e => e.id == targetId);
                    const [moved] = masterExercises.splice(globalDraggedIdx, 1);
                    masterExercises.splice(globalTargetIdx, 0, moved);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    if (newIdx > draggedIdx) {
                        container.insertBefore(row, currentOrder[newIdx].nextSibling);
                    } else {
                        container.insertBefore(row, currentOrder[newIdx]);
                    }
                    Array.from(container.querySelectorAll("[id^='ex-lib-row-']")).forEach((r, i) => {
                        r.id = `ex-lib-row-${i}`;
                    });
                    saveAll();
                }
            }
        });
    });
}

function closeEditProgramModal(idx) {
    const pass = programData.routine[idx];
    if (!pass) return;
    
    const nameInput = document.getElementById("edit-pass-name");
    const currentName = nameInput ? nameInput.value.trim() : "";
    // Spara namnet till programData direkt så det inte försvinner
    if (currentName && pass) {
        programData.routine[idx].name = currentName;
    }
    const original = window._editPassOriginalState ? JSON.parse(window._editPassOriginalState) : null;
    
    const nameChanged = original && currentName !== original.name && currentName !== '';
    const exercisesChanged = original && JSON.stringify(pass.exercises) !== JSON.stringify(original.exercises);
    
    if (nameChanged || exercisesChanged) {
        const body = document.getElementById("modal-body");
        body.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <div style="width:56px; height:56px; border-radius:16px; background:rgba(34,211,238,0.1); 
                    border:1px solid rgba(34,211,238,0.3); display:flex; align-items:center; 
                    justify-content:center; font-size:26px; margin:0 auto 16px auto;">💾</div>
                <h3 style="margin:0 0 10px 0; font-size:20px; font-weight:900; color:#fff;">Save changes?</h3>
                <p style="color:var(--text-light); font-size:14px; line-height:1.5; margin-bottom:24px;">
                    Unsaved changes. What would you like to do?
                </p>
                <button class="mode-btn glass-border" onclick="openEditProgramModal(${idx})"
                    style="width:100%; margin-bottom:10px; background:linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); 
                    border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45);">
                    ← Continue Editing
                </button>
                <button class="mode-btn blue" onclick="saveProgramEdit(${idx})"
                    style="width:100%; flex-direction:row; gap:8px; padding:14px; margin-bottom:10px;">
                    💾 Save Changes
                </button>
                <button class="btn-danger" onclick="
                    if (window._editPassOriginalState) {
                        const original = JSON.parse(window._editPassOriginalState);
                        programData.routine[${idx}].exercises = original.exercises;
                        programData.routine[${idx}].name = original.name;
                        window._editPassOriginalState = null;
                    }
                    if (programData.routine[${idx}]._isTemp) {
                        programData.routine.splice(${idx}, 1);
                    }
                    hideDefaultCloseButton(false);
                    document.getElementById('workout-modal').classList.add('hidden');
                    if (currentViewGroupId) {
                        renderPassesInGroup(currentViewGroupId);
                    } else {
                        renderGroupsView();
                    }
                ">
                    🗑️ Discard Changes
                </button>
            </div>
        `;
    } else {
        // Inga ändringar — stäng direkt
        if (pass._isTemp) {
            programData.routine.splice(idx, 1);
        }
        window._editPassOriginalState = null;
        hideDefaultCloseButton(false);
        document.getElementById('workout-modal').classList.add('hidden');
        if (currentViewGroupId) {
            renderPassesInGroup(currentViewGroupId);
        } else {
            renderGroupsView();
        }
    }
}

function startRestTimer(seconds, exIdx) {
    if (activeDraft && activeDraft.restTimerDisabled) return;
    restTimerSeconds = seconds;
    restTimerActive = true;
    restTimerExIdx = exIdx;
    clearInterval(restTimerInterval);
    renderRestTimer();
    restTimerInterval = setInterval(() => {
        restTimerSeconds--;
        if (restTimerSeconds <= 0) {
            clearInterval(restTimerInterval);
            restTimerActive = false;
            restTimerSeconds = 0;
            restTimerExIdx = null;
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.3; o.start(); setTimeout(() => o.stop(), 300); } catch(e) {}
            renderRestTimer();
            return;
        }
        renderRestTimer();
    }, 1000);
}

function stopRestTimer() {
    clearInterval(restTimerInterval);
    restTimerActive = false;
    restTimerSeconds = 0;
    restTimerExIdx = null;
    renderRestTimer();
}

function renderRestTimer() {
    const isDisabled = activeDraft && activeDraft.restTimerDisabled;
    const mins = String(Math.floor(restTimerSeconds / 60)).padStart(1, '0');
    const secs = String(restTimerSeconds % 60).padStart(2, '0');

    const disabledHTML = `
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid rgba(255,255,255,0.1); border-radius:16px; padding:8px 16px; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:14px; opacity:0.25;">⏱️</span>
                <span style="font-size:11px; color:rgba(255,255,255,0.2); font-weight:600; text-transform:uppercase; letter-spacing:1px;">Rest Timer</span>
            </div>
            <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(255,255,255,0.08); overflow:hidden;">
                <button onclick="activeDraft.restTimerDisabled=false; persistActiveWorkout(); renderRestTimer();"
                    style="padding:5px 12px; font-size:11px; font-weight:700; cursor:pointer; border:none; border-right:1px solid rgba(255,255,255,0.08); background:transparent; color:rgba(255,255,255,0.25);">On</button>
                <button style="padding:5px 12px; font-size:11px; font-weight:700; border:none; background:rgba(245,158,11,0.2); color:#f59e0b; cursor:default;">Off</button>
            </div>
        </div>`;

    const activeHTML = `
        <div style="background:linear-gradient(135deg,#1a1200 0%,#0f0a00 100%); border-left:4px solid #f59e0b; border-radius:16px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; overflow:hidden; position:relative;">
            <div style="position:absolute; top:0; left:4px; right:0; height:1px; background:linear-gradient(90deg,rgba(245,158,11,0.6) 0%,rgba(245,158,11,0.1) 100%);"></div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px;">⏱️</span>
                <div>
                    <div style="font-size:9px; color:#92400e; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Rest</div>
                    <div style="font-size:22px; font-weight:900; color:${restTimerSeconds <= 10 ? '#ef4444' : '#f59e0b'}; line-height:1; font-family:monospace;">${mins}:${secs}</div>
                </div>
            </div>
            <div style="display:flex; gap:5px; align-items:center;">
                <button onclick="restTimerSeconds=Math.max(0,restTimerSeconds-15); renderRestTimer();" style="background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.15); border-radius:8px; padding:5px 8px; font-size:11px; color:#92400e; cursor:pointer;">−15s</button>
                <button onclick="restTimerSeconds+=30; renderRestTimer();" style="background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.15); border-radius:8px; padding:5px 8px; font-size:11px; color:#92400e; cursor:pointer;">+30s</button>
                <button onclick="stopRestTimer();" style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:5px 8px; font-size:11px; color:#ef4444; cursor:pointer; font-weight:700;">Skip ✕</button>
                <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(245,158,11,0.2); overflow:hidden;">
                    <button style="padding:5px 10px; font-size:11px; font-weight:700; border:none; border-right:1px solid rgba(245,158,11,0.2); background:rgba(245,158,11,0.25); color:#f59e0b; cursor:default;">On</button>
                    <button onclick="activeDraft.restTimerDisabled=true; clearInterval(restTimerInterval); restTimerActive=false; restTimerSeconds=0; persistActiveWorkout(); renderRestTimer();"
                        style="padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer; border:none; background:transparent; color:rgba(255,255,255,0.25);">Off</button>
                </div>
            </div>
        </div>`;

    const idleHTML = `
        <div style="background:linear-gradient(135deg,#1a1200 0%,#0f0a00 100%); border-left:4px solid #f59e0b; border-radius:16px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; overflow:hidden; position:relative; opacity:0.5;">
            <div style="position:absolute; top:0; left:4px; right:0; height:1px; background:linear-gradient(90deg,rgba(245,158,11,0.6) 0%,rgba(245,158,11,0.1) 100%);"></div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px;">⏱️</span>
                <div>
                    <div style="font-size:9px; color:#92400e; text-transform:uppercase; letter-spacing:1px; font-weight:700;">Rest</div>
                    <div style="font-size:22px; font-weight:900; color:#f59e0b; line-height:1; font-family:monospace;">—</div>
                </div>
            </div>
            <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(245,158,11,0.2); overflow:hidden;">
                <button style="padding:5px 10px; font-size:11px; font-weight:700; border:none; border-right:1px solid rgba(245,158,11,0.2); background:rgba(245,158,11,0.25); color:#f59e0b; cursor:default;">On</button>
                <button onclick="activeDraft.restTimerDisabled=true; clearInterval(restTimerInterval); restTimerActive=false; restTimerSeconds=0; persistActiveWorkout(); renderRestTimer();"
                    style="padding:5px 10px; font-size:11px; font-weight:700; cursor:pointer; border:none; background:transparent; color:rgba(255,255,255,0.25);">Off</button>
            </div>
        </div>`;

    // Rensa gamla rörliga timern
    const oldMoving = document.getElementById("rest-timer-moving");
    if (oldMoving) oldMoving.remove();

    const staticBar = document.getElementById("rest-timer-bar");

    if (isDisabled) {
        // Visa alltid grå statisk timer högst upp
        if (staticBar) staticBar.innerHTML = disabledHTML;
    } else if (restTimerActive && restTimerExIdx !== null) {
        // Dölj statisk, visa rörlig ovanför aktiv övning
        if (staticBar) staticBar.innerHTML = '';
        const targetCard = document.getElementById(`exercise-card-${restTimerExIdx}`);
        if (targetCard) {
            const movingBar = document.createElement("div");
            movingBar.id = "rest-timer-moving";
            movingBar.innerHTML = activeHTML;
            targetCard.insertAdjacentElement('beforebegin', movingBar);
        }
    } else {
        // Ingen aktiv vila — visa idle-timer högst upp
        if (staticBar) staticBar.innerHTML = idleHTML;
    }
}

function restoreRestTimerIfActive() {
    if (!restTimerActive && !(activeDraft && activeDraft.restTimerDisabled)) return;
    const exIdx = restTimerExIdx !== null ? restTimerExIdx : 0;
    const bar = document.getElementById("rest-timer-bar");
    if (!bar) {
        renderRestTimer(exIdx);
    }
}

function showFireworks() {
    const style = document.createElement("style");
    style.textContent = `
        @keyframes burstUp {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
            100% { transform: translate(var(--tx), var(--ty)) scale(0) rotate(var(--rot)); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.setAttribute('style', 'position:fixed !important; top:0 !important; left:0 !important; width:100vw !important; height:100vh !important; z-index:2147483647 !important; pointer-events:none !important; overflow:hidden !important;');
    document.documentElement.appendChild(container);

    const colors = ["#f59e0b", "#22d3ee", "#22c55e", "#a78bfa", "#f472b6", "#fff", "#ef4444", "#fde047"];

    const burst = (cx, cy) => {
        for (let i = 0; i < 40; i++) {
            const el = document.createElement("div");
            const color = colors[Math.floor(Math.random() * colors.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = 80 + Math.random() * 150;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;
            const size = 4 + Math.random() * 6;
            const duration = 0.6 + Math.random() * 0.8;
            const isCircle = Math.random() > 0.3;
            el.setAttribute('style', `
                position:absolute !important;
                left:${cx}px !important;
                top:${cy}px !important;
                width:${size}px !important;
                height:${isCircle ? size : size*0.3}px !important;
                background:${color} !important;
                border-radius:${isCircle ? '50%' : '2px'} !important;
                box-shadow: 0 0 ${size}px ${color} !important;
                --tx:${tx}px !important;
                --ty:${ty}px !important;
                --rot:${Math.random()*360}deg !important;
                animation: burstUp ${duration}s ease-out forwards !important;
            `);
            container.appendChild(el);
        }
    };

    let count = 0;
    const interval = setInterval(() => {
        burst(
            window.innerWidth * (0.2 + Math.random() * 0.6),
            window.innerHeight * (0.1 + Math.random() * 0.6)
        );
        count++;
        if (count >= 6) clearInterval(interval);
    }, 400);

    setTimeout(() => { container.remove(); style.remove(); }, 6000);
}

function showCalendarHint() {
    const container = document.getElementById('calendar-hint-container');
    if (!container || document.getElementById('calendar-hint-bubble')) return;
    const hint = document.createElement('div');
    hint.id = 'calendar-hint-bubble';
    hint.className = 'hint-bubble hint-centered';
    hint.innerHTML = '<span style="font-size:13px; font-weight:700; color:#fff; letter-spacing:0.3px;">Select a day to start or schedule a workout 📅</span>';
    container.style.cssText = 'text-align:center; width:100%; display:block;';
    container.appendChild(hint);
}


