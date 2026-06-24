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
    "Cardio": "Cardio",
    "Mobility": "Mobility"
};

const SUBCATEGORIES = {
    "Ben": ["Compound", "Quads", "Hamstrings", "Glutes", "Calves"],
    "Bröst": ["Compound", "Upper Chest", "Mid Chest", "Lower Chest"],
    "Rygg": ["Compound", "Lats", "Upper Back", "Lower Back"],
    "Axlar": ["Compound", "Front Delts", "Side Delts", "Rear Delts"],
    "Armar": ["Biceps", "Triceps", "Forearms"],
    "Bål": ["Compound", "Abs", "Obliques"],
    "Cardio": ["Running", "Cycling", "Rowing", "Swimming", "Jump Rope", "Stairmaster"],
    "Mobility": ["Stretching", "Yoga", "Foam Rolling", "Warm-up", "Cool-down"]
};

// --- INIT ---
async function initApp() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
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
                // Tilldela standardgrupper baserat på pass-id, så importerade pass
                // hamnar i rätt träningsgrupp (t.ex. Full Body) istället för "Other"
                const DEFAULT_GROUP_MAP = {
                    "fullbody-a": ["fullbody"],
                    "fullbody-b": ["fullbody"]
                };
                json.routine.forEach(p => {
                    if (!Array.isArray(p.groups) || p.groups.length === 0) {
                        if (DEFAULT_GROUP_MAP[p.id]) {
                            p.groups = DEFAULT_GROUP_MAP[p.id];
                        }
                    }
                });
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

function isCardioExercise(ex) {
    if (!ex) return false;
    return ex.target === 'Cardio';
}

function getDefaultSetData(ex) {
    if (isCardioExercise(ex)) {
        return { duration: '', distance: '', userConfirmed: false };
    }
    return { weight: '', reps: '', userConfirmed: false };
}

