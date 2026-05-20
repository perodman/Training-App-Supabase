// ===========================================================================
// SUPABASE INITIALISERING
// ===========================================================================
const supabaseUrl = 'https://oixavkihfvbagzlyoocm.supabase.co';
const supabaseKey = 'sb_publishable_v6MqFHOeimJvtx-dZWFn1g_s0YOTUE8'; 
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

// Hämta användar-ID efter inloggning
let currentUserId = null;

async function checkUser() {
    const { data: { user } } = await client.auth.getUser();
    if (user) {
        currentUserId = user.id;
        console.log("Inloggad som:", user.email);
    } else {
        console.log("Inte inloggad. Klicka på inloggningsknappen.");
    }
}

// Kör denna direkt när appen laddas
checkUser();

// ============================================================================
// GLOBALA VARIABLER
// ============================================================================
let programData;
let masterExercises = [];
let workoutHistory = [];
let activeDraft = null;
let calendarOverrides = {};
let currentViewDate = new Date();
let currentExerciseCategory = "Ben";

// Timer-variabler
let timerInterval = null;
let secondsElapsed = 0;
let isTimerRunning = false;

// Touch-hantering
let pressTimer;
let touchTimeout = null;
let isLongPress = false;
let touchStartY = 0;
let hasScrolled = false;

// Temporär övningsval
let temporarySelectedExercises = [];

// User ID (för multi-user support i framtiden)
let currentUserId = "default_user"; // Kan ersättas med Supabase Auth senare


// ============================================================================
// INLOGGNINGSFUNKTIONEN
// ============================================================================

async function loginWithGitHub() {
    const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: window.location.origin // Skickar tillbaka användaren hit efter inlogg
        }
    });
    if (error) console.error("Inloggningsfel:", error.message);
}

// ============================================================================
// SUPABASE DATAHANTERING
// ============================================================================


// Ladda masterExercises från program.json vid appstart
async function loadMasterExercises() {
    console.log("📥 Laddar masterExercises från program.json...");
    
    try {
        const response = await fetch('https://raw.githubusercontent.com/perodman/Training-App-Supabase/main/program.json');
        
        // Kontrollera att svaret är OK
        if (!response.ok) {
            throw new Error('Nätverksfel: ' + response.status);
        }
        
        // Hämta JSON-datan
        const data = await response.json();
        
        // Extrahera övningar
        if (data.routine && data.routine.length > 0) {
            masterExercises = data.routine.flatMap(routine => routine.exercises);
            console.log("✅ Övningar laddade:", masterExercises.length);
        } else {
            console.error("❌ Inga övningar hittades i program.json.");
        }

    } catch (error) {
        console.error("❌ Fel vid laddning från program.json:", error);
        // Hantera fel här, om nödvändigt
    }
}

// Anropa funktionen för att ladda datan
loadMasterExercises();

function renderHome() {
    showView("home-view");
    
    // Punkt 1: Permanent avgränsande linje på startsidan
    const homeView = document.getElementById("home-view");
    const headerP = homeView.querySelector("header p");
    
    // Ta bort ev gamla kopior först för att undvika dubletter vid omladdning
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


// Ladda ALL data från Supabase vid appstart
async function loadFromSupabase() {
    console.log("📥 Laddar data från Supabase...");

    try {
        // Steg 1: Logga in med GitHub
        console.log("📥 Försöker logga in med GitHub...");
        const { user, error: loginError } = await client.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: 'https://oixavkihfvbagzlyoocm.supabase.co/auth/v1/callback',
            },
        });

        if (loginError) {
            console.error("❌ Inloggning misslyckades:", loginError);
            return; // Avbryt om inloggningen misslyckas
        }

        if (!user) {
            console.error("❌ Inloggning misslyckades: Användaren är undefined");
            return; // Avbryt om användaren är undefined
        }

        console.log("✅ Inloggad som:", user);

        // Steg 2: Hämta UUID för den inloggade användaren
        const userId = user.id; // Hämta UUID

        // 1. Ladda workoutHistory
        const { historyData, error: historyError } = await client
            .from('workout_history')
            .select('*')
            .eq('user_id', userId) // Använd UUID här
            .order('workout_date', { ascending: false });

        if (historyError) throw historyError;

        if (historyData && historyData.length > 0) {
            workoutHistory = historyData.map(row => row.workout_data);
            console.log("✅ Träningshistorik laddad:", workoutHistory.length);
        }

        // 2. Ladda calendarOverrides
        const { overridesData, error: overridesError } = await client
            .from('calendar_overrides')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (overridesError && overridesError.code !== 'PGRST116') throw overridesError;

        if (overridesData) {
            calendarOverrides = overridesData.data;
            console.log("✅ Kalenderändringar laddade");
        }

        // 3. Ladda activeDraft
        const { draftData, error: draftError } = await client
            .from('active_draft')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (draftError && draftError.code !== 'PGRST116') throw draftError;

        if (draftData) {
            activeDraft = draftData.data;
            console.log("✅ Aktivt utkast laddat");
        }

        // 4. Ladda customProgram
        const { programDataRow, error: programError } = await client
            .from('custom_program')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (programError && programError.code !== 'PGRST116') throw programError;

        if (programDataRow) {
            programData = programDataRow.data;
            console.log("✅ Anpassat program laddat");
        }

    } catch (error) {
        console.error("❌ Fel vid laddning från Supabase:", error);
        // Fallback till localStorage om Supabase misslyckas
        loadFromLocalStorage();
    }
}

// Fallback: Ladda från localStorage
function loadFromLocalStorage() {
    console.log("📦 Laddar från localStorage (offline-läge)");
    masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]");
    workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
    activeDraft = JSON.parse(localStorage.getItem("activeWorkoutDraft") || "null");
    calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}");
    const savedProgram = JSON.parse(localStorage.getItem("myCustomProgram"));
    if (savedProgram) programData = savedProgram;
}

// Spara ALL data till både Supabase OCH localStorage (HYBRID)
async function saveAll() {
    // 1. ALLTID spara till localStorage först (instant feedback)
    localStorage.setItem("myCustomProgram", JSON.stringify(programData));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
    
    if (activeDraft) {
        localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));
    } else {
        localStorage.removeItem("activeWorkoutDraft");
    }

    // 2. Sedan synka till Supabase i bakgrunden
    try {
        // Spara masterExercises
        const { error: exercisesError } = await client
            .from('master_exercises')
            .upsert({
                user_id: currentUserId,
                masterExercises,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        
        if (exercisesError) throw exercisesError;

        // Spara workoutHistory
        const { error: historyError } = await client
            .from('workout_history')
            .delete()
            .eq('user_id', currentUserId);
        
        if (historyError) throw historyError;

        for (const workout of workoutHistory) {
            const { error: insertError } = await client
                .from('workout_history')
                .insert({
                    user_id: currentUserId,
                    date: workout.date,
                    workout
                });
            
            if (insertError) throw insertError;
        }

        // Spara calendarOverrides
        const { error: overridesError } = await client
            .from('calendar_overrides')
            .upsert({
                user_id: currentUserId,
                calendarOverrides,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        
        if (overridesError) throw overridesError;

        // Spara activeDraft
        if (activeDraft) {
            const { error: draftError } = await client
                .from('active_draft')
                .upsert({
                    user_id: currentUserId,
                    activeDraft,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
            
            if (draftError) throw draftError;
        } else {
            await client.from('active_draft').delete().eq('user_id', currentUserId);
        }

        // Spara customProgram
        if (programData) {
            const { error: programError } = await client
                .from('custom_program')
                .upsert({
                    user_id: currentUserId,
                    programData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
            
            if (programError) throw programError;
        }

        console.log("☁️ Data synkad till Supabase");

    } catch (error) {
        console.error("⚠️ Kunde inte synka till Supabase (offline?)", error);
        // Appen fortsätter fungera med localStorage
    }
}

// ============================================================================
// INITIALISERING
// ============================================================================
async function initApp() {
    // Ladda från Supabase först
    await loadFromSupabase();
 
    // Om ingen data finns i Supabase, ladda från program.json
    if (masterExercises.length === 0) {
        try {
            const response = await fetch("https://raw.githubusercontent.com/perodman/Training-App-Supabase/main/program.json");
            const json = await response.json();
            
            json.routine.forEach(p => {
                p.exercises.forEach(ex => {
                    // Kontrollera om övningen redan finns
                    if (!masterExercises.find(m => m.name === ex.name)) {
                        let animFile = "";
                        if (ex.name === "Deadlift") animFile = "Gemini_Generated_Image_sqtn3ksqtn3ksqtn.mp4";
                        if (ex.name === "Barbell Bench Press") animFile = "Skärmbild 2026-05-11 124104.mp4";
                        
                        // Lägg till övningen i masterExercises
                        masterExercises.push({ 
                            ...ex, 
                            id: Date.now() + Math.random(),
                            animation: animFile 
                        });
                    }
                });
            });
            
            // Sätt programData om den inte redan är satt
            if (!programData) programData = json;
            await saveAll();  // Spara övningarna
        } catch (error) {
            console.error("❌ Kunde inte ladda program.json:", error);
        }
    } else {
        // Uppdatera animationer för befintliga övningar
        masterExercises.forEach(ex => {
            if (ex.name === "Deadlift") ex.animation = "Gemini_Generated_Image_sqtn3ksqtn3ksqtn.mp4";
            if (ex.name === "Barbell Bench Press") ex.animation = "Skärmbild 2026-05-11 124104.mp4";
        });
    }
 
    // Återställ timer om det finns ett aktivt utkast
    if (activeDraft && activeDraft.isStarted) {
        secondsElapsed = activeDraft.secondsElapsed || 0;
        if (activeDraft.wasTimerRunning) {
            startTimer();
        } else {
            updateTimerDisplay();
        }
    }
 
    renderHome();  // Rendera hemsidan
}

// Starta appen
initApp();

// ============================================================================
// VIEW-HANTERING
// ============================================================================
function showView(id) {
    const target = document.getElementById(id);
    if (!target) return;
    
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
    if (video) video.pause();
    
    if (typeof hideDefaultCloseButton === 'function') {
        hideDefaultCloseButton(false);
    }

    restoreDraftState();
}

function openModal() {
    const modal = document.getElementById("workout-modal");
    if (modal) modal.classList.remove("hidden");

    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) modalContent.scrollTop = 0;
    }, 20);
}

// ============================================================================
// TIMER-LOGIK
// ============================================================================
function updateTimerDisplay() {
    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    document.getElementById("workout-timer").textContent = `${hrs}:${mins}:${secs}`;
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    if (activeDraft) activeDraft.wasTimerRunning = true;
    document.getElementById("timer-toggle-btn").textContent = "Pausa ⏸️";
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
        if (activeDraft) {
            activeDraft.secondsElapsed = secondsElapsed;
            persistActiveWorkout();
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    if (activeDraft) activeDraft.wasTimerRunning = false;
    clearInterval(timerInterval);
    document.getElementById("timer-toggle-btn").textContent = "Fortsätt ▶️";
    if (activeDraft) persistActiveWorkout();
}

document.getElementById("timer-toggle-btn").onclick = () => {
    if (isTimerRunning) pauseTimer();
    else startTimer();
};

// ============================================================================
// ÖVNINGSHANTERING
// ============================================================================
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
 
    document.getElementById("save-new-ex-btn").onclick = () => {
        const name = document.getElementById("new-ex-name").value.trim();
        if(!name) return alert("Ange ett namn!");
        
        const newEx = { 
            id: Date.now(), 
            name, 
            target: selectedCategory, 
            defaultSets: 3, 
            animation: "" 
        };
        
        masterExercises.push(newEx);
        saveAll();
        
        if(callback) callback(newEx);
        else { 
            closeModal(); 
            filterExercises(selectedCategory); 
        }
    };
    
    openModal();
}
 
function filterExercises(category) {
    currentExerciseCategory = category;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === category));
    const results = document.getElementById("exercise-results");
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
 
            <button class="mode-btn blue" style="width: 100%; max-width: 300px; margin-top: 15px;" onclick="handleUpdateExercise(${id})">Uppdatera</button>
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
 
    window.handleUpdateExercise = (exId) => {
        const nameInput = document.getElementById("edit-ex-name").value.trim();
        if(!nameInput) return alert("Namnet får inte vara tomt!");
        
        const exIndex = masterExercises.findIndex(e => e.id == exId);
        if(exIndex !== -1) {
            const oldName = masterExercises[exIndex].name;
            updateExerciseNameInHistory(oldName, nameInput);
 
            masterExercises[exIndex].name = nameInput;
            masterExercises[exIndex].target = selectedCategory; 
            saveAll();
            closeModal();
            filterExercises(currentExerciseCategory);
        }
    };
 
    openModal();
}
 
function updateExerciseNameInHistory(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
 
    let updatedCount = 0;
 
    workoutHistory.forEach(workout => {
        if (workout.exercises && Array.isArray(workout.exercises)) {
            workout.exercises.forEach(exercise => {
                if (exercise.name === oldName) {
                    exercise.name = newName;
                    updatedCount++;
                }
            });
        }
    });
 
    if (updatedCount > 0) {
        saveAll();
        console.log(`Historiken uppdaterad: Ändrade "${oldName}" till "${newName}" på ${updatedCount} ställen.`);
    }
}

function renderCalendar(isFromStartBtn = false) {
    const grid = document.getElementById("calendar-grid");
    const label = document.getElementById("month-label");
    const infoBox = document.getElementById("calendar-info-box");
    
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
        const isRestDay = dayOfWeek === 0 || dayOfWeek === 3 || dayOfWeek === 6;
        
        let plannedPass = null;
        if (calendarOverrides[dateStr] !== undefined) {
            if (calendarOverrides[dateStr] === "none") {
                plannedPass = null;
            } else {
                plannedPass = programData.routine.find(p => p.id === calendarOverrides[dateStr]);
            }
        } else {
            if (!isRestDay) {
                const cycleDay = ((d - 1) % 4);
                plannedPass = programData.routine[cycleDay];
            }
        }
 
        let statusIcon = "";
        let statusColor = "";
        
        if (hasWorkouts.length > 0) {
            statusIcon = "✅";
            statusColor = "#22c55e";
        } else if (isOngoing) {
            statusIcon = "🔥";
            statusColor = "#f59e0b";
        } else if (plannedPass) {
            statusIcon = "📋";
            statusColor = "#3b82f6";
        } else {
            statusIcon = "🧘";
            statusColor = "#64748b";
        }
 
        cell.innerHTML = `
            <div style="font-size:16px; font-weight:700; color:var(--text); margin-bottom:4px;">${d}</div>
            <div style="font-size:18px; line-height:1;" title="${plannedPass ? plannedPass.name : 'Vila'}">${statusIcon}</div>
        `;
        
        cell.style.borderTop = `3px solid ${statusColor}`;
        cell.onclick = () => openDayManager(dateStr, plannedPass, hasWorkouts, isOngoing);
        grid.appendChild(cell);
    }
    
    showView("calendar-view");
}
 
function showExercisesForWorkout(idx) {
    console.log("Visar övningar för workout idx:", idx);
}
 
function startPress(idx, event) {
    if (!event.target.classList.contains('plan-override-btn')) return;
 
    isLongPress = false;
    hasScrolled = false;
    
    if (event.touches) {
        touchStartY = event.touches[0].clientY;
    }
 
    pressTimer = setTimeout(() => {
        isLongPress = true;
        showExercisesForWorkout(idx); 
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
 
function handleTouchMove(event) {
    if (event && event.touches && event.touches[0] && touchStartY > 0) {
        const currentY = event.touches[0].clientY;
        const moveDistance = Math.abs(currentY - touchStartY);
        
        if (moveDistance > 6) { 
            hasScrolled = true;
            cancelPress();
        }
    }
}
 
function handleTouchEnd(idx, dateStr, programId, event) {
    cancelPress();
    
    if (hasScrolled || isLongPress) {
        if (event) {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
        }
        return false;
    }
    
    if (event && event.cancelable) {
        event.preventDefault();
    }
    
    setOverrideSilent(dateStr, programId);
}
 
function openProgramPreviewModal(idx) {
    const pass = programData.routine[idx];
    
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
    
    if (completed.length > 0) {
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
                            <span style="color: #ffffff; font-size: 13px; font-weight: 600;">${wVal} <small style="color: var(--primary); font-weight: 700;">kg</small> × ${rVal} <small style="color: var(--primary); font-weight: 700;">reps</small></span>
                        </div>`;
                    });
                } else {
                    html += `<small style="color: var(--text-light);">Inga set registrerade</small>`;
                }
                
                html += `</div></div>`;
            });
            
            html += `</div></div>`;
        });
    }
    
    if (isOngoing) {
        html += `
        <div class="card glass" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 146, 60, 0.1) 100%); border-left: 4px solid #f59e0b; text-align: center; margin: 0; padding: 20px;">
            <div style="font-size: 32px; margin-bottom: 10px;">🔥</div>
            <strong style="font-size: 16px; color: var(--text); display: block; margin-bottom: 8px;">Pågående träningspass</strong>
            <p style="color: var(--text-light); font-size: 13px; margin-bottom: 15px;">Du har ett aktivt pass som inte är slutfört än.</p>
            <button class="mode-btn" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; width: 100%;" onclick="closeModal(); startWorkout(activeDraft.workout, activeDraft.data, activeDraft.date)">Fortsätt träna</button>
        </div>`;
    }
    
    if (planned && !isOngoing) {
        html += `
        <div style="margin: 0;">
            <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-light); text-align: center; margin-bottom: 12px; font-weight: 600;">Planerat pass</p>
            <div class="card glass" style="border-left: 4px solid var(--primary); text-align: center; margin: 0; padding: 20px;">
                <strong style="font-size: 18px; color: var(--text); display: block; margin-bottom: 15px;">${planned.name}</strong>
                <button class="mode-btn green" style="width: 100%; padding: 15px; font-weight: 700;" onclick="prepareStart('${dateStr}', '${planned.id}')">Starta detta pass 🚀</button>
            </div>
        </div>`;
    }
    
    if (!isOngoing) {
        html += `
        <div style="margin: 0;">
            <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-light); text-align: center; margin-bottom: 12px; font-weight: 600;">Byt till annat pass</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">`;
        
        programData.routine.forEach((p, i) => {
            const isCurrentlyPlanned = planned && planned.id === p.id;
            html += `
                <button 
                    class="plan-override-btn card glass ${isCurrentlyPlanned ? 'active-plan' : ''}" 
                    ontouchstart="startPress(${i}, event)" 
                    ontouchmove="handleTouchMove(event)" 
                    ontouchend="handleTouchEnd(${i}, '${dateStr}', '${p.id}', event)"
                    onmousedown="startPress(${i}, event)" 
                    onmouseup="cancelPress(); handleTouchEnd(${i}, '${dateStr}', '${p.id}', event)"
                    onmouseleave="cancelPress()"
                    style="padding: 15px 10px; text-align: center; cursor: pointer; font-size: 13px; font-weight: 600; border-radius: 12px; transition: all 0.2s; border: 1px solid ${isCurrentlyPlanned ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}; background: ${isCurrentlyPlanned ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)'}; color: ${isCurrentlyPlanned ? 'var(--primary)' : 'var(--text)'};">
                    ${p.name} ${isCurrentlyPlanned ? '✓' : ''}
                </button>`;
        });
        
        html += `</div></div>`;
        
        html += `
        <div style="margin: 0;">
            <button class="mode-btn glass-border" style="width: 100%; padding: 12px; font-size: 13px;" onclick="setOverride('${dateStr}', 'none')">
                🧘 Markera som vilodag
            </button>
        </div>`;
    }
    
    body.innerHTML = html;
    openModal();
}
 
function setOverrideSilent(dateStr, programId) {
    calendarOverrides[dateStr] = programId;
    saveAll();
    renderCalendar();
    closeModal();
}
 
// ============================================================================
// PROGRAM/PASS-HANTERING
// ============================================================================
function renderProgramView(selectedIdx = null) {
    const list = document.getElementById("program-list");
    list.innerHTML = "";
    
    programData.routine.forEach((p, i) => {
        const div = document.createElement("div");
        div.className = "card glass";
        div.style.cssText = "padding:15px; margin-bottom:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;";
        div.innerHTML = `
            <div onclick="showProgramDetails(${i})" style="flex-grow:1;">
                <strong style="font-size:16px;">${p.name}</strong><br>
                <small style="color:var(--text-light);">${p.exercises.length} övningar</small>
            </div>
            <button style="background:none; border:none; font-size:18px; cursor:pointer; padding:8px;" onclick="event.stopPropagation(); openEditProgramModal(${i})">⚙️</button>
        `;
        list.appendChild(div);
    });
    
    if (selectedIdx !== null) {
        showProgramDetails(selectedIdx);
    }
    
    showView("programs-view");
}
 
function showProgramDetails(idx) {
    const p = programData.routine[idx];
    const area = document.getElementById("program-details-area");
    area.classList.remove("hidden");
    area.innerHTML = `
        <h3 class="section-title modern-header">${p.name}</h3>
        <div style="display:flex; flex-direction:column; gap:8px;">
            ${p.exercises.map(ex => `
                <div class="card glass" style="padding:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:14px;">${ex.name}</strong><br>
                        <small style="color:var(--primary); font-weight:800; text-transform:uppercase; font-size:10px;">${ex.target}</small>
                    </div>
                </div>
            `).join("")}
        </div>
        <button class="mode-btn glass-border" style="margin-top:15px;" onclick="openEditProgramModal(${idx})">Redigera Pass</button>
        <button class="mode-btn" style="background:none; color:var(--danger); font-size:13px; margin-top:10px; border:1px solid rgba(239, 68, 68, 0.2);" onclick="deleteEntireProgram(${idx})">Radera Pass Permanent</button>
    `;
}
 
function openEditProgramModal(pIdx) {
    const p = programData.routine[pIdx];
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3>Redigera Pass</h3>
        <label style="font-size:12px; color:var(--text-light); text-align:left; display:block; margin-left:10px;">NAMN PÅ PASS</label>
        <input type="text" id="edit-pass-name" class="log-input" value="${p.name}">
        <p style="font-size:12px; color:var(--text-light); text-align:center; margin-top:20px;">ÖVNINGAR I PASSET:</p>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
            ${p.exercises.map((ex, eIdx) => `
                <div class="card glass" style="padding:10px; display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:13px;">${ex.name}</strong>
                    <div style="display:flex; gap:5px;">
                        <button class="reorder-btn" onclick="moveExercise(${pIdx}, ${eIdx}, -1)">▲</button>
                        <button class="reorder-btn" onclick="moveExercise(${pIdx}, ${eIdx}, 1)">▼</button>
                        <button style="background:none; border:none; color:var(--danger); font-size:16px; cursor:pointer;" onclick="removeExFromPass(${pIdx}, ${eIdx})">×</button>
                    </div>
                </div>
            `).join("")}
        </div>
        <p style="font-size:12px; color:var(--text-light); text-align:center; margin-bottom:10px;">LÄGG TILL ÖVNING:</p>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; margin-bottom:15px;">
            ${masterExercises.map(ex => `
                <button class="mode-btn glass-border" style="padding:10px; font-size:11px;" onclick="addExerciseToPassDirectly(${pIdx}, ${ex.id})">${ex.name}</button>
            `).join("")}
        </div>
        <button class="mode-btn blue" onclick="saveProgramEdit(${pIdx})">Spara Ändringar</button>
    `;
    openModal();
}

function moveExercise(pIdx, eIdx, dir) {
    const newIdx = eIdx + dir;
    if (newIdx < 0 || newIdx >= programData.routine[pIdx].exercises.length) return;
    
    [programData.routine[pIdx].exercises[eIdx], programData.routine[pIdx].exercises[newIdx]] = 
    [programData.routine[pIdx].exercises[newIdx], programData.routine[pIdx].exercises[eIdx]];
    
    saveAll();
    openEditProgramModal(pIdx);
}
 
function removeExFromPass(pIdx, eIdx) {
    programData.routine[pIdx].exercises.splice(eIdx, 1);
    saveAll();
    openEditProgramModal(pIdx);
}
 
function addExerciseToPassDirectly(pIdx, exId) {
    const ex = masterExercises.find(e => e.id == exId);
    if (!ex) return;
    
    programData.routine[pIdx].exercises.push({ name: ex.name, target: ex.target });
    saveAll();
    openEditProgramModal(pIdx);
}
 
function saveProgramEdit(pIdx) {
    const newName = document.getElementById("edit-pass-name").value.trim();
    if (!newName) return alert("Namnet får inte vara tomt!");
    
    programData.routine[pIdx].name = newName;
    saveAll();
    closeModal();
    renderProgramView(pIdx);
}
 
function openCreateProgramModal() {
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3>Skapa Nytt Pass</h3>
        <label style="font-size:12px; color:var(--text-light); text-align:left; display:block; margin-left:10px;">NAMN PÅ PASS</label>
        <input type="text" id="new-pass-name" class="log-input" placeholder="T.ex. Överkropp A">
        <p style="font-size:12px; color:var(--text-light); text-align:center; margin-top:20px;">VÄLJ ÖVNINGAR:</p>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; margin-bottom:15px;" id="new-pass-exercise-grid">
            ${masterExercises.map(ex => `
                <button class="mode-btn glass-border exercise-select-btn" data-ex-id="${ex.id}" style="padding:10px; font-size:11px;" onclick="toggleExerciseForNewPass(${ex.id}, this)">${ex.name}</button>
            `).join("")}
        </div>
        <button class="mode-btn blue" onclick="saveNewProgram()">Skapa Pass</button>
    `;
    openModal();
}
 
let newPassSelectedExercises = [];
 
function toggleExerciseForNewPass(exId, btn) {
    const index = newPassSelectedExercises.indexOf(exId);
    if (index > -1) {
        newPassSelectedExercises.splice(index, 1);
        btn.style.background = "rgba(255,255,255,0.03)";
        btn.style.borderColor = "rgba(255,255,255,0.1)";
        btn.style.color = "var(--text)";
    } else {
        newPassSelectedExercises.push(exId);
        btn.style.background = "rgba(59, 130, 246, 0.15)";
        btn.style.borderColor = "var(--primary)";
        btn.style.color = "var(--primary)";
    }
}
 
function saveNewProgram() {
    const name = document.getElementById("new-pass-name").value.trim();
    if (!name) return alert("Ange ett namn!");
    if (newPassSelectedExercises.length === 0) return alert("Välj minst en övning!");
    
    const exercises = newPassSelectedExercises.map(exId => {
        const ex = masterExercises.find(e => e.id == exId);
        return { name: ex.name, target: ex.target };
    });
    
    const newProgram = {
        id: "custom-" + Date.now(),
        name: name,
        exercises: exercises
    };
    
    programData.routine.push(newProgram);
    saveAll();
    
    newPassSelectedExercises = [];
    closeModal();
    renderProgramView();
}
 
// ============================================================================
// AKTIVT TRÄNINGSPASS
// ============================================================================
function startWorkout(workout, existingData = null, date = null, isNewStart = false) {
    if (activeDraft && !isNewStart) {
        renderActiveWorkout();
        showView("workout-view");
        return;
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    let dataObj;
    if (existingData) {
        dataObj = existingData;
    } else {
        dataObj = workout.exercises.map(ex => {
            const history = getExerciseHistory(ex.name);
            if (history) {
                return { sets_data: JSON.parse(JSON.stringify(history)), isCompleted: false };
            }
            return { sets_data:[{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }], isCompleted: false };
        });
    }
    
    const isFrittPass = workout.name === "Fritt Pass";
    
    activeDraft = {
        workout: workout,
        dataObj,
        date: targetDate,
        secondsElapsed: 0,
        isStarted: isNewStart,
        wasTimerRunning: false,
        ui_state: {
            openExercises: isFrittPass ? [0] : []
        }
    };
    
    persistActiveWorkout();
    renderActiveWorkout();
    showView("workout-view");
}
 
function getExerciseHistory(exerciseName) {
    for (let i = workoutHistory.length - 1; i >= 0; i--) {
        const workout = workoutHistory[i];
        const ex = workout.exercises.find(e => e.name === exerciseName);
        if (ex && ex.sets_data) {
            return ex.sets_data.map(s => ({ weight: s.weight, reps: s.reps }));
        }
    }
    return null;
}
 
function renderActiveWorkout() {
    const container = document.getElementById("active-workout-container");
    const isFrittPass = activeDraft.workout.name === "Fritt Pass";
    
    let html = `<h2 class="section-title modern-header">${activeDraft.workout.name}</h2>`;
    
    if (isFrittPass) {
        html += `
        <div style="background: rgba(34, 211, 238, 0.1); padding: 12px; border-radius: 12px; margin-bottom: 20px; text-align: center; border: 1px solid var(--primary);">
            <p style="font-size: 13px; color: var(--primary); margin: 0;">
                🎯 Fritt pass – Lägg till övningar efter behov!
            </p>
        </div>`;
    }
    
    activeDraft.workout.exercises.forEach((ex, i) => {
        const isOpen = isFrittPass ? activeDraft.ui_state.openExercises.includes(i) : true;
        const exData = activeDraft.data[i];
        const allSetsConfirmed = exData.sets_data.every(s => s.userConfirmed);
        
        html += `
        <div class="card glass" style="margin-bottom: 15px; padding: 0; overflow: hidden; border: 1px solid ${allSetsConfirmed ? '#22c55e' : 'rgba(255,255,255,0.08)'}; border-left: 4px solid ${allSetsConfirmed ? '#22c55e' : 'var(--primary)'};">
            <div style="padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: ${isFrittPass ? 'pointer' : 'default'};" ${isFrittPass ? `onclick="toggleExerciseCard(${i})"` : ''}>
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${isFrittPass ? `<span style="font-size: 18px;">${isOpen ? '▼' : '▶'}</span>` : ''}
                    <div>
                        <strong style="font-size: 16px; display: block;">${ex.name}</strong>
                        <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px;">${ex.target}</small>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${allSetsConfirmed ? '<span style="font-size: 20px;">✅</span>' : ''}
                    ${isFrittPass ? `
                        <button class="reorder-btn" onclick="event.stopPropagation(); moveActiveExercise(${i}, -1)" ${i === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
                        <button class="reorder-btn" onclick="event.stopPropagation(); moveActiveExercise(${i}, 1)" ${i === activeDraft.workout.exercises.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
                        <button style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); removeActiveExercise(${i})">×</button>
                    ` : ''}
                </div>
            </div>`;
        
        if (isOpen) {
            html += `<div style="padding: 0 15px 15px 15px; display: flex; flex-direction: column; gap: 10px;">`;
            
            exData.sets_data.forEach((set, sIdx) => {
                const isConfirmed = set.userConfirmed;
                html += `
                <div style="background: ${isConfirmed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)'}; padding: 12px; border-radius: 12px; border: 1px solid ${isConfirmed ? '#22c55e' : 'rgba(255,255,255,0.08)'}; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <span style="color: var(--primary); font-size: 11px; font-weight: 800; text-transform: uppercase; min-width: 50px;">Set ${sIdx + 1}</span>
                    <input type="number" id="w-${i}-${sIdx}" class="log-input" placeholder="Vikt" value="${set.weight || ''}" onchange="updateSetDataOnly(${i}, ${sIdx})" style="flex: 1; text-align: center; padding: 10px; font-size: 14px;">
                    <span style="color: var(--text-light); font-size: 12px;">kg</span>
                    <input type="number" id="r-${i}-${sIdx}" class="log-input" placeholder="Reps" value="${set.reps || ''}" onchange="updateSetDataOnly(${i}, ${sIdx})" style="flex: 1; text-align: center; padding: 10px; font-size: 14px;">
                    <span style="color: var(--text-light); font-size: 12px;">reps</span>
                    <button onclick="confirmSet(${i}, ${sIdx})" style="background: ${isConfirmed ? '#22c55e' : 'rgba(59, 130, 246, 0.2)'}; border: 1px solid ${isConfirmed ? '#22c55e' : 'var(--primary)'}; color: ${isConfirmed ? '#fff' : 'var(--primary)'}; cursor: pointer; font-size: 18px; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                        ${isConfirmed ? '✓' : '○'}
                    </button>
                </div>`;
            });
            
            html += `
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    <button class="mode-btn glass-border" style="flex: 1; padding: 10px; font-size: 12px;" onclick="addSet(${i})">+ Lägg till set</button>
                    ${exData.sets_data.length > 1 ? `<button class="mode-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); padding: 10px; font-size: 12px;" onclick="removeSet(${i})">- Ta bort set</button>` : ''}
                </div>
            </div>`;
        }
        
        html += `</div>`;
    });
    
    if (isFrittPass) {
        html += `
        <button class="mode-btn blue" style="width: 100%; padding: 15px; margin-top: 10px; font-weight: 700;" onclick="openExercisePickerForFrittPass()">
            ➕ Lägg till övning
        </button>`;
    }
    
    container.innerHTML = html;
}
 
function toggleExerciseCard(exIdx) {
    const openExercises = activeDraft.ui_state.openExercises;
    const index = openExercises.indexOf(exIdx);
    
    if (index > -1) {
        openExercises.splice(index, 1);
    } else {
        openExercises.push(exIdx);
    }
    
    persistActiveWorkout();
    renderActiveWorkout();
}
 
function addSet(exIdx) {
    const lastSet = activeDraft.data[exIdx].sets_data[activeDraft.data[exIdx].sets_data.length - 1];
    activeDraft.data[exIdx].sets_data.push({ weight: lastSet.weight || "", reps: lastSet.reps || "" });
    persistActiveWorkout();
    renderActiveWorkout();
}
 
function removeSet(exIdx) {
    if (activeDraft.data[exIdx].sets_data.length > 1) {
        activeDraft.data[exIdx].sets_data.pop();
        persistActiveWorkout();
        renderActiveWorkout();
    }
}
 
function openExercisePickerForFrittPass() {
    temporarySelectedExercises = [];
    renderExercisePicker("Ben", null);
}

function restoreDraftState() {
    temporarySelectedExercises = [];
}
 
// ============================================================================
// ÖVNINGSVÄLJARE FÖR FRITT PASS
// ============================================================================
function renderExercisePicker(category, callback) {
    const body = document.getElementById("modal-body");
    
    const categories = [
        { id: "Ben", icon: "🦵" },
        { id: "Bröst", icon: "🏋️" },
        { id: "Rygg", icon: "🪵" },
        { id: "Axlar", icon: "👐" },
        { id: "Armar", icon: "💪" },
        { id: "Bål", icon: "🧘" }
    ];
 
    const filtered = masterExercises.filter(ex => 
        category === "Armar" ? (ex.target === "Biceps" || ex.target === "Triceps") : ex.target === category
    );
 
    body.innerHTML = `
        <h3 style="text-align: center; margin-bottom: 20px;">Välj Övningar</h3>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
            ${categories.map(cat => `
                <div class="cat-select-item ${cat.id === category ? 'active' : ''}" 
                     onclick="renderExercisePicker('${cat.id}', ${callback})"
                     style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                    <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div>
                    <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${cat.id}</div>
                </div>
            `).join('')}
        </div>
 
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; max-height: 50vh; overflow-y: auto;">
            ${filtered.map(ex => {
                const isSelected = temporarySelectedExercises.includes(ex.id);
                return `
                    <div class="card glass exercise-picker-item ${isSelected ? 'selected' : ''}" 
                         onclick="toggleExerciseSelection(${ex.id})"
                         style="padding: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}; background: ${isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)'};">
                        <div>
                            <strong style="font-size: 14px; color: ${isSelected ? 'var(--primary)' : 'var(--text)'};">${ex.name}</strong><br>
                            <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px;">${ex.target}</small>
                        </div>
                        <span style="font-size: 20px;">${isSelected ? '✓' : ''}</span>
                    </div>
                `;
            }).join('')}
        </div>
 
        <button class="mode-btn blue" onclick="addSelectedExercisesToFrittPass()" style="width: 100%; padding: 15px; font-weight: 700;">
            Lägg till valda övningar (${temporarySelectedExercises.length})
        </button>
 
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
    
    openModal();
}
 
function toggleExerciseSelection(exId) {
    const index = temporarySelectedExercises.indexOf(exId);
    if (index > -1) {
        temporarySelectedExercises.splice(index, 1);
    } else {
        temporarySelectedExercises.push(exId);
    }
    
    const category = document.querySelector('.cat-select-item.active div:last-child').textContent;
    renderExercisePicker(category, null);
}
 
function addSelectedExercisesToFrittPass() {
    if (temporarySelectedExercises.length === 0) {
        alert("Välj minst en övning!");
        return;
    }
    
    temporarySelectedExercises.forEach(exId => {
        const ex = masterExercises.find(e => e.id == exId);
        if (ex) {
            activeDraft.workout.exercises.push({ name: ex.name, target: ex.target });
            
            const history = getExerciseHistory(ex.name);
            if (history) {
                activeDraft.data.push({ sets_data: JSON.parse(JSON.stringify(history)), isCompleted: false });
            } else {
                activeDraft.data.push({ 
                    sets_data:[
                        { weight: "", reps: "" }, 
                        { weight: "", reps: "" }, 
                        { weight: "", reps: "" }
                    ], 
                    isCompleted: false 
                });
            }
            
            activeDraft.ui_state.openExercises.push(activeDraft.workout.exercises.length - 1);
        }
    });
    
    temporarySelectedExercises = [];
    persistActiveWorkout();
    renderActiveWorkout();
    closeModal();
}
 
function moveActiveExercise(exIdx, direction) {
    const newIdx = exIdx + direction;
    if (newIdx < 0 || newIdx >= activeDraft.workout.exercises.length) return;
    
    [activeDraft.workout.exercises[exIdx], activeDraft.workout.exercises[newIdx]] = 
    [activeDraft.workout.exercises[newIdx], activeDraft.workout.exercises[exIdx]];
    
    [activeDraft.data[exIdx], activeDraft.data[newIdx]] = 
    [activeDraft.data[newIdx], activeDraft.data[exIdx]];
    
    const openExercises = activeDraft.ui_state.openExercises;
    const wasOldOpen = openExercises.includes(exIdx);
    const wasNewOpen = openExercises.includes(newIdx);
    
    activeDraft.ui_state.openExercises = openExercises
        .filter(i => i !== exIdx && i !== newIdx)
        .concat(wasOldOpen ? [newIdx] : [])
        .concat(wasNewOpen ? [exIdx] : []);
    
    persistActiveWorkout();
    renderActiveWorkout();
}
 
function removeActiveExercise(exIdx) {
    if (!confirm(`Ta bort "${activeDraft.workout.exercises[exIdx].name}" från passet?`)) return;
    
    activeDraft.workout.exercises.splice(exIdx, 1);
    activeDraft.data.splice(exIdx, 1);
    
    activeDraft.ui_state.openExercises = activeDraft.ui_state.openExercises
        .filter(i => i !== exIdx)
        .map(i => i > exIdx ? i - 1 : i);
    
    persistActiveWorkout();
    renderActiveWorkout();
}
 
function updateSetDataOnly(exIdx, setIdx) {
    const w = document.getElementById(`w-${exIdx}-${setIdx}`).value;
    const r = document.getElementById(`r-${exIdx}-${setIdx}`).value;
    activeDraft.data[exIdx].sets_data[setIdx].weight = w;
    activeDraft.data[exIdx].sets_data[setIdx].reps = r;
    persistActiveWorkout();
}
 
function confirmSet(exIdx, setIdx) {
    const set = activeDraft.data[exIdx].sets_data[setIdx];
    
    if (!set.weight || !set.reps) {
        alert("Fyll i både vikt och reps innan du bekräftar!");
        return;
    }
    
    set.userConfirmed = !set.userConfirmed;
    persistActiveWorkout();
    renderActiveWorkout();
}
 
function persistActiveWorkout() {
    if (activeDraft) {
        activeDraft.secondsElapsed = secondsElapsed;
        saveAll();
    }
}
 
function finishWorkout() {
    if (!activeDraft) return;
    
    const hasUnconfirmedSets = activeDraft.data.some(exData => 
        exData.sets_data.some(set => !set.userConfirmed && (set.weight || set.reps))
    );
    
    if (hasUnconfirmedSets) {
        if (!confirm("Du har obekräftade set. Vill du verkligen avsluta?")) {
            return;
        }
    }
    
    pauseTimer();
    
    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
const secs = String(secondsElapsed % 60).padStart(2, '0');
const totalTime = `${hrs}:${mins}:${secs}`;

const loggedWorkout = {
    date: activeDraft.date,
    programName: activeDraft.workout.name,
    exercises: activeDraft.workout.exercises.map((ex, i) => ({
        name: ex.name,
        target: ex.target,
        sets: activeDraft.data[i].sets_data.filter(s => s.weight && s.reps)
    })),
    totalTime: totalTime
};
    
    workoutHistory.push(loggedWorkout);
    
    activeDraft = null;
    secondsElapsed = 0;
    isTimerRunning = false;
    clearInterval(timerInterval);
    
    saveAll();
    
    alert("🎉 Passet är sparat!");
    renderHome();
}
 
function cancelWorkout() {
    if (!confirm("Är du säker på att du vill avbryta detta pass? All data går förlorad.")) return;
    
    pauseTimer();
    activeDraft = null;
    secondsElapsed = 0;
    isTimerRunning = false;
    clearInterval(timerInterval);
    
    saveAll();
    renderHome();
}
 
// ============================================================================
// HISTORIK
// =====================================================
function renderHistory() {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    
    if (workoutHistory.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
                <p style="font-size: 16px; margin-bottom: 10px;">Ingen träningshistorik än</p>
                <p style="font-size: 13px;">Dina genomförda pass kommer visas här</p>
            </div>
        `;
        showView("history-view");
        return;
    }
    
    const sorted = [...workoutHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach((w, idx) => {
        const originalIdx = workoutHistory.indexOf(w);
        const timeStr = w.totalTime ? `⏱️ ${w.totalTime}` : "";
        
        const div = document.createElement("div");
        div.className = "card glass";
        div.style.cssText = "padding: 15px; margin-bottom: 12px; border-left: 4px solid #22c55e;";
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                    <strong style="font-size: 16px; display: block; color: var(--text);">${w.programName}</strong>
                    <small style="font-size: 11px; color: var(--text-light); font-weight: 500;">${w.date} ${timeStr}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="editLoggedWorkout('${w.date}', ${originalIdx})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--primary); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✏️</button>
                    <button onclick="openConfirmDeleteModal('${w.date}', ${originalIdx})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--danger); cursor: pointer; font-size: 12px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✖</button>
                </div>
            </div>
            
            <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px;">
                ${w.exercises.map(ex => `
                    <div style="font-size: 13px;">
                        <span style="color: var(--text); font-weight: 600; display: block; margin-bottom: 8px;">${ex.name}</span>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${ex.sets_data && ex.sets_data.length > 0 ? ex.sets_data.map((s, sIdx) => `
                                <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid var(--primary); padding: 6px 12px; border-radius: 8px; width: fit-content; display: flex; align-items: center; gap: 8px;">
                                    <span style="color: var(--primary); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Set ${sIdx+1}</span> 
                                    <span style="color: #ffffff; font-size: 13px; font-weight: 600;">${s.weight || 0} <small style="color: var(--primary); font-weight: 700;">kg</small> × ${s.reps || 0} <small style="color: var(--primary); font-weight: 700;">reps</small></span>
                                </div>
                            `).join('') : '<small style="color: var(--text-light);">Inga set registrerade</small>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        list.appendChild(div);
    });
    
    showView("history-view");
}
 
function editLoggedWorkout(dateStr, workoutIdx) {
    const workouts = workoutHistory.filter(w => w.date === dateStr);
    const w = workouts[workoutIdx];
    if (!w) return;
    
    const body = document.getElementById("modal-body");
    
    body.innerHTML = `
        <h3 style="text-align: center; margin-bottom: 20px;">Redigera Pass</h3>
        
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-light); font-weight: 600; display: block; margin-bottom: 5px;">Datum</span>
            <strong style="font-size: 18px; color: var(--text);">${w.date}</strong>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px; text-align: center;">Passnamn</label>
            <input type="text" id="edit-workout-name" class="log-input" value="${w.programName}" style="text-align: center;">
        </div>
        
        <div id="edit-exercises-container" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
            ${w.exercises.map((ex, exIdx) => `
                <div class="card glass" style="padding: 15px; border-left: 3px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <strong style="font-size: 15px; color: var(--text);">${ex.name}</strong>
                        <button onclick="removeExerciseFromHistory(${workoutIdx}, ${exIdx})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); cursor: pointer; font-size: 14px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${ex.sets_data.map((s, sIdx) => `
                            <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 8px;">
                                <span style="color: var(--primary); font-size: 10px; font-weight: 800; text-transform: uppercase; min-width: 45px;">Set ${sIdx+1}</span>
                                <input type="number" id="edit-w-${exIdx}-${sIdx}" class="log-input" value="${s.weight || ''}" style="flex: 1; text-align: center; padding: 8px; font-size: 13px;">
                                <span style="color: var(--text-light); font-size: 11px;">kg</span>
                                <input type="number" id="edit-r-${exIdx}-${sIdx}" class="log-input" value="${s.reps || ''}" style="flex: 1; text-align: center; padding: 8px; font-size: 13px;">
                                <span style="color: var(--text-light); font-size: 11px;">reps</span>
                                <button onclick="removeSetFromHistory(${workoutIdx}, ${exIdx}, ${sIdx})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); cursor: pointer; font-size: 12px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="mode-btn glass-border" style="width: 100%; margin-top: 10px; padding: 8px; font-size: 12px;" onclick="addSetToHistory(${workoutIdx}, ${exIdx})">+ Lägg till set</button>
                </div>
            `).join('')}
        </div>
        
        <button class="mode-btn blue" onclick="saveEditedWorkout(${workoutIdx})" style="width: 100%; padding: 15px; font-weight: 700;">Spara ändringar</button>
    `;
    
    openModal();
}
 
function addSetToHistory(workoutIdx, exIdx) {
    const w = workoutHistory[workoutIdx];
    const lastSet = w.exercises[exIdx].sets_data[w.exercises[exIdx].sets_data.length - 1];
    w.exercises[exIdx].sets_data.push({ weight: lastSet.weight || "", reps: lastSet.reps || "" });
    saveAll();
    editLoggedWorkout(w.date, workoutIdx);
}
 
function removeSetFromHistory(workoutIdx, exIdx, setIdx) {
    const w = workoutHistory[workoutIdx];
    if (w.exercises[exIdx].sets_data.length > 1) {
        w.exercises[exIdx].sets_data.splice(setIdx, 1);
        saveAll();
        editLoggedWorkout(w.date, workoutIdx);
    } else {
        alert("Du måste ha minst ett set!");
    }
}
 
function removeExerciseFromHistory(workoutIdx, exIdx) {
    const w = workoutHistory[workoutIdx];
    if (!confirm(`Ta bort "${w.exercises[exIdx].name}" från detta pass?`)) return;
    
    w.exercises.splice(exIdx, 1);
    saveAll();
    
    if (w.exercises.length === 0) {
        workoutHistory.splice(workoutIdx, 1);
        saveAll();
        closeModal();
        renderHistory();
    } else {
        editLoggedWorkout(w.date, workoutIdx);
    }
}
 
function saveEditedWorkout(workoutIdx) {
    const w = workoutHistory[workoutIdx];
    const newName = document.getElementById("edit-workout-name").value.trim();
    
    if (!newName) {
        alert("Passnamn får inte vara tomt!");
        return;
    }
    
    w.programName = newName;
    
    w.exercises.forEach((ex, exIdx) => {
        ex.sets_data.forEach((s, sIdx) => {
            const wInput = document.getElementById(`edit-w-${exIdx}-${sIdx}`);
            const rInput = document.getElementById(`edit-r-${exIdx}-${sIdx}`);
            
            if (wInput && rInput) {
                s.weight = wInput.value;
                s.reps = rInput.value;
            }
        });
    });
    
    saveAll();
    closeModal();
    renderHistory();
}
 
function openConfirmDeleteModal(dateStr, workoutIdx) {
    const w = workoutHistory[workoutIdx];
    if (!w) return;
    
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
            <h3 style="margin-bottom: 15px;">Bekräfta radering</h3>
            <p style="color: var(--text-light); margin-bottom: 20px;">Är du säker på att du vill radera detta pass?</p>
            
            <div class="card glass" style="padding: 15px; margin-bottom: 20px; text-align: left; border-left: 4px solid var(--danger);">
                <strong style="display: block; margin-bottom: 5px;">${w.programName}</strong>
                <small style="color: var(--text-light);">${w.date}</small>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="mode-btn glass-border" onclick="closeModal()" style="flex: 1;">Avbryt</button>
                <button class="mode-btn" style="flex: 1; background: var(--danger); color: #fff;" onclick="confirmDeleteWorkout(${workoutIdx})">Radera</button>
            </div>
        </div>
    `;
    openModal();
}
 
function confirmDeleteWorkout(workoutIdx) {
    workoutHistory.splice(workoutIdx, 1);
    saveAll();
    closeModal();
    renderHistory();
}
 
function deleteMasterExercise(exId) {
    const ex = masterExercises.find(e => e.id == exId);
    if (!ex) return;
    
    if (!confirm(`Radera "${ex.name}" permanent? Detta påverkar även alla pass som använder denna övning.`)) return;
    
    masterExercises = masterExercises.filter(e => e.id != exId);
    
    programData.routine.forEach(p => {
        p.exercises = p.exercises.filter(e => e.name !== ex.name);
    });
    
    saveAll();
    closeModal();
    filterExercises(currentExerciseCategory);
}
 
function deleteEntireProgram(pIdx) {
    const p = programData.routine[pIdx];
    if (!confirm(`Radera "${p.name}" permanent?`)) return;
    
    programData.routine.splice(pIdx, 1);
    saveAll();
    closeModal();
    renderProgramView();
}
 
// ============================================================================
// STATISTIK
// =========================================================================
function renderStats() {
    const container = document.getElementById("stats-container");
    
    if (workoutHistory.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                <div style="font-size: 48px; margin-bottom: 15px;">📈</div>
                <p style="font-size: 16px; margin-bottom: 10px;">Ingen statistik än</p>
                <p style="font-size: 13px;">Träna några pass för att se din utveckling</p>
            </div>
        `;
        showView("stats-view");
        return;
    }
    
    const totalWorkouts = workoutHistory.length;
    
    let totalSeconds = 0;
    workoutHistory.forEach(w => {
        if (w.totalTime) {
            const parts = w.totalTime.split(':');
            if (parts.length === 3) {
                totalSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
            }
        }
    });
    
    const avgSeconds = totalWorkouts > 0 ? Math.floor(totalSeconds / totalWorkouts) : 0;
    const avgHrs = Math.floor(avgSeconds / 3600);
    const avgMins = Math.floor((avgSeconds % 3600) / 60);
    const avgTimeStr = `${avgHrs}h ${avgMins}m`;
    
    const exerciseFrequency = {};
    workoutHistory.forEach(w => {
        w.exercises.forEach(ex => {
            if (!exerciseFrequency[ex.name]) {
                exerciseFrequency[ex.name] = 0;
            }
            exerciseFrequency[ex.name]++;
        });
    });
    
    const sortedExercises = Object.entries(exerciseFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const exerciseProgress = {};
    masterExercises.forEach(ex => {
        const history = [];
        workoutHistory.forEach(w => {
            const foundEx = w.exercises.find(e => e.name === ex.name);
            if (foundEx && foundEx.sets_data && foundEx.sets_data.length > 0) {
                const maxWeight = Math.max(...foundEx.sets_data.map(s => parseFloat(s.weight) || 0));
                if (maxWeight > 0) {
                    history.push({ date: w.date, weight: maxWeight });
                }
            }
        });
        
        if (history.length > 0) {
            exerciseProgress[ex.name] = history;
        }
    });
    
    const sortedProgress = Object.entries(exerciseProgress)
        .filter(([name, data]) => data.length >= 2)
        .map(([name, data]) => {
            const first = data[0].weight;
            const last = data[data.length - 1].weight;
            const increase = last - first;
            const percentIncrease = ((increase / first) * 100).toFixed(1);
            return { name, first, last, increase, percentIncrease, data };
        })
        .sort((a, b) => b.increase - a.increase)
        .slice(0, 5);
    
    let html = `
        <h2 class="section-title modern-header">Din Statistik 📊</h2>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 25px;">
            <div class="card glass" style="padding: 20px; text-align: center; border-left: 4px solid var(--primary);">
                <div style="font-size: 32px; font-weight: 800; color: var(--primary); margin-bottom: 5px;">${totalWorkouts}</div>
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-light); font-weight: 600;">Totalt pass</div>
            </div>
            
            <div class="card glass" style="padding: 20px; text-align: center; border-left: 4px solid #22c55e;">
                <div style="font-size: 18px; font-weight: 800; color: #22c55e; margin-bottom: 5px;">${avgTimeStr}</div>
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-light); font-weight: 600;">Snitttid</div>
            </div>
        </div>
    `;
    
    if (sortedExercises.length > 0) {
        html += `
            <div class="card glass" style="padding: 20px; margin-bottom: 25px;">
                <h3 style="font-size: 16px; margin-bottom: 15px; text-align: center; color: var(--text);">🏆 Mest Tränade Övningar</h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${sortedExercises.map(([name, count], idx) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 10px; border-left: 3px solid var(--primary);">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 18px; font-weight: 800; color: var(--primary); min-width: 25px;">#${idx + 1}</span>
                                <span style="font-size: 14px; font-weight: 600; color: var(--text);">${name}</span>
                            </div>
                            <span style="font-size: 13px; color: var(--text-light); font-weight: 700;">${count} ggr</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (sortedProgress.length > 0) {
        html += `
            <div class="card glass" style="padding: 20px; margin-bottom: 25px;">
                <h3 style="font-size: 16px; margin-bottom: 15px; text-align: center; color: var(--text);">📈 Största Utvecklingen</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${sortedProgress.map((prog, idx) => `
                        <div style="padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; border-left: 3px solid #22c55e;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <strong style="font-size: 14px; color: var(--text);">${prog.name}</strong>
                                <span style="font-size: 14px; font-weight: 800; color: #22c55e;">+${prog.increase} kg</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-light);">
                                <span>Start: ${prog.first} kg</span>
                                <span style="color: #22c55e; font-weight: 700;">↑ ${prog.percentIncrease}%</span>
                                <span>Nu: ${prog.last} kg</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const programFrequency = {};
    workoutHistory.forEach(w => {
        if (!programFrequency[w.programName]) {
            programFrequency[w.programName] = 0;
        }
        programFrequency[w.programName]++;
    });
    
    const sortedPrograms = Object.entries(programFrequency)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedPrograms.length > 0) {
        html += `
            <div class="card glass" style="padding: 20px; margin-bottom: 25px;">
                <h3 style="font-size: 16px; margin-bottom: 15px; text-align: center; color: var(--text);">💪 Pass-översikt</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${sortedPrograms.map(([name, count]) => {
                        const percentage = ((count / totalWorkouts) * 100).toFixed(0);
                        return `
                            <div style="padding: 12px; background: rgba(255,255,255,0.03); border-radius: 10px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-size: 13px; font-weight: 600; color: var(--text);">${name}</span>
                                    <span style="font-size: 12px; color: var(--text-light);">${count} ggr (${percentage}%)</span>
                                </div>
                                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, var(--primary), #22c55e); border-radius: 3px;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    showView("stats-view");
}
 
// ============================================================================
// TIMER-FUNKTIONER
// ============================================================================
function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    
    if (activeDraft) {
        activeDraft.isStarted = true;
        activeDraft.wasTimerRunning = true;
        persistActiveWorkout();
    }
    
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
        
        if (activeDraft) {
            activeDraft.secondsElapsed = secondsElapsed;
        }
    }, 1000);
    
    updateTimerControls();
}
 
function pauseTimer() {
    if (!isTimerRunning) return;
    isTimerRunning = false;
    clearInterval(timerInterval);
    
    if (activeDraft) {
        activeDraft.wasTimerRunning = false;
        persistActiveWorkout();
    }
    
    updateTimerControls();
}
 
function resetTimer() {
    if (!confirm("Är du säker på att du vill nollställa timern?")) return;
    
    pauseTimer();
    secondsElapsed = 0;
    
    if (activeDraft) {
        activeDraft.secondsElapsed = 0;
        persistActiveWorkout();
    }
    
    updateTimerDisplay();
}
 
function updateTimerDisplay() {
    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    document.getElementById("timer-display").textContent = `${hrs}:${mins}:${secs}`;
}
 
function updateTimerControls() {
    const startBtn = document.getElementById("timer-start-btn");
    const pauseBtn = document.getElementById("timer-pause-btn");
    
    if (isTimerRunning) {
        startBtn.style.display = "none";
        pauseBtn.style.display = "flex";
    } else {
        startBtn.style.display = "flex";
        pauseBtn.style.display = "none";
    }
}
 
// ============================================================================
// INSTÄLLNINGAR
// ============================================================================
function renderSettings() {
    const container = document.getElementById("settings-container");
    
    container.innerHTML = `
        <h2 class="section-title modern-header">Inställningar ⚙️</h2>
        
        <div class="card glass" style="padding: 20px; margin-bottom: 15px;">
            <h3 style="font-size: 16px; margin-bottom: 15px; color: var(--text);">📊 Data & Backup</h3>
            
            <button class="mode-btn blue" style="width: 100%; margin-bottom: 10px; padding: 15px; font-weight: 700;" onclick="exportData()">
                📥 Exportera All Data
            </button>
            
            <button class="mode-btn glass-border" style="width: 100%; margin-bottom: 10px; padding: 15px; font-weight: 700;" onclick="importData()">
                📤 Importera Data
            </button>
            
            <button class="mode-btn" style="width: 100%; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger); padding: 15px; font-weight: 700;" onclick="confirmResetAll()">
                🗑️ Återställ All Data
            </button>
        </div>
        
        <div class="card glass" style="padding: 20px; margin-bottom: 15px;">
            <h3 style="font-size: 16px; margin-bottom: 10px; color: var(--text);">ℹ️ Om Appen</h3>
            <p style="font-size: 13px; color: var(--text-light); line-height: 1.6;">
                <strong style="color: var(--text);">GymTracker Pro</strong><br>
                Version 2.0<br><br>
                En kraftfull träningsapp för att planera, logga och följa din träning.
            </p>
        </div>
    `;
    
    showView("settings-view");
}

function exportData() {
    const data = {
        workoutHistory,
        programData,
        masterExercises,
        calendarOverrides,
        activeDraft,
        secondsElapsed,
        isTimerRunning,
        exportDate: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymtracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert("✅ Data exporterad framgångsrikt!");
}
 
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                if (data.workoutHistory) workoutHistory = data.workoutHistory;
                if (data.programData) programData = data.programData;
                if (data.masterExercises) masterExercises = data.masterExercises;
                if (data.calendarOverrides) calendarOverrides = data.calendarOverrides;
                if (data.activeDraft) activeDraft = data.activeDraft;
                if (data.secondsElapsed !== undefined) secondsElapsed = data.secondsElapsed;
                if (data.isTimerRunning !== undefined) isTimerRunning = data.isTimerRunning;
                
                saveAll();
                
                alert("✅ Data importerad framgångsrikt!");
                location.reload();
            } catch (err) {
                alert("❌ Fel vid import: " + err.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}
 
function confirmResetAll() {
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
            <h3 style="margin-bottom: 15px; color: var(--danger);">Varning!</h3>
            <p style="color: var(--text-light); margin-bottom: 25px; line-height: 1.6;">
                Detta kommer permanent radera:<br><br>
                • All träningshistorik<br>
                • Alla skapade pass<br>
                • Alla övningar<br>
                • Kalenderinställningar<br>
                • Pågående träningspass<br><br>
                <strong style="color: var(--text);">Denna åtgärd kan inte ångras!</strong>
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="mode-btn glass-border" onclick="closeModal()" style="width: 100%; padding: 15px; font-weight: 700;">Avbryt</button>
                <button class="mode-btn" style="width: 100%; background: var(--danger); color: #fff; padding: 15px; font-weight: 700;" onclick="resetAllData()">Radera Allt</button>
            </div>
        </div>
    `;
    openModal();
}
 
function resetAllData() {
    localStorage.clear();
    alert("✅ All data har raderats!");
    location.reload();
}
 
// ============================================================================
// ÖVNINGSBIBLIOTEK
// ============================================================================
function renderExerciseLibrary() {
    filterExercises(currentExerciseCategory);
    showView("exercises-view");
}
 
function filterExercises(category) {
    currentExerciseCategory = category;
    
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`)?.classList.add('active');
    
    const list = document.getElementById("exercise-list");
    list.innerHTML = "";
    
    let filtered;
    if (category === "Alla") {
        filtered = masterExercises;
    } else if (category === "Armar") {
        filtered = masterExercises.filter(ex => ex.target === "Biceps" || ex.target === "Triceps");
    } else {
        filtered = masterExercises.filter(ex => ex.target === category);
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                <div style="font-size: 48px; margin-bottom: 15px;">🔍</div>
                <p style="font-size: 16px; margin-bottom: 10px;">Inga övningar i denna kategori</p>
                <p style="font-size: 13px;">Lägg till egna övningar nedan</p>
            </div>
        `;
        return;
    }
    
    filtered.forEach(ex => {
        const div = document.createElement("div");
        div.className = "card glass";
        div.style.cssText = "padding: 15px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid var(--primary);";
        
        div.innerHTML = `
            <div onclick="showExerciseHistory('${ex.name}')" style="flex-grow: 1; cursor: pointer;">
                <strong style="font-size: 15px; display: block; margin-bottom: 4px; color: var(--text);">${ex.name}</strong>
                <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px;">${ex.target}</small>
            </div>
            <div style="display: flex; gap: 5px;">
                <button onclick="event.stopPropagation(); openEditExerciseModal(${ex.id})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--primary); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✏️</button>
                <button onclick="event.stopPropagation(); deleteMasterExercise(${ex.id})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--danger); cursor: pointer; font-size: 12px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
            </div>
        `;
        
        list.appendChild(div);
    });
}
 
function showExerciseHistory(exerciseName) {
    const history = [];
    
    workoutHistory.forEach(w => {
        const ex = w.exercises.find(e => e.name === exerciseName);
        if (ex && ex.sets_data && ex.sets_data.length > 0) {
            history.push({
                date: w.date,
                sets: ex.sets_data
            });
        }
    });
    
    const body = document.getElementById("modal-body");
    
    if (history.length === 0) {
        body.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 15px;">${exerciseName}</h3>
                <div style="font-size: 48px; margin: 30px 0;">📊</div>
                <p style="color: var(--text-light); font-size: 14px;">Ingen historik för denna övning än.</p>
            </div>
        `;
        openModal();
        return;
    }
    
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    body.innerHTML = `
        <h3 style="text-align: center; margin-bottom: 20px;">${exerciseName}</h3>
        
        <div style="display: flex; flex-direction: column; gap: 15px; max-height: 60vh; overflow-y: auto;">
            ${sortedHistory.map(entry => {
                const maxWeight = Math.max(...entry.sets.map(s => parseFloat(s.weight) || 0));
                const totalReps = entry.sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
                
                return `
                    <div class="card glass" style="padding: 15px; border-left: 3px solid var(--primary);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <strong style="font-size: 14px; color: var(--text);">${entry.date}</strong>
                            <div style="display: flex; gap: 10px; font-size: 11px; color: var(--text-light);">
                                <span>Max: <strong style="color: var(--primary);">${maxWeight} kg</strong></span>
                                <span>Reps: <strong style="color: var(--primary);">${totalReps}</strong></span>
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${entry.sets.map((s, idx) => `
                                <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid var(--primary); padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; font-size: 13px;">
                                    <span style="color: var(--primary); font-size: 10px; font-weight: 800; text-transform: uppercase; min-width: 45px;">Set ${idx + 1}</span>
                                    <span style="color: #ffffff; font-weight: 600;">${s.weight || 0} <small style="color: var(--primary); font-weight: 700;">kg</small> × ${s.reps || 0} <small style="color: var(--primary); font-weight: 700;">reps</small></span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    openModal();
}
function openAddExerciseModal() {
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3 style="text-align: center; margin-bottom: 20px;">Skapa Ny Övning</h3>
        
        <label style="font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px; margin-left: 10px;">Övningsnamn</label>
        <input type="text" id="new-exercise-name" class="log-input" placeholder="T.ex. Bänkpress" style="margin-bottom: 20px;">
        
        <label style="font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 12px; text-align: center;">Välj Muskelgrupp</label>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
            <button class="target-select-btn" data-target="Ben" onclick="selectTarget('Ben', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🦵 Ben
            </button>
            <button class="target-select-btn" data-target="Bröst" onclick="selectTarget('Bröst', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🏋️ Bröst
            </button>
            <button class="target-select-btn" data-target="Rygg" onclick="selectTarget('Rygg', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🪵 Rygg
            </button>
            <button class="target-select-btn" data-target="Axlar" onclick="selectTarget('Axlar', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                👐 Axlar
            </button>
            <button class="target-select-btn" data-target="Biceps" onclick="selectTarget('Biceps', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                💪 Biceps
            </button>
            <button class="target-select-btn" data-target="Triceps" onclick="selectTarget('Triceps', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🔱 Triceps
            </button>
            <button class="target-select-btn" data-target="Bål" onclick="selectTarget('Bål', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s; grid-column: 1 / -1;">
                🧘 Bål
            </button>
        </div>
        
        <button class="mode-btn blue" onclick="saveNewExercise()" style="width: 100%; padding: 15px; font-weight: 700;">Skapa Övning</button>
        
        <style>
            .target-select-btn.selected {
                background: rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
                color: var(--primary) !important;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
            }
        </style>
    `;
    openModal();
}
 
let selectedTarget = null;
 
function selectTarget(target, btn) {
    document.querySelectorAll('.target-select-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTarget = target;
}
 
function saveNewExercise() {
    const name = document.getElementById("new-exercise-name").value.trim();
    
    if (!name) {
        alert("Ange ett namn på övningen!");
        return;
    }
    
    if (!selectedTarget) {
        alert("Välj en muskelgrupp!");
        return;
    }
    
    const exists = masterExercises.find(ex => ex.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert("En övning med detta namn finns redan!");
        return;
    }
    
    const newExercise = {
        id: Date.now(),
        name: name,
        target: selectedTarget
    };
    
    masterExercises.push(newExercise);
    saveAll();
    
    selectedTarget = null;
    closeModal();
    filterExercises(currentExerciseCategory);
}
 
function openEditExerciseModal(exId) {
    const ex = masterExercises.find(e => e.id == exId);
    if (!ex) return;
    
    const body = document.getElementById("modal-body");
    body.innerHTML = `
        <h3 style="text-align: center; margin-bottom: 20px;">Redigera Övning</h3>
        
        <label style="font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px; margin-left: 10px;">Övningsnamn</label>
        <input type="text" id="edit-exercise-name" class="log-input" value="${ex.name}" style="margin-bottom: 20px;">
        
        <label style="font-size: 11px; color: var(--text-light); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 12px; text-align: center;">Muskelgrupp</label>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
            <button class="target-select-btn ${ex.target === 'Ben' ? 'selected' : ''}" data-target="Ben" onclick="selectTarget('Ben', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🦵 Ben
            </button>
            <button class="target-select-btn ${ex.target === 'Bröst' ? 'selected' : ''}" data-target="Bröst" onclick="selectTarget('Bröst', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🏋️ Bröst
            </button>
            <button class="target-select-btn ${ex.target === 'Rygg' ? 'selected' : ''}" data-target="Rygg" onclick="selectTarget('Rygg', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🪵 Rygg
            </button>
            <button class="target-select-btn ${ex.target === 'Axlar' ? 'selected' : ''}" data-target="Axlar" onclick="selectTarget('Axlar', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                👐 Axlar
            </button>
            <button class="target-select-btn ${ex.target === 'Biceps' ? 'selected' : ''}" data-target="Biceps" onclick="selectTarget('Biceps', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                💪 Biceps
            </button>
            <button class="target-select-btn ${ex.target === 'Triceps' ? 'selected' : ''}" data-target="Triceps" onclick="selectTarget('Triceps', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s;">
                🔱 Triceps
            </button>
            <button class="target-select-btn ${ex.target === 'Bål' ? 'selected' : ''}" data-target="Bål" onclick="selectTarget('Bål', this)" style="padding: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text); transition: all 0.2s; grid-column: 1 / -1;">
                🧘 Bål
            </button>
        </div>
        
        <button class="mode-btn blue" onclick="saveEditedExercise(${exId})" style="width: 100%; padding: 15px; font-weight: 700;">Spara Ändringar</button>
        
        <style>
            .target-select-btn.selected {
                background: rgba(59, 130, 246, 0.2) !important;
                border-color: var(--primary) !important;
                color: var(--primary) !important;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
            }
        </style>
    `;
    
    selectedTarget = ex.target;
    openModal();
}
 
function saveEditedExercise(exId) {
    const ex = masterExercises.find(e => e.id == exId);
    if (!ex) return;
    
    const newName = document.getElementById("edit-exercise-name").value.trim();
    
    if (!newName) {
        alert("Ange ett namn på övningen!");
        return;
    }
    
    if (!selectedTarget) {
        alert("Välj en muskelgrupp!");
        return;
    }
    
    const oldName = ex.name;
    ex.name = newName;
    ex.target = selectedTarget;
    
    programData.routine.forEach(p => {
        p.exercises.forEach(e => {
            if (e.name === oldName) {
                e.name = newName;
                e.target = selectedTarget;
            }
        });
    });
    
    workoutHistory.forEach(w => {
        w.exercises.forEach(e => {
            if (e.name === oldName) {
                e.name = newName;
                e.target = selectedTarget;
            }
        });
    });
    
    if (activeDraft) {
        activeDraft.workout.exercises.forEach(e => {
            if (e.name === oldName) {
                e.name = newName;
                e.target = selectedTarget;
            }
        });
    }
    
    saveAll();
    selectedTarget = null;
    closeModal();
    filterExercises(currentExerciseCategory);
}
 
// ============================================================================
// HJÄLPFUNKTIONER
// ============================================================================
function prepareStart(dateStr, programId) {
    const program = programData.routine.find(p => p.id === programId);
    if (!program) return;
    
    closeModal();
    startWorkout(program, null, dateStr, true);
}
 
function setOverride(dateStr, programId) {
    if (programId === 'none') {
        calendarOverrides[dateStr] = 'none';
    } else {
        calendarOverrides[dateStr] = programId;
    }
    saveAll();
    renderCalendar();
    closeModal();
}
 
let currentPressIndex = null;
let hasMoved = false;
 
function startPress(index, event) {
    currentPressIndex = index;
    hasMoved = false;
    
    pressTimer = setTimeout(() => {
        if (!hasMoved && currentPressIndex === index) {
            const btn = event.target;
            btn.style.transform = "scale(0.95)";
            btn.style.opacity = "0.7";
        }
    }, 500);
}
 
function handleTouchMove(event) {
    hasMoved = true;
    cancelPress();
}
 
function handleTouchEnd(index, dateStr, programId, event) {
    cancelPress();
    
    if (!hasMoved && currentPressIndex === index) {
        setOverrideSilent(dateStr, programId);
    }
    
    currentPressIndex = null;
}
function cancelPress() {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
}

async function loadAll() {
    console.log("📥 Laddar all data...");
    
    // Försök att ladda data från Supabase
    await loadFromSupabase();
 
    // Om ingen data finns, ladda från localStorage
    if (masterExercises.length === 0) {
        loadFromLocalStorage();
    }
    
    // Återställ timer och UI
    if (activeDraft) {
        secondsElapsed = activeDraft.secondsElapsed || 0;
        isTimerRunning = activeDraft.wasTimerRunning || false;
        
        if (isTimerRunning) {
            startTimer();
        }
        
        updateTimerDisplay();
        updateTimerControls();
    }
 
    renderHome(); // Visa startsidan
}

// ============================================================================
// INITIALISERING
// ============================================================================
function initApp() {
    loadAll();
    
    if (activeDraft) {
        secondsElapsed = activeDraft.secondsElapsed || 0;
        isTimerRunning = activeDraft.wasTimerRunning || false;
        
        if (isTimerRunning) {
            startTimer();
        }
        
        updateTimerDisplay();
        updateTimerControls();
    }
    
    renderHome();
}

// ============================================================================
// STARTA APPEN
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// ============================================================================
// PWA SERVICE WORKER REGISTRERING
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrerad:', registration);
            })
            .catch(error => {
                console.log('Service Worker registrering misslyckades:', error);
            });
    });
}

// ============================================================================
// SPARA DATA VID STÄNGNING
// ============================================================================
window.addEventListener('beforeunload', () => {
    if (activeDraft) {
        activeDraft.secondsElapsed = secondsElapsed;
        activeDraft.wasTimerRunning = isTimerRunning;
        persistActiveWorkout();
    }
});

// ============================================================================
// FÖRHINDRA ZOOM PÅ DUBBELKLICK (MOBIL)
// ============================================================================
document.addEventListener('dblclick', (e) => {
    e.preventDefault();
}, { passive: false });

// ============================================================================
// HANTERA TILLBAKA-KNAPP
// ============================================================================
window.addEventListener('popstate', (e) => {
    if (document.getElementById("modal").style.display === "flex") {
        closeModal();
    } else {
        renderHome();
    }
});

// ============================================================================
// EXTRA HJÄLPFUNKTIONER
// ============================================================================
function setOverrideSilent(dateStr, programId) {
    if (programId === 'none') {
        calendarOverrides[dateStr] = 'none';
    } else {
        calendarOverrides[dateStr] = programId;
    }
    saveAll();
}

function getDayName(dayIndex) {
    const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    return days[dayIndex];
}

function getShortDayName(dayIndex) {
    const days = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    return days[dayIndex];
}

function getMonthName(monthIndex) {
    const months = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];
    return months[monthIndex];
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = getMonthName(date.getMonth());
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function isToday(dateStr) {
    return dateStr === getTodayString();
}

function isFutureDate(dateStr) {
    return new Date(dateStr) > new Date(getTodayString());
}

function isPastDate(dateStr) {
    return new Date(dateStr) < new Date(getTodayString());
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

function addDays(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function getWeekNumber(dateStr) {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function calculateStreak() {
    if (workoutHistory.length === 0) return 0;
    
    const sortedDates = [...new Set(workoutHistory.map(w => w.date))].sort((a, b) => new Date(b) - new Date(a));
    
    let streak = 0;
    let currentDate = getTodayString();
    
    for (let i = 0; i < sortedDates.length; i++) {
        if (sortedDates[i] === currentDate) {
            streak++;
            currentDate = addDays(currentDate, -1);
        } else if (new Date(sortedDates[i]) < new Date(currentDate)) {
            break;
        }
    }
    
    return streak;
}

function getWorkoutsThisWeek() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return workoutHistory.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfWeek && workoutDate <= endOfWeek;
    }).length;
}

function getWorkoutsThisMonth() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    return workoutHistory.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate.getFullYear() === year && workoutDate.getMonth() === month;
    }).length;
}

function getTotalVolume() {
    let totalVolume = 0;
    
    workoutHistory.forEach(w => {
        w.exercises.forEach(ex => {
            if (ex.sets_data) {
                ex.sets_data.forEach(set => {
                    const weight = parseFloat(set.weight) || 0;
                    const reps = parseInt(set.reps) || 0;
                    totalVolume += weight * reps;
                });
            }
        });
    });
    
    return totalVolume;
}

function getAverageWorkoutDuration() {
    if (workoutHistory.length === 0) return "0h 0m";
    
    let totalSeconds = 0;
    let count = 0;
    
    workoutHistory.forEach(w => {
        if (w.totalTime) {
            const parts = w.totalTime.split(':');
            if (parts.length === 3) {
                totalSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                count++;
            }
        }
    });
    
    if (count === 0) return "0h 0m";
    
    const avgSeconds = Math.floor(totalSeconds / count);
    const hrs = Math.floor(avgSeconds / 3600);
    const mins = Math.floor((avgSeconds % 3600) / 60);
    
    return `${hrs}h ${mins}m`;
}

function getMostFrequentExercise() {
    if (workoutHistory.length === 0) return "Ingen data";
    
    const exerciseFrequency = {};
    
    workoutHistory.forEach(w => {
        w.exercises.forEach(ex => {
            if (!exerciseFrequency[ex.name]) {
                exerciseFrequency[ex.name] = 0;
            }
            exerciseFrequency[ex.name]++;
        });
    });
    
    let maxCount = 0;
    let mostFrequent = "Ingen data";
    
    Object.entries(exerciseFrequency).forEach(([name, count]) => {
        if (count > maxCount) {
            maxCount = count;
            mostFrequent = name;
        }
    });
    
    return `${mostFrequent} (${maxCount}x)`;
}

function getPersonalRecords() {
    const records = {};
    
    workoutHistory.forEach(w => {
        w.exercises.forEach(ex => {
            if (ex.sets_data && ex.sets_data.length > 0) {
                const maxWeight = Math.max(...ex.sets_data.map(s => parseFloat(s.weight) || 0));
                
                if (!records[ex.name] || maxWeight > records[ex.name].weight) {
                    records[ex.name] = {
                        weight: maxWeight,
                        date: w.date
                    };
                }
            }
        });
    });
    
    return records;
}

function showPersonalRecords() {
    const records = getPersonalRecords();
    const body = document.getElementById("modal-body");
    
    if (Object.keys(records).length === 0) {
        body.innerHTML = `
            <div style="text-align: center;">
                <h3 style="margin-bottom: 15px;">Personliga Rekord 🏆</h3>
                <div style="font-size: 48px; margin: 30px 0;">📊</div>
                <p style="color: var(--text-light); font-size: 14px;">Inga personliga rekord registrerade än.</p>
            </div>
        `;
        openModal();
        return;
    }
    
    const sortedRecords = Object.entries(records).sort((a, b) => b[1].weight - a[1].weight);
    
    body.innerHTML = `
        <h3 style="text-align: center; margin-bottom: 20px;">Personliga Rekord 🏆</h3>
        
        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto;">
            ${sortedRecords.map(([name, record], idx) => `
                <div class="card glass" style="padding: 15px; border-left: 3px solid ${idx === 0 ? '#fbbf24' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--primary)'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="font-size: 14px; display: block; margin-bottom: 4px; color: var(--text);">
                                ${idx < 3 ? ['🥇', '🥈', '🥉'][idx] : '🏋️'} ${name}
                            </strong>
                            <small style="font-size: 11px; color: var(--text-light);">${record.date}</small>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 20px; font-weight: 800; color: var(--primary); display: block;">${record.weight} kg</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    openModal();
}

// ============================================================================
// KONSOL-LOGG FÖR UTVECKLING
// ============================================================================
console.log('%c🏋️ GymTracker Pro v2.0 ', 'background: linear-gradient(90deg, #22d3ee, #3b82f6); color: white; font-size: 20px; padding: 10px 20px; border-radius: 8px; font-weight: bold;');
console.log('%cApp initialiserad framgångsrikt!', 'color: #22c55e; font-size: 14px; font-weight: 600;');

// ============================================================================
// SLUT PÅ SCRIPT.JS
// ============================================================================