function calcPace(duration, distance) {
    if (!duration || !distance) return '—';
    const parts = String(duration).split(':');
    let totalSeconds;
    if (parts.length === 2) {
        totalSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
        totalSeconds = parseInt(duration) * 60;
    }
    const dist = parseFloat(distance);
    if (!dist || dist <= 0 || !totalSeconds) return '—';
    const paceSeconds = totalSeconds / dist;
    const paceMins = Math.floor(paceSeconds / 60);
    const paceSecs = String(Math.round(paceSeconds % 60)).padStart(2, '0');
    return `${paceMins}:${paceSecs}`;
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

    const bottomBar = document.getElementById("bottom-bar");
    if (bottomBar) {
        bottomBar.classList.toggle("hidden", id === "workout-view");
    }
    const globalHome = document.getElementById("global-home");
    if (globalHome) {
        globalHome.style.display = id === "workout-view" ? "none" : "flex";
    }
    
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
        { id: "Bål", icon: "🧘" },
        { id: "Cardio", icon: "🏃" },
        { id: "Mobility", icon: "🤸" }
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
                <div id="category-selector-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 0 10px; box-sizing: border-box;">
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
    results.style.opacity = "0";
    results.style.transform = "translateY(8px)";
    
    setTimeout(() => {
        results.innerHTML = "";

    const subContainer = document.getElementById("subcategory-filter-container");
    if (subContainer) {
        const subs = SUBCATEGORIES[category] || [];
        subContainer.innerHTML = subs.length === 0 ? "" : `
            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:16px;">
                <div style="font-size:9px; color:rgba(255,255,255,0.8); text-transform:uppercase; letter-spacing:2px; text-align:center; margin-bottom:6px;">Filter by Muscle</div>
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

    requestAnimationFrame(() => {
            results.style.opacity = "1";
            results.style.transform = "translateY(0)";
        });
        setTimeout(() => initExerciseLibraryDragAndDrop(), 50);
    }, 150);
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
        { id: "Bål", icon: " 🧘 " },
        { id: "Cardio", icon: " 🏃 " },
        { id: "Mobility", icon: " 🤸 " }
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
                <div id="edit-category-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 0 10px;">
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

            // Spegla ändringen i alla pass där övningen förekommer
            programData.routine.forEach(pass => {
                pass.exercises.forEach(ex => {
                    if (ex.name === oldName) {
                        ex.name = nameInput;
                        ex.target = selectedCategory;
                        ex.subtarget = selectedSubcategory || null;
                    }
                });
            });

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
    initCalendarSwipe();
}

// GLOBALA VARIABLER FÖR LÅNGTRYCK OCH SCROLL-ACCURACY
let pressTimer;
let touchTimeout = null;
let isLongPress = false;
let touchStartY = 0;
let hasScrolled = false;

function startPress(idx, event) {
    // 1. SÄKERHETSKONTROLL: Endast för knappar med rätt klass (eller barn till en sådan)
    if (!event.target.closest('.plan-override-btn')) return;
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
    previewModal.style.pointerEvents = "none";
    const unblockModal = () => {
        setTimeout(() => {
            previewModal.style.pointerEvents = "auto";
        }, 50);
        document.removeEventListener('touchend', unblockModal, true);
        document.removeEventListener('mouseup', unblockModal, true);
    };
    document.addEventListener('touchend', unblockModal, true);
    document.addEventListener('mouseup', unblockModal, true);
    setTimeout(unblockModal, 1500);

    previewModal.innerHTML = `
        <div id="preview-modal-card" class="card glass" style="width: 90%; max-width: 400px; padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.95); margin-top: 40px;
            transition: all 0.2s ease-out; transform: scale(0.95); opacity: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div>
                    <h3 style="margin: 0; font-size: 18px; color: #fff;">${pass.name}</h3>
                    <div style="display:flex; gap:10px; margin-top:4px; align-items:center;">
                        <span style="font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase;">${pass.exercises.length} ${pass.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</span>
                        ${pass.duration ? `<span style="font-size:14px; color:#f59e0b; font-weight:800;">⏱️ ~${pass.duration} min</span>` : ''}
                    </div>
                </div>
                <button onclick="closePreviewModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-light); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink:0;"> ✖ </button>
            </div>
            <div style="max-height: 65vh; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;">
                ${pass.exercises.map((e, i) => `
                <div style="display:grid; grid-template-columns: 1fr 70px 12px 70px; align-items:center; padding:10px 4px; border-bottom:1px solid rgba(255,255,255,0.03);">
                    <span style="display:flex; align-items:center; gap:10px; font-weight:600; font-size:13px; color:#ffffff;">
                        <span style="display:flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; border:1px solid rgba(34,211,238,0.4); color:var(--primary); font-size:10px; font-weight:700; flex-shrink:0;">${i + 1}</span>
                        ${e.name}
                    </span>
                    <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--primary); text-align:right;">${CATEGORY_DISPLAY[e.target] || e.target}</span>
                    <span style="align-self:stretch; display:flex; justify-content:center;">${e.subtarget ? '<span style="width:1px; align-self:stretch; min-height:14px; background:rgba(255,255,255,0.15);"></span>' : ''}</span>
                    <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--text-light); opacity:0.6;">${e.subtarget || ''}</span>
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

function renderOverrideBtnContent(p, isSelected) {
    return `
        <span style="display:flex; align-items:center; gap:8px; width:100%;">
            <span class="ovr-check" style="width:22px; height:22px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; border:2px solid ${isSelected ? '#22d3ee' : 'rgba(255,255,255,0.2)'}; background:${isSelected ? '#22d3ee' : 'transparent'}; color:${isSelected ? '#0f172a' : 'transparent'};">✓</span>
            <span style="font-size:12px; font-weight:700; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;">${p.name}</span>
        </span>
        <span style="display:flex; gap:10px; width:100%; font-size:9px; font-weight:800; flex-wrap:nowrap; overflow:hidden;">
            <span style="color:#22d3ee; flex-shrink:0;">${p.exercises.length} EXERCISES</span>
            ${p.duration ? `<span style="color:#f59e0b; flex-shrink:0; white-space:nowrap;">⏱️ ~${p.duration} MIN</span>` : ''}
        </span>
    `;
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
    let autoOpenGroupId = null;

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
                        ${w.programName === "Free Workout" ? `
                        <button onclick="openSaveFreeWorkoutModalForLog('${dateStr}', ${idx})" style="background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); color: var(--primary); cursor: pointer; font-size: 13px; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">💾</button>
                        ` : ''}
                        <button onclick="openRepeatWorkoutModalForLog('${dateStr}', ${idx})" style="background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); color: var(--primary); cursor: pointer; font-size: 13px; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">🔁</button>
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
                        const isCardioEx = ex.sets_data.some(s => s.duration_min !== undefined || s.distance !== undefined);
if (isCardioEx) {
    html += `
    `;
} else if (hasRest) {
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
const isCardioSet = s.duration_min !== undefined || s.duration_sec !== undefined || s.distance !== undefined;
const duration = isCardioSet ? `${s.duration_min || '0'}:${String(s.duration_sec || '0').padStart(2,'0')}` : null;
const pace = (isCardioSet && duration && s.distance) ? calcPace(duration, s.distance) : null;
html += `
<div style="display: flex; align-items: center;">
    <div style="width: ${isCardioSet ? '100%' : '160px'}; background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.2); border-radius: 10px; overflow:hidden;">
        ${isCardioSet ? `
        <div style="display:grid; grid-template-columns: 20px 10px 1fr 1fr 1fr; padding: 5px 10px; border-bottom: 1px solid rgba(34,211,238,0.15);">
            <span></span><span></span>
            <span style="font-size:10px; color:rgba(34,211,238,0.6); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Time</span>
            <span style="font-size:10px; color:rgba(34,211,238,0.6); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Dist</span>
            <span style="font-size:10px; color:rgba(34,211,238,0.6); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:center;">Pace</span>
        </div>
        <div style="display:grid; grid-template-columns: 20px 10px 1fr 1fr 1fr; align-items:center; padding: 8px 10px;">
            <span style="color:rgba(255,255,255,0.5); font-size:10px; font-weight:800;">#${sIdx+1}</span>
            <span style="color:rgba(255,255,255,0.2); font-size:10px;">|</span>
            <span style="color:#fff; font-size:13px; font-weight:700; text-align:center;">${duration || '—'}</span>
            <span style="color:#fff; font-size:13px; font-weight:700; text-align:center;">${s.distance ? s.distance + ' km' : '—'}</span>
            <span style="color:#22d3ee; font-size:13px; font-weight:700; text-align:center;">${pace || '—'}</span>
        </div>` : `
        <div style="display:flex; align-items:center; gap:8px; padding:10px;">
            <span style="color:rgba(255,255,255,0.5); font-size:10px; font-weight:800; min-width:20px;">#${sIdx+1}</span>
            <span style="color:rgba(255,255,255,0.2); font-size:10px;">|</span>
            <span style="color:#fff; font-size:11px; font-weight:600;">${wVal} kg × ${rVal} reps</span>
        </div>`}
    </div>
    ${!isLastSet && restVal ? `
    <span style="font-size: 10px; color: #f59e0b; font-weight: 600; margin-left: 12px; position: relative; top: 14px;">← ⏱️ ${restVal}s</span>` : ''}
</div>`;
                        });
                        html += `</div>`;
                    } else {
                        html += `<div style="background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.2); color: #fff; font-size: 12px; padding: 5px 10px; border-radius: 8px; font-weight: 600;">${ex.sets} set × ${ex.weight || 0}kg × ${ex.reps || 0}</div>`;
                    }
                    if (ex.note) {
                        html += `<div style="background:rgba(253,224,71,0.06); border:1px solid rgba(253,224,71,0.15); border-radius:8px; padding:6px 10px; margin-top:8px; font-size:11px; color:#fde047;">📝 ${ex.note}</div>`;
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
        background: linear-gradient(135deg, #243044 0%, #152032 100%);
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

            <div id="current-planned-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px;">
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
        const ungrouped = programData.routine.filter(p => (!Array.isArray(p.groups) || p.groups.length === 0) && !p._isFreeCopy);

       html += `
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 12px;">
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 1px; white-space: nowrap;">Edit Plan</span>
            <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>
        <div style="text-align:center;">
            <div class="hint-bubble hint-centered" style="position:relative !important; right:auto !important; display:inline-flex !important; margin:0 auto 8px auto !important;">
                <span style="font-size:13px; font-weight:700; color:#fff; letter-spacing:0.3px;">${!planned ? 'Tap a group to add workout' : 'Tap a group to change workout'}</span>
            </div>
        </div>
       <div id="day-manager-group-container" style="display: flex; flex-direction: column; gap: 18px; border-left: none;">`;

        const GROUP_COLORS = {
            fullbody: '#f59e0b',
            upperbody: '#fbbf24',
            lowerbody: '#3b82f6',
            pushbody: '#ef4444',
            pullbody: '#a78bfa',
            superset: '#22c55e',
            __other__: 'rgba(255,255,255,0.2)'
        };
        const renderGroupSection = (g, passes, isUngrouped = false) => {
            const sectionId = `dm-group-${g.id}`;
            const groupAccent = GROUP_COLORS[g.id] || '#22d3ee';
            return `
            <div style="
                border-radius: 16px; overflow: hidden;
                position: relative;
                background: linear-gradient(135deg, #243044 0%, #152032 100%);
                border: none;
                border-left: 4px solid ${isUngrouped ? 'rgba(255,255,255,0.15)' : groupAccent};
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <div style="position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 100%);"></div>
                <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 100%);"></div>
                <div style="position:absolute; top:0; right:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%);"></div>
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
                    <div style="padding: 6px 10px 10px 10px; background: rgba(0,0,0,0.2);">
                        <div style="font-size:10px; color:var(--text-light); opacity:0.7; text-align:center; padding: 4px 0 6px 0; font-weight:600; letter-spacing:0.3px;">
                            💡 Hold to preview exercises
                        </div>
                        ${(() => {
                            const { visible, hasMore } = getVisiblePassesForGroup(g.id, passes);
                            const buttonsHtml = visible.map(p => {
                                const isSelected = planned && p.id === planned.id;
                                const cardStyle = `margin:0 !important; padding:10px 12px !important; font-size:13px !important; border-radius:12px !important; font-weight:600 !important;
                                    width:100% !important; height:auto !important; min-height:0 !important;
                                    display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:space-between !important;
                                    text-align:left !important;
                                    background:#1e293b !important;
                                    border:1px solid ${isSelected ? '#22d3ee' : 'rgba(255,255,255,0.08)'} !important;
                                    border-left:3px solid ${isSelected ? '#22d3ee' : groupAccent} !important;
                                    box-shadow:0 4px 10px rgba(0,0,0,0.4) !important;
                                    color:${isSelected ? 'var(--primary)' : 'var(--text)'} !important;
                                    outline:none !important;
                                    user-select:none; -webkit-user-select:none;`;
                                return `
                                <button class="mode-btn plan-override-btn plan-override-btn-v2"
                                    id="btn-ovr-${p.id}"
                                    data-name="${p.name}"
                                    data-accent="${groupAccent}"
                                    data-compact="true"
                                    onclick="if(!isLongPress) { setOverrideSilent('${dateStr}', '${p.id}'); cancelPress(); }"
                                    onmousedown="startPress(${programData.routine.indexOf(p)}, event)"
                                    onmouseup="if(!isLongPress && !hasScrolled) setOverrideSilent('${dateStr}', '${p.id}'); cancelPress();"
                                    onmouseleave="cancelPress();"
                                    ontouchstart="startPress(${programData.routine.indexOf(p)}, event)"
                                    ontouchend="handleTouchEnd(${programData.routine.indexOf(p)}, '${dateStr}', '${p.id}', event)"
                                    ontouchmove="handleTouchMove(event)"
                                    style="${cardStyle}">
                                   ${renderOverrideBtnContentCompact(p, isSelected)}
                                </button>`;
                            }).join('');
                            const browseLink = hasMore ? `
                                <button onclick="enterWorkoutSelectionMode('${dateStr}', '${g.id}')"
                                    style="margin-top:8px; width:100%; padding:10px; border-radius:12px;
                                    border:1px dashed rgba(34,211,238,0.4); background:rgba(34,211,238,0.04);
                                    color:var(--primary); font-size:12px; font-weight:700; cursor:pointer;">
                                  Choose from all ${passes.length} workouts →
                                </button>` : '';
                            return `<div style="display:grid; grid-template-columns:1fr; gap:8px;">${buttonsHtml}</div>${browseLink}`;
                        })()}
                    </div>
                </div>
            </div>`;
        };

        if (planned) {
            const plannedGroup = groupsWithPasses.find(g => groupMap[g.id].some(p => p.id === planned.id));
            if (plannedGroup) {
                autoOpenGroupId = plannedGroup.id;
            } else if (ungrouped.some(p => p.id === planned.id)) {
                autoOpenGroupId = '__other__';
            }
        }
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
    if (autoOpenGroupId) {
        setTimeout(() => toggleDayManagerGroup(autoOpenGroupId), 50);
    }
}

const PASS_COMPACT_THRESHOLD = 6;

function renderOverrideBtnContentCompact(p, isSelected) {
    return `
        <span style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span class="ovr-check" style="width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; border:2px solid ${isSelected ? '#22d3ee' : 'rgba(255,255,255,0.2)'}; background:${isSelected ? '#22d3ee' : 'transparent'}; color:${isSelected ? '#0f172a' : 'transparent'};">✓</span>
            <span style="font-size:12px; font-weight:700; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;">${p.name}</span>
        </span>
        <span style="display:flex; gap:6px; flex-shrink:0; font-size:9px; font-weight:800; white-space:nowrap;">
            <span style="color:#22d3ee;">${p.exercises.length} EXERCISES</span>
            ${p.duration ? `<span style="color:#f59e0b;">⏱️ ~${p.duration} MIN</span>` : ''}
        </span>
    `;
}

window.goToWorkoutProgramsGroup = (groupId) => {
    closeModal();
    const targetId = groupId === '__other__' ? '__ungrouped__' : groupId;
    renderPassesInGroup(targetId);
};

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
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    if (programId !== "none" && programId !== "") {
        recordRecentlyUsedPass(programId);
    }
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

// Uppdatera "Tap a group..."-hinten beroende på om något pass nu är planerat
    const editPlanHint = document.querySelector('#day-manager-group-container')?.parentElement.querySelector('.hint-bubble span');
    if (editPlanHint) {
        const isRestNow = (programId === "none" || programId === "");
        editPlanHint.textContent = isRestNow ? 'Tap a group to add workout' : 'Tap a group to change workout';
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

    // Nollställ alla pass-knappar till "ej vald"-utseende
    document.querySelectorAll('.plan-override-btn').forEach(btn => {
        btn.classList.remove('active-choice');
        if (!btn.classList.contains('override-rest-btn')) {
            const accent = btn.dataset.accent || '#22d3ee';
            btn.style.setProperty('background', '#1e293b', 'important');
            btn.style.setProperty('border', '1px solid rgba(255,255,255,0.08)', 'important');
            btn.style.setProperty('border-left', `3px solid ${accent}`, 'important');
            btn.style.setProperty('color', 'var(--text)', 'important');
            const passId = btn.id.replace('btn-ovr-', '');
            const passObj = programData.routine.find(x => x.id === passId);
            if (passObj) {
                btn.innerHTML = btn.dataset.compact === 'true'
                    ? renderOverrideBtnContentCompact(passObj, false)
                    : renderOverrideBtnContent(passObj, false);
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
                selectedBtn.classList.remove('active-choice');
                selectedBtn.style.setProperty('background', 'rgba(34,211,238,0.1)', 'important');
              selectedBtn.style.setProperty('border', '1px solid #22d3ee', 'important');
                selectedBtn.style.setProperty('color', 'var(--primary)', 'important');
                const passObj = programData.routine.find(x => x.id === programId);
                if (passObj) {
                    selectedBtn.innerHTML = selectedBtn.dataset.compact === 'true'
                        ? renderOverrideBtnContentCompact(passObj, true)
                        : renderOverrideBtnContent(passObj, true);
                }
                selectedBtn.style.setProperty('border-left', '3px solid #22d3ee', 'important');
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

const EXERCISE_SVG_MAP = {
    'Ben': {
        small: `<svg width="30" height="34" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="8" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="13" x2="26" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="17" x2="32" y2="17" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="18" y2="36" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="34" y2="36" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="36" x2="16" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="34" y1="36" x2="36" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="32" x2="40" y2="32" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="32" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/><circle cx="42" cy="32" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/></svg>`,
        large: `<svg width="100" height="100" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="8" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="13" x2="26" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="17" x2="32" y2="17" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="18" y2="36" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="34" y2="36" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="36" x2="16" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="34" y1="36" x2="36" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="32" x2="40" y2="32" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="32" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/><circle cx="42" cy="32" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/></svg>`
    },
    'Bröst': {
        small: `<svg width="30" height="34" viewBox="0 0 52 52" fill="none"><rect x="8" y="28" width="36" height="5" rx="2" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" stroke-width="1.2"/><circle cx="26" cy="20" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="25" x2="26" y2="33" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="29" x2="20" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="29" x2="32" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="26" x2="14" y2="27" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><line x1="32" y1="26" x2="38" y2="27" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><circle cx="13" cy="27" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/><circle cx="39" cy="27" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/><line x1="26" y1="33" x2="22" y2="40" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="33" x2="30" y2="40" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        large: `<svg width="100" height="100" viewBox="0 0 52 52" fill="none"><rect x="8" y="28" width="36" height="5" rx="2" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" stroke-width="1.2"/><circle cx="26" cy="20" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="25" x2="26" y2="33" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="29" x2="20" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="29" x2="32" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="26" x2="14" y2="27" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><line x1="32" y1="26" x2="38" y2="27" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><circle cx="13" cy="27" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/><circle cx="39" cy="27" r="3" fill="none" stroke="#22d3ee" stroke-width="1.2"/><line x1="26" y1="33" x2="22" y2="40" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="33" x2="30" y2="40" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/></svg>`
    },
    'Rygg': {
        small: `<svg width="30" height="34" viewBox="0 0 52 52" fill="none"><circle cx="18" cy="10" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="18" y1="15" x2="20" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="26" x2="14" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="26" x2="24" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="20" x2="38" y2="20" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><circle cx="40" cy="20" r="3.5" fill="none" stroke="#22d3ee" stroke-width="1.2"/></svg>`,
        large: `<svg width="100" height="100" viewBox="0 0 52 52" fill="none"><circle cx="18" cy="10" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="18" y1="15" x2="20" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="26" x2="14" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="26" x2="24" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="20" x2="38" y2="20" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/><circle cx="40" cy="20" r="3.5" fill="none" stroke="#22d3ee" stroke-width="1.2"/></svg>`
    },
    'Axlar': {
        small: `<svg width="30" height="34" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="18" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="23" x2="26" y2="34" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="27" x2="18" y2="24" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="27" x2="34" y2="24" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="10" x2="40" y2="10" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="10" r="3.5" fill="none" stroke="#22d3ee" stroke-width="1.2"/><circle cx="42" cy="10" r="3.5" fill="none" stroke="#22d3ee" stroke-width="1.2"/><line x1="18" y1="24" x2="18" y2="12" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="34" y1="24" x2="34" y2="12" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="34" x2="22" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="34" x2="30" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        large: `<svg width="100" height="100" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="18" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="23" x2="26" y2="34" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="27" x2="18" y2="24" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="27" x2="34" y2="24" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="10" x2="40" y2="10" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="10" r="3.5" fill="none" stroke="#22d3ee" stroke-width="1.2"/><circle cx="42" cy="10" r="3.5" fill="none" stroke="#22d3ee" stroke-width="1.2"/><line x1="18" y1="24" x2="18" y2="12" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="34" y1="24" x2="34" y2="12" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="34" x2="22" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="34" x2="30" y2="44" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/></svg>`
    },
    'default': {
        small: `<svg width="30" height="34" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="8" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="13" x2="26" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="18" x2="32" y2="18" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="22" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="30" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="22" y1="38" x2="20" y2="46" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="30" y1="38" x2="32" y2="46" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        large: `<svg width="100" height="100" viewBox="0 0 52 52" fill="none"><circle cx="26" cy="8" r="5" fill="none" stroke="#22d3ee" stroke-width="1.5"/><line x1="26" y1="13" x2="26" y2="26" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="20" y1="18" x2="32" y2="18" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="22" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="26" y1="26" x2="30" y2="38" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="22" y1="38" x2="20" y2="46" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><line x1="30" y1="38" x2="32" y2="46" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/></svg>`
    }
};

function getExSVG(target, size) {
    const map = EXERCISE_SVG_MAP[target] || EXERCISE_SVG_MAP['default'];
    return size === 'small' ? map.small : map.large;
}

let recentPassesByGroup = JSON.parse(localStorage.getItem("recentPassesByGroup") || "{}");
window._selectionModeDate = null;

function recordRecentlyUsedPass(passId) {
    const pass = programData.routine.find(p => p.id === passId);
    if (!pass || !Array.isArray(pass.groups)) return;
    pass.groups.forEach(gId => {
        if (!recentPassesByGroup[gId]) recentPassesByGroup[gId] = [];
        recentPassesByGroup[gId] = recentPassesByGroup[gId].filter(id => id !== passId);
        recentPassesByGroup[gId].unshift(passId);
        recentPassesByGroup[gId] = recentPassesByGroup[gId].slice(0, 10);
    });
    localStorage.setItem("recentPassesByGroup", JSON.stringify(recentPassesByGroup));
}

function getVisiblePassesForGroup(groupId, passes) {
    const THRESHOLD = 4;
    if (passes.length <= THRESHOLD) return { visible: passes, hasMore: false };
    const recentIds = recentPassesByGroup[groupId] || [];
    const recentPasses = recentIds.map(id => passes.find(p => p.id === id)).filter(Boolean);
    const remaining = passes.filter(p => !recentIds.includes(p.id));
    const visible = [...recentPasses, ...remaining].slice(0, THRESHOLD);
    return { visible, hasMore: true };
}

function reopenDayManagerForDate(dateStr) {
    if (typeof showView === 'function') showView("calendar-view");
    if (typeof renderCalendar === 'function') renderCalendar();
    const hasWorkouts = workoutHistory.filter(w => w.date === dateStr);
    const isOngoing = activeDraft && activeDraft.date === dateStr && activeDraft.isStarted;
    const override = calendarOverrides[dateStr];
    let displayPass = null;
    if (override && override !== "none") {
        displayPass = programData.routine.find(p => p.id === override) || null;
    } else if (override !== "none") {
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();
        const isAutoDay = [1, 3, 5].includes(dayOfWeek);
        if (isAutoDay && programData && programData.routine.length > 0) {
            const d = dateObj.getDate();
            displayPass = programData.routine[d % programData.routine.length];
        }
    }
    openDayManager(dateStr, displayPass, hasWorkouts, isOngoing);
}

window.enterWorkoutSelectionMode = (dateStr, groupId) => {
    window._selectionModeDate = dateStr;
    document.getElementById("workout-modal").classList.add("hidden");
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(false);
    const targetId = groupId === '__other__' ? '__ungrouped__' : groupId;
    renderPassesInGroup(targetId);
};

window.cancelWorkoutSelection = () => {
    const dateStr = window._selectionModeDate;
    window._selectionModeDate = null;
    if (dateStr) reopenDayManagerForDate(dateStr);
};

window.selectWorkoutForDate = (passId) => {
    const dateStr = window._selectionModeDate;
    if (!dateStr) return;
    calendarOverrides[dateStr] = passId;
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
    recordRecentlyUsedPass(passId);
    if (typeof renderCalendar === "function") renderCalendar();
    setTimeout(() => { if (typeof saveAll === 'function') saveAll(); }, 0);
    window._selectionModeDate = null;
    reopenDayManagerForDate(dateStr);
};

function getExerciseTemplatesFromLog(exercises) {
    return (exercises || []).map(ex => {
        const master = masterExercises.find(m => m.name === ex.name);
        return {
            name: ex.name,
            target: master ? master.target : '',
            subtarget: master ? (master.subtarget || null) : null,
            defaultSets: 3
        };
    });
}

function getHistoryExercisesForLog(dateStr, idx) {
    const filtered = workoutHistory.filter(w => w.date === dateStr);
    const w = filtered[idx];
    return w ? (w.exercises || []) : [];
}

function roundDurationToNearest5(totalTimeStr) {
    if (!totalTimeStr) return null;
    const parts = totalTimeStr.split(':').map(Number);
    if (parts.length < 2) return null;
    const totalMinutes = (parts[0] || 0) * 60 + (parts[1] || 0) + (parts[2] || 0) / 60;
    return Math.round(totalMinutes / 5) * 5;
}

async function renameSingleWorkoutInHistory(workoutId, newName, dateStr, oldName) {
    if (!workoutId) return;
    const entry = workoutHistory.find(w => w.id === workoutId);
    if (entry) entry.programName = newName;
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    if (typeof currentUser !== 'undefined' && currentUser && typeof supabaseClient !== 'undefined') {
        try {
            let query = supabaseClient
                .from('workout_history')
                .select('id, workout_data')
                .eq('user_id', currentUser.id);
            if (dateStr) query = query.eq('workout_date', dateStr);
            const { data, error } = await query;
            if (!error && Array.isArray(data)) {
                const targetRow = data.find(row =>
                    row.workout_data && (row.workout_data.id === workoutId || row.workout_data.programName === oldName)
                );
                if (targetRow) {
                    targetRow.workout_data.programName = newName;
                    await supabaseClient
                        .from('workout_history')
                        .update({ workout_data: targetRow.workout_data })
                        .eq('id', targetRow.id)
                        .eq('user_id', currentUser.id);
                }
            }
        } catch (e) {
            console.error("renameSingleWorkoutInHistory:", e);
        }
    }
}

function openSaveFreeWorkoutModalForLog(dateStr, idx) {
    const filtered = workoutHistory.filter(w => w.date === dateStr);
    const entry = filtered[idx];
    if (!entry) return;
    openSaveFreeWorkoutModal(entry.exercises || [], () => reopenDayManagerForDate(dateStr), {
        workoutId: entry.id,
        oldName: entry.programName,
        date: dateStr,
        totalTime: entry.totalTime
    });
}

function openRepeatWorkoutModalForLog(dateStr, idx) {
    const filtered = workoutHistory.filter(w => w.date === dateStr);
    const entry = filtered[idx];
    if (!entry) return;
    openRepeatWorkoutModal(entry.exercises || [], entry.programName);
}

function openSaveFreeWorkoutModal(exercises, onSaved, meta = {}) {
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    const customGroups = programData.customGroups || [];
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...customGroups];
    let selectedGroups = [];
    const roundedDuration = roundDurationToNearest5(meta.totalTime);
    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom:8px;">Save as Workout program</h3>
        <p style="text-align:center; font-size:12px; color:var(--text-light); margin-bottom:20px;">Give this workout a name to reuse it later</p>
        <input type="text" id="save-free-name" class="log-input" placeholder="e.g. Saturday Push Day" style="text-align:center;">
        <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin:16px 0 10px; letter-spacing:1px;">Estimated Duration</p>
        <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:6px;">
            <span style="font-size:20px;">⏱️</span>
            <input type="number" id="save-free-duration" class="log-input" placeholder="e.g. 60" value="${roundedDuration || ''}"
                style="margin:0; text-align:center; width:80px; -moz-appearance: textfield;"
                onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)">
            <span style="font-size:12px; color:var(--text-light); font-weight:700;">min</span>
        </div>
        <p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin:16px 0 10px; letter-spacing:1px;">Add to group (optional)</p>
        <div id="save-free-groups" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-bottom:20px;">
            ${ALL_GROUPS.map(g => `
            <button data-gid="${g.id}" onclick="window.toggleSaveFreeGroup('${g.id}')"
                style="padding:8px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:var(--text-light); font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                <span>${g.icon}</span>${g.name}
            </button>`).join('')}
        </div>
        <button class="mode-btn blue" id="save-free-confirm-btn" style="width:100%; margin-bottom:10px;">Save Program</button>
        <button class="mode-btn glass-border" id="save-free-skip-btn"
            style="width:100%; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45);">
            Skip
        </button>
    `;
    window.toggleSaveFreeGroup = (gid) => {
        const btn = document.querySelector(`#save-free-groups [data-gid="${gid}"]`);
        const idx = selectedGroups.indexOf(gid);
        if (idx > -1) {
            selectedGroups.splice(idx, 1);
            if (btn) { btn.style.border = '1px solid rgba(255,255,255,0.1)'; btn.style.background = 'rgba(255,255,255,0.04)'; btn.style.color = 'var(--text-light)'; }
        } else {
            selectedGroups.push(gid);
            if (btn) { btn.style.border = '1px solid var(--primary)'; btn.style.background = 'rgba(34,211,238,0.15)'; btn.style.color = 'var(--primary)'; }
        }
    };
    let isSaving = false;
    document.getElementById("save-free-confirm-btn").onclick = async () => {
        if (isSaving) return;
        const name = document.getElementById("save-free-name").value.trim();
        if (!name) { alert("Please enter a name"); return; }
        isSaving = true;
        const durationInput = document.getElementById("save-free-duration");
        const duration = durationInput && durationInput.value ? parseInt(durationInput.value) : null;
        const newPass = {
            id: "pass-" + Date.now(),
            name,
            exercises: getExerciseTemplatesFromLog(exercises),
            groups: selectedGroups,
            duration: duration
        };
        programData.routine.push(newPass);
        await saveCustomProgramToSupabase();
        if (meta.workoutId && meta.oldName && meta.oldName !== name) {
            await renameSingleWorkoutInHistory(meta.workoutId, name, meta.date, meta.oldName);
        }
        hideDefaultCloseButton(false);
        closeModal();
        if (typeof onSaved === 'function') onSaved();
    };
    document.getElementById("save-free-skip-btn").onclick = () => {
        hideDefaultCloseButton(false);
        closeModal();
        if (typeof onSaved === 'function') onSaved();
    };
    openModal();
}

function openRepeatWorkoutModal(exercises, sourceName = "Free Workout") {
    if (typeof hideDefaultCloseButton === 'function') hideDefaultCloseButton(true);
    const body = document.getElementById("modal-body");
    body.style.display = "";
    body.style.flexDirection = "";
    body.style.justifyContent = "";
    body.style.alignItems = "";
    body.style.gap = "";
    let pickerDate = new Date();
    const render = () => {
        const year = pickerDate.getFullYear();
        const month = pickerDate.getMonth();
        const monthLabel = pickerDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const firstDay = new Date(year, month, 1).getDay();
        const offset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        let cells = '';
        for (let i = 0; i < offset; i++) cells += `<div></div>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = dateStr === todayStr;
            const hasWorkouts = workoutHistory.filter(w => w.date === dateStr);
            const isOngoing = activeDraft && activeDraft.date === dateStr && activeDraft.isStarted;
            const dayOfWeek = new Date(year, month, d).getDay();
            const isAutoDay = [1, 3, 5].includes(dayOfWeek);
            const override = calendarOverrides[dateStr];
            let displayPass = null;
            if (override && override !== "none") displayPass = programData.routine.find(p => p.id === override);
            else if (isAutoDay && override !== "none" && programData && programData.routine.length > 0) displayPass = programData.routine[d % programData.routine.length];
            let extraClass = '';
            let info = '';
            if (hasWorkouts.length > 0) { extraClass = 'cell-completed'; info = '✓'; }
            else if (isOngoing) { extraClass = 'cell-ongoing'; info = displayPass ? displayPass.name.split(" ").pop() : '🔥'; }
            else if (displayPass) { extraClass = 'cell-planned'; info = displayPass.name.split(" ").pop(); }
            cells += `<div onclick="window.selectRepeatDate(this, '${dateStr}')" class="calendar-cell ${isToday ? 'today' : ''} ${extraClass}"><span>${d}</span><div class="cell-info">${info}</div></div>`;
        }
        body.innerHTML = `
            <h3 style="text-align:center; margin-bottom:8px;">Repeat workout on...</h3>
            <p style="text-align:center; font-size:12px; color:var(--text-light); margin-bottom:16px;">Choose a date to schedule this workout</p>
            <div class="calendar-nav">
                <button class="nav-arrow" onclick="window.repeatPickerChangeMonth(-1)">❮</button>
                <h2 id="month-label" style="margin:0;">${monthLabel}</h2>
                <button class="nav-arrow" onclick="window.repeatPickerChangeMonth(1)">❯</button>
            </div>
            <div class="card calendar-card glass-light">
                <div class="calendar-weekdays"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div>
                <div class="calendar-grid" id="calendar-grid">${cells}</div>
            </div>
            <button class="mode-btn glass-border" onclick="hideDefaultCloseButton(false); closeModal();"
                style="width:100%; margin-top:10px; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%); border: 1px solid rgba(255,255,255,0.25); border-top: 1px solid rgba(255,255,255,0.45);">
                Cancel
            </button>
        `;
    };
    window.repeatPickerChangeMonth = (delta) => {
        pickerDate.setMonth(pickerDate.getMonth() + delta);
        render();
    };
    window.selectRepeatDate = (el, dateStr) => {
        document.querySelectorAll('#workout-modal .calendar-cell').forEach(c => c.classList.remove('cell-planned'));
        el.classList.add('cell-planned');
        window.confirmRepeatDate(dateStr);
    };
    window.confirmRepeatDate = async (dateStr) => {
const newPass = {
            id: "freecopy-" + Date.now(),
            name: sourceName,
            exercises: getExerciseTemplatesFromLog(exercises),
            groups: [],
            _isFreeCopy: true
        };
        programData.routine.push(newPass);
        calendarOverrides[dateStr] = newPass.id;
        await saveCustomProgramToSupabase();
        await saveAll();
        setTimeout(() => {
            hideDefaultCloseButton(false);
            closeModal();
            if (typeof renderCalendar === 'function') renderCalendar();
        }, 250);
    };
    render();
    openModal();
}

function renderLargePassCard(pass, passIdx, icons, selector) {
    const passCard = document.createElement("div");
    passCard.className = "prog-card";
    passCard.style.cssText = `
        position: relative; min-height: 120px; overflow: hidden;
        background: linear-gradient(135deg, #243044 0%, #152032 100%);
        border-top: 3px solid #f59e0b;
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
}

let accordionOpenPassIdx = null;

function renderAccordionPassCard(pass, passIdx, icons, selector, layoutMode) {
    const isCompact = layoutMode === 'compact';
    const passCard = document.createElement("div");
    passCard.className = "prog-card";
    passCard.style.cssText = `
        position: relative; overflow: hidden;
        background: linear-gradient(135deg, #243044 0%, #152032 100%);
        border-top: 3px solid #f59e0b;
        border-radius: 16px;
        transition: opacity 0.3s ease, grid-column 0.3s ease;
        ${isCompact ? 'min-height:60px; padding:12px 15px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;' : 'min-height:120px;'}
    `;

   const editPencil = `
        <div onclick="event.stopPropagation(); openEditProgramModal(${passIdx})"
            style="position: absolute; top: 6px; right: 6px; font-size: 12px; opacity: 0.6; cursor: pointer; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); z-index:2;">✏️</div>
    `;
   const selectBtn = window._selectionModeDate ? `
        <button class="dm-select-btn" onclick="event.stopPropagation(); selectWorkoutForDate('${pass.id}')"
            style="position:absolute; bottom:6px; right:6px; padding:3px 9px; border-radius:6px; border:none; background:var(--primary); color:#0f172a; font-size:9px; font-weight:800; cursor:pointer; z-index:2;">
            Select
        </button>` : '';

    if (isCompact) {
        passCard.innerHTML = `
            <div style="position:absolute; left:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; right:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="font-size:20px;">${icons[passIdx % 4]}</div>
            <div style="flex:1;">
                <h4 style="font-size:13px; margin:0; line-height:1.3;">${pass.name}</h4>
                <div style="font-size:9px; color:var(--primary); font-weight:800;">${pass.exercises.length} ${pass.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</div>
            </div>
            ${editPencil}${selectBtn}
        `;
    } else {
        passCard.innerHTML = `
            <div style="position:absolute; left:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; right:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="position:absolute; bottom:0; left:0; right:0; height:1px; background: linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.3) 50%, rgba(245,158,11,0.1) 100%);"></div>
            <div style="font-size:28px;">${icons[passIdx % 4]}</div>
            <h4 style="font-size:14px; margin:8px 0 4px 0; line-height:1.3;">${pass.name}</h4>
            <div style="font-size:10px; color:var(--primary); font-weight:800;">${pass.exercises.length} ${pass.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</div>
            ${pass.duration ? `<div style="position:absolute; top:8px; left:10px; font-size:10px; color:#f59e0b; font-weight:600; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); padding: 3px 7px; border-radius: 8px;">⏱️ ~${pass.duration} min</div>` : ''}
            ${editPencil}${selectBtn}
        `;
    }

    passCard.onclick = () => {
        const isOpen = passCard.classList.contains("active");
        document.querySelectorAll("#pass-selector-list .prog-card.active").forEach(c => {
            c.classList.remove("active");
            c.style.gridColumn = "";
            const list = c.querySelector(".acc-exercise-list");
            if (list) {
                list.style.maxHeight = "0px";
                list.style.opacity = "0";
                setTimeout(() => list.remove(), 300);
            }
        });

        if (!isOpen) {
            document.querySelectorAll("#pass-selector-list .prog-card").forEach(c => {
                c.style.opacity = c === passCard ? "1" : "0.55";
            });
            passCard.classList.add("active");
            accordionOpenPassIdx = passIdx;
            if (!isCompact) passCard.style.gridColumn = "span 2";

            const list = document.createElement("div");
            list.className = "acc-exercise-list";
            list.style.cssText = "max-height:0px; opacity:0; overflow:hidden; transition: max-height 0.35s ease, opacity 0.3s ease; width:100%;";
            list.innerHTML = `
                <div style="padding-top:12px; margin-top:12px; border-top:1px solid rgba(255,255,255,0.08); margin-bottom:6px;">
                    <span style="font-size:13px; color:var(--text-light); text-transform:uppercase; letter-spacing:1px; font-weight:700;">Exercises</span>
                </div>
                ${pass.exercises.map((e, i) => `
                <div style="display:grid; grid-template-columns: 1fr 70px 12px 70px; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
                    <span style="display:flex; align-items:center; gap:10px; font-weight:600; font-size:13px;">
                        <span style="display:flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; border:1px solid rgba(34,211,238,0.4); color:var(--primary); font-size:10px; font-weight:700; flex-shrink:0;">${i + 1}</span>
                        ${e.name}
                    </span>
                    <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--primary); text-align:right;">${CATEGORY_DISPLAY[e.target] || e.target}</span>
                    <span style="align-self:stretch; display:flex; justify-content:center;">${e.subtarget ? '<span style="width:1px; align-self:stretch; min-height:14px; background:rgba(255,255,255,0.15);"></span>' : ''}</span>
                    <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--text-light); opacity:0.6;">${e.subtarget || ''}</span>
                </div>
                `).join("")}
            `;
           passCard.appendChild(list);
            void list.offsetHeight; // tvingar fram reflow så transitionen verkligen triggas
            requestAnimationFrame(() => {
                list.style.maxHeight = (pass.exercises.length * 44 + 70) + "px";
                list.style.opacity = "1";
            });
            const selBtn = passCard.querySelector('.dm-select-btn');
            if (selBtn) {
                selBtn.style.bottom = 'auto';
                selBtn.style.top = '6px';
                selBtn.style.right = '34px';
            }
       } else {
            accordionOpenPassIdx = null;
            document.querySelectorAll("#pass-selector-list .prog-card").forEach(c => {
                c.style.opacity = "1";
            });
            const selBtn = passCard.querySelector('.dm-select-btn');
            if (selBtn) {
                selBtn.style.top = 'auto';
                selBtn.style.bottom = '6px';
                selBtn.style.right = '6px';
            }
        }
    };

    selector.appendChild(passCard);

    if (passIdx === accordionOpenPassIdx) {
        passCard.click();
    }
}


function renderChipsLayout(passesInGroup, selector, icons) {
    selector.style.gridTemplateColumns = '1fr';
    showChipsDetail(passesInGroup, null, selector, icons);
}

function showChipsDetail(passesInGroup, activePass, selector, icons) {
    let chipsRow = document.getElementById("chips-row");
    let detailCard = document.getElementById("chips-detail-card");

    if (!chipsRow || !detailCard) {
        selector.innerHTML = "";
        selector.style.gridTemplateColumns = '1fr';

        chipsRow = document.createElement("div");
        chipsRow.id = "chips-row";
        chipsRow.style.cssText = "display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px;";
        selector.appendChild(chipsRow);

        detailCard = document.createElement("div");
        detailCard.id = "chips-detail-card";
        detailCard.style.cssText = `
            background: linear-gradient(135deg, #243044 0%, #152032 100%);
            border-top: 3px solid #f59e0b; border-radius: 16px; position:relative; overflow:hidden;
            max-height:0px; opacity:0; padding:0 16px;
            transition: max-height 0.35s ease, opacity 0.3s ease, padding 0.35s ease;
        `;
        selector.appendChild(detailCard);
    }

    chipsRow.innerHTML = "";
    passesInGroup.forEach(p => {
        const chip = document.createElement("div");
        const isActive = p === activePass;
        chip.style.cssText = `padding:6px 12px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer;
            ${isActive ? 'background:rgba(34,211,238,0.15); color:var(--primary); border:1px solid var(--primary);' : 'background:rgba(255,255,255,0.05); color:var(--text-light); border:1px solid rgba(255,255,255,0.1);'}`;
        chip.textContent = p.name;
        chip.onclick = () => showChipsDetail(passesInGroup, isActive ? null : p, selector, icons);
        chipsRow.appendChild(chip);
    });

    if (!activePass) {
        // Collapsa mjukt
        const currentHeight = detailCard.scrollHeight + 32; // +32 = padding top+bottom när öppen
        detailCard.style.maxHeight = currentHeight + "px";
        void detailCard.offsetHeight;
        requestAnimationFrame(() => {
            detailCard.style.maxHeight = "0px";
            detailCard.style.opacity = "0";
            detailCard.style.padding = "0 16px";
        });
        return;
    }

    const passIdx = programData.routine.indexOf(activePass);
    detailCard.innerHTML = `
        <div style="position:absolute; left:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
        <div style="position:absolute; right:0; top:0; bottom:0; width:1px; background: linear-gradient(180deg, rgba(245,158,11,0.9) 0%, rgba(245,158,11,0.1) 100%);"></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:6px;">
            <div>
                <h4 style="margin:0; font-size:16px; color:#fff;">${activePass.name}</h4>
                <div style="display:flex; gap:10px; margin-top:4px; align-items:center;">
                    <span style="font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase;">${activePass.exercises.length} ${activePass.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}</span>
                    ${activePass.duration ? `<span style="font-size:12px; color:#f59e0b; font-weight:800;">⏱️ ~${activePass.duration} min</span>` : ''}
                </div>
            </div>
           <span style="display:flex; gap:8px; flex-shrink:0;">
                ${window._selectionModeDate ? `<button onclick="event.stopPropagation(); selectWorkoutForDate('${activePass.id}')" style="padding:6px 14px; border-radius:8px; border:none; background:var(--primary); color:#0f172a; font-size:11px; font-weight:800; cursor:pointer;">Select</button>` : ''}
                <span onclick="event.stopPropagation(); openEditProgramModal(${passIdx})" style="font-size:14px; opacity:0.7; cursor:pointer; padding:4px 8px; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); height:fit-content;">✏️</span>
            </span>
        </div>
        ${activePass.exercises.map((e, i) => `
        <div style="display:grid; grid-template-columns: 1fr 70px 12px 70px; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
            <span style="display:flex; align-items:center; gap:10px; font-weight:600; font-size:13px;">
                <span style="display:flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; border:1px solid rgba(34,211,238,0.4); color:var(--primary); font-size:10px; font-weight:700; flex-shrink:0;">${i + 1}</span>
                ${e.name}
            </span>
            <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--primary); text-align:right;">${CATEGORY_DISPLAY[e.target] || e.target}</span>
            <span style="align-self:stretch; display:flex; justify-content:center;">${e.subtarget ? '<span style="width:1px; align-self:stretch; min-height:14px; background:rgba(255,255,255,0.15);"></span>' : ''}</span>
            <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--text-light); opacity:0.6;">${e.subtarget || ''}</span>
        </div>
        `).join("")}
    `;

    // Mät naturlig innehållshöjd (utan padding) och expandera mjukt
    const targetHeight = detailCard.scrollHeight + 32;
    detailCard.style.maxHeight = "0px";
    detailCard.style.opacity = "0";
    detailCard.style.padding = "0 16px";
    void detailCard.offsetHeight;
    requestAnimationFrame(() => {
        detailCard.style.padding = "16px";
        detailCard.style.maxHeight = targetHeight + "px";
        detailCard.style.opacity = "1";
    });
}

function openLayoutPickerModal() {
    const body = document.getElementById("modal-body");
    const current = programData.layoutPreference || 'balanced';

    const iconLarge = `<div style="width:24px; height:24px; border-radius:5px; background:var(--primary);"></div>`;
    const iconGrid = `<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:3px; width:24px; height:24px;">
        <div style="background:var(--primary); border-radius:3px;"></div><div style="background:var(--primary); border-radius:3px;"></div>
        <div style="background:var(--primary); border-radius:3px;"></div><div style="background:var(--primary); border-radius:3px;"></div>
    </div>`;
    const iconList = `<div style="display:flex; flex-direction:column; gap:4px; width:24px;">
        ${'<div style="height:3px; border-radius:2px; background:var(--primary);"></div>'.repeat(5)}
    </div>`;

    const options = [
        { id: 'balanced', icon: iconGrid, title: 'Cards', desc: 'Best for a handful of workouts' },
        { id: 'compact', icon: iconList, title: 'Quick switch', desc: 'Best when you have many workouts' }
    ];

    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom: 20px;">Choose layout</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
            ${options.map(o => `
                <div onclick="window.selectLayoutPreference('${o.id}')"
                    style="display:flex; align-items:center; gap:14px; padding:14px; border-radius:14px; cursor:pointer;
                    border:1px solid ${current === o.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
                    background:${current === o.id ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)'};">
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px;">${o.icon}</div>
                    <div>
                        <div style="font-weight:700; font-size:14px;">${o.title}</div>
                        <div style="font-size:11px; color:var(--text-light);">${o.desc}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    openModal();
}

window.selectLayoutPreference = async (id) => {
    programData.layoutPreference = id;
    window.programData = programData;
    localStorage.setItem("myCustomProgram", JSON.stringify(programData));
    if (typeof saveCustomProgram === 'function') await saveCustomProgram();
    closeModal();
    if (currentViewGroupId) {
        renderPassesInGroup(currentViewGroupId);
    } else {
        renderGroupsView();
    }
};

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
            background: linear-gradient(135deg, #243044 0%, #152032 100%);
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
   const ungroupedPasses = programData.routine.filter(p => (!Array.isArray(p.groups) || p.groups.length === 0) && !p._isFreeCopy);
    if (true) {
        const ungroupedCard = document.createElement("div");
        ungroupedCard.style.cssText = `
            position: relative; overflow: hidden;
            background: linear-gradient(135deg, #243044 0%, #152032 100%);
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

    const layoutBar = document.getElementById("layout-picker-bar");
    if (layoutBar) layoutBar.style.display = 'none';
    showView("programs-view");
}

function renderPassesInGroup(groupId) {
    const selector = document.getElementById("pass-selector-list");
    if (!selector) return;
    const customGroups = programData.customGroups || [];
    const ALL_GROUPS = [...PREDEFINED_GROUPS, ...customGroups];
    const groupDef = ALL_GROUPS.find(g => g.id === groupId) || { id: groupId, name: groupId === '__ungrouped__' ? 'Other' : groupId, icon: groupId === '__ungrouped__' ? '📁' : '📁' };
    currentViewGroupId = groupId;
    const hintText = window._selectionModeDate
        ? 'Select a workout for your plan'
        : 'Tap a workout to see its exercises';
    let hint = document.getElementById('groups-hint-bubble');
    if (hint) {
        hint.querySelector('span').textContent = hintText;
    } else {
        const programsView = document.getElementById("programs-view");
        let hintWrap = document.getElementById('groups-hint-wrap');
        if (!hintWrap) {
            hintWrap = document.createElement('div');
            hintWrap.id = 'groups-hint-wrap';
            hintWrap.style.cssText = 'text-align:center; width:100%; margin-bottom:12px;';
            programsView.insertBefore(hintWrap, selector);
        }
        hint = document.createElement('div');
        hint.id = 'groups-hint-bubble';
        hint.className = 'hint-bubble hint-centered';
        hint.innerHTML = `<span style="font-size:13px; font-weight:700; color:#fff; letter-spacing:0.3px;">${hintText}</span>`;
        hintWrap.appendChild(hint);
    }
    const passesInGroup = groupId === '__ungrouped__'
        ? programData.routine.filter(p => (!Array.isArray(p.groups) || p.groups.length === 0) && !p._isFreeCopy)
        : programData.routine.filter(p => Array.isArray(p.groups) && p.groups.includes(groupId));
    selector.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    selector.style.transform = 'translateX(30px)';
    selector.style.opacity = '0';
    setTimeout(() => {
        const addGroupBtn = document.getElementById("add-custom-group-btn");
        if (addGroupBtn) addGroupBtn.style.display = 'none';
        selector.innerHTML = "";
        const layoutMode = programData.layoutPreference || 'balanced';
        const gridCols = layoutMode === 'compact' ? '1fr' : 'repeat(2, 1fr)';
        selector.style.cssText = `display: grid; grid-template-columns: ${gridCols}; gap: 12px; transition: transform 0.3s ease, opacity 0.3s ease; transform: translateX(30px); opacity: 0;`;

        let topBar = document.getElementById("programs-top-bar");
        if (!topBar) {
            topBar = document.createElement("div");
            topBar.id = "programs-top-bar";
            topBar.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:16px;";
            selector.parentElement.insertBefore(topBar, selector);
        }

        let backBtn = document.getElementById("group-back-btn");
        if (!backBtn) {
            backBtn = document.createElement("button");
            backBtn.id = "group-back-btn";
            topBar.appendChild(backBtn);
        }
        backBtn.style.cssText = `
            display: flex; align-items: center; gap: 8px;
            background: none; border: none; color: var(--primary);
            font-size: 14px; font-weight: 700; cursor: pointer;
            padding: 0;
        `;
        backBtn.innerHTML = `← ${groupDef.icon} ${groupDef.name}`;

        let layoutBar = document.getElementById("layout-picker-bar");
        if (!layoutBar) {
            layoutBar = document.createElement("div");
            layoutBar.id = "layout-picker-bar";
            topBar.appendChild(layoutBar);
        }
        layoutBar.style.cssText = "display:flex; align-items:center; gap:8px;";
        const segIcons = {
            balanced: `<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:2px; width:14px; height:14px;">
                <div style="background:currentColor; border-radius:2px;"></div><div style="background:currentColor; border-radius:2px;"></div>
                <div style="background:currentColor; border-radius:2px;"></div><div style="background:currentColor; border-radius:2px;"></div>
            </div>`,
            compact: `<div style="display:flex; gap:2px; width:14px; height:14px; align-items:flex-end;">
                <div style="width:3px; height:14px; border-radius:2px; background:currentColor;"></div>
                <div style="width:3px; height:9px; border-radius:2px; background:currentColor;"></div>
                <div style="width:3px; height:14px; border-radius:2px; background:currentColor;"></div>
            </div>`
        };
        layoutBar.innerHTML = `
            <div style="display:flex; border:1px solid rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                ${['balanced','compact'].map(id => `
                    <div data-layout="${id}" style="padding:7px 11px; display:flex; align-items:center; justify-content:center; cursor:pointer;
                        color:${layoutMode===id ? 'var(--primary)' : 'var(--text-light)'};
                        background:${layoutMode===id ? 'rgba(34,211,238,0.1)' : 'transparent'};">
                        ${segIcons[id]}
                    </div>
                `).join('')}
            </div>
            <div id="layout-settings-btn" style="font-size:18px; opacity:0.6; cursor:pointer;">⚙️</div>
        `;
        layoutBar.querySelectorAll('[data-layout]').forEach(el => {
            el.onclick = () => window.selectLayoutPreference(el.dataset.layout);
        });
        layoutBar.querySelector('#layout-settings-btn').onclick = openLayoutPickerModal;
        layoutBar.style.display = 'flex';

        if (window._selectionModeDate) {
            const cancelBtn = document.createElement("button");
            cancelBtn.onclick = () => cancelWorkoutSelection();
            cancelBtn.style.cssText = "padding:8px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:var(--text-light); font-size:12px; font-weight:700; cursor:pointer;";
            cancelBtn.textContent = "Cancel";
            layoutBar.appendChild(cancelBtn);
        }

        if (window._selectionModeDate) {
            backBtn.innerHTML = `← Back to Day Manager`;
            backBtn.onclick = () => cancelWorkoutSelection();
        } else {
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
        }

        const icons = [' ⚡ ', ' 🔥 ', ' 🏆 ', ' 💎 '];
        if (layoutMode === 'compact') {
            renderChipsLayout(passesInGroup, selector, icons);
        } else {
            passesInGroup.forEach(pass => {
                const passIdx = programData.routine.indexOf(pass);
                renderAccordionPassCard(pass, passIdx, icons, selector, layoutMode);
            });
        }
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
        <div style="display:grid; grid-template-columns: 1fr 70px 12px 70px; align-items:center; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.03); gap:0;">
         <span style="font-weight:600;">${e.name}</span>
         <span style="font-weight:800; text-transform:uppercase; font-size:9px; color:var(--primary); text-align:right;">${CATEGORY_DISPLAY[e.target] || e.target}</span>
         <span style="align-self:stretch; display:flex; justify-content:center;">${e.subtarget ? '<span style="width:1px; align-self:stretch; min-height:14px; background:rgba(255,255,255,0.15);"></span>' : ''}</span>
         <span style="font-weight:800; text-transform:uppercase; font-size:10px; color:var(--text-light); opacity:0.6;">${e.subtarget || ''}</span>
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
            pass.exercises.push({ id: ex.id, name: ex.name, target: ex.target, subtarget: ex.subtarget || null });
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

    programData.routine[pIdx].exercises.push({ name: ex.name, target: ex.target, subtarget: ex.subtarget || null, defaultSets: 3 });

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
        { name: "Bål", icon: "🧘" },
        { name: "Cardio", icon: "🏃" },
        { name: "Mobility", icon: "🤸" }
    ];
    let html = `<div class="separator" style="margin: 12px 0 18px 0;"></div>`;
    html += `<h3 style="margin: 0 0 15px 0; color: var(--primary); font-size: 1.2rem; text-align: center; text-transform: uppercase; letter-spacing: 1px;">ADD EXERCISES</h3>`;
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Select Category</p>`;
    html += `<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:15px;">`;
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
        programData.routine[pIdx].exercises.push({ name: newEx.name, target: newEx.target, subtarget: newEx.subtarget || null, defaultSets: 3 });
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
  const withDates = workoutHistory
    .map(w => ({ w, dt: w.date ? new Date(w.date) : new Date(0) }))
    .filter(x => x.dt.toString() !== 'Invalid Date');
  if (withDates.length === 0) return null;
  withDates.sort((a, b) => b.dt - a.dt);
  const latest = withDates[0].w;
  if (!latest.exercises) return null;
  const exMatch = latest.exercises.find(e => e.name === exerciseName);
  if (!exMatch) return null;
  if (exMatch.sets_data && Array.isArray(exMatch.sets_data)) {
    return { sets_data: JSON.parse(JSON.stringify(exMatch.sets_data)), note: exMatch.note || null };
  }
  const count = parseInt(exMatch.sets || 3, 10) || 3;
  return {
    sets_data: Array.from({ length: count }, (_, i) => ({
      weight: exMatch.weight || "",
      reps: exMatch.reps || "",
      userConfirmed: false
    })),
    note: exMatch.note || null
  };
}

async function startWorkout(workout, data = null, date = null, isImmediateStart = false) {
    // Nollställ alltid vilotimern när ett nytt pass startas
    stopRestTimer();
    if (typeof carouselStopRest === 'function') carouselStopRest();

    if(!data) {
        data = workout.exercises.map(ex => {
            if (!isCardioExercise(ex)) {
                const history = getExerciseHistory(ex.name);
                if (history) {
                    const setsCopy = JSON.parse(JSON.stringify(history.sets_data));
                    setsCopy.forEach(set => { set.userConfirmed = false; });
                    return { sets_data: setsCopy, isCompleted: false, note: history.note || null };
                }
            }
            const defaultSet = getDefaultSetData(ex);
            const numSets = isCardioExercise(ex) ? 1 : 3;
            return { sets_data: Array(numSets).fill(null).map(() => ({...defaultSet})), isCompleted: false };
        });
    }

    // Bevara befintligt ui_state om passet redan har ett (återkomst till pågående pass)
    const existingUiState = (activeDraft && activeDraft.ui_state) ? activeDraft.ui_state : null;

    // Kontrollera om detta är ett pass vi återvänder till (som redan har startats tidigare)
    const alreadyStarted = activeDraft?.isStarted || false;
    const existingStartTime = activeDraft?.startTime || null;

    activeDraft = {
        workout: JSON.parse(JSON.stringify(workout)),
        data,
        date: date || new Date().toISOString().split('T')[0],
        // ÄNDRING: Sätt bara starttid om passet faktiskt redan var startat sedan innan, annars null
        startTime: alreadyStarted ? existingStartTime : null,
        // ÄNDRING: isStarted styrs av om det redan var igång, eller om isImmediateStart tvingar igång det
        isStarted: alreadyStarted || isImmediateStart,
        ui_state: existingUiState || {}
    };
    
    // Om vi tvingar en omedelbar start (isImmediateStart är true), stämpla tiden direkt
    if (isImmediateStart && !activeDraft.startTime) {
        activeDraft.startTime = new Date().toISOString();
    }
    
    // Sparar det skapade passutkastet direkt till både localStorage och Supabase
    await persistActiveWorkout();
    renderActiveWorkout();
}

// Global array för att hålla koll på valda övningar i modalen innan de sparas
let temporarySelectedExercises = [];

let isSyncingWithSupabase = false;

function renderActiveWorkout() {
    if (!activeDraft || !activeDraft.workout) {
        console.warn(" ⚠️ Inget aktivt utkast tillgängligt.");
        return;
    }
    
    // =========================================================================
    // 1. SÄKRA STARTTIDEN DIREKT OM PASSET ÄR IGÅNG
    // =========================================================================
    if (activeDraft.isStarted && (!activeDraft.startTime || activeDraft.startTime === "null" || activeDraft.startTime === "undefined")) {
        activeDraft.startTime = new Date().toISOString();
        if (typeof persistActiveWorkout === 'function') persistActiveWorkout();
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
    const exCountEl = document.getElementById("active-exercise-count");
    if (exCountEl && activeDraft.workout.exercises) {
        exCountEl.textContent = `${activeDraft.workout.exercises.length} exercises`;
    }
    
    // =========================================================================
    // 2. UPPDATERA KLOCKAN I HTML (Matchat mot dina exakta ID:n!)
    // =========================================================================
    const badgeWrapper = document.getElementById("start-time-badge");
    const startTimeEl = document.getElementById("active-start-time");
    const durationTextEl = document.getElementById("workout-duration-text");
    
    if (activeDraft.isStarted) {
        // Visa klockpucken om den råkar vara dold
        if (badgeWrapper) badgeWrapper.style.display = "flex";

        let startTimeStr = "--:--";
        if (activeDraft.startTime) {
            try {
                const parsedDate = new Date(activeDraft.startTime);
                if (!isNaN(parsedDate.getTime())) {
                    startTimeStr = parsedDate.toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'});
                }
            } catch (e) {
                console.error("Kunde inte tolka starttid:", e);
            }
        }
        
        // Tryck in tidsstämpeln (ersätter --:--)
        if (startTimeEl) {
            startTimeEl.textContent = startTimeStr;
        }

        // Beräkna live-minuter
        if (durationTextEl && activeDraft.startTime) {
            try {
                const diffInMs = new Date() - new Date(activeDraft.startTime);
                const diffInMinutes = Math.max(0, Math.floor(diffInMs / 1000 / 60)); 
                durationTextEl.textContent = `${diffInMinutes} min`;
            } catch (err) {
                durationTextEl.textContent = "0 min";
            }
        }
    } else {
        // Om passet INTE är startat (det är bara en mall/utkast), dölj starttidspucken helt
        if (badgeWrapper) badgeWrapper.style.display = "none";
        if (durationTextEl) durationTextEl.textContent = "0 min";
    }

    // =========================================================================
    // 3. RENDERA UT TRÄNINGSPASSETS INNEHÅLL OCH KNAPPAR
    // =========================================================================
    const list = document.getElementById("exercise-list");
    const footer = document.querySelector(".workout-footer");
    if (!list) return;
    list.innerHTML = "";
    
    // Grön jätteknapp om passet inte har startat fysiskt än
    if (!activeDraft.isStarted) {
        if (footer) footer.classList.add("hidden");
        list.innerHTML = `
        <div style="text-align:center; padding:20px 0;">
            <button class="mode-btn green" style="width:100%; padding:20px; font-size:18px; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);" onclick="actuallyStartWorkout()">START WORKOUT   🔥 </button>
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
    
    // Footer-knappar för pågående pass
    if (footer) {
        footer.classList.remove("hidden");
        footer.style.display = "flex";
        footer.style.alignItems = "stretch";
        footer.style.gap = "12px";
        const allExercisesDone = activeDraft.data && activeDraft.data.every(ex => ex.isCompleted);
        footer.innerHTML = `
            <div style="height:2px; background:linear-gradient(90deg, transparent, #22d3ee 30%, #f0a020 70%, transparent); margin:-0px -0px 12px -0px; border-radius:0;"></div>
            ${allExercisesDone ? `
            <button onclick="finishWorkout()" style="width:100%; padding:15px; background:linear-gradient(135deg,#15803d,#22c55e); color:#fff; font-size:15px; font-weight:900; border-radius:14px; border:none; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; margin-bottom:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Finish workout
            </button>` : `
           <button onclick="showEndWorkoutConfirm()" style="width:100%; padding:10px; background:transparent; border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:rgba(255,255,255,0.45); font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:4px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                End workout early
            </button>`}
            <div style="display:flex; gap:8px; width:100%;">
                <button onclick="saveDraftAndGoHome()" style="width:44px; height:44px; background:rgba(34,211,238,0.1); border:1.5px solid rgba(34,211,238,0.45); color:#22d3ee; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </button>
                <button id="pause-workout-btn" onclick="saveDraftAndGoHome()" style="flex:1; height:44px; background:linear-gradient(135deg,#7a8fa6,#5a7080); border:none; color:#fff; font-size:14px; font-weight:800; border-radius:14px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
                    Save draft
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                </button>
                <button onclick="confirmDiscardActiveWorkout()" style="width:44px; height:44px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.35); color:#ef4444; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
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
    
    let totalWorkoutCompletedSets = 0;
    let totalWorkoutSets = 0;

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
                background: linear-gradient(180deg, #1a2540 0%, #0f172a 100%);
                border: none;
                border-left: 4px solid ${isDone ? '#22c55e' : isOpen ? '#22d3ee' : 'rgba(250,204,21,0.3)'};
                box-shadow: ${isDone ? '0 0 25px rgba(34,197,94,0.25), inset 0 0 40px rgba(34,197,94,0.06)' : isOpen ? '0 4px 12px rgba(34,211,238,0.08)' : '0 4px 12px rgba(0,0,0,0.3)'};
            `;
            div.id = `exercise-card-${i}`;
            const completedSets = exerciseData.sets_data ? exerciseData.sets_data.filter(s => s.userConfirmed).length : 0;
            const totalSets = exerciseData.sets_data ? exerciseData.sets_data.length : 0;
            
            totalWorkoutCompletedSets += completedSets;
            totalWorkoutSets += totalSets;

            const firstUnconfirmed = exerciseData.sets_data ? exerciseData.sets_data.findIndex(s => !s.userConfirmed) : -1;
            const isCardio = isCardioExercise(ex);
            let setsHtml = `<div style="margin-top:10px;">
                <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
                <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">${isCardio ? '' : 'SET'}</small>
                <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'TIME (mm:ss)' : 'KG'}</small>
                <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'DIST (km)' : 'REPS'}</small>
                <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'PACE' : 'REST (S)'}</small>
                    <span></span>
                </div>`;
            if (exerciseData.sets_data) {
                exerciseData.sets_data.forEach((set, sIdx) => {
                    const isLocked = isDone;
                    const isCurrent = !set.userConfirmed && !isDone && sIdx === firstUnconfirmed;
                    const showSuccess = set.userConfirmed || isDone;
                    const circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
                    const statusContent = showSuccess ? ' ✅ ' : (isCardio ? '✓' : `#${sIdx + 1}`);
                    setsHtml += `
                    <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center; transition: opacity 0.2s ease; position:relative; overflow:visible;">
                       <div class="${isCurrent ? 'pulse-ring' : ''}" onclick="${isLocked && !isDone ? '' : `confirmSet(${i}, ${sIdx})`}"
                            style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:800; background: ${showSuccess ? 'rgba(34, 197, 94, 0.2)' : (isCurrent ? 'rgba(250, 204, 21, 0.15)' : 'rgba(245, 158, 11, 0.05)')}; color: ${circleColor}; opacity: 1;">
                            ${statusContent}
                        </div>
                       ${isCardio
                            ? `<input type="text" inputmode="numeric" id="cdm-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px 4px; font-size:15px; min-width:0; opacity:${isCurrent ? '1' : '0.3'}; text-align:center; font-family:monospace; letter-spacing:2px; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.duration || '__:__'}" ${isLocked ? 'readonly' : ''} onfocus="initCardioTimeInput('cdm-${i}-${sIdx}', ${i}, ${sIdx})">`
                            : `<input type="text" inputmode="decimal" id="w-${i}-${sIdx}" class="log-input weight-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.weight || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'weight')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                        ${isCardio
                            ? `<input type="text" inputmode="decimal" id="ck-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.distance || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'distance')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                            : `<input type="text" inputmode="decimal" id="r-${i}-${sIdx}" class="log-input reps-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.reps || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'reps')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                        ${isCardio ? `<div id="pace-${i}-${sIdx}" style="display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#22d3ee; font-family:monospace; white-space:nowrap; opacity:${isCurrent ? '1' : '0.3'};">${calcPace(set.duration, set.distance)}</div>` : (sIdx < exerciseData.sets_data.length - 1 ? `<input type="text" inputmode="decimal" id="v-${i}-${sIdx}" class="log-input rest-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; border-color:${isCurrent ? 'rgba(245,158,11,0.6)' : 'rgba(52,152,219,0.3)'};" value="${set.rest || '120'}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'rest')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">` : '<div></div>')}
                        <button onclick="removeSetFromExercise(${i}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity: ${showSuccess ? '0.1' : '0.8'};" ${showSuccess ? 'disabled' : ''}>×</button>
                    </div>`;
                   if (isCurrent && sIdx === firstUnconfirmed && !isCardio) {
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
               <div onclick="toggleExercise(${i})" style="padding: 12px 15px; display: flex; align-items: center; cursor: pointer; background: ${isOpen ? 'rgba(250, 204, 21, 0.05)' : 'transparent'}; overflow: hidden;">
                    <div style="width: 8px; flex-shrink: 0;"></div>
                    <div style="display: flex; flex-direction: column; min-width:0; flex-grow:1;">
                        <div style="display:flex;align-items:center;gap:6px;">
    <strong style="font-size: 14px; color: ${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration: ${isDone ? 'line-through' : 'none'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${ex.name}</strong>
    <div onclick="event.stopPropagation(); const z=document.getElementById('anim-modal-list-${i}'); z.style.display=z.style.display==='flex'?'none':'flex';" style="display:flex;align-items:center;justify-content:center;padding:3px 7px;border-radius:20px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);cursor:pointer;flex-shrink:0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
</div>
<div id="anim-modal-list-${i}" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;align-items:center;justify-content:center;" onclick="this.style.display='none'">
    <div style="background:#1e293b;border-radius:16px;padding:20px;width:90%;max-width:400px;">
        <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Animation</div>
        <div style="font-size:11px;color:#475569;text-align:center;margin-top:10px;">Animation coming soon</div>
    </div>
</div>
                       <small style="color: ${isDone ? '#22c55e' : 'var(--primary)'}; font-size: 10px;">${isDone ? 'DONE  ✅ ' : isCardio ? '' : `${completedSets}/${totalSets} set`}</small>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 6px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; ${isDone ? 'opacity:0.3;' : ''}">
                       <button onclick="event.stopPropagation(); toggleExerciseNote(${i})" style="background:#1e2d3d;border:1px solid #2a3d52;color:#94a3b8;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;position:relative;">
                            <span style="font-size:13px;">📝</span>${exerciseData.note ? '<span style="position:absolute; top:2px; right:2px; width:6px; height:6px; background:#fde047; border-radius:50%;"></span>' : ''}
                        </button>
                        <button onclick="event.stopPropagation(); openReplaceExerciseModal(${i})" style="background:#1a3040;border:1px solid #22d3ee;color:#22d3ee;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;" ${isDone ? 'disabled' : ''}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                        </button>
                        <button onclick="event.stopPropagation(); removeActiveExercise(${i})" style="background:#2d1a1a;border:1px solid #7f1d1d;color:#ef4444;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;" ${isDone ? 'disabled' : ''}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <span style="font-size: 10px; color: var(--text-light); margin-left: 5px; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0)'}; transition: 0.3s;"> ▼ </span>
                    </div>
                </div>
                <div style="padding: 0 15px 15px 15px; display: ${isOpen ? 'block' : 'none'}; border-top: 1px solid rgba(255,255,255,0.05);">
                    <div id="note-area-${i}" style="display: ${activeDraft.ui_state.openNotes && activeDraft.ui_state.openNotes.includes(i) ? 'block' : 'none'}; margin-top:10px;">
                        <textarea id="note-input-${i}" placeholder="Add a note for this exercise..." 
                            style="width:100%; min-height:60px; padding:10px; border-radius:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(253,224,71,0.2); color:#fff; font-size:13px; font-family:inherit; resize:vertical;">${exerciseData.note || ''}</textarea>
                    </div>
                    ${setsHtml}
                   <div style="display:flex; gap:8px; margin-top:12px;">
                    <button style="flex:1; padding:10px; background:transparent; border:1.5px dashed rgba(34,211,238,0.3); color:#22d3ee; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:${isCardio ? 'none' : 'flex'}; align-items:center; justify-content:center; gap:6px; ${isDone ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="addSetToExercise(${i})" ${isDone ? 'disabled' : ''}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add set
                      </button>
                     <button style="flex:2; padding:12px; background:${isDone ? 'rgba(148,163,184,0.25)' : 'rgba(34,197,94,0.1)'}; color:${isDone ? '#fff' : '#22c55e'}; border-radius:12px; font-size:13px; font-weight:800; border:${isDone ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(34,197,94,0.25)'}; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="toggleExerciseDone(${i})">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isDone ? '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline>'}</svg>
                        ${isDone ? 'Undo' : 'Finish exercise'}
                      </button>
                    </div>
                </div>`;
            list.appendChild(div);
        });
    } else {
        const emptyNotice = document.createElement("p");
        emptyNotice.style.cssText = "color: var(--text-light); text-align: center; padding: 30px 10px; font-size: 14px; line-height: 2;";
emptyNotice.innerHTML = "This workout is empty.<br>Click the button below to add your exercises!<br>👇";
        list.appendChild(emptyNotice);
    }

    if (typeof updateWorkoutProgress === 'function') {
        const totalWorkoutCompletedSets = activeDraft.data ? activeDraft.data.reduce((acc, curr) => acc + (curr.sets_data ? curr.sets_data.filter(s => s.userConfirmed).length : 0), 0) : 0;
        const totalWorkoutSets = activeDraft.data ? activeDraft.data.reduce((acc, curr) => acc + (curr.sets_data ? curr.sets_data.length : 0), 0) : 0;
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }

    const addBtn = document.createElement("button");
    addBtn.className = "mode-btn glass-border";
    addBtn.style.cssText = "margin-top:10px; margin-bottom: 25px; border: 2px dashed rgba(34, 211, 238, 0.4); color: var(--primary); background: rgba(34, 211, 238, 0.04); font-weight: 700; width:100%;";
    addBtn.innerHTML = " ➕ Add Exercise";
    addBtn.onclick = openCustomAddExerciseModal;
    list.appendChild(addBtn);
    
       
    showView("workout-view");
    renderRestTimer();

    setTimeout(() => initDragAndDrop(), 50);
    const savedLayout = localStorage.getItem('workoutLayoutMode') || 'list';
    const listBtn = document.getElementById('layout-list-btn');
    const carouselBtn = document.getElementById('layout-carousel-btn');
    const focusBtn = document.getElementById('layout-focus-btn');
    if (listBtn) listBtn.classList.toggle('active', savedLayout === 'list');
    if (carouselBtn) carouselBtn.classList.toggle('active', savedLayout === 'carousel');
    if (focusBtn) focusBtn.classList.toggle('active', savedLayout === 'focus');

    const exerciseList = document.getElementById('exercise-list');
    const carouselView = document.getElementById('carousel-view');
    const focusView = document.getElementById('focus-view');
    const restTimerBar = document.getElementById('rest-timer-bar');

   if (savedLayout === 'carousel') {
        const topTimer = document.getElementById('carousel-rest-time');
        if (topTimer) topTimer.style.display = 'none';
        if (exerciseList) exerciseList.style.display = 'none';
        if (carouselView) carouselView.classList.remove('hidden');
        if (focusView) focusView.classList.add('hidden');
        if (restTimerBar) restTimerBar.style.display = 'none';
        const headerCardInit3 = document.querySelector('#workout-view > div:first-child');
        const separatorInit3 = document.getElementById('workout-separator-line');
        if (headerCardInit3) headerCardInit3.classList.remove('hidden');
        if (separatorInit3) separatorInit3.classList.remove('hidden');
        renderCarousel();
    } else if (savedLayout === 'focus') {
        if (exerciseList) exerciseList.style.display = 'none';
        if (carouselView) carouselView.classList.add('hidden');
        if (focusView) focusView.classList.remove('hidden');
        if (restTimerBar) restTimerBar.style.display = 'none';
        const headerCardInit = document.querySelector('#workout-view > div:first-child');
        const separatorInit = document.getElementById('workout-separator-line');
        const footerInit = document.querySelector('.workout-footer');
        if (headerCardInit) headerCardInit.classList.add('hidden');
        if (separatorInit) separatorInit.classList.add('hidden');
        if (footerInit) footerInit.classList.add('hidden');
        renderFocus();
    } else {
        if (exerciseList) exerciseList.style.display = 'block';
        if (carouselView) carouselView.classList.add('hidden');
        if (focusView) focusView.classList.add('hidden');
        const headerCardInit2 = document.querySelector('#workout-view > div:first-child');
        const separatorInit2 = document.getElementById('workout-separator-line');
        if (headerCardInit2) headerCardInit2.classList.remove('hidden');
        if (separatorInit2) separatorInit2.classList.remove('hidden');
    }
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

function showEndWorkoutConfirm() {
    const modal = document.getElementById('workout-modal');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;
    body.innerHTML = `
        <div style="text-align:center; padding:10px 0 20px;">
            <div style="width:56px;height:56px;border-radius:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#fff;">End workout early?</h3>
            <p style="margin:0 0 24px;font-size:13px;color:#64748b;line-height:1.5;">Not all exercises are completed. Are you sure you want to finish?</p>
            <button onclick="finishWorkout(); closeModal();" style="width:100%;padding:14px;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:10px;">
                Yes, end workout
            </button>
            <button onclick="closeModal()" style="width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;">
                Continue workout
            </button>
        </div>
    `;
    modal.classList.remove('hidden');
}


function carouselCopySet0(exIdx) {
    const exData = activeDraft?.data?.[exIdx];
    if (!exData?.sets_data || exData.sets_data.length < 2) return;
    const wEl = document.getElementById(`w-${exIdx}-0`);
    const rEl = document.getElementById(`r-${exIdx}-0`);
    if (!wEl || !rEl) return;
    const wVal = wEl.value !== '' ? wEl.value : (wEl.placeholder || '');
    const rVal = rEl.value !== '' ? rEl.value : (rEl.placeholder || '');
    for (let sIdx = 1; sIdx < exData.sets_data.length; sIdx++) {
        if (exData.sets_data[sIdx].userConfirmed) continue;
        // Uppdatera alltid activeDraft (oavsett readonly-status på input)
        exData.sets_data[sIdx].weight = wVal;
        exData.sets_data[sIdx].reps = rVal;
        // Uppdatera DOM om elementet finns
        const wTarget = document.getElementById(`w-${exIdx}-${sIdx}`);
        const rTarget = document.getElementById(`r-${exIdx}-${sIdx}`);
        if (wTarget) wTarget.value = wVal;
        if (rTarget) rTarget.value = rVal;
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
        
        // Om det stängda kortet var det aktiva, sätt föregående öppna kort som aktivt
        if (activeDraft.ui_state.currentExerciseIndex === index) {
            activeDraft.ui_state.currentExerciseIndex = activeDraft.ui_state.openExercises.length > 0 
                ? activeDraft.ui_state.openExercises[activeDraft.ui_state.openExercises.length - 1] 
                : 0;
        }
    } else {
        activeDraft.ui_state.openExercises.push(index);
        
        // SYNK: Här sätter vi direkt vilket index som är det senast öppnade i listvyn.
        activeDraft.ui_state.currentExerciseIndex = index;
    }

    // Uppdatera även den dolda globala karusellvariabeln direkt i bakgrunden
    carouselCurrentIndex = typeof activeDraft.ui_state.currentExerciseIndex === 'number' 
        ? activeDraft.ui_state.currentExerciseIndex 
        : 0;

    window._suppressAutoScroll = true;
    await persistActiveWorkout();
    renderActiveWorkout();
    setTimeout(() => restoreRestTimerIfActive(), 50);
    requestAnimationFrame(() => initDragAndDrop());
    window.scrollTo(0, scrollPos);
}

async function addSetToExercise(exIdx) {
    const lastSet = activeDraft.data[exIdx].sets_data[activeDraft.data[exIdx].sets_data.length - 1];
    const newWeight = lastSet ? lastSet.weight : "";
    const newReps = lastSet ? lastSet.reps : "";
    const exObj = activeDraft.workout.exercises[exIdx];
    if (isCardioExercise(exObj)) {
        activeDraft.data[exIdx].sets_data.push({ duration: '', distance: '', userConfirmed: false });
    } else {
        const exObj = activeDraft.workout.exercises[exIdx];
    if (isCardioExercise(exObj)) {
        activeDraft.data[exIdx].sets_data.push({ duration: '', distance: '', userConfirmed: false });
    } else {
        activeDraft.data[exIdx].sets_data.push({ weight: newWeight, reps: newReps });
    }
    }
const savedLayout = localStorage.getItem('workoutLayoutMode') || 'list';
    if (savedLayout === 'carousel' && carouselFocusModeActive) {
        renderFocusCard();
    } else if (savedLayout === 'carousel') {
        renderCarouselCard();
    } else if (savedLayout === 'focus') {
        renderFocusCard();
    } else {
        const targetCard = document.getElementById(`exercise-card-${exIdx}`);
        const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;
        updateSingleExerciseCard(exIdx);
        if (existingHandle) {
            const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
            if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
                updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
            }
        }
    }
    await persistActiveWorkout();
}

async function removeSetFromExercise(exIdx, setIdx) {
    activeDraft.data[exIdx].sets_data.splice(setIdx, 1);
const savedLayout = localStorage.getItem('workoutLayoutMode') || 'list';
    if (savedLayout === 'carousel' && carouselFocusModeActive) {
        renderFocusCard();
    } else if (savedLayout === 'carousel') {
        renderCarouselCard();
    } else if (savedLayout === 'focus') {
        renderFocusCard();
    } else {
        const targetCard = document.getElementById(`exercise-card-${exIdx}`);
        const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;
        updateSingleExerciseCard(exIdx);
        if (existingHandle) {
            const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
            if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
                updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
            }
        }
    }
    await persistActiveWorkout();
}

async function toggleExerciseDone(exIdx) {
    const scrollPos = window.scrollY;
    
    // Invertera statusen för om övningen är helt klar
    const newCompletedState = !activeDraft.data[exIdx].isCompleted;
    activeDraft.data[exIdx].isCompleted = newCompletedState;
    
    if (newCompletedState) {
        stopRestTimer();
    }

    // NYHET: Om övningen markeras som klar, se till att ALLA dess set också blir markerade som klara i datan.
    // Om man trycker på "Undo" (false), sätter vi dem till false.
    if (activeDraft.data[exIdx].sets_data && activeDraft.data[exIdx].sets_data.length > 0) {
        activeDraft.data[exIdx].sets_data.forEach(set => {
            set.userConfirmed = newCompletedState;
        });
    }

    // Spara handtaget innan omritning
    const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;

    const savedLayout = localStorage.getItem('workoutLayoutMode') || 'list';
    if (savedLayout === 'carousel') {
        renderCarouselCard();
        renderCarouselNav();
        renderCarouselDots();
    } else {
        updateSingleExerciseCard(exIdx);
    }

    // Återlägg handtaget direkt
    if (existingHandle) {
        const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
        if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
            updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
        }
    }

    window.scrollTo(0, scrollPos);
    await persistActiveWorkout();

    // Uppdatera mätaren i headern baserat på den nya datan där seten nu räknas med!
    const footer = document.querySelector('.workout-footer');
    if (footer) {
        const allDone = activeDraft.data && activeDraft.data.every(ex => ex.isCompleted);
        const allExercisesDone = allDone;
        footer.innerHTML = `
            <div style="height:2px; background:linear-gradient(90deg, transparent, #22d3ee 30%, #f0a020 70%, transparent); margin:-0px -0px 12px -0px; border-radius:0;"></div>
            ${allExercisesDone ? `<button onclick="finishWorkout()" style="width:100%; padding:15px; background:linear-gradient(135deg,#15803d,#22c55e); color:#fff; font-size:15px; font-weight:900; border-radius:14px; border:none; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; margin-bottom:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Finish workout</button>` : `<button onclick="showEndWorkoutConfirm()" style="width:100%; padding:10px; background:transparent; border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:rgba(255,255,255,0.45); font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:4px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>End workout early</button>`}
            <div style="display:flex; gap:8px; width:100%;">
                <button onclick="saveDraftAndGoHome()" style="width:44px; height:44px; background:rgba(34,211,238,0.1); border:1.5px solid rgba(34,211,238,0.45); color:#22d3ee; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></button>
                <button id="pause-workout-btn" onclick="saveDraftAndGoHome()" style="flex:1; height:44px; background:linear-gradient(135deg,#7a8fa6,#5a7080); border:none; color:#fff; font-size:14px; font-weight:800; border-radius:14px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">Save draft<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
                <button onclick="confirmDiscardActiveWorkout()" style="width:44px; height:44px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.35); color:#ef4444; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            </div>`;
    }
    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0;
        let totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }
}

function actuallyStartWorkout() {
    if (!activeDraft) return;

    // Sätt starttiden till exakt just nu (ISO-sträng)
    activeDraft.startTime = new Date().toISOString();
    activeDraft.isStarted = true;

    // Om ui_state inte finns, skapa det och öppna första övningen
    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    activeDraft.ui_state.openExercises = [0];
    activeDraft.ui_state.hasInitializedOpen = true;

    // Spara det nya startade läget till Supabase/localStorage
    if (typeof persistActiveWorkout === 'function') persistActiveWorkout();

    // Rita om vyn så att träningspasset och den korrekta tiden visas direkt
    renderActiveWorkout();
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
function renderExercisePicker(category, replaceIndex = null, subtarget = null) {
    const body = document.getElementById("modal-body");
    const categories = [
        { name: "Ben", icon: "🦵" },
        { name: "Bröst", icon: "🏋️" },
        { name: "Rygg", icon: "🪵" },
        { name: "Axlar", icon: "👐" },
        { name: "Armar", icon: "💪" },
        { name: "Bål", icon: "🧘" },
        { name: "Cardio", icon: "🏃" },
        { name: "Mobility", icon: "🤸" }
    ];

    let html = `<h3>${replaceIndex !== null ? 'Change Exercise' : 'Select Exercise'}</h3>`;
    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Select Category</p>`;
    html += `<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:15px;">`;
    categories.forEach(cat => {
        const isActive = cat.name === category;
        html += `
        <button onclick="renderExercisePicker('${cat.name}', ${replaceIndex}, null)"
            style="padding:10px 5px; font-size:11px; border-radius:12px; border:1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
            background:${isActive ? 'rgba(34,211,238,0.1)' : 'var(--card)'}; color:${isActive ? 'var(--primary)' : 'white'}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:16px;">${cat.icon}</span>${CATEGORY_DISPLAY[cat.name] || cat.name}
        </button>`;
    });
    html += `</div>`;

    // Filter by Muscle
    const subs = SUBCATEGORIES[category] || [];
    if (subs.length > 0) {
        html += `<div style="margin-bottom:14px;">`;
        html += `<div style="font-size:9px; color:rgba(255,255,255,0.8); text-transform:uppercase; letter-spacing:2px; text-align:center; margin-bottom:8px;">Filter by Muscle</div>`;
        html += `<div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">`;
        html += `<button onclick="renderExercisePicker('${category}', ${replaceIndex}, null)"
            style="padding:5px 14px; border-radius:20px; border:1px solid ${!subtarget ? 'var(--primary)' : 'rgba(255,255,255,0.15)'};
            background:${!subtarget ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'};
            color:${!subtarget ? 'var(--primary)' : 'var(--text-light)'}; font-size:12px; font-weight:600; cursor:pointer;">All</button>`;
        subs.forEach(sub => {
            const isActiveSub = subtarget === sub;
            html += `<button onclick="renderExercisePicker('${category}', ${replaceIndex}, '${sub}')"
                style="padding:5px 14px; border-radius:20px; border:1px solid ${isActiveSub ? 'var(--primary)' : 'rgba(255,255,255,0.15)'};
                background:${isActiveSub ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)'};
                color:${isActiveSub ? 'var(--primary)' : 'var(--text-light)'}; font-size:12px; font-weight:600; cursor:pointer;">${sub}</button>`;
        });
        html += `</div></div>`;
    }

    html += `<p style="font-size:11px; text-transform:uppercase; color:var(--text-light); text-align:center; margin-bottom:10px;">Exercises (${CATEGORY_DISPLAY[category] || category}):</p>`;
    html += `<div style="max-height:280px; overflow-y:auto; padding-right:5px; background:rgba(0,0,0,0.2); border-radius:15px; padding:10px; margin-bottom:15px; display:flex; flex-direction:column; gap:8px;">`;

    const filtered = masterExercises.filter(ex => {
        const matchCategory = category === "Armar"
            ? (ex.target === "Biceps" || ex.target === "Triceps" || ex.target === "Armar")
            : ex.target === category;
        const matchSub = !subtarget || ex.subtarget === subtarget;
        return matchCategory && matchSub;
    });

    if (filtered.length === 0) {
        html += `<p style="text-align:center; font-size:12px; color:var(--text-light); padding:10px;">No exercises found.</p>`;
    }

    filtered.forEach(ex => {
        const isSelectedInBatch = replaceIndex === null && temporarySelectedExercises.includes(ex.id);
        const currentBg = isSelectedInBatch ? 'rgba(34,197,94,0.15)' : 'transparent';
        const currentBorder = isSelectedInBatch ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)';
        const currentIcon = replaceIndex !== null ? '🔄' : (isSelectedInBatch ? '✅' : '+');
        const clickHandler = replaceIndex !== null
            ? `confirmAddExerciseToActive(${ex.id}, ${replaceIndex})`
            : `toggleSelectExerciseInPicker(${ex.id}, '${category}')`;
        html += `
        <div class="card glass" id="picker-ex-${ex.id}" style="padding:12px; margin:0; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-radius:12px; background:${currentBg} !important; border:${currentBorder} !important; transition:all 0.2s;"
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

    html += `
    <button style="width:100%; padding:14px; background:transparent; border:1.5px dashed rgba(34,211,238,0.4); border-radius:12px; color:#22d3ee; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;"
        onclick="(async () => { await saveDraftState(); openCreateExerciseModal((newEx) => handleInstantExerciseCreated(newEx, ${replaceIndex})); })()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create new exercise to the library
    </button>`;

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
        
        const exHistory = getExerciseHistory(ex.name);
        if (exHistory && !isCardioExercise(ex)) {
            let setsCopy = JSON.parse(JSON.stringify(exHistory.sets_data));
            setsCopy.forEach(set => set.userConfirmed = false);
            newDataEntry = { sets_data: setsCopy, isCompleted: false, note: exHistory.note || null };
        } else {
            const defaultSet = getDefaultSetData(ex);
            const numSets = isCardioExercise(ex) ? 1 : 3;
            newDataEntry = { sets_data: Array(numSets).fill(null).map(() => ({...defaultSet})), isCompleted: false };
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
    console.log("DEBUG confirmAdd:", ex.name, ex.target, isCardioExercise(ex));
    const newExObj = { name: ex.name, target: ex.target };
    let newDataEntry;
    const exHistory = getExerciseHistory(ex.name);
    if (exHistory && !isCardioExercise(ex)) {
        let setsCopy = JSON.parse(JSON.stringify(exHistory.sets_data));
        setsCopy.forEach(set => set.userConfirmed = false);
        newDataEntry = { sets_data: setsCopy, isCompleted: false, note: exHistory.note || null };
    } else {
        const defaultSet = getDefaultSetData(ex);
        const numSets = isCardioExercise(ex) ? 1 : 3;
        newDataEntry = { sets_data: Array(numSets).fill(null).map(() => ({...defaultSet})), isCompleted: false };
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

async function updateSetDataOnly(inputEl, exIdx, setIdx, fieldType) {
    if (!inputEl) return;
    if (!activeDraft || !activeDraft.data || !activeDraft.data[exIdx]) return;
    
    const setsArray = activeDraft.data[exIdx].sets_data || [];
    setsArray[setIdx] = Object.assign({}, setsArray[setIdx] || {});
    const setObj = setsArray[setIdx];

    // Spara det aktuella värdet som användaren skriver in
   if (fieldType === 'weight') setObj.weight = inputEl.value;
    if (fieldType === 'reps') setObj.reps = inputEl.value;
    if (fieldType === 'rest') setObj.rest = inputEl.value;
    if (fieldType === 'duration') setObj.duration = inputEl.value;
    if (fieldType === 'distance') {
        const normalized = inputEl.value.replace(',', '.');
        inputEl.value = normalized;
        setObj.distance = normalized;
        document.querySelectorAll(`[id^="pace-${exIdx}-${setIdx}"]`).forEach(el => {
            el.textContent = calcPace(setObj.duration, normalized);
        });
    }
    if (typeof setObj.userConfirmed === "undefined") setObj.userConfirmed = false;

    // Om ändringen sker i Set 1 (index 0), kör autofyll/spegling
    if (setIdx === 0) {
const shouldCopyWeight = setsArray.slice(1).every(s => !s.userConfirmed && (!s.weight || s.weight === inputEl.value.slice(0, -1)));
        const shouldCopyReps = setsArray.slice(1).every(s => !s.userConfirmed && (!s.reps || s.reps === inputEl.value.slice(0, -1)));

        // Autofyll DOM omedelbart i den aktiva vyn utan re-render
        for (let i = 1; i < setsArray.length; i++) {
            if (fieldType === 'weight' && shouldCopyWeight) {
                // Letar upp viktfält för index i, oavsett om klassen är weight-input eller via id
                const wEls = document.querySelectorAll(`.weight-input[data-ex="${exIdx}"][data-set="${i}"], [id$="w-${exIdx}-${i}"]`);
                wEls.forEach(el => { el.value = inputEl.value || ""; });
            }
            if (fieldType === 'reps' && shouldCopyReps) {
                const rEls = document.querySelectorAll(`.reps-input[data-ex="${exIdx}"][data-set="${i}"], [id$="r-${exIdx}-${i}"]`);
                rEls.forEach(el => { el.value = inputEl.value || ""; });
            }
        }

       // Spara värdena direkt till activeDraft synkront
        for (let i = 1; i < setsArray.length; i++) {
            setsArray[i] = Object.assign({}, setsArray[i] || {});
            if (fieldType === 'weight' && shouldCopyWeight) {
                setsArray[i].weight = inputEl.value;
            }
            if (fieldType === 'reps' && shouldCopyReps) {
                setsArray[i].reps = inputEl.value;
            }
            if ((fieldType === 'weight' && shouldCopyWeight) || (fieldType === 'reps' && shouldCopyReps)) {
                setsArray[i].userConfirmed = false;
            }
        }
    }

    debouncedPersistActiveWorkout();
}

function updateCardioTime(inputEl, exIdx, setIdx) {
    if (!activeDraft?.data?.[exIdx]?.sets_data?.[setIdx]) return;
    const setObj = activeDraft.data[exIdx].sets_data[setIdx];
    const val = inputEl.value.replace(',', ':');
    setObj.duration = val;
    const parts = val.split(':');
    setObj.duration_min = parts[0] || '0';
    setObj.duration_sec = parts[1] || '0';
    document.querySelectorAll(`[id^="pace-${exIdx}-${setIdx}"]`).forEach(el => {
        el.textContent = calcPace(setObj.duration, setObj.distance);
    });
    debouncedPersistActiveWorkout();
}

function initCardioTimeInput(inputId, exIdx, setIdx) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let digits = input.value.replace(':', '').replace(/\D/g, '').padEnd(4, '_');
    
    function render() {
        const mm = digits.slice(0, 2);
        const ss = digits.slice(2, 4);
        input.value = `${mm}:${ss}`;
    }
    
    function getCleanDigits() {
        return digits.replace(/_/g, '');
    }
    
    render();
    
    input.addEventListener('keydown', function(e) {
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            const firstUnderscore = digits.indexOf('_');
            if (firstUnderscore !== -1) {
                digits = digits.substring(0, firstUnderscore) + e.key + digits.substring(firstUnderscore + 1);
            }
            render();
            const clean = getCleanDigits();
            const mm = clean.slice(0, 2) || '0';
            const ss = clean.slice(2, 4) || '0';
            const duration = `${mm}:${ss.padStart(2, '0')}`;
            if (activeDraft?.data?.[exIdx]?.sets_data?.[setIdx]) {
                const setObj = activeDraft.data[exIdx].sets_data[setIdx];
                setObj.duration = duration;
                setObj.duration_min = mm;
                setObj.duration_sec = ss;
                document.querySelectorAll(`[id^="pace-${exIdx}-${setIdx}"]`).forEach(el => {
                    el.textContent = calcPace(duration, setObj.distance);
                });
                debouncedPersistActiveWorkout();
            }
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            const lastDigit = digits.split('').reduce((last, c, i) => c !== '_' ? i : last, -1);
            if (lastDigit !== -1) {
                digits = digits.substring(0, lastDigit) + '_' + digits.substring(lastDigit + 1);
            }
            render();
        }
    });
    
    input.addEventListener('click', function() {
        const firstUnderscore = digits.indexOf('_');
        const pos = firstUnderscore !== -1 ? firstUnderscore + (firstUnderscore >= 2 ? 1 : 0) : 5;
        this.setSelectionRange(pos, pos);
    });
    
    input.addEventListener('focus', function() {
        const firstUnderscore = digits.indexOf('_');
        const pos = firstUnderscore !== -1 ? firstUnderscore + (firstUnderscore >= 2 ? 1 : 0) : 5;
        this.setSelectionRange(pos, pos);
    });
}

async function confirmSet(exIdx, setIdx) {
    flushFocusedInputs();

    // Läs alltid REST-värdet direkt från DOM och spara till draft INNAN state ändras
    const vInp = document.getElementById(`v-${exIdx}-${setIdx}`);
const restVal = vInp ? (parseInt(vInp.value) || 120) : 120;
activeDraft.data[exIdx].sets_data[setIdx].rest = String(restVal);

const cdmInp = document.getElementById(`cdm-${exIdx}-${setIdx}`);
const cdsInp = document.getElementById(`cds-${exIdx}-${setIdx}`);
const ckInp = document.getElementById(`ck-${exIdx}-${setIdx}`);
if (cdmInp) activeDraft.data[exIdx].sets_data[setIdx].duration_min = cdmInp.value;
if (cdsInp) activeDraft.data[exIdx].sets_data[setIdx].duration_sec = cdsInp.value;
if (ckInp) activeDraft.data[exIdx].sets_data[setIdx].distance = ckInp.value;

    const currentState = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    activeDraft.data[exIdx].sets_data[setIdx].userConfirmed = !currentState;

    const isNowConfirmed = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    const isLastSet = setIdx === activeDraft.data[exIdx].sets_data.length - 1;

    if (isNowConfirmed && !isLastSet) {
        stopRestTimer();
        startRestTimer(restVal, exIdx);
    } else {
        // Sista set, avbekräftning — stoppa alltid
        stopRestTimer();
    }

    await persistActiveWorkout();

    const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;

    updateSingleExerciseCard(exIdx);

    if (existingHandle) {
        const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
        if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
            updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
        }
    }

    // Uppdatera den globala mätaren i headern
    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0;
        let totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }
}


function updateSingleExerciseCard(exIdx) {
    const savedLayout = localStorage.getItem('workoutLayoutMode') || 'list';
    if (savedLayout === 'carousel') {
        return;
    }
    const exerciseData = activeDraft.data[exIdx];
    const ex = activeDraft.workout.exercises[exIdx];
    const isDone = exerciseData.isCompleted;
    const openExercises = activeDraft.ui_state.openExercises || [];
    const isOpen = openExercises.includes(exIdx);
    const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    if (!targetCard) return;
    targetCard.style.borderLeft = `4px solid ${isDone ? '#22c55e' : isOpen ? '#22d3ee' : 'rgba(250,204,21,0.3)'}`;
    targetCard.style.boxShadow = isDone ? '0 0 25px rgba(34,197,94,0.25), inset 0 0 40px rgba(34,197,94,0.06)' : isOpen ? '0 4px 12px rgba(34,211,238,0.08)' : '0 4px 12px rgba(0,0,0,0.3)';
    targetCard.style.outline = isDone ? '1.5px solid #22c55e' : 'none';
    targetCard.style.background = 'linear-gradient(180deg, #1a2540 0%, #0f172a 100%)';
    targetCard.classList.toggle('exercise-done', isDone);
    const completedSets = exerciseData.sets_data ? exerciseData.sets_data.filter(s => s.userConfirmed).length : 0;
    const totalSets = exerciseData.sets_data ? exerciseData.sets_data.length : 0;
    const firstUnconfirmed = exerciseData.sets_data ? exerciseData.sets_data.findIndex(s => !s.userConfirmed) : -1;
    const isCardio = isCardioExercise(ex);
    let setsHtml = `<div style="margin-top:10px;">
        <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
            <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">${isCardio ? '' : 'SET'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'TID' : 'KG'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'DIST (km)' : 'REPS'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'PACE' : 'REST (S)'}</small>
            <span></span>
        </div>`;
    if (exerciseData.sets_data) {
        exerciseData.sets_data.forEach((set, sIdx) => {
            const isLocked = isDone;
            const isCurrent = !set.userConfirmed && !isDone && sIdx === firstUnconfirmed;
            const showSuccess = set.userConfirmed || isDone;
            const circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
            const statusContent = showSuccess ? ' ✅ ' : (isCardio ? '✓' : `#${sIdx + 1}`);
            setsHtml += `
            <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center; transition: opacity 0.2s ease; position:relative; overflow:visible;">
                <div class="${isCurrent ? 'pulse-ring' : ''}" onclick="${isLocked && !isDone ? '' : `confirmSet(${exIdx}, ${sIdx})`}"
                    style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:800; background: ${showSuccess ? 'rgba(34, 197, 94, 0.2)' : (isCurrent ? 'rgba(250, 204, 21, 0.15)' : 'rgba(245, 158, 11, 0.05)')}; color: ${circleColor}; opacity: 1;">
                    ${statusContent}
                </div>
                ${isCardio
                    ? `<input type="text" inputmode="numeric" id="cdm-${exIdx}-${sIdx}" class="log-input" style="margin:0; padding:12px 4px; font-size:15px; min-width:0; opacity:${isCurrent ? '1' : '0.3'}; text-align:center; font-family:monospace; letter-spacing:2px; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.duration || '__:__'}" ${isLocked ? 'readonly' : ''} onfocus="initCardioTimeInput('cdm-${exIdx}-${sIdx}', ${exIdx}, ${sIdx})">`
                    : `<input type="text" inputmode="decimal" id="w-${exIdx}-${sIdx}" class="log-input weight-input" data-ex="${exIdx}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.weight || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${exIdx}, ${sIdx}, 'weight')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                ${isCardio
                    ? `<input type="text" inputmode="decimal" id="ck-${exIdx}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.distance || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${exIdx}, ${sIdx}, 'distance')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                    : `<input type="text" inputmode="decimal" id="r-${exIdx}-${sIdx}" class="log-input reps-input" data-ex="${exIdx}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.reps || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${exIdx}, ${sIdx}, 'reps')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                ${isCardio
                    ? `<div id="pace-${exIdx}-${sIdx}" style="display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#22d3ee; font-family:monospace; white-space:nowrap; opacity:${isCurrent ? '1' : '0.3'};">${calcPace(set.duration, set.distance)}</div>`
                    : (sIdx < exerciseData.sets_data.length - 1
                        ? `<input type="text" inputmode="decimal" id="v-${exIdx}-${sIdx}" class="log-input rest-input" data-ex="${exIdx}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${isCurrent ? '1' : '0.3'}; border-color:${isCurrent ? 'rgba(245,158,11,0.6)' : 'rgba(52,152,219,0.3)'};" value="${set.rest || '120'}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${exIdx}, ${sIdx}, 'rest')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                        : '<div></div>')}
                <button onclick="removeSetFromExercise(${exIdx}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity: ${showSuccess ? '0.1' : '0.8'};" ${showSuccess ? 'disabled' : ''}>×</button>
            </div>`;
            if (isCurrent && sIdx === firstUnconfirmed && !isCardio) {
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
                <div style="display:flex;align-items:center;gap:6px;">
                    <strong style="font-size: 14px; color: ${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration: ${isDone ? 'line-through' : 'none'}; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${ex.name}</strong>
                    <div onclick="event.stopPropagation(); const z=document.getElementById('anim-modal-list-${exIdx}'); z.style.display=z.style.display==='flex'?'none':'flex';" style="display:flex;align-items:center;justify-content:center;padding:3px 7px;border-radius:20px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);cursor:pointer;flex-shrink:0;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                </div>
                <div id="anim-modal-list-${exIdx}" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;align-items:center;justify-content:center;" onclick="this.style.display='none'">
                    <div style="background:#1e293b;border-radius:16px;padding:20px;width:90%;max-width:400px;">
                        <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Animation</div>
                        <div style="font-size:11px;color:#475569;text-align:center;margin-top:10px;">Animation coming soon</div>
                    </div>
                </div>
                <small style="color: ${isDone ? '#22c55e' : 'var(--primary)'}; font-size: 10px;">${isDone ? 'DONE ✅' : isCardio ? '' : `${completedSets}/${totalSets} set`}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 6px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; ${isDone ? 'opacity:0.3;' : ''}">
                <button onclick="event.stopPropagation(); toggleExerciseNote(${exIdx})" style="background:#1e2d3d;border:1px solid #2a3d52;color:#94a3b8;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;position:relative;">
                    <span style="font-size:13px;">📝</span>${exerciseData.note ? '<span style="position:absolute; top:2px; right:2px; width:6px; height:6px; background:#fde047; border-radius:50%;"></span>' : ''}
                </button>
                <button onclick="event.stopPropagation(); openReplaceExerciseModal(${exIdx})" style="background:#1a3040;border:1px solid #22d3ee;color:#22d3ee;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;" ${isDone ? 'disabled' : ''}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                </button>
                <button onclick="event.stopPropagation(); removeActiveExercise(${exIdx})" style="background:#2d1a1a;border:1px solid #7f1d1d;color:#ef4444;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;" ${isDone ? 'disabled' : ''}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <span style="font-size: 10px; color: var(--text-light); margin-left: 5px; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0)'}; transition: 0.3s;"> ▼ </span>
            </div>
        </div>
        <div style="padding: 0 15px 15px 15px; display: ${isOpen ? 'block' : 'none'}; border-top: 1px solid rgba(255,255,255,0.05);">
            <div id="note-area-${exIdx}" style="display: ${activeDraft.ui_state.openNotes && activeDraft.ui_state.openNotes.includes(exIdx) ? 'block' : 'none'}; margin-top:10px;">
                <textarea id="note-input-${exIdx}" placeholder="Add a note for this exercise..."
                    oninput="updateExerciseNote(${exIdx})"
                    style="width:100%; min-height:60px; padding:10px; border-radius:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(253,224,71,0.2); color:#fff; font-size:13px; font-family:inherit; resize:vertical;">${exerciseData.note || ''}</textarea>
            </div>
            ${setsHtml}
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button style="flex:1; padding:10px; background:transparent; border:1.5px dashed rgba(34,211,238,0.3); color:#22d3ee; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:${isCardio ? 'none' : 'flex'}; align-items:center; justify-content:center; gap:6px; ${isDone ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="addSetToExercise(${exIdx})" ${isDone ? 'disabled' : ''}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add set
                </button>
                <button style="flex:2; padding:12px; background:${isDone ? 'rgba(148,163,184,0.25)' : 'rgba(34,197,94,0.1)'}; color:${isDone ? '#fff' : '#22c55e'}; border-radius:12px; font-size:13px; font-weight:800; border:${isDone ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(34,197,94,0.25)'}; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="toggleExerciseDone(${exIdx})">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isDone ? '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline>'}</svg>
                    ${isDone ? 'Undo' : 'Finish exercise'}
                </button>
            </div>
        </div>`;
    restoreRestTimerIfActive();
}


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
document.getElementById("view-programs-btn").onclick = () => {
    window._selectionModeDate = null;
    renderGroupsView();
};
document.getElementById("stats-mode").onclick = renderStats;
document.getElementById("add-custom-pass-btn").onclick = openCreateProgramModal;
document.getElementById("add-custom-group-btn").onclick = openCreateGroupModal;

// ==========================================================================
// GRÄNSSNITT & KNAPPHANTERING (HOME & SAVE WORKOUT)
// ==========================================================================
function renderHome() {
    // 🛡️ Om järnridån är aktiv, totalvägra att köra startsidans logik överhuvudtaget!
    if (window.blockAllSync) return;
    window._selectionModeDate = null;
 
    // Scrolla till toppen (mobil + desktop)
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
 
    showView("home-view");

    updateHomeWeekCard();
    updateHomeNextWorkoutCard();
    updateHomeConsistency();

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

function getMondayOfCurrentWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0,0,0,0);
    return monday;
}

function updateHomeConsistency() {
    const el = document.getElementById("home-consistency");
    if (!el) return;

    if (!workoutHistory || workoutHistory.length === 0) {
        el.textContent = "";
        return;
    }

    const allDates = workoutHistory
        .map(w => w.date)
        .filter(Boolean)
        .sort();
    const earliestDate = new Date(allDates[0] + "T00:00:00");

    const currentMonday = getMondayOfCurrentWeek();
    const earliestMonday = new Date(earliestDate);
    const dayOfWeek = earliestMonday.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    earliestMonday.setDate(earliestMonday.getDate() + diffToMonday);
    earliestMonday.setHours(0,0,0,0);

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    let weeksAvailable = Math.round((currentMonday - earliestMonday) / msPerWeek) + 1;
    if (weeksAvailable < 1) weeksAvailable = 1;

    const weeksToUse = Math.min(4, weeksAvailable);

    const rangeStart = new Date(currentMonday);
    rangeStart.setDate(rangeStart.getDate() - (weeksToUse - 1) * 7);

    const totalWorkouts = workoutHistory.filter(w => {
        if (!w.date) return false;
        const d = new Date(w.date + "T00:00:00");
        return d >= rangeStart;
    }).length;

    const avg = (totalWorkouts / weeksToUse);
    const avgRounded = Math.round(avg * 10) / 10;

    const weekLabel = weeksToUse === 1 ? "1 week" : `${weeksToUse} weeks`;
    el.innerHTML = `Avg <strong>${avgRounded}</strong> workouts/week (last ${weekLabel})`;
}

function updateHomeWeekCard() {
    const doneEl = document.getElementById("home-week-done");
    const goalEl = document.getElementById("home-week-goal");
    const percentEl = document.getElementById("home-week-percent");
    const ringEl = document.getElementById("home-week-ring");
    if (!doneEl || !goalEl || !percentEl || !ringEl) return;

    const monday = getMondayOfCurrentWeek();
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }

    let goal = 0;
    weekDates.forEach((dateStr, idx) => {
        const override = calendarOverrides[dateStr];
        if (override && override !== "none") {
            goal++;
        } else if (override !== "none") {
            const dayOfWeek = idx;
            if ([0,2,4].includes(dayOfWeek) && programData?.routine?.length > 0) {
                goal++;
            }
        }
    });
    if (goal === 0) goal = 6;

    const done = weekDates.filter(dateStr => workoutHistory.some(w => w.date === dateStr)).length;
    const percent = Math.min(100, Math.round((done / goal) * 100));

    doneEl.textContent = done;
    goalEl.textContent = goal;
    percentEl.textContent = `${percent}%`;
    const circumference = 125.6;
    ringEl.setAttribute("stroke-dashoffset", circumference - (circumference * percent / 100));
}

function updateHomeNextWorkoutCard() {
    const nameEl = document.getElementById("home-next-pass-name");
    const statsEl = document.getElementById("home-next-pass-stats");
    const labelEl = document.querySelector("#start-new-btn .label-sub");
    if (!nameEl || !statsEl) return;

    let displayPass = null;
    let foundDateStr = null;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const override = calendarOverrides[dateStr];

        let pass = null;
        if (override && override !== "none") {
            pass = programData?.routine?.find(p => p.id === override) || null;
        } else if (override !== "none") {
            const dayOfWeek = d.getDay();
            if ([1,3,5].includes(dayOfWeek) && programData?.routine?.length > 0) {
                pass = programData.routine[d.getDate() % programData.routine.length];
            }
        }

        if (pass) {
            displayPass = pass;
            foundDateStr = dateStr;
            break;
        }
    }

    if (displayPass) {
        if (labelEl) {
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
            if (foundDateStr === todayStr) {
                labelEl.textContent = "Next workout · Today";
            } else if (foundDateStr === tomorrowStr) {
                labelEl.textContent = "Next workout · Tomorrow";
            } else {
                const d = new Date(foundDateStr + "T00:00:00");
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                labelEl.textContent = `Next workout · ${dayName}`;
            }
        }
        nameEl.textContent = displayPass.name.toUpperCase();
        let statsHtml = `<span class="stat-ex">${displayPass.exercises.length} EXERCISES</span>`;
        if (displayPass.duration) {
            statsHtml += `<span class="stat-time"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>~${displayPass.duration} MIN</span>`;
        }
        statsEl.innerHTML = statsHtml;
    } else {
        if (labelEl) labelEl.textContent = "Next workout";
        nameEl.textContent = "REST DAY";
        statsEl.innerHTML = `<span class="stat-time">Tap to start a free workout</span>`;
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
 
        console.log("🚀 [SPÅRNING] STEG 1.5: Täcker skärmen direkt.");
        const modalBodyEl = document.getElementById("modal-body");
        if (modalBodyEl) modalBodyEl.innerHTML = "";
        if (typeof openModal === 'function') openModal(true);

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
                const setsWithRest = setsData.map((set, sIdx) => {
                    const vInp = document.getElementById(`v-${i}-${sIdx}`);
                    return {
                        ...set,
                        rest: vInp ? vInp.value : (set.rest || null)
                    };
                });
                return {
                    name: ex.name,
                    sets_data: setsWithRest,
                    note: (activeDraft.data[i] && activeDraft.data[i].note) || null
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
 
       console.log("🚀 [SPÅRNING] STEG 7: Byter till kalendervyn bakom overlayn.");
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
    const grid = document.getElementById("calendar-grid");
    if (grid) {
        grid.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
        grid.style.transform = `translateX(${off > 0 ? '-24px' : '24px'})`;
        grid.style.opacity = '0';
    }
    setTimeout(() => {
        currentViewDate.setMonth(currentViewDate.getMonth() + off);
        renderCalendar();
        const newGrid = document.getElementById("calendar-grid");
        if (newGrid) {
            newGrid.style.transition = 'none';
            newGrid.style.transform = `translateX(${off > 0 ? '24px' : '-24px'})`;
            newGrid.style.opacity = '0';
            requestAnimationFrame(() => {
                newGrid.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
                newGrid.style.transform = 'translateX(0)';
                newGrid.style.opacity = '1';
            });
        }
    }, 160);
}

function initCalendarSwipe() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;
    const container = grid.parentElement;
    if (!container || container.dataset.swipeInit) return;
    container.dataset.swipeInit = "true";
    let startX = 0, startY = 0, isHorizontal = null;
    container.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        isHorizontal = null;
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (isHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            isHorizontal = Math.abs(dx) > Math.abs(dy);
        }
        if (isHorizontal && e.cancelable) {
            e.preventDefault();
        }
    }, { passive: false });
    container.addEventListener('touchend', (e) => {
        if (!isHorizontal) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        if (Math.abs(dx) > 50) {
            changeMonth(dx < 0 ? 1 : -1);
        }
        isHorizontal = null;
    });
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
isSyncingWithSupabase = false;
    activeDraft = null;
    localStorage.removeItem("activeWorkoutDraft");
    if (typeof deleteActiveDraft === 'function') await deleteActiveDraft();
    if (currentUser) {
        try {
            await supabaseClient.from('active_draft').delete().eq('user_id', currentUser.id);
        } catch(e) { console.error(e); }
    }
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
            const setsCopy = JSON.parse(JSON.stringify(ex.sets_data));
            const allConfirmed = setsCopy.length > 0 && setsCopy.every(s => s.userConfirmed === true);
            return { sets_data: setsCopy, isCompleted: allConfirmed, note: ex.note || null };
        }
        return {
            sets_data: Array(parseInt(ex.sets || 1)).fill(null).map(() => ({ weight: ex.weight || "", reps: ex.reps || "" })),
            isCompleted: false,
            note: ex.note || null
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
        stopRestTimer();
        clearInterval(carouselRestInterval);
        carouselRestActive = false;
        carouselRestSeconds = 0;

        // LÖSNING PÅ SPÖK-MINNET: Innan vi kastar bort activeDraft och sparar,
        // nollställer vi karusellens index globalt, och tömmer sparade tillstånd helt.
        carouselCurrentIndex = 0;
        if (activeDraft) {
            activeDraft.ui_state = {
                activeView: 'list',
                currentExerciseIndex: 0,
                openExercises: [0] // Gör så att nästa pass startar med första övningen öppen
            };
            if (activeDraft.ui_state.hasOwnProperty('hasInitializedOpen')) {
                delete activeDraft.ui_state.hasInitializedOpen;
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
        accordionOpenPassIdx = idx;
        renderPassesInGroup(groupId);
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
        // Inga ändringar — stäng direkt utan att rita om vyn
        if (pass._isTemp) {
            programData.routine.splice(idx, 1);
        }
        window._editPassOriginalState = null;
        hideDefaultCloseButton(false);
        document.getElementById('workout-modal').classList.add('hidden');
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
            try { 
                const ctx = new AudioContext(); 
                const o = ctx.createOscillator(); 
                const g = ctx.createGain(); 
                o.connect(g); 
                g.connect(ctx.destination); 
                o.frequency.value = 880; 
                g.gain.value = 0.3; 
                o.start(); 
                setTimeout(() => o.stop(), 300); 
            } catch(e) {}
            
            renderRestTimer();
            if (['carousel', 'focus'].includes(localStorage.getItem('workoutLayoutMode'))) {
                renderCarouselCard();
            }
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
    if (['carousel', 'focus'].includes(localStorage.getItem('workoutLayoutMode'))) {
        renderCarouselCard();
    }
}

function renderRestTimer() {
    const currentLayoutMode = localStorage.getItem('workoutLayoutMode');
    // FOCUS-LÄGE: Använd samma listvy-logik men med egen container
   if (currentLayoutMode === 'focus' || (currentLayoutMode === 'carousel' && carouselFocusModeActive)) {
        const staticBar = document.getElementById("focus-rest-timer-bar");
        renderRestTimerListStyle(staticBar);
        return;
    }
    // KARUSELLÄGE (Carousel)
    if (currentLayoutMode === 'carousel') {
        const isTimerDisabled = !!(activeDraft && activeDraft.restTimerDisabled);
        const timerColor = restTimerSeconds <= 10 ? '#ef4444' : '#f59e0b';
        
        const mins = String(Math.floor(restTimerSeconds / 60)).padStart(1, '0');
        const secs = String(restTimerSeconds % 60).padStart(2, '0');
        const liveTimeStr = `${mins}:${secs}`;
        const isCurrentlyCounting = restTimerActive && restTimerSeconds > 0;

        // Hämta standardtid för nuvarande övning
        const nextRest = parseInt(activeDraft?.data?.[carouselCurrentIndex]?.sets_data?.find(s => !s.userConfirmed)?.rest || 120);
        const defaultMins = String(Math.floor(nextRest / 60)).padStart(1, '0');
        const defaultSecs = String(nextRest % 60).padStart(2, '0');
        const defaultTimeStr = `${defaultMins}:${defaultSecs}`;

const zone = document.getElementById('carousel-timer-header-zone');
const liveLabelTime = document.getElementById('carousel-live-label-time');
        const labelWord = document.getElementById('carousel-rest-label-word');
        const carouselDdTime = document.getElementById('carousel-rest-dropdown-time');

        // Om vi är i karuselläget men elementen inte finns i DOM:en än, rita först kortet
        if (!zone && document.getElementById('carousel-ex-card')) {
            renderCarouselCard();
            return;
        }

        // Uppdatera headern live utan att förstöra resten av kortet
        if (zone) {
            if (isTimerDisabled) {
                zone.style.opacity = '0.35';
                if (labelWord) labelWord.textContent = 'REST OFF';
                if (liveLabelTime) {
                    liveLabelTime.textContent = '--:--';
                    liveLabelTime.style.color = '#64748b';
                }
            } else {
                zone.style.opacity = '1';
                if (labelWord) labelWord.textContent = 'REST';
                if (liveLabelTime) {
                    if (isCurrentlyCounting) {
                        liveLabelTime.textContent = liveTimeStr;
                        liveLabelTime.style.color = timerColor;
                    } else {
                        liveLabelTime.textContent = defaultTimeStr;
                        liveLabelTime.style.color = '#f59e0b';
                    }
                }
            }
        }

        // Uppdatera klockan inuti dropdown-panelen live (om den är öppen)
        if (carouselDdTime) {
            if (isTimerDisabled) {
                carouselDdTime.textContent = '--:--';
                carouselDdTime.style.color = '#64748b';
            } else if (isCurrentlyCounting) {
                carouselDdTime.textContent = liveTimeStr;
                carouselDdTime.style.color = timerColor;
            } else {
                carouselDdTime.textContent = defaultTimeStr;
                carouselDdTime.style.color = '#f59e0b';
            }
        }
        return; 
    }
    
    // LISTVYN (Standardläge)
    const staticBar = document.getElementById("rest-timer-bar");
    renderRestTimerListStyle(staticBar);
}

function renderRestTimerListStyle(staticBar) {
    if (staticBar) {
        staticBar.style.display = 'block';
    }
    const isDisabled = activeDraft && activeDraft.restTimerDisabled;
    const mins = String(Math.floor(restTimerSeconds / 60)).padStart(1, '0');
    const secs = String(restTimerSeconds % 60).padStart(2, '0');
    
    const disabledHTML = `
        <div style="background:rgba(255,255,255,0.03); border-left:4px solid rgba(255,255,255,0.1); border-radius:16px; padding:8px 16px; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; opacity: 0.35;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:14px; opacity:0.25;">⏱️</span>
                <span style="font-size:11px; color:rgba(255,255,255,0.2); font-weight:600; text-transform:uppercase; letter-spacing:1px;">Rest Timer (OFF)</span>
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

    const oldMoving = document.getElementById("rest-timer-moving");
    if (oldMoving) oldMoving.remove();

    if (isDisabled) {
        if (staticBar) staticBar.innerHTML = disabledHTML;
    } else if (restTimerActive && restTimerExIdx !== null) {
        const isFocusMode = localStorage.getItem('workoutLayoutMode') === 'focus' || 
        (localStorage.getItem('workoutLayoutMode') === 'carousel' && carouselFocusModeActive);
        const targetCard = isFocusMode ? null : document.getElementById(`exercise-card-${restTimerExIdx}`);
        if (targetCard) {
            if (staticBar) staticBar.innerHTML = '';
            const movingBar = document.createElement("div");
            movingBar.id = "rest-timer-moving";
            movingBar.innerHTML = activeHTML;
            targetCard.insertAdjacentElement('beforebegin', movingBar);
        } else if (staticBar) {
            staticBar.innerHTML = activeHTML;
        }
    } else {
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

function toggleExerciseNote(exIdx) {
    if (!activeDraft.ui_state.openNotes) activeDraft.ui_state.openNotes = [];
    const idx = activeDraft.ui_state.openNotes.indexOf(exIdx);
    if (idx > -1) {
        activeDraft.ui_state.openNotes.splice(idx, 1);
    } else {
        activeDraft.ui_state.openNotes.push(exIdx);
    }
const targetCard = document.getElementById(`exercise-card-${exIdx}`);
    const existingHandle = targetCard ? targetCard.querySelector('.drag-handle') : null;
    updateSingleExerciseCard(exIdx);
    if (existingHandle) {
        const updatedHeader = targetCard.querySelector('div[onclick^="toggleExercise"]');
        if (updatedHeader && !updatedHeader.querySelector('.drag-handle')) {
            updatedHeader.insertBefore(existingHandle, updatedHeader.firstChild);
        }
    }
    setTimeout(() => {
        const ta = document.getElementById(`note-input-${exIdx}`);
        if (ta && activeDraft.ui_state.openNotes.includes(exIdx)) ta.focus();
    }, 50);
}

function updateExerciseNote(firstArg, secondArg) {
    if (!activeDraft) return;

    let ta = null;
    let exIdx = null;

    // SCENARIO 1: Kallad från list-vyn -> updateExerciseNote(exIdx)
    // Första argumentet är ett nummer (indexet)
    if (typeof firstArg === 'number') {
        exIdx = firstArg;
        ta = document.getElementById(`note-input-${exIdx}`);
    } 
    // SCENARIO 2: Kallad från karusell-vyn -> updateExerciseNote(this, i)
    // Första argumentet är ett HTML-element (textarea)
    else if (typeof firstArg === 'object' && firstArg !== null) {
        ta = firstArg;
        exIdx = secondArg;
    }

    // Om vi inte hittade något textfält, avbryt för att undvika krasch
    if (!ta) return;
    
    // Uppdatera utkastet med texten
    activeDraft.data[exIdx].note = ta.value;
    
    // Synka texten till ALLA fält för denna övning som råkar finnas i DOM:en just nu
    const allNoteInputs = document.querySelectorAll(`.carousel-note-input[data-ex="${exIdx}"], #note-input-${exIdx}`);
    allNoteInputs.forEach(input => {
        if (input !== ta) {
            input.value = ta.value;
        }
    });
    
    // Uppdatera pricken och rutan i carousel-vyn (om vi är där)
    const carouselNoteDiv = document.querySelector(`[onclick="carouselToggleNote(${exIdx})"]`);
    if (carouselNoteDiv) {
        const noteSpan = carouselNoteDiv.querySelector('span:first-child');
        if (noteSpan) {
            noteSpan.innerHTML = `📝${ta.value ? '<span style="position:absolute;top:-2px;right:-2px;width:6px;height:6px;background:#fde047;border-radius:50%;"></span>' : ''}`;
        }
        carouselNoteDiv.style.border = `1px solid ${ta.value ? 'rgba(253,224,71,0.4)' : 'rgba(255,255,255,0.1)'}`;
        carouselNoteDiv.style.background = ta.value ? 'rgba(253,224,71,0.06)' : 'rgba(255,255,255,0.06)';
        const noteLabel = carouselNoteDiv.querySelector('span:last-child');
        if (noteLabel) noteLabel.style.color = ta.value ? '#fde047' : '#94a3b8';
    }
    
    // Uppdatera pricken i list-vyn (om vi är där)
    const listNoteBtn = document.querySelector(`#exercise-card-${exIdx} button[onclick*="toggleExerciseNote"]`);
    if (listNoteBtn) {
        const existingDot = listNoteBtn.querySelector('.note-dot');
        if (ta.value && !existingDot) {
            const dot = document.createElement('span');
            dot.className = 'note-dot';
            dot.style.cssText = 'position:absolute;top:2px;right:2px;width:6px;height:6px;background:#fde047;border-radius:50%;pointer-events:none;';
            listNoteBtn.appendChild(dot);
        } else if (!ta.value && existingDot) {
            existingDot.remove();
        }
    }
    
    debouncedPersistActiveWorkout();
}

function toggleQuickMenu() {
    const menu = document.getElementById("quick-menu");
    const fab = document.querySelector(".fab");
    const isHidden = menu.classList.contains("hidden");
    if (isHidden) {
        menu.classList.remove("hidden");
        fab.classList.add("open");
    } else {
        menu.classList.add("hidden");
        fab.classList.remove("open");
    }
}
function closeQuickMenu() {
    document.getElementById("quick-menu").classList.add("hidden");
    document.querySelector(".fab").classList.remove("open");
}

function openProfilePanel() {
    const overlay = document.getElementById("profile-overlay");
    const panel = document.getElementById("profile-panel");
    overlay.classList.remove("hidden");
    setTimeout(() => {
        overlay.classList.add("visible");
        panel.classList.add("open");
    }, 10);
    document.querySelectorAll("#bottom-bar .bar-item").forEach(el => el.classList.remove("active"));
    document.getElementById("bar-profile-item").classList.add("active");
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    if (typeof currentUser !== 'undefined' && currentUser) {
        const email = currentUser.email || "";
        const initials = email.substring(0, 2).toUpperCase();
        document.getElementById("profile-avatar").textContent = initials;
        document.getElementById("profile-name").textContent = email.split("@")[0];
        document.getElementById("profile-email").textContent = email;
    }
}

function openThemePanel() {
    closeProfilePanel();
    const body = document.getElementById("modal-body");
    if (!body) return;
    const current = localStorage.getItem('theme') || 'dark';
    body.innerHTML = `
        <h3 style="text-align:center; margin-bottom:20px;">Theme & Layout</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <div onclick="window.applyTheme('dark')" style="display:flex; align-items:center; gap:14px; padding:16px; border-radius:16px; cursor:pointer;
                border:2px solid ${current === 'dark' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
                background:${current === 'dark' ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)'};">
                <div style="width:40px; height:40px; border-radius:12px; background:#0f172a; border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                </div>
                <div>
                    <div style="font-weight:800; font-size:14px; color:#fff;">Dark</div>
                    <div style="font-size:11px; color:var(--text-light);">Current default</div>
                </div>
                ${current === 'dark' ? '<span style="margin-left:auto; color:var(--primary); font-size:18px;">✓</span>' : ''}
            </div>
            <div onclick="window.applyTheme('light')" style="display:flex; align-items:center; gap:14px; padding:16px; border-radius:16px; cursor:pointer;
                border:2px solid ${current === 'light' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'};
                background:${current === 'light' ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)'};">
                <div style="width:40px; height:40px; border-radius:12px; background:#e2e8f0; border:1px solid rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                </div>
                <div>
                    <div style="font-weight:800; font-size:14px; color:#fff;">Light</div>
                    <div style="font-size:11px; color:var(--text-light);">Clean & bright</div>
                </div>
                ${current === 'light' ? '<span style="margin-left:auto; color:var(--primary); font-size:18px;">✓</span>' : ''}
            </div>
        </div>
    `;
    openModal();
}

window.applyTheme = function(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    closeModal();
};

function closeProfilePanel() {
    const overlay = document.getElementById("profile-overlay");
    const panel = document.getElementById("profile-panel");
    overlay.classList.remove("visible");
    panel.classList.remove("open");
    document.getElementById("bar-profile-item").classList.remove("active");
    setTimeout(() => overlay.classList.add("hidden"), 250);
}

function triggerLogout() {
    closeProfilePanel();
    const oldLogoutBtn = document.getElementById("global-logout");
    if (oldLogoutBtn) {
        oldLogoutBtn.click();
    } else {
        console.warn("Kunde inte hitta global-logout-knappen för att trigga utloggning.");
    }
}

function openInfoModal() {
    const body = document.getElementById("modal-body");
    if (!body) return;
    body.innerHTML = `
        <div style="text-align:center; padding:10px;">
            <div style="width:56px; height:56px; border-radius:16px; background:rgba(34,211,238,0.1);
                border:1px solid rgba(34,211,238,0.3); display:flex; align-items:center;
                justify-content:center; font-size:26px; margin:0 auto 16px auto;">
                <i class="ti ti-info-circle" style="color:#22d3ee;"></i>
            </div>
            <h3 style="margin:0 0 10px 0; font-size:20px; font-weight:900; color:#fff;">LIFT Tracker Pro</h3>
            <p style="color:var(--text-light); font-size:14px; line-height:1.5;">
                Workout tracking made simple.
            </p>
        </div>
    `;
    openModal();
}


let workoutLayoutMode = localStorage.getItem('workoutLayoutMode') || 'list';
let carouselCurrentIndex = 0;
let carouselRestActive = false;
let carouselRestSeconds = 0;
let carouselRestInterval = null;
setInterval(() => {
    const durationTextEl = document.getElementById("workout-duration-text");
    if (durationTextEl && activeDraft?.isStarted && activeDraft?.startTime) {
        const diffInMs = new Date() - new Date(activeDraft.startTime);
        const diffInMinutes = Math.max(0, Math.floor(diffInMs / 1000 / 60));
        durationTextEl.textContent = `${diffInMinutes} min`;
    }
}, 60000);

function setWorkoutLayout(mode) {
    flushFocusedInputs();
    workoutLayoutMode = mode;
    localStorage.setItem('workoutLayoutMode', mode);
    const listBtn = document.getElementById('layout-list-btn');
    const carouselBtn = document.getElementById('layout-carousel-btn');
    const focusBtn = document.getElementById('layout-focus-btn');
    const exerciseList = document.getElementById('exercise-list');
    const carouselView = document.getElementById('carousel-view');
    const focusView = document.getElementById('focus-view');
    const restTimerBar = document.getElementById('rest-timer-bar');
    
    if (listBtn) listBtn.classList.toggle('active', mode === 'list');
    if (carouselBtn) carouselBtn.classList.toggle('active', mode === 'carousel');
    if (focusBtn) focusBtn.classList.toggle('active', mode === 'focus');
    
   if (mode === 'list') {
        if (exerciseList) exerciseList.style.display = 'block';
        if (carouselView) carouselView.classList.add('hidden');
        if (focusView) focusView.classList.add('hidden');
        window._suppressAutoScroll = true;
        const headerCard2 = document.querySelector('#workout-view > div:first-child');
        const separator2 = document.getElementById('workout-separator-line');
        if (headerCard2) headerCard2.classList.remove('hidden');
        if (separator2) separator2.classList.remove('hidden');
        document.getElementById('carousel-focus-toggle')?.style && (document.getElementById('carousel-focus-toggle').style.display = 'none');
        carouselFocusModeActive = false;
        const header = document.querySelector('#workout-view > div:first-child');
        const footer = document.querySelector('.workout-footer');
        if (header) { header.style.opacity = '1'; header.style.maxHeight = ''; header.style.overflow = ''; }
        if (footer) { footer.style.opacity = '1'; footer.style.maxHeight = ''; footer.style.overflow = ''; }
        renderRestTimer();
        renderActiveWorkout();
       
   } else if (mode === 'carousel') {
        if (exerciseList) exerciseList.style.display = 'none';
        if (carouselView) carouselView.classList.remove('hidden');
        if (focusView) focusView.classList.add('hidden');
        
        if (restTimerBar) {
            restTimerBar.innerHTML = '';
            restTimerBar.style.display = 'none';
        }
        const oldMoving = document.getElementById("rest-timer-moving");
        if (oldMoving) oldMoving.remove();
        
        carouselCurrentIndex = 0;
        if (activeDraft?.workout?.exercises) {
            const firstUndone = activeDraft.workout.exercises.findIndex((_, i) => !activeDraft.data[i]?.isCompleted);
            if (firstUndone !== -1) carouselCurrentIndex = firstUndone;
        }
       const headerCard3 = document.querySelector('#workout-view > div:first-child');
        const separator3 = document.getElementById('workout-separator-line');
        if (headerCard3) headerCard3.classList.remove('hidden');
        if (separator3) separator3.classList.remove('hidden');
carouselFocusModeActive = false;
        renderCarousel();
        setTimeout(() => renderCarouselCard(), 50);
        setTimeout(() => {
            const ft = document.getElementById('carousel-focus-toggle');
            if (ft) ft.style.display = 'flex';
        }, 100);
       
    } else if (mode === 'focus') {
        if (exerciseList) exerciseList.style.display = 'none';
        if (carouselView) carouselView.classList.add('hidden');
        if (focusView) focusView.classList.remove('hidden');
        document.getElementById('carousel-focus-toggle')?.style && (document.getElementById('carousel-focus-toggle').style.display = 'none');
        carouselFocusModeActive = false;
        
        const headerCard = document.querySelector('#workout-view > div:first-child');
        const separator = document.getElementById('workout-separator-line');
        const footer = document.querySelector('.workout-footer');
        if (headerCard) headerCard.classList.add('hidden');
        if (separator) separator.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
        
        if (restTimerBar) {
            restTimerBar.innerHTML = '';
            restTimerBar.style.display = 'none';
        }
        const oldMoving = document.getElementById("rest-timer-moving");
        if (oldMoving) oldMoving.remove();
        
        carouselCurrentIndex = 0;
        if (activeDraft?.workout?.exercises) {
            const firstUndone = activeDraft.workout.exercises.findIndex((_, i) => !activeDraft.data[i]?.isCompleted);
            if (firstUndone !== -1) carouselCurrentIndex = firstUndone;
        }
        renderFocus();
    }
}

// =========================================================================
// 1. DIN VY-VÄXLINGSFUNKTION (Säkerställer att rätt index skickas med vid byte)
// =========================================================================
function switchView(view) {
    const listView = document.getElementById('list-view');
    const carouselView = document.getElementById('carousel-view');
    const btnList = document.getElementById('btn-view-list');
    const btnCarousel = document.getElementById('btn-view-carousel');

    if (!listView || !carouselView || !btnList || !btnCarousel) return;

    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    activeDraft.ui_state.activeView = view;

    if (view === 'carousel') {
        listView.style.display = 'none';
        carouselView.style.display = 'block';
        btnCarousel.classList.add('active');
        btnList.classList.remove('active');

        // SYNK (Från lista till karusell): Tvinga karusellen att använda 
        // det index som sparades när du klickade runt i listvyn
        if (activeDraft.ui_state && typeof activeDraft.ui_state.currentExerciseIndex === 'number') {
            carouselCurrentIndex = activeDraft.ui_state.currentExerciseIndex;
        } else {
            carouselCurrentIndex = 0;
        }

        renderCarousel(); // Ritar upp karusellvyn med rätt övning centrerad
    } else {
        listView.style.display = 'block';
        carouselView.style.display = 'none';
        btnList.classList.add('active');
        btnCarousel.classList.remove('active');

        // SYNK (Från karusell till lista): Det här fungerade redan bra för dig,
        // men vi behåller det för att säkerställa att det blir en tvåvägs-gata.
        if (typeof carouselCurrentIndex === 'number') {
            activeDraft.ui_state.currentExerciseIndex = carouselCurrentIndex;
            activeDraft.ui_state.openExercises = [carouselCurrentIndex];
        }

        renderActiveWorkout(); 
    }
    
    persistActiveWorkout();
}

// =========================================================================
// 2. DIN LIST-FUNKTION: När man klickar/expanderar en övning i listvyn
// =========================================================================
function toggleExerciseExpand(exIdx) {
    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    if (!activeDraft.ui_state.openExercises) activeDraft.ui_state.openExercises = [];

    const index = activeDraft.ui_state.openExercises.indexOf(exIdx);
    
    if (index > -1) {
        // Om användaren stänger kortet
        activeDraft.ui_state.openExercises.splice(index, 1);
        
        // Om det var det här kortet som var aktivt, backa till det senast öppnade kortet som är kvar
        if (activeDraft.ui_state.currentExerciseIndex === exIdx) {
            activeDraft.ui_state.currentExerciseIndex = activeDraft.ui_state.openExercises.length > 0 
                ? activeDraft.ui_state.openExercises[activeDraft.ui_state.openExercises.length - 1] 
                : 0; // Fallback till första om inget är öppet
        }
    } else {
        // Om användaren öppnar kortet
        activeDraft.ui_state.openExercises.push(exIdx);
        
        // SYNK: Här sätter vi direkt vilket index som är det senast expanderade.
        // Det är detta som gör att karusellen fattar vilken övning den ska visa när du byter vy!
        activeDraft.ui_state.currentExerciseIndex = exIdx;
    }

    // Synka även den globala karusellvariabeln direkt så att den är redo
    carouselCurrentIndex = activeDraft.ui_state.currentExerciseIndex;

    persistActiveWorkout();
    renderActiveWorkout();
}

function renderCarousel() {
    const container = document.getElementById('carousel-view');
    if (!container || !activeDraft) return;
    const exercises = activeDraft.workout.exercises;
    const data = activeDraft.data;

    if (!exercises || exercises.length === 0) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 24px; text-align:center; gap:16px;">
            <div style="font-size:14px; color:var(--text-light); text-align:center; line-height:2;">
                    This workout is empty.<br>Click the button below to add your exercises!<br>👇
                </div>
                <button onclick="openCustomAddExerciseModal()" style="width:100%; padding:16px; background:transparent; border:2px dashed rgba(34,211,238,0.4); border-radius:16px; color:#22d3ee; font-size:15px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Exercise
                </button>
            </div>`;
        return;
    }

    if (activeDraft.ui_state && typeof activeDraft.ui_state.currentExerciseIndex === 'number') {
        carouselCurrentIndex = activeDraft.ui_state.currentExerciseIndex;
    }

    const totalExercises = exercises.length;
    const completedExercises = data.filter(d => d?.isCompleted).length;
    const totalSets = data.reduce((acc, d) => acc + (d?.sets_data?.length || 0), 0);

    container.innerHTML = `
        <div class="carousel-nav-bar" id="carousel-nav-bar-inner"></div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 2px 6px; font-size:10px; font-weight:700; color:#f0a020; letter-spacing:0.3px;">
           <span></span>
            <div class="carousel-nav-dots" style="justify-content:center; padding:0;">
                <div class="carousel-dots" id="carousel-dots-container"></div>
            </div>
              <span></span>
        </div>
        <div class="carousel-card-area" id="carousel-card-area">
            <div class="carousel-ex-card" id="carousel-ex-card"></div>
        </div>`;

    renderCarouselNav();
    renderCarouselDots();
    renderCarouselCard();
    initCarouselSwipe();
    initCarouselDragAndDrop();

    const ft = document.getElementById('carousel-focus-toggle');
    if (ft) ft.style.display = 'flex';
    carouselFocusModeActive = false;

    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0;
        let totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }

    setTimeout(() => {
        const active = document.getElementById(`carousel-thumb-${carouselCurrentIndex}`);
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 50);
}

let carouselNavDragInProgress = false;

function renderCarouselNav() {
    const navBar = document.getElementById('carousel-nav-bar-inner');
    if (!navBar || !activeDraft) return;
    const exercises = activeDraft.workout.exercises;
    const data = activeDraft.data;

    const addBtn = `<div onclick="openCustomAddExerciseModal()" style="flex-shrink:0; min-width:56px; max-width:80px; border-radius:14px; border:1.5px dashed rgba(34,211,238,0.3); background:transparent; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:7px 4px 6px; cursor:pointer; gap:4px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <div style="font-size:8px; font-weight:800; color:#22d3ee; text-align:center; line-height:1.4;">Add<br>Exercise</div>
    </div>`;

    const thumbsHtml = exercises.map((ex, i) => {
        const isDone = data[i]?.isCompleted;
        const isActive = i === carouselCurrentIndex;
        const svg = getExSVG(ex.target, 'small');
      return `<div class="carousel-ex-thumb${isDone ? ' done' : isActive ? ' active' : ''}" id="carousel-thumb-${i}" onclick="carouselGoTo(${i})" style="position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:6px 4px 6px;">
            ${isDone ? `<div style="position:absolute; top:5px; right:5px; width:8px; height:8px; border-radius:50%; background:#22c55e;"></div>` : ''}
            <div class="carousel-drag-handle" style="display:flex; align-items:center; justify-content:center; cursor:grab; width:100%; opacity:${isDone ? 0.25 : isActive ? 1 : 0.3};">
                <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
                    <circle cx="3" cy="2" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="11" cy="2" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="3" cy="7" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="11" cy="7" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="7" cy="2" r="1.3" fill="${isActive ? 'rgba(34,211,238,0.4)' : isDone ? '#22c55e' : '#94a3b8'}"/>
                    <circle cx="7" cy="7" r="1.3" fill="${isActive ? 'rgba(34,211,238,0.4)' : isDone ? '#22c55e' : '#94a3b8'}"/>
                </svg>
            </div>
            <div style="width:22px; height:22px; border-radius:50%; border:1.5px solid ${isDone ? '#22c55e' : isActive ? '#22d3ee' : 'rgba(255,255,255,0.25)'}; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:11px; font-weight:900; color:${isActive ? '#22d3ee' : isDone ? '#22c55e' : '#fff'};">${i + 1}</span>
            </div>
            <span style="font-size:8px; font-weight:800; display:block; line-height:1.2; text-align:center; color:${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#e2e8f0'}; padding:0 3px;">${ex.name}</span>
        </div>`;
    }).join('');

    navBar.innerHTML = addBtn + thumbsHtml;

    setTimeout(() => {
        const active = document.getElementById(`carousel-thumb-${carouselCurrentIndex}`);
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 50);

    initCarouselDragAndDrop();
}

function renderCarouselDots() {
    const dotsContainer = document.getElementById('carousel-dots-container');
    if (!dotsContainer || !activeDraft) return;
    dotsContainer.innerHTML = activeDraft.workout.exercises.map((_, i) => {
        const isDone = activeDraft.data[i]?.isCompleted;
        return `<div class="carousel-dot${isDone ? ' done' : i === carouselCurrentIndex ? ' active' : ''}"></div>`;
    }).join('');
}

function renderCarouselCard() {
    const card = document.getElementById('carousel-ex-card');
    if (!card || !activeDraft) return;
    const i = carouselCurrentIndex;
    const ex = activeDraft.workout.exercises[i];
    const exData = activeDraft.data[i];
    if (!ex || !exData) return;
    const dropdownEl = document.getElementById('carousel-rest-dropdown');
    const wasDropdownOpen = dropdownEl ? (dropdownEl.style.display === 'block') : false;
    const isNoteOpen = activeDraft.ui_state?.openNotes?.includes(i) || false;
    const isDone = exData.isCompleted;
    card.style.borderLeftColor = isDone ? '#22c55e' : '#22d3ee';
    card.classList.toggle('is-done', isDone);
    card.style.outline = isDone ? '1.5px solid #22c55e' : 'none';
    card.style.boxShadow = isDone ? '0 0 25px rgba(34,197,94,0.25), inset 0 0 40px rgba(34,197,94,0.06)' : 'none';
    const completedSets = exData.sets_data ? exData.sets_data.filter(s => s.userConfirmed).length : 0;
    const totalSets = exData.sets_data ? exData.sets_data.length : 0;
    const firstUnconfirmed = exData.sets_data ? exData.sets_data.findIndex(s => !s.userConfirmed) : -1;
    const catDisplay = CATEGORY_DISPLAY[ex.target] || ex.target || '';
    const isTimerDisabled = !!activeDraft.restTimerDisabled;
    const timerColor = restTimerSeconds <= 10 ? '#ef4444' : '#f59e0b';
    const currentMins = String(Math.floor(restTimerSeconds / 60)).padStart(1, '0');
    const currentSecs = String(restTimerSeconds % 60).padStart(2, '0');
    const liveTimeStr = `${currentMins}:${currentSecs}`;
    const nextRestSeconds = parseInt(exData.sets_data?.find(s => !s.userConfirmed)?.rest || 120);
    const defaultMins = String(Math.floor(nextRestSeconds / 60)).padStart(1, '0');
    const defaultSecs = String(nextRestSeconds % 60).padStart(2, '0');
    const defaultTimeStr = `${defaultMins}:${defaultSecs}`;
    const isCounting = restTimerActive && restTimerSeconds > 0;
    const isCardio = isCardioExercise(ex);
    let setsHtml = `<div style="margin-top:4px;">
        <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
            <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">${isCardio ? '' : 'SET'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'TID' : 'KG'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'DIST (km)' : 'REPS'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'PACE' : 'REST (S)'}</small>
            <span></span>
        </div>`;
    if (exData.sets_data) {
        exData.sets_data.forEach((set, sIdx) => {
            const isLocked = isDone;
            const isCurrent = !set.userConfirmed && !isDone && sIdx === firstUnconfirmed;
            const showSuccess = set.userConfirmed || isDone;
            const circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
            const statusContent = showSuccess ? '✅' : (isCardio ? '✓' : `#${sIdx + 1}`);
            const inputOpacity = isCurrent ? '1' : '0.3';
            setsHtml += `
            <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center; transition:opacity 0.2s ease; position:relative; overflow:visible;">
                <div class="${isCurrent ? 'pulse-ring' : ''}" onclick="${isLocked && !isDone ? '' : `carouselConfirmSet(${i}, ${sIdx})`}"
                    style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:${isCardio ? '14px' : '10px'}; font-weight:800; background:${showSuccess ? 'rgba(34,197,94,0.2)' : isCurrent ? 'rgba(250,204,21,0.15)' : 'rgba(245,158,11,0.05)'}; color:${circleColor}; opacity:1;">
                    ${statusContent}
                </div>
                ${isCardio
                    ? `<input type="text" inputmode="numeric" id="cdm-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px 4px; font-size:15px; min-width:0; opacity:${inputOpacity}; text-align:center; font-family:monospace; letter-spacing:2px; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.duration || '__:__'}" ${isLocked ? 'readonly' : ''} onfocus="initCardioTimeInput('cdm-${i}-${sIdx}', ${i}, ${sIdx})">`
                    : `<input type="text" inputmode="decimal" id="w-${i}-${sIdx}" class="log-input weight-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.weight || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'weight')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                ${isCardio
                    ? `<input type="text" inputmode="decimal" id="ck-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.distance || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'distance')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                    : `<input type="text" inputmode="decimal" id="r-${i}-${sIdx}" class="log-input reps-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.reps || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'reps')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                ${isCardio
                    ? `<div id="pace-${i}-${sIdx}" style="display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#22d3ee; font-family:monospace; white-space:nowrap; opacity:${inputOpacity};">${calcPace(set.duration, set.distance)}</div>`
                    : (sIdx < exData.sets_data.length - 1
                        ? `<input type="text" inputmode="decimal" id="v-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; border-color:${isCurrent ? 'rgba(245,158,11,0.6)' : 'rgba(52,152,219,0.3)'};" value="${set.rest || '120'}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'rest')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                        : '<div></div>')}
                <button onclick="removeSetFromExercise(${i}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity:${showSuccess ? '0.1' : '0.8'};" ${showSuccess ? 'disabled' : ''}>×</button>
            </div>`;
            if (isCurrent && sIdx === firstUnconfirmed && !isCardio) {
                setsHtml += `
                <div style="grid-column: 2 / span 3; margin:-4px 0 8px 0; padding-left:2px; opacity:0.8; font-size:10px; color:var(--primary); font-weight:600; letter-spacing:0.3px;">
                    💡 Select ${statusContent} to lock & continue
                </div>`;
            }
        });
    }
    setsHtml += `</div>`;
    card.innerHTML = `
        <div style="padding:10px 14px 8px; display:flex; align-items:center; justify-content:space-between; gap:8px; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="min-width:0; flex:1;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="font-size:16px; font-weight:900; color:${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration:${isDone ? 'line-through' : 'none'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ex.name}</div>
                    <div onclick="const z=document.getElementById('anim-modal-${i}'); z.style.display=z.style.display==='flex'?'none':'flex';" style="display:flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:20px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);cursor:pointer;flex-shrink:0;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                </div>
                <div style="font-size:10px; color:${isDone ? '#22c55e' : 'var(--primary)'}; font-weight:800; margin-top:1px;">${isDone ? 'DONE ✅' : isCardio ? catDisplay : `${catDisplay}${catDisplay ? ' · ' : ''}${completedSets}/${totalSets} sets`}</div>
            </div>
            <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                <div id="carousel-timer-header-zone" style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; cursor:pointer; transition: opacity 0.2s ease; opacity: ${isDone ? '0.3' : isTimerDisabled ? '0.35' : '1'}; pointer-events:${isDone ? 'none' : 'auto'};" onclick="carouselToggleRestBadge();">
                    <span id="carousel-rest-label-word" style="font-size:9px; color:${isTimerDisabled ? '#64748b' : '#92400e'}; font-weight:800; text-transform:uppercase; letter-spacing:1px; line-height:1;">
                        ${isTimerDisabled ? 'OFF' : 'REST'}
                    </span>
                    <div style="display:flex; align-items:center; gap:6px; min-width:52px; justify-content:flex-end;">
                        <span style="font-size:14px; line-height:1;">⏱️</span>
                        <span id="carousel-live-label-time" style="font-size:14px; font-weight:900; color:${isTimerDisabled ? '#64748b' : '#f59e0b'}; font-family:monospace; letter-spacing:0.5px;">
                            ${isTimerDisabled ? '--:--' : (isCounting ? liveTimeStr : defaultTimeStr)}
                        </span>
                    </div>
                </div>
                <div onclick="carouselToggleRestBadge();"
                     style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid rgba(245,158,11,0.2); background:rgba(245,158,11,0.08); cursor:pointer; transition:all 0.2s; ${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </div>
            </div>
        </div>
        <div id="carousel-rest-dropdown" style="display:${wasDropdownOpen ? 'block' : 'none'}; margin:0 14px 6px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2); border-radius:12px; padding:10px 12px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div>
                        <div style="font-size:8px; color:#92400e; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Rest Timer</div>
                        <div style="font-size:22px; font-weight:900; color:${isTimerDisabled ? '#64748b' : (isCounting ? timerColor : '#f59e0b')}; font-family:monospace;" id="carousel-rest-dropdown-time">
                            ${isTimerDisabled ? '--:--' : (isCounting ? liveTimeStr : defaultTimeStr)}
                        </div>
                    </div>
                    <div style="display:flex; background:rgba(0,0,0,0.4); border-radius:10px; border:1px solid rgba(255,255,255,0.08); overflow:hidden; height:26px; align-items:center; margin-left:4px;">
                        <button onclick="activeDraft.restTimerDisabled=false; persistActiveWorkout(); renderCarouselCard(); renderRestTimer();"
                            style="padding:0 10px; height:100%; font-size:10px; font-weight:700; cursor:pointer; border:none; transition:all 0.15s; background:${!isTimerDisabled ? 'rgba(245,158,11,0.25)' : 'transparent'}; color:${!isTimerDisabled ? '#f59e0b' : 'rgba(255,255,255,0.2)'};">On</button>
                        <button onclick="clearInterval(restTimerInterval); clearInterval(carouselRestInterval); restTimerActive=false; carouselRestActive=false; restTimerSeconds=0; carouselRestSeconds=0; restTimerExIdx=null; activeDraft.restTimerDisabled=true; persistActiveWorkout(); renderCarouselCard(); renderRestTimer();"
                            style="padding:0 10px; height:100%; font-size:10px; font-weight:700; cursor:pointer; border:none; transition:all 0.15s; background:${isTimerDisabled ? 'rgba(245,158,11,0.25)' : 'transparent'}; color:${isTimerDisabled ? '#f59e0b' : 'rgba(255,255,255,0.2)'};">Off</button>
                    </div>
                </div>
                <div style="display:flex; gap:4px; align-items:center;">
                    <button onclick="carouselRestAdjust(-15)" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:4px 6px;font-size:9px;color:#f59e0b;cursor:pointer;white-space:nowrap;" ${isTimerDisabled ? 'disabled' : ''}>−15s</button>
                    <button onclick="carouselRestAdjust(30)" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:4px 6px;font-size:9px;color:#f59e0b;cursor:pointer;white-space:nowrap;" ${isTimerDisabled ? 'disabled' : ''}>+30s</button>
                    <button onclick="carouselRestStart()" style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:4px 6px;font-size:9px;font-weight:700;color:#22c55e;cursor:pointer;white-space:nowrap;" ${isTimerDisabled ? 'disabled' : ''}>${isCounting ? 'Restart' : 'Start'}</button>
                </div>
            </div>
        </div>
        <div class="carousel-card-body" style="background:rgba(255,255,255,0.03); border-top:1px solid rgba(255,255,255,0.06);">
            ${isNoteOpen ? `<div style="margin-bottom:10px;">
                <textarea id="note-input-${i}" class="carousel-note-input" data-ex="${i}" placeholder="Add a note for this exercise..."
                    oninput="updateExerciseNote(this, ${i})"
                    style="width:100%; min-height:60px; padding:10px; border-radius:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(253,224,71,0.2); color:#fff; font-size:13px; font-family:inherit; resize:vertical;">${exData.note || ''}</textarea>
            </div>` : ''}
            ${setsHtml}
            <div style="display:flex; gap:6px; align-items:center; margin-top:12px; margin-bottom:8px; width:100%;">
                <button style="display:${isCardio ? 'none' : 'flex'};align-items:center;gap:5px;padding:7px 10px;background:transparent;border:1.5px dashed rgba(34,211,238,0.3);color:#22d3ee;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}" onclick="addSetToExercise(${i})" ${isDone ? 'disabled' : ''}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add set
                </button>
                <div style="flex:1;"></div>
                <div onclick="carouselToggleNote(${i})" style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:20px;border:1px solid ${exData.note ? 'rgba(253,224,71,0.4)' : '#2a3d52'};background:${exData.note ? 'rgba(253,224,71,0.06)' : '#1e2d3d'};cursor:pointer;flex-shrink:0;position:relative;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                    <span style="font-size:13px;position:relative;">📝${exData.note ? '<span style="position:absolute;top:-2px;right:-2px;width:6px;height:6px;background:#fde047;border-radius:50%;"></span>' : ''}</span><span style="font-size:11px;font-weight:700;color:${exData.note ? '#fde047' : '#f8fafc'};">Note</span>
                </div>
                <div onclick="${isDone ? '' : `openReplaceExerciseModal(${i})`}" style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:20px;background:#1a3040;border:1px solid #22d3ee;cursor:pointer;flex-shrink:0;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    <span style="font-size:11px;font-weight:700;color:#22d3ee;">Swap</span>
                </div>
                <div onclick="${isDone ? '' : `removeActiveExercise(${i})`}" style="display:flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:20px;background:#2d1a1a;border:1px solid #7f1d1d;cursor:pointer;flex-shrink:0;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
            </div>
            <button style="width:100%;padding:12px;background:${isDone ? 'rgba(148,163,184,0.25)' : 'rgba(34,197,94,0.1)'};color:${isDone ? '#fff' : '#22c55e'};border-radius:12px;font-size:14px;font-weight:800;border:${isDone ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(34,197,94,0.25)'};cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="carouselToggleDone(${i})">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isDone ? '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline>'}</svg>
                ${isDone ? 'Undo' : 'Finish exercise'}
            </button>
        </div>`;
}

function formatRestTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

async function carouselConfirmSet(exIdx, setIdx) {
    // Spara ALLA inputs för denna övning till draft FÖRST (innan flush/omritning)
   const allInputs = document.querySelectorAll(`[id^="w-${exIdx}-"], [id^="r-${exIdx}-"], [id^="v-${exIdx}-"], [id^="cd-${exIdx}-"], [id^="ck-${exIdx}-"]`);
    allInputs.forEach(inp => {
        const parts = inp.id.split('-');
        const sIdx2 = parseInt(parts[parts.length - 1]);
        const type = parts[0];
        if (!isNaN(sIdx2) && activeDraft.data[exIdx]?.sets_data?.[sIdx2]) {
        if (type === 'w') activeDraft.data[exIdx].sets_data[sIdx2].weight = inp.value;
            if (type === 'r') activeDraft.data[exIdx].sets_data[sIdx2].reps = inp.value;
            if (type === 'v') activeDraft.data[exIdx].sets_data[sIdx2].rest = inp.value;
            if (type === 'cd') activeDraft.data[exIdx].sets_data[sIdx2].duration = inp.value;
            if (type === 'ck') activeDraft.data[exIdx].sets_data[sIdx2].distance = inp.value;
        }
    });

    const restVal = parseInt(activeDraft.data[exIdx].sets_data[setIdx].rest) || 120;

    const currentState = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    activeDraft.data[exIdx].sets_data[setIdx].userConfirmed = !currentState;
    const isNowConfirmed = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    const isLastSet = setIdx === activeDraft.data[exIdx].sets_data.length - 1;

    if (isNowConfirmed && !isLastSet) {
        stopRestTimer();
        carouselStopRest();
        carouselStartRest(restVal); // Använd karusellens egen startare
    } else if (isNowConfirmed && isLastSet) {
        stopRestTimer();
        carouselStopRest();
    } else if (!isNowConfirmed) {
        stopRestTimer();
        carouselStopRest();
    }

    await persistActiveWorkout();

    // NYHET: Uppdatera den globala mätaren i headern även när man klickar i enskilda set i karusellen
    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0;
        let totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }

    renderCarouselCard();
}

function carouselStartRest(seconds) {
    if (activeDraft && activeDraft.restTimerDisabled) return; 
    clearInterval(carouselRestInterval);
    
    // SÄKERSTÄLL: Rensa även list-vyns gamla intervall om det fanns något
    if (typeof restTimerInterval !== 'undefined') clearInterval(restTimerInterval);

    carouselRestSeconds = seconds;
    carouselRestActive = true;
    
    // Synka till de globala variablerna som list-vyn använder
    restTimerActive = true; 
    restTimerSeconds = seconds; 
    // Sätter restTimerExIdx till nuvarande karusell-index så att listvyn vet vilken kort-position den rörliga timern ska ligga på
    if (typeof carouselCurrentIndex !== 'undefined') {
        restTimerExIdx = carouselCurrentIndex;
    }

       renderRestTimer();

    // 1. Karusellens egna intervall-loop
    carouselRestInterval = setInterval(() => {
        carouselRestSeconds--;
        restTimerSeconds = carouselRestSeconds; 

        const badgeTime = document.getElementById('carousel-rest-badge-time');
        const dropdownTime = document.getElementById('carousel-rest-dropdown-time');
        const headerTime = document.getElementById('carousel-live-label-time');
        const focusHeaderTime = document.getElementById('focus-live-label-time');
        const focusDropdownTime = document.getElementById('focus-rest-dropdown-time');
        const formatted = formatRestTime(carouselRestSeconds);
        const timerColor = carouselRestSeconds <= 10 ? '#ef4444' : '#f59e0b';
        if (badgeTime) badgeTime.textContent = formatted;
        if (dropdownTime) {
            dropdownTime.textContent = formatted;
            dropdownTime.style.color = timerColor;
        }
        if (headerTime) {
            headerTime.textContent = formatted;
            headerTime.style.color = timerColor;
        }
        if (focusHeaderTime) {
            focusHeaderTime.textContent = formatted;
            focusHeaderTime.style.color = timerColor;
        }
        if (focusDropdownTime) {
            focusDropdownTime.textContent = formatted;
            focusDropdownTime.style.color = timerColor;
        }
        if (localStorage.getItem('workoutLayoutMode') === 'focus' || carouselFocusModeActive) {
            renderRestTimer();
        }

        if (carouselRestSeconds <= 0) {
            clearInterval(carouselRestInterval);
            if (typeof restTimerInterval !== 'undefined') clearInterval(restTimerInterval);
            carouselRestActive = false;
            restTimerActive = false;
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            renderCarouselCard();
        }
    }, 1000);

    // 2. SYNCHRONIZATION: Starta även list-vyns bakgrunds-loop så den tickar parallellt
    if (typeof restTimerInterval !== 'undefined' || true) {
        restTimerInterval = setInterval(() => {
            // Om användaren har hunnit växla över till list-vyn, låt den sköta renderingen där
            if (typeof workoutLayoutMode !== 'undefined' && workoutLayoutMode === 'list') {
                restTimerSeconds--;
                if (restTimerSeconds <= 0) {
                    clearInterval(restTimerInterval);
                    clearInterval(carouselRestInterval);
                    restTimerActive = false;
                    carouselRestActive = false;
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                }
                renderRestTimer();
            }
        }, 1000);
    }
}

function carouselStopRest() {
    clearInterval(carouselRestInterval);
    // SÄKERSTÄLL: Stoppa även list-vyns intervall-loop
    if (typeof restTimerInterval !== 'undefined') clearInterval(restTimerInterval);

    carouselRestActive = false;
    carouselRestSeconds = 0;
    if (typeof restTimerActive !== 'undefined') restTimerActive = false;
    if (typeof restTimerSeconds !== 'undefined') restTimerSeconds = 0;
    
    // Säkerställ att det statiska elementet förblir rensat i karuselläge
    const staticBar = document.getElementById("rest-timer-bar");
    if (staticBar) {
        staticBar.innerHTML = '';
        staticBar.style.display = 'none';
    }
    
    renderCarouselCard();
}

async function carouselAddSet(exIdx) {
    const lastSet = activeDraft.data[exIdx].sets_data[activeDraft.data[exIdx].sets_data.length - 1];
    activeDraft.data[exIdx].sets_data.push({ weight: lastSet?.weight || '', reps: lastSet?.reps || '', userConfirmed: false });
    await persistActiveWorkout();
    renderCarouselCard();
}

async function carouselToggleDone(exIdx) {
    // Invertera statusen för om övningen är helt klar
    const newCompletedState = !activeDraft.data[exIdx].isCompleted;
    activeDraft.data[exIdx].isCompleted = newCompletedState;
    
    if (newCompletedState) {
        stopRestTimer();
        carouselStopRest();
    }

    // NYHET: Uppdatera statusen på ALLA set i övningen så att de matchar övningens nya läge
    if (activeDraft.data[exIdx].sets_data && activeDraft.data[exIdx].sets_data.length > 0) {
        activeDraft.data[exIdx].sets_data.forEach(set => {
            set.userConfirmed = newCompletedState;
        });
    }

    await persistActiveWorkout();
    
    // NYHET: Uppdatera den globala mätaren i headern direkt efter ändringen
    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0;
        let totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }

    if (newCompletedState) {
        renderCarouselNav();
        renderCarouselDots();
        renderCarouselCard();
        const nextUndone = activeDraft.workout.exercises.findIndex((_, i) => i > exIdx && !activeDraft.data[i]?.isCompleted);
        if (nextUndone !== -1) {
            setTimeout(() => carouselGoTo(nextUndone), 350);
        }
    } else {
        renderCarouselNav();
        renderCarouselDots();
        renderCarouselCard();
    }
}

function carouselGoTo(i) {
    if (i === carouselCurrentIndex) return;
    if (carouselNavDragInProgress) return;
    const dir = i > carouselCurrentIndex ? 1 : -1;

    carouselStopRest();
    stopRestTimer();

    const card = carouselFocusModeActive
        ? document.getElementById('focus-ex-card')
        : document.getElementById('carousel-ex-card');

    if (card) {
        card.style.transition = 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease';
        card.style.transform = `translateX(${dir * 35}px)`;
        card.style.opacity = '0';
    }

    setTimeout(async () => {
        carouselCurrentIndex = i;
        if (!activeDraft.ui_state) activeDraft.ui_state = {};
        activeDraft.ui_state.currentExerciseIndex = i;
        activeDraft.ui_state.openExercises = [i];
        await persistActiveWorkout();

        const prevActive = document.querySelector('.carousel-ex-thumb.active');
        if (prevActive) prevActive.classList.remove('active');

        const newActive = document.getElementById(`carousel-thumb-${i}`);
        if (newActive) {
            newActive.classList.add('active');
            const nameEl = newActive.querySelector('.carousel-ex-thumb-name');
            if (nameEl) nameEl.style.color = '#22d3ee';
            newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }

        document.querySelectorAll('.carousel-ex-thumb').forEach((t, idx) => {
            const svgWrap = t.querySelector('div:not(.carousel-drag-handle)');
            if (svgWrap) svgWrap.style.opacity = idx === i ? '1' : '0.5';
            const nameEl = t.querySelector('.carousel-ex-thumb-name');
            if (nameEl) nameEl.style.color = idx === i ? '#22d3ee' : (activeDraft.data[idx]?.isCompleted ? '#22c55e' : '#64748b');
        });

        renderCarouselDots();

        if (carouselFocusModeActive) {
            renderFocusCard();
            updateFocusProgress();
        } else {
            renderCarouselCard();
        }

        if (card) {
            card.style.transition = 'none';
            card.style.transform = `translateX(${dir * 35}px)`;
            card.style.opacity = '0';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    card.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease';
                    card.style.transform = 'translateX(0)';
                    card.style.opacity = '1';
                });
            });
        }
    }, 200);
}

function carouselNext() { if (carouselCurrentIndex < activeDraft.workout.exercises.length - 1) carouselGoTo(carouselCurrentIndex + 1); }
function carouselPrev() { if (carouselCurrentIndex > 0) carouselGoTo(carouselCurrentIndex - 1); }

function initCarouselSwipe() {
    const ca = document.getElementById('carousel-card-area');
    if (!ca || ca.dataset.swipeInit) return;
    ca.dataset.swipeInit = 'true';
    let sx = 0, sy = 0, isH = null;
    ca.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; isH = null; }, { passive: true });
    ca.addEventListener('touchmove', e => {
        if (isH === null) { const dx = Math.abs(e.touches[0].clientX - sx), dy = Math.abs(e.touches[0].clientY - sy); if (dx > 8 || dy > 8) isH = dx > dy; }
        if (isH && e.cancelable) e.preventDefault();
    }, { passive: false });
    ca.addEventListener('touchend', e => {
        if (!isH) return;
        const dx = e.changedTouches[0].clientX - sx;
       if (dx < -50) carouselNext(); else if (dx > 50) carouselPrev();
        isH = null;
    });
}

function initCarouselDragAndDrop() {
    const navBar = document.getElementById('carousel-nav-bar-inner');
    if (!navBar || typeof Draggable === 'undefined') return;
    const thumbs = Array.from(navBar.querySelectorAll('.carousel-ex-thumb'));
    if (thumbs.length === 0) return;

    thumbs.forEach(t => {
        const existing = Draggable.get(t);
        if (existing) existing.kill();
    });

    thumbs.forEach((thumb) => {
        const handle = thumb.querySelector('.carousel-drag-handle');
        if (!handle) return;
        handle.style.touchAction = 'none';
        const thumbWidth = () => thumb.offsetWidth + 7;

        Draggable.create(thumb, {
            type: 'x',
            trigger: handle,
            zIndexBoost: false,
            lockAxis: true,
            onDragStart: function () {
                carouselNavDragInProgress = true;
                gsap.to(thumb, { scale: 1.05, boxShadow: '0 8px 20px rgba(0,0,0,0.5)', duration: 0.2 });
                gsap.set(thumb, { zIndex: 100 });
            },
            onDrag: function () {
                const currentOrder = Array.from(navBar.querySelectorAll('.carousel-ex-thumb'));
                const draggedIdx = currentOrder.indexOf(thumb);
                const movedSteps = Math.round(this.x / thumbWidth());
                currentOrder.forEach((other, otherIdx) => {
                    if (other === thumb) return;
                    const diff = otherIdx - draggedIdx;
                    if (movedSteps > 0 && diff > 0 && diff <= movedSteps) {
                        gsap.to(other, { x: -thumbWidth(), duration: 0.2, ease: 'power2.out' });
                    } else if (movedSteps < 0 && diff < 0 && diff >= movedSteps) {
                        gsap.to(other, { x: thumbWidth(), duration: 0.2, ease: 'power2.out' });
                    } else {
                        gsap.to(other, { x: 0, duration: 0.2, ease: 'power2.out' });
                    }
                });
            },
            onDragEnd: async function () {
    const currentOrder = Array.from(navBar.querySelectorAll('.carousel-ex-thumb'));
    const draggedIdx = currentOrder.indexOf(thumb);
    const movedSteps = Math.round(this.x / thumbWidth());
    const newIdx = Math.max(0, Math.min(currentOrder.length - 1, draggedIdx + movedSteps));

    // Döda alla tweens men RENSA INTE props — rendera om direkt istället
    // så att GSAP aldrig hinner hoppa tillbaka till gamla positioner
    gsap.killTweensOf(thumb);
    currentOrder.forEach(t => gsap.killTweensOf(t));

    setTimeout(() => { carouselNavDragInProgress = false; }, 300);

    if (newIdx === draggedIdx) {
        renderCarouselNav();
        return;
    }

    const currentlyViewedName = activeDraft.workout.exercises[carouselCurrentIndex]?.name;

    const exArr = activeDraft.workout.exercises;
    const dataArr = activeDraft.data;
    const [movedEx] = exArr.splice(draggedIdx, 1);
    const [movedData] = dataArr.splice(draggedIdx, 1);
    exArr.splice(newIdx, 0, movedEx);
    dataArr.splice(newIdx, 0, movedData);

    if (activeDraft.ui_state?.openNotes) {
        activeDraft.ui_state.openNotes = activeDraft.ui_state.openNotes.map(idx => {
            if (idx === draggedIdx) return newIdx;
            if (draggedIdx < newIdx && idx > draggedIdx && idx <= newIdx) return idx - 1;
            if (draggedIdx > newIdx && idx < draggedIdx && idx >= newIdx) return idx + 1;
            return idx;
        });
    }

    const newViewedIdx = exArr.findIndex(ex => ex.name === currentlyViewedName);
    carouselCurrentIndex = newViewedIdx !== -1 ? newViewedIdx : carouselCurrentIndex;

    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    activeDraft.ui_state.currentExerciseIndex = carouselCurrentIndex;

await persistActiveWorkout();

navBar.style.opacity = '0';
requestAnimationFrame(() => {
    renderCarouselNav();
    renderCarouselDots();
    renderCarouselCard();
    requestAnimationFrame(() => {
        navBar.style.opacity = '1';
    });
});

setTimeout(() => {
    const active = document.getElementById(`carousel-thumb-${carouselCurrentIndex}`);
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}, 50);
}
        });
    });
}

function carouselToggleRestBadge() {
    const dd = document.getElementById('carousel-rest-dropdown');
    if (!dd) return;
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

// Uppdaterad så att den justerar de nya elementen inuti övningskortet
function carouselRestAdjust(delta) {
    if (carouselRestActive) {
        carouselRestSeconds = Math.max(0, carouselRestSeconds + delta);
        restTimerSeconds = carouselRestSeconds;
    }
    const ddTime = document.getElementById('carousel-rest-dropdown-time');
    if (ddTime) {
        ddTime.textContent = formatRestTime(carouselRestActive ? carouselRestSeconds : 120);
    }
    const badgeTime = document.getElementById('carousel-rest-badge-time');
    if (badgeTime && carouselRestActive) {
        badgeTime.textContent = formatRestTime(carouselRestSeconds);
    }
}

function carouselRestStart() {
    const firstUnconfirmed = activeDraft?.data[carouselCurrentIndex]?.sets_data?.findIndex(s => !s.userConfirmed && s.rest);
    const restSecs = firstUnconfirmed !== -1 && firstUnconfirmed !== undefined
        ? parseInt(activeDraft.data[carouselCurrentIndex].sets_data[firstUnconfirmed - 1]?.rest || '120')
        : 120;
    carouselStartRest(restSecs);
}

function carouselRestStop() {
    clearInterval(carouselRestInterval);
    carouselRestActive = false;
    carouselRestSeconds = 0;
    if (typeof restTimerActive !== 'undefined') restTimerActive = false;
    renderCarouselCard();
}

function carouselToggleNote(exIdx) {
    if (!activeDraft.ui_state.openNotes) activeDraft.ui_state.openNotes = [];

    const existingTa = document.querySelector(`.carousel-note-input[data-ex="${exIdx}"], #note-input-${exIdx}`);
    if (existingTa) {
        activeDraft.data[exIdx].note = existingTa.value;
    }
    
    const noteSpan = document.querySelector(`[onclick="carouselToggleNote(${exIdx})"] span:first-child`);
    if (noteSpan) {
        const hasNote = !!(activeDraft.data[exIdx].note && activeDraft.data[exIdx].note.trim());
        noteSpan.innerHTML = `📝${hasNote ? '<span style="position:absolute;top:-2px;right:-2px;width:6px;height:6px;background:#fde047;border-radius:50%;"></span>' : ''}`;
    }

    const idx = activeDraft.ui_state.openNotes.indexOf(exIdx);
    if (idx > -1) {
        activeDraft.ui_state.openNotes.splice(idx, 1);
    } else {
        activeDraft.ui_state.openNotes.push(exIdx);
    }

    renderCarouselCard();

    setTimeout(() => {
        const ta = document.querySelector(`.carousel-note-input[data-ex="${exIdx}"]`) || document.getElementById(`note-input-${exIdx}`);
        if (ta && activeDraft.ui_state.openNotes.includes(exIdx)) ta.focus();
    }, 50);
}

function updateWorkoutProgress(completedSets, totalSets) {
    // Sätt texten (t.ex. "6 / 14 set")
    document.getElementById('workout-sets-progress').innerText = `${completedSets} / ${totalSets} set`;
    
    // Räkna ut procenten
    const percentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    
    // Fyll på linjen i botten av kortet
    document.getElementById('workout-progress-bar').style.width = `${percentage}%`;
}

function renderFocus() {
    const layout = localStorage.getItem('workoutLayoutMode');
    const inCarousel = layout === 'carousel' && carouselFocusModeActive;
    const container = inCarousel
        ? document.getElementById('carousel-card-area')
        : document.getElementById('focus-view');
    if (!container || !activeDraft) return;
    const exercises = activeDraft.workout.exercises;
    if (!exercises || exercises.length === 0) return;
    if (activeDraft.ui_state && typeof activeDraft.ui_state.currentExerciseIndex === 'number') {
        carouselCurrentIndex = activeDraft.ui_state.currentExerciseIndex;
    }
    if (inCarousel) {
        container.innerHTML = `
            <div id="focus-rest-timer-bar"></div>
            <div class="carousel-ex-card" id="focus-ex-card"></div>`;
    } else {
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:2px 4px 8px;">
                <div onclick="setWorkoutLayout('list')" style="display:flex; align-items:center; gap:5px; color:#64748b; font-size:12px; font-weight:700; cursor:pointer;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    Exit focus
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                        <div onclick="focusAdjustTextScale(-1)" style="padding:5px 9px; font-size:11px; font-weight:800; color:#64748b; cursor:pointer; border-right:1px solid rgba(255,255,255,0.08);">A−</div>
                        <div onclick="focusAdjustTextScale(1)" style="padding:5px 9px; font-size:14px; font-weight:800; color:#94a3b8; cursor:pointer;">A+</div>
                    </div>
                    <div id="focus-progress-text" style="font-size:14px; font-weight:900; color:#22d3ee;"></div>
                </div>
            </div>
            <div style="height:3px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden; margin:0 2px 10px;">
                <div id="focus-progress-bar" style="width:0%; height:100%; background:#22d3ee; transition:width 0.3s ease;"></div>
            </div>
            <div class="carousel-nav-bar" id="focus-nav-bar-inner"></div>
            <div id="focus-rest-timer-bar"></div>
            <div class="carousel-card-area" id="focus-card-area">
                <div class="carousel-ex-card" id="focus-ex-card"></div>
            </div>`;
    }
    if (!inCarousel) {
        renderFocusNav();
    }
    renderFocusCard();
    renderRestTimer();
    initFocusSwipe();
    updateFocusProgress();
}
function updateFocusProgress() {
    const el = document.getElementById('focus-progress-text');
    const bar = document.getElementById('focus-progress-bar');
    if (!el || !activeDraft.data) return;
    let totalCompleted = 0, total = 0;
    activeDraft.data.forEach(d => {
        if (d && d.sets_data) {
            total += d.sets_data.length;
            totalCompleted += d.sets_data.filter(s => s.userConfirmed).length;
        }
    });
    el.textContent = `${totalCompleted} / ${total} set`;
    if (bar) bar.style.width = total > 0 ? `${(totalCompleted / total) * 100}%` : '0%';
}
function renderFocusNav() {
    const navBar = document.getElementById('focus-nav-bar-inner');
    if (!navBar || !activeDraft) return;
    const exercises = activeDraft.workout.exercises;
    const data = activeDraft.data;
    navBar.innerHTML = exercises.map((ex, i) => {
        const isDone = data[i]?.isCompleted;
        const isActive = i === carouselCurrentIndex;
        const svg = getExSVG(ex.target, 'small');
       return `<div class="carousel-ex-thumb${isDone ? ' done' : isActive ? ' active' : ''}" id="focus-thumb-${i}" onclick="focusGoTo(${i})" style="position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:6px 4px 6px;">
            ${isDone ? `<div style="position:absolute; top:5px; right:5px; width:8px; height:8px; border-radius:50%; background:#22c55e;"></div>` : ''}
            <div class="carousel-drag-handle" style="display:flex; align-items:center; justify-content:center; cursor:grab; width:100%; opacity:${isDone ? 0.25 : isActive ? 1 : 0.3};">
                <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
                    <circle cx="3" cy="2" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="11" cy="2" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="3" cy="7" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="11" cy="7" r="1.3" fill="${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#94a3b8'}"/>
                    <circle cx="7" cy="2" r="1.3" fill="${isActive ? 'rgba(34,211,238,0.4)' : isDone ? '#22c55e' : '#94a3b8'}"/>
                    <circle cx="7" cy="7" r="1.3" fill="${isActive ? 'rgba(34,211,238,0.4)' : isDone ? '#22c55e' : '#94a3b8'}"/>
                </svg>
            </div>
            <div style="width:22px; height:22px; border-radius:50%; border:1.5px solid ${isDone ? '#22c55e' : isActive ? '#22d3ee' : 'rgba(255,255,255,0.25)'}; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:11px; font-weight:900; color:${isActive ? '#22d3ee' : isDone ? '#22c55e' : '#fff'};">${i + 1}</span>
            </div>
            <span style="font-size:8px; font-weight:800; display:block; line-height:1.2; text-align:center; color:${isDone ? '#22c55e' : isActive ? '#22d3ee' : '#e2e8f0'}; padding:0 3px;">${ex.name}</span>
        </div>`;
    }).join('');
    setTimeout(() => {
        const active = document.getElementById(`focus-thumb-${carouselCurrentIndex}`);
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 50);
    initFocusDragAndDrop();
}
function renderFocusCard() {
    const card = document.getElementById('focus-ex-card');
    if (!card || !activeDraft) return;
    const i = carouselCurrentIndex;
    const ex = activeDraft.workout.exercises[i];
    const exData = activeDraft.data[i];
    if (!ex || !exData) return;
    const dropdownEl = document.getElementById('focus-rest-dropdown');
    const wasDropdownOpen = dropdownEl ? (dropdownEl.style.display === 'block') : false;
    const isNoteOpen = activeDraft.ui_state?.openNotes?.includes(i) || false;
    const isDone = exData.isCompleted;
    card.className = 'carousel-ex-card';
    if (isDone) card.classList.add('is-done');
    const completedSets = exData.sets_data ? exData.sets_data.filter(s => s.userConfirmed).length : 0;
    const totalSets = exData.sets_data ? exData.sets_data.length : 0;
    const firstUnconfirmed = exData.sets_data ? exData.sets_data.findIndex(s => !s.userConfirmed) : -1;
    const catDisplay = CATEGORY_DISPLAY[ex.target] || ex.target || '';
    const isTimerDisabled = !!activeDraft.restTimerDisabled;
    const timerColor = restTimerSeconds <= 10 ? '#ef4444' : '#f59e0b';
    const currentMins = String(Math.floor(restTimerSeconds / 60)).padStart(1, '0');
    const currentSecs = String(restTimerSeconds % 60).padStart(2, '0');
    const liveTimeStr = `${currentMins}:${currentSecs}`;
    const nextRestSeconds = parseInt(exData.sets_data?.find(s => !s.userConfirmed)?.rest || 120);
    const defaultMins = String(Math.floor(nextRestSeconds / 60)).padStart(1, '0');
    const defaultSecs = String(nextRestSeconds % 60).padStart(2, '0');
    const defaultTimeStr = `${defaultMins}:${defaultSecs}`;
    const isCounting = restTimerActive && restTimerSeconds > 0;
    const isCardio = isCardioExercise(ex);
    let setsHtml = `<div style="margin-top:4px;">
        <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:5px; align-items:center;">
            <small style="text-align:left; padding-left:5px; color:var(--text-light); font-size:9px; font-weight:700;">${isCardio ? '' : 'SET'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'TID' : 'KG'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'DIST (km)' : 'REPS'}</small>
            <small style="text-align:center; color:var(--text-light); font-size:9px;">${isCardio ? 'PACE' : 'REST (S)'}</small>
            <span></span>
        </div>`;
    if (exData.sets_data) {
        exData.sets_data.forEach((set, sIdx) => {
            const isLocked = isDone;
            const isCurrent = !set.userConfirmed && !isDone && sIdx === firstUnconfirmed;
            const showSuccess = set.userConfirmed || isDone;
            const circleColor = showSuccess ? '#22c55e' : (isCurrent ? '#facc15' : '#f59e0b');
            const statusContent = showSuccess ? '✅' : (isCardio ? '✓' : `#${sIdx + 1}`);
            const inputOpacity = isCurrent ? '1' : '0.3';
            setsHtml += `
            <div style="display:grid; grid-template-columns: 40px 1.5fr 1fr 1fr 30px; gap:8px; margin-bottom:8px; align-items:center; transition:opacity 0.2s ease; position:relative; overflow:visible;">
                <div class="${isCurrent ? 'pulse-ring' : ''}" onclick="${isLocked && !isDone ? '' : `focusConfirmSet(${i}, ${sIdx})`}"
                    style="width:32px; height:32px; border-radius:50%; border:2px solid ${circleColor}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:800; background:${showSuccess ? 'rgba(34,197,94,0.2)' : isCurrent ? 'rgba(250,204,21,0.15)' : 'rgba(245,158,11,0.05)'}; color:${circleColor}; opacity:1;">
                    ${statusContent}
                </div>
                ${isCardio
                    ? `<input type="text" inputmode="numeric" id="fcdm-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px 4px; font-size:15px; min-width:0; opacity:${inputOpacity}; text-align:center; font-family:monospace; letter-spacing:2px; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.duration || '__:__'}" ${isLocked ? 'readonly' : ''} onfocus="initCardioTimeInput('fcdm-${i}-${sIdx}', ${i}, ${sIdx})">`
                    : `<input type="text" inputmode="decimal" id="fw-${i}-${sIdx}" class="log-input weight-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.weight || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'weight')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                ${isCardio
                    ? `<input type="text" inputmode="decimal" id="fck-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.distance || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'distance')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                    : `<input type="text" inputmode="decimal" id="fr-${i}-${sIdx}" class="log-input reps-input" data-ex="${i}" data-set="${sIdx}" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; ${isCurrent ? 'border-color:rgba(245,158,11,0.6);' : ''}" value="${set.reps || ''}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'reps')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`}
                ${isCardio
                    ? `<div id="pace-${i}-${sIdx}" style="display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#22d3ee; font-family:monospace; white-space:nowrap; opacity:${isCurrent ? '1' : '0.3'};">${calcPace(set.duration, set.distance)}</div>`
                    : (sIdx < exData.sets_data.length - 1
                        ? `<input type="text" inputmode="decimal" id="fv-${i}-${sIdx}" class="log-input" style="margin:0; padding:12px; font-size:18px; opacity:${inputOpacity}; border-color:${isCurrent ? 'rgba(245,158,11,0.6)' : 'rgba(52,152,219,0.3)'};" value="${set.rest || '120'}" placeholder="" ${isLocked ? 'readonly' : ''} oninput="updateSetDataOnly(this, ${i}, ${sIdx}, 'rest')" onfocus="if(!this.readOnly) handleInputFocus(this)" onblur="if(!this.readOnly) handleInputBlur(this)">`
                        : '<div></div>')}
                <button onclick="removeSetFromExercise(${i}, ${sIdx})" style="background:none; border:none; color:var(--danger); font-size:16px; opacity: ${showSuccess ? '0.1' : '0.8'};" ${showSuccess ? 'disabled' : ''}>×</button>
            </div>`;
            if (isCurrent && sIdx === firstUnconfirmed && !isCardio) {
                setsHtml += `
                <div style="grid-column: 2 / span 3; margin:-4px 0 8px 0; padding-left:2px; opacity:0.8; font-size:10px; color:var(--primary); font-weight:600; letter-spacing:0.3px;">
                    💡 Select ${statusContent} to lock & continue
                </div>`;
            }
        });
    }
    setsHtml += `</div>`;
    card.innerHTML = `
        <div style="padding:10px 14px 8px; display:flex; align-items:flex-start; justify-content:space-between; gap:8px; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                <div style="font-size:18px; font-weight:900; color:${isDone ? 'var(--text-light)' : 'var(--text)'}; text-decoration:${isDone ? 'line-through' : 'none'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ex.name}</div>
                <div onclick="const z=document.getElementById('focus-anim-modal-${i}'); z.style.display=z.style.display==='flex'?'none':'flex';" style="display:flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:20px;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);cursor:pointer;flex-shrink:0;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <div onclick="const z=document.getElementById('focus-menu-${i}'); z.style.display=z.style.display==='block'?'none':'block';" style="width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#94a3b8;font-size:13px;letter-spacing:1px;flex-shrink:0;">⋯</div>
            </div>
        </div>
        <div id="focus-menu-${i}" style="display:none; position:absolute; top:54px; right:14px; background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:6px; z-index:50; min-width:160px; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
            <div onclick="document.getElementById('focus-menu-${i}').style.display='none'; focusToggleNote(${i});" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;position:relative;">
                <span style="font-size:14px;">📝${exData.note ? '<span style="position:absolute;top:6px;left:18px;width:6px;height:6px;background:#fde047;border-radius:50%;"></span>' : ''}</span><span style="color:#f8fafc;">Note</span>
            </div>
            <div onclick="document.getElementById('focus-menu-${i}').style.display='none'; ${isDone ? '' : `openReplaceExerciseModal(${i})`}" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg><span style="color:#22d3ee;">Swap exercise</span>
            </div>
            <div onclick="document.getElementById('focus-menu-${i}').style.display='none'; ${isDone ? '' : `removeActiveExercise(${i})`}" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span style="color:#ef4444;">Remove</span>
            </div>
        </div>
        <div id="focus-rest-dropdown" style="display:${wasDropdownOpen ? 'block' : 'none'}; margin:0 14px 6px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2); border-radius:12px; padding:10px 12px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div>
                        <div style="font-size:8px; color:#92400e; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Rest Timer</div>
                        <div style="font-size:22px; font-weight:900; color:${isTimerDisabled ? '#64748b' : (isCounting ? timerColor : '#f59e0b')}; font-family:monospace;" id="focus-rest-dropdown-time">
                            ${isTimerDisabled ? '--:--' : (isCounting ? liveTimeStr : defaultTimeStr)}
                        </div>
                    </div>
                    <div style="display:flex; background:rgba(0,0,0,0.4); border-radius:10px; border:1px solid rgba(255,255,255,0.08); overflow:hidden; height:26px; align-items:center; margin-left:4px;">
                        <button onclick="activeDraft.restTimerDisabled=false; persistActiveWorkout(); renderFocusCard(); renderRestTimer();"
                            style="padding:0 10px; height:100%; font-size:10px; font-weight:700; cursor:pointer; border:none; transition:all 0.15s; background:${!isTimerDisabled ? 'rgba(245,158,11,0.25)' : 'transparent'}; color:${!isTimerDisabled ? '#f59e0b' : 'rgba(255,255,255,0.2)'};">On</button>
                        <button onclick="clearInterval(restTimerInterval); restTimerActive=false; restTimerSeconds=0; restTimerExIdx=null; activeDraft.restTimerDisabled=true; persistActiveWorkout(); renderFocusCard(); renderRestTimer();"
                            style="padding:0 10px; height:100%; font-size:10px; font-weight:700; cursor:pointer; border:none; transition:all 0.15s; background:${isTimerDisabled ? 'rgba(245,158,11,0.25)' : 'transparent'}; color:${isTimerDisabled ? '#f59e0b' : 'rgba(255,255,255,0.2)'};">Off</button>
                    </div>
                </div>
                <div style="display:flex; gap:4px; align-items:center;">
                    <button onclick="carouselRestAdjust(-15)" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:4px 6px;font-size:9px;color:#f59e0b;cursor:pointer;white-space:nowrap;" ${isTimerDisabled ? 'disabled' : ''}>−15s</button>
                    <button onclick="carouselRestAdjust(30)" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:4px 6px;font-size:9px;color:#f59e0b;cursor:pointer;white-space:nowrap;" ${isTimerDisabled ? 'disabled' : ''}>+30s</button>
                    <button onclick="carouselRestStart()" style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:4px 6px;font-size:9px;font-weight:700;color:#22c55e;cursor:pointer;white-space:nowrap;" ${isTimerDisabled ? 'disabled' : ''}>${isCounting ? 'Restart' : 'Start'}</button>
                </div>
            </div>
        </div>
        <div class="carousel-card-body">
            <div style="font-size:13px; color:${isDone ? '#22c55e' : 'var(--primary)'}; font-weight:800; margin-bottom:12px;">${isDone ? 'DONE ✅' : isCardio ? catDisplay : `${catDisplay}${catDisplay ? ' · ' : ''}${completedSets}/${totalSets} sets`}</div>
            ${isNoteOpen ? `<div style="margin-bottom:10px;">
                <textarea id="note-input-${i}" class="carousel-note-input" data-ex="${i}" placeholder="Add a note for this exercise..."
                    oninput="updateExerciseNote(this, ${i})"
                    style="width:100%; min-height:60px; padding:10px; border-radius:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(253,224,71,0.2); color:#fff; font-size:13px; font-family:inherit; resize:vertical;">${exData.note || ''}</textarea>
            </div>` : ''}
            ${setsHtml}
            <div style="display:flex; gap:6px; align-items:center; margin-top:12px; margin-bottom:8px; width:100%;">
                <button style="display:${isCardio ? 'none' : 'flex'};align-items:center;gap:6px;padding:9px 14px;background:transparent;border:1.5px dashed rgba(34,211,238,0.3);color:#22d3ee;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;${isDone ? 'opacity:0.3;pointer-events:none;' : ''}" onclick="addSetToExercise(${i})" ${isDone ? 'disabled' : ''}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add set
                </button>
                <button style="display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 14px;background:${isDone ? 'rgba(148,163,184,0.25)' : 'rgba(34,197,94,0.1)'};color:${isDone ? '#fff' : '#22c55e'};border-radius:10px;font-size:13px;font-weight:700;border:${isDone ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(34,197,94,0.25)'};cursor:pointer;flex:1;" onclick="focusToggleDone(${i})">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isDone ? '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="9 12 11 14 15 10"></polyline>'}</svg>
                    ${isDone ? 'Undo' : 'Finish exercise'}
                </button>
            </div>
        </div>
        <div id="focus-anim-modal-${i}" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;align-items:center;justify-content:center;" onclick="this.style.display='none'">
            <div style="background:#1e293b;border-radius:16px;padding:20px;width:90%;max-width:400px;">
                <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Animation</div>
                ${getExSVG(ex.target, 'large')}
                <div style="font-size:11px;color:#475569;text-align:center;margin-top:10px;">Animation coming soon</div>
            </div>
        </div>`;
    applyFocusTextScale();
}
function focusToggleRestBadge() {
    const dd = document.getElementById('focus-rest-dropdown');
    if (dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}
function focusToggleNote(exIdx) {
    if (!activeDraft.ui_state.openNotes) activeDraft.ui_state.openNotes = [];
    const idx = activeDraft.ui_state.openNotes.indexOf(exIdx);
    if (idx > -1) {
        activeDraft.ui_state.openNotes.splice(idx, 1);
    } else {
        activeDraft.ui_state.openNotes.push(exIdx);
    }
    renderFocusCard();
    setTimeout(() => {
        const ta = document.getElementById(`note-input-${exIdx}`);
        if (ta && activeDraft.ui_state.openNotes.includes(exIdx)) ta.focus();
    }, 50);
}
async function focusConfirmSet(exIdx, setIdx) {
    const allInputs = document.querySelectorAll(`[id^="fw-${exIdx}-"], [id^="fr-${exIdx}-"], [id^="fv-${exIdx}-"], [id^="fcdm-${exIdx}-"], [id^="fcds-${exIdx}-"], [id^="fck-${exIdx}-"]`);
    allInputs.forEach(inp => {
        const parts = inp.id.split('-');
        const sIdx2 = parseInt(parts[parts.length - 1]);
        const type = parts[0];
        if (!isNaN(sIdx2) && activeDraft.data[exIdx]?.sets_data?.[sIdx2]) {
            if (type === 'fw') activeDraft.data[exIdx].sets_data[sIdx2].weight = inp.value;
            if (type === 'fr') activeDraft.data[exIdx].sets_data[sIdx2].reps = inp.value;
            if (type === 'fv') activeDraft.data[exIdx].sets_data[sIdx2].rest = inp.value;
            if (type === 'fck') activeDraft.data[exIdx].sets_data[sIdx2].distance = inp.value;
        }
    });
    const restVal = parseInt(activeDraft.data[exIdx].sets_data[setIdx].rest) || 120;
    const currentState = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    activeDraft.data[exIdx].sets_data[setIdx].userConfirmed = !currentState;
    const isNowConfirmed = activeDraft.data[exIdx].sets_data[setIdx].userConfirmed;
    const isLastSet = setIdx === activeDraft.data[exIdx].sets_data.length - 1;
    if (isNowConfirmed && !isLastSet) {
        stopRestTimer();
        carouselStopRest();
        carouselStartRest(restVal);
    } else {
        stopRestTimer();
        carouselStopRest();
    }
    await persistActiveWorkout();
    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0, totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }
    renderFocusCard();
    updateFocusProgress();
}
async function focusToggleDone(exIdx) {
    const newCompletedState = !activeDraft.data[exIdx].isCompleted;
    activeDraft.data[exIdx].isCompleted = newCompletedState;
    if (newCompletedState) {
        stopRestTimer();
        carouselStopRest();
    }
    if (activeDraft.data[exIdx].sets_data && activeDraft.data[exIdx].sets_data.length > 0) {
        activeDraft.data[exIdx].sets_data.forEach(set => { set.userConfirmed = newCompletedState; });
    }
    await persistActiveWorkout();
    if (typeof updateWorkoutProgress === 'function' && activeDraft.data) {
        let totalWorkoutCompletedSets = 0, totalWorkoutSets = 0;
        activeDraft.data.forEach(exerciseData => {
            if (exerciseData && exerciseData.sets_data) {
                totalWorkoutSets += exerciseData.sets_data.length;
                totalWorkoutCompletedSets += exerciseData.sets_data.filter(s => s.userConfirmed).length;
            }
        });
        updateWorkoutProgress(totalWorkoutCompletedSets, totalWorkoutSets);
    }
    renderFocusNav();
    renderFocusCard();
    updateFocusProgress();
    renderCarouselNav();
    renderCarouselDots();
    if (newCompletedState) {
        const nextUndone = activeDraft.workout.exercises.findIndex((_, idx) => idx > exIdx && !activeDraft.data[idx]?.isCompleted);
        if (nextUndone !== -1) {
            setTimeout(() => focusGoTo(nextUndone), 350);
        }
    }
}
function focusGoTo(i) {
    if (i === carouselCurrentIndex || i < 0 || i >= activeDraft.workout.exercises.length) return;
    if (carouselNavDragInProgress) return;
    const card = document.getElementById('focus-ex-card');
    if (!card) return;
    const dir = i > carouselCurrentIndex ? 1 : -1;
    card.style.transition = 'transform 0.1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.1s ease';
    card.style.transform = `translateX(${dir * 35}px)`;
    card.style.opacity = '0';
    carouselStopRest();
    stopRestTimer();
    setTimeout(async () => {
        carouselCurrentIndex = i;
        if (!activeDraft.ui_state) activeDraft.ui_state = {};
        activeDraft.ui_state.currentExerciseIndex = i;
        await persistActiveWorkout();
        renderCarouselNav();
        renderCarouselDots();
        const prevActive = document.querySelector('#focus-nav-bar-inner .carousel-ex-thumb.active');
        if (prevActive) prevActive.classList.remove('active');
        const newActive = document.getElementById(`focus-thumb-${i}`);
        if (newActive) {
            newActive.classList.add('active');
            const nameEl = newActive.querySelector('.carousel-ex-thumb-name');
            if (nameEl) nameEl.style.color = '#22d3ee';
            newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        document.querySelectorAll('#focus-nav-bar-inner .carousel-ex-thumb').forEach((t, idx) => {
            const svgWrap = t.querySelector('div:not(.carousel-drag-handle)');
            if (svgWrap) svgWrap.style.opacity = idx === i ? '1' : '0.5';
            const nameEl = t.querySelector('.carousel-ex-thumb-name');
            if (nameEl) nameEl.style.color = idx === i ? '#22d3ee' : (activeDraft.data[idx]?.isCompleted ? '#22c55e' : '#64748b');
        });
        renderFocusCard();
        updateFocusProgress();
        card.style.transition = 'none';
        card.style.transform = `translateX(${dir * 35}px)`;
        card.style.opacity = '0';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                card.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease';
                card.style.transform = 'translateX(0)';
                card.style.opacity = '1';
            });
        });
    }, 200);
}
function initFocusSwipe() {
    const area = document.getElementById('focus-card-area');
    if (!area) return;
    let startX = 0, startY = 0;
    area.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });
    area.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -50) focusGoTo(carouselCurrentIndex + 1);
            else if (dx > 50) focusGoTo(carouselCurrentIndex - 1);
        }
    }, { passive: true });
}

function initFocusDragAndDrop() {
    const navBar = document.getElementById('focus-nav-bar-inner');
    if (!navBar || typeof Draggable === 'undefined') return;
    const thumbs = Array.from(navBar.querySelectorAll('.carousel-ex-thumb'));
    if (thumbs.length === 0) return;

    thumbs.forEach(t => {
        const existing = Draggable.get(t);
        if (existing) existing.kill();
    });

    thumbs.forEach((thumb) => {
        const handle = thumb.querySelector('.carousel-drag-handle');
        if (!handle) return;
        handle.style.touchAction = 'none';
        const thumbWidth = () => thumb.offsetWidth + 7;

        Draggable.create(thumb, {
            type: 'x',
            trigger: handle,
            zIndexBoost: false,
            lockAxis: true,
            onDragStart: function () {
                carouselNavDragInProgress = true;
                gsap.to(thumb, { scale: 1.05, boxShadow: '0 8px 20px rgba(0,0,0,0.5)', duration: 0.2 });
                gsap.set(thumb, { zIndex: 100 });
            },
            onDrag: function () {
                const currentOrder = Array.from(navBar.querySelectorAll('.carousel-ex-thumb'));
                const draggedIdx = currentOrder.indexOf(thumb);
                const movedSteps = Math.round(this.x / thumbWidth());
                currentOrder.forEach((other, otherIdx) => {
                    if (other === thumb) return;
                    const diff = otherIdx - draggedIdx;
                    if (movedSteps > 0 && diff > 0 && diff <= movedSteps) {
                        gsap.to(other, { x: -thumbWidth(), duration: 0.2, ease: 'power2.out' });
                    } else if (movedSteps < 0 && diff < 0 && diff >= movedSteps) {
                        gsap.to(other, { x: thumbWidth(), duration: 0.2, ease: 'power2.out' });
                    } else {
                        gsap.to(other, { x: 0, duration: 0.2, ease: 'power2.out' });
                    }
                });
            },
            onDragEnd: async function () {
    const currentOrder = Array.from(navBar.querySelectorAll('.carousel-ex-thumb'));
    const draggedIdx = currentOrder.indexOf(thumb);
    const movedSteps = Math.round(this.x / thumbWidth());
    const newIdx = Math.max(0, Math.min(currentOrder.length - 1, draggedIdx + movedSteps));

    gsap.killTweensOf(thumb);
    currentOrder.forEach(t => gsap.killTweensOf(t));

    setTimeout(() => { carouselNavDragInProgress = false; }, 300);

    if (newIdx === draggedIdx) {
        renderFocusNav();
        return;
    }

    const currentlyViewedName = activeDraft.workout.exercises[carouselCurrentIndex]?.name;

    const exArr = activeDraft.workout.exercises;
    const dataArr = activeDraft.data;
    const [movedEx] = exArr.splice(draggedIdx, 1);
    const [movedData] = dataArr.splice(draggedIdx, 1);
    exArr.splice(newIdx, 0, movedEx);
    dataArr.splice(newIdx, 0, movedData);

    const newViewedIdx = exArr.findIndex(ex => ex.name === currentlyViewedName);
    carouselCurrentIndex = newViewedIdx !== -1 ? newViewedIdx : carouselCurrentIndex;

    if (!activeDraft.ui_state) activeDraft.ui_state = {};
    activeDraft.ui_state.currentExerciseIndex = carouselCurrentIndex;

   await persistActiveWorkout();

navBar.style.opacity = '0';
requestAnimationFrame(() => {
    renderFocusNav();
    renderFocusCard();
    updateFocusProgress();
    requestAnimationFrame(() => {
        navBar.style.opacity = '1';
    });
});

setTimeout(() => {
    const active = document.getElementById(`focus-thumb-${carouselCurrentIndex}`);
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}, 50);
}
        });
    });
}

let focusTextScaleStep = parseInt(localStorage.getItem('focusTextScaleStep') || '0');

function focusAdjustTextScale(delta) {
    focusTextScaleStep = Math.max(0, Math.min(3, focusTextScaleStep + delta));
    localStorage.setItem('focusTextScaleStep', focusTextScaleStep);
    applyFocusTextScale();
}

function applyFocusTextScale() {
    const card = document.getElementById('focus-ex-card');
    const area = document.getElementById('focus-card-area');
    if (!card || !area) return;
    const scaleMap = { 0: 1, 1: 1.08, 2: 1.16, 3: 1.26 };
    const scale = scaleMap[focusTextScaleStep];
    card.style.transform = `scale(${scale})`;
    card.style.transformOrigin = 'top center';
    area.style.paddingBottom = scale > 1 ? `${(scale - 1) * 300}px` : '0px';
}

let carouselFocusModeActive = false;

function toggleCarouselFocusMode() {
    carouselFocusModeActive = !carouselFocusModeActive;
    const header = document.querySelector('#workout-view > div:first-child');
    const separator = document.getElementById('workout-separator-line');
    const footer = document.querySelector('.workout-footer');
    const transitionStyle = 'opacity 0.4s ease, max-height 0.5s ease';

    if (carouselFocusModeActive) {
        if (header) { header.style.transition = transitionStyle; header.style.opacity = '0'; header.style.maxHeight = '0'; header.style.overflow = 'hidden'; }
        if (separator) { separator.style.transition = 'opacity 0.3s ease, max-height 0.3s ease'; separator.style.opacity = '0'; separator.style.maxHeight = '0'; separator.style.overflow = 'hidden'; }
        if (footer) { footer.style.transition = transitionStyle; footer.style.opacity = '0'; footer.style.maxHeight = '0'; footer.style.overflow = 'hidden'; }

        const toggleEl = document.getElementById('carousel-focus-toggle');
        if (toggleEl) {
            toggleEl.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; width:100%; padding:0 4px;">
                   <div onclick="event.stopPropagation(); toggleCarouselFocusMode();" style="display:flex; align-items:center; gap:7px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:6px 18px; cursor:pointer;">
                        <svg style="transform:rotate(180deg);" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                        <span style="font-size:11px; font-weight:700; color:#64748b;">Exit Focus</span>
                    </div>
                </div>`;
        }

        const cardArea = document.getElementById('carousel-card-area') || document.querySelector('.carousel-card-area');
        if (cardArea) {
            const existingCard = document.getElementById('carousel-ex-card');
            if (existingCard) { existingCard.id = 'carousel-ex-card-hidden'; existingCard.style.display = 'none'; }
            const restBar = document.createElement('div');
            restBar.id = 'focus-rest-timer-bar';
            const focusCard = document.createElement('div');
            focusCard.className = 'carousel-ex-card';
            focusCard.id = 'focus-ex-card';
            cardArea.appendChild(restBar);
            cardArea.appendChild(focusCard);
        }

        renderFocusCard();
        renderRestTimer();
        updateFocusProgress();

    } else {
        if (header) { header.style.transition = transitionStyle; header.style.opacity = '1'; header.style.maxHeight = '500px'; header.style.overflow = ''; }
        if (separator) { separator.style.transition = 'opacity 0.3s ease, max-height 0.3s ease'; separator.style.opacity = '1'; separator.style.maxHeight = '100px'; separator.style.overflow = ''; }
        if (footer) { footer.style.transition = transitionStyle; footer.style.opacity = '1'; footer.style.maxHeight = '500px'; footer.style.overflow = ''; }

        const focusCard = document.getElementById('focus-ex-card');
        if (focusCard) focusCard.remove();
        const focusBar = document.getElementById('focus-rest-timer-bar');
        if (focusBar) focusBar.remove();
        const hiddenCard = document.getElementById('carousel-ex-card-hidden');
        if (hiddenCard) { hiddenCard.id = 'carousel-ex-card'; hiddenCard.style.display = ''; }

        const toggleEl2 = document.getElementById('carousel-focus-toggle');
        if (toggleEl2) {
            toggleEl2.innerHTML = `
                <div style="background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:6px 18px; display:flex; align-items:center; gap:7px;">
                    <svg id="carousel-focus-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="transition:transform 0.3s ease;"><polyline points="18 15 12 9 6 15"/></svg>
                    <span id="carousel-focus-label" style="font-size:11px; font-weight:700; color:#64748b; letter-spacing:0.5px;">Focus view</span>
                </div>`;
        }

        renderCarouselCard();
    }
}
