// ===========================================================================
// SUPABASE INITIALISERING
// ===========================================================================
const supabaseUrl = 'https://oixavkihfvbagzlyoocm.supabase.co'; [cite: 1]
const supabaseKey = 'sb_publishable_v6MqFHOeimJvtx-dZWFn1g_s0YOTUE8'; [cite: 1]
const client = window.supabase.createClient(supabaseUrl, supabaseKey); [cite: 1]

// Hämta användar-ID efter inloggning
let currentUserId = null; [cite: 2]
async function checkUser() { [cite: 2]
    const { data: { user } } = await client.auth.getUser(); [cite: 2]
    const loginBtn = document.getElementById('login-btn'); [cite: 3]
    
    if (user) { [cite: 3]
        currentUserId = user.id; [cite: 3]
        console.log("Inloggad som:", user.email); [cite: 3]
        if (loginBtn) { [cite: 3]
            loginBtn.innerText = "Inloggad"; [cite: 3]
            loginBtn.style.opacity = "0.6"; [cite: 4]
            loginBtn.onclick = null; [cite: 4]
        }
    } else { [cite: 4]
        console.log("Inte inloggad."); [cite: 4]
        if (loginBtn) { [cite: 4]
            loginBtn.innerText = "Logga in"; [cite: 4]
            loginBtn.onclick = loginWithGitHub; [cite: 5]
        }
    }
} [cite: 5]

// ============================================================================
// GLOBALA VARIABLER (Hela din lista bevarad)
// ============================================================================
let programData = { routine: [] }; // NYTT: Satt till ett säkert startobjekt istället för odefinierat [cite: 5]
let masterExercises = []; [cite: 6]
let workoutHistory = []; [cite: 6]
let activeDraft = null; [cite: 7]
let calendarOverrides = {}; [cite: 7]
let currentViewDate = new Date(); [cite: 7]
let currentExerciseCategory = "Ben"; [cite: 7]
let isAppInitialized = false; [cite: 8]

// Timer-variabler
let timerInterval = null; [cite: 8]
let secondsElapsed = 0; [cite: 8]
let isTimerRunning = false; [cite: 8]

// Touch-hantering
let pressTimer; [cite: 9]
let touchTimeout = null; [cite: 9]
let isLongPress = false; [cite: 9]
let touchStartY = 0; [cite: 9]
let hasScrolled = false; [cite: 9]

// Temporär övningsval
let temporarySelectedExercises = []; [cite: 10]

// ============================================================================
// INLOGGNINGSFUNKTIONEN
// ============================================================================
async function loginWithGitHub() { [cite: 10]
    const { error } = await client.auth.signInWithOAuth({ [cite: 10]
        provider: 'github', [cite: 10]
        options: {
            redirectTo: window.location.origin // Skickar tillbaka användaren hit efter inlogg [cite: 10]
        }
    }); [cite: 10]
    if (error) console.error("Inloggningsfel:", error.message); [cite: 11]
} [cite: 11]

// ============================================================================
// SUPABASE DATAHANTERING
// ============================================================================
// Ladda masterExercises från program.json vid appstart
async function loadMasterExercises() { [cite: 11]
    console.log(" 📥  Laddar masterExercises från program.json..."); [cite: 11]
    try { [cite: 12]
        const response = await fetch('https://raw.githubusercontent.com/perodman/Training-App-Supabase/main/program.json'); [cite: 12]

        // Kontrollera att svaret är OK
        if (!response.ok) { [cite: 12]
            throw new Error('Nätverksfel: ' + response.status); [cite: 12]
        } [cite: 13]

        // Hämta JSON-datan
        const data = await response.json(); [cite: 13]

        // Extrahera övningar
        if (data.routine && data.routine.length > 0) { [cite: 13]
            masterExercises = data.routine.flatMap(routine => routine.exercises); [cite: 13]
            console.log(" ✅   Ö vningar laddade:", masterExercises.length); [cite: 14]
        } else { [cite: 14]
            console.error(" ❌  Inga  ö vningar hittades i program.json."); [cite: 14]
        }
    } catch (error) { [cite: 15]
        console.error(" ❌  Fel vid laddning fr å n program.json:", error); [cite: 15]
        // Hantera fel här, om nödvändigt
    } [cite: 16]
} [cite: 16]

// Anropa funktionen för att ladda datan
loadMasterExercises(); [cite: 16]

async function saveWorkout(workoutData) { [cite: 17]
    const { data, error } = await client [cite: 17]
        .from('workout_history') [cite: 17]
        .insert([{ [cite: 17]
            ...workoutData, [cite: 17]
            user_id: currentUserId // Använd den dynamiska variabeln! [cite: 17]
        }]); [cite: 17]
} [cite: 18]

function renderHome() { [cite: 18]
    showView("home-view"); [cite: 18]

    // Punkt 1: Permanent avgränsande linje på startsidan
    const homeView = document.getElementById("home-view"); [cite: 18]
    const headerP = homeView.querySelector("header p"); [cite: 19]

    // Ta bort ev gamla kopior först för att undvika dubletter vid omladdning
    homeView.querySelectorAll(".home-separator").forEach(s => s.remove()); [cite: 19]

    if (headerP) { [cite: 20]
        const sep = document.createElement("div"); [cite: 20]
        sep.className = "separator home-separator"; [cite: 20]
        sep.style.margin = "25px 0"; [cite: 20]
        headerP.after(sep); [cite: 20]
    }
    if(activeDraft) { [cite: 20]
        document.getElementById("draft-alert").classList.remove("hidden"); [cite: 20]
        document.getElementById("start-new-btn").classList.add("hidden"); [cite: 21]
        document.getElementById("resume-workout-btn").onclick = () => startWorkout(activeDraft.workout, activeDraft.data, activeDraft.date); [cite: 21]
    } else { [cite: 21]
        document.getElementById("start-new-btn").classList.remove("hidden"); [cite: 21]
        document.getElementById("draft-alert").classList.add("hidden"); [cite: 21]
    }
} [cite: 22]

// Ladda ALL data från Supabase vid appstart
async function loadFromSupabase() { [cite: 22]
    if (!currentUserId) return loadFromLocalStorage(); [cite: 22]
    console.log(" 📥  Laddar data från Supabase..."); [cite: 23]
    try { [cite: 23]
        // 1. Ladda workoutHistory
        const { data: historyData } = await client [cite: 23]
            .from('workout_history') [cite: 23]
            .select('workout_data') [cite: 23]
            .eq('user_id', currentUserId) [cite: 23]
            .order('workout_date', { ascending: false }); [cite: 23]
        workoutHistory = historyData ? historyData.map(row => row.workout_data) : []; [cite: 24]
        console.log(" ✅  Tr ä ningshistorik laddad:", workoutHistory.length); [cite: 24]
        
        // 2. Ladda calendarOverrides (utan .single())
        const { data: ovData } = await client [cite: 25]
            .from('calendar_overrides') [cite: 25]
            .select('data') [cite: 25]
            .eq('user_id', currentUserId); [cite: 25]

        if (ovData && ovData.length > 0) calendarOverrides = ovData[0].data; [cite: 26]
        
        // 3. Ladda activeDraft
        const { data: adData } = await client [cite: 26]
            .from('active_draft') [cite: 26]
            .select('data') [cite: 26]
            .eq('user_id', currentUserId); [cite: 26]

        if (adData && adData.length > 0) activeDraft = adData[0].data; [cite: 27]
        
        // 4. Ladda customProgram
        const { data: cpData } = await client [cite: 27]
            .from('custom_program') [cite: 27]
            .select('data') [cite: 27]
            .eq('user_id', currentUserId); [cite: 27]

        if (cpData && cpData.length > 0) programData = cpData[0].data; [cite: 28]
        console.log(" ✅  All data har laddats."); [cite: 28]
    } catch (error) { [cite: 29]
        console.error(" ❌  Fel vid laddning:", error); [cite: 29]
    }
} [cite: 30]

// Fallback: Ladda från localStorage
function loadFromLocalStorage() { [cite: 30]
    console.log(" 📦  Laddar från localStorage (offline-läge)"); [cite: 30]
    masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]"); [cite: 31]
    workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]"); [cite: 31]
    activeDraft = JSON.parse(localStorage.getItem("activeWorkoutDraft") || "null"); [cite: 31]
    calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}"); [cite: 31]
    const savedProgram = JSON.parse(localStorage.getItem("myCustomProgram")); [cite: 32]
    if (savedProgram) programData = savedProgram; [cite: 32]
} [cite: 32]

// Spara ALL data till både Supabase OCH localStorage (HYBRID)
async function saveAll() { [cite: 32]
    // 1. ALLTID spara till localStorage först (instant feedback)
    localStorage.setItem("myCustomProgram", JSON.stringify(programData)); [cite: 32]
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises)); [cite: 33]
    localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory)); [cite: 33]
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides)); [cite: 33]

    if (activeDraft) { [cite: 33]
        localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft)); [cite: 33]
    } else { [cite: 33]
        localStorage.removeItem("activeWorkoutDraft"); [cite: 34]
    }
    
    // 2. Sedan synka till Supabase i bakgrunden
    try { [cite: 34]
        // Spara masterExercises
        const { error: exercisesError } = await client [cite: 34]
            .from('master_exercises') [cite: 34]
            .upsert({ [cite: 34]
                user_id: currentUserId, [cite: 34]
                masterExercises, [cite: 34]
                updated_at: new Date().toISOString() [cite: 34]
            }, { onConflict: 'user_id' }); [cite: 34]

        if (exercisesError) throw exercisesError; [cite: 35]
        
        // Spara workoutHistory
        const { error: historyError } = await client [cite: 35]
            .from('workout_history') [cite: 35]
            .delete() [cite: 35]
            .eq('user_id', currentUserId); [cite: 35]

        if (historyError) throw historyError; [cite: 36]
        for (const workout of workoutHistory) { [cite: 36]
            const { error: insertError } = await client [cite: 36]
                .from('workout_history') [cite: 36]
                .insert({ [cite: 36]
                    user_id: currentUserId, [cite: 37]
                    date: workout.date, [cite: 37]
                    workout [cite: 37]
                }); [cite: 37]

            if (insertError) throw insertError; [cite: 37]
        }
        
        // Spara calendarOverrides
        const { error: overridesError } = await client [cite: 37]
            .from('calendar_overrides') [cite: 37]
            .upsert({ [cite: 37]
                user_id: currentUserId, [cite: 37]
                calendarOverrides, [cite: 38]
                updated_at: new Date().toISOString() [cite: 38]
            }, { onConflict: 'user_id' }); [cite: 38]

        if (overridesError) throw overridesError; [cite: 38]
        
        // Spara activeDraft
        if (activeDraft) { [cite: 38]
            const { error: draftError } = await client [cite: 38]
                .from('active_draft') [cite: 38]
                .upsert({ [cite: 38]
                    user_id: currentUserId, [cite: 38]
                    activeDraft, [cite: 38]
                    updated_at: new Date().toISOString() [cite: 39]
                }, { onConflict: 'user_id' }); [cite: 39]

            if (draftError) throw draftError; [cite: 39]
        } else { [cite: 39]
            await client.from('active_draft').delete().eq('user_id', currentUserId); [cite: 39]
        }
        
        // Spara customProgram
        if (programData) { [cite: 40]
            const { error: programError } = await client [cite: 40]
                .from('custom_program') [cite: 40]
                .upsert({ [cite: 40]
                    user_id: currentUserId, [cite: 40]
                    programData, [cite: 41]
                    updated_at: new Date().toISOString() [cite: 41]
                }, { onConflict: 'user_id' }); [cite: 41]

            if (programError) throw programError; [cite: 41]
        }
        console.log(" ☁️  Data synkad till Supabase"); [cite: 41]
    } catch (error) { [cite: 42]
        console.error(" ⚠️  Kunde inte synka till Supabase (offline?)", error); [cite: 42]
        // Appen fortsätter fungera med localStorage
    } [cite: 43]
}

// ============================================================================
// VIEW-HANTERING
// ============================================================================
function showView(id) { [cite: 43]
    const target = document.getElementById(id); [cite: 43]
    if (!target) { [cite: 44]
        console.error("Vyn hittades inte:", id); [cite: 44]
        return; [cite: 44]
    } [cite: 44]

    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden")); [cite: 44]
    target.classList.remove("hidden"); [cite: 44]

    // Trigger animation
    target.style.animation = 'none'; [cite: 44]
    target.offsetHeight; [cite: 44]
    target.style.animation = null; [cite: 45]

    const menu = document.getElementById("main-menu"); [cite: 45]
    if (menu) menu.classList.remove("hidden"); [cite: 45]

    window.scrollTo(0, 0); [cite: 45]
    console.log("Visar vy:", id); [cite: 45]
} [cite: 45]

function closeModal() { [cite: 45]
    document.getElementById("workout-modal").classList.add("hidden"); [cite: 45]
    const video = document.querySelector("#modal-body video"); [cite: 46]
    if (video) video.pause(); [cite: 46]

    if (typeof hideDefaultCloseButton === 'function') { [cite: 46]
        hideDefaultCloseButton(false); [cite: 46]
    }
    restoreDraftState(); [cite: 46]
} [cite: 47]

function openModal() { [cite: 47]
    const modal = document.getElementById("workout-modal"); [cite: 47]
    if (modal) modal.classList.remove("hidden"); [cite: 47]
    setTimeout(() => { [cite: 48]
        const modalContent = document.querySelector('.modal-content'); [cite: 48]
        if (modalContent) modalContent.scrollTop = 0; [cite: 48]
    }, 20); [cite: 49]
}

// ============================================================================
// TIMER-LOGIK
// ============================================================================
// [Denna sektion fortsätter här och innehåller dina fullständiga logikrutiner...]
function updateTimerDisplay() { [cite: 49]
    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0'); [cite: 49]
    const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0'); [cite: 50]
    const secs = String(secondsElapsed % 60).padStart(2, '0'); [cite: 50]
    document.getElementById("workout-timer").textContent = `${hrs}:${mins}:${secs}`; [cite: 50]
} [cite: 51]

function startTimer() { [cite: 51]
    if (isTimerRunning) return; [cite: 51]
    isTimerRunning = true; [cite: 51]
    if (activeDraft) activeDraft.wasTimerRunning = true; [cite: 51]
    document.getElementById("timer-toggle-btn").textContent = "Pausa  ⏸️ "; [cite: 51]
    timerInterval = setInterval(() => { [cite: 52]
        secondsElapsed++; [cite: 52]
        updateTimerDisplay(); [cite: 52]
        if (activeDraft) { [cite: 52]
            activeDraft.secondsElapsed = secondsElapsed; [cite: 52]
            persistActiveWorkout(); [cite: 52]
        }
    }, 1000); [cite: 53]
} [cite: 53]

function pauseTimer() { [cite: 53]
    isTimerRunning = false; [cite: 53]
    if (activeDraft) activeDraft.wasTimerRunning = false; [cite: 53]
    clearInterval(timerInterval); [cite: 53]
    document.getElementById("timer-toggle-btn").textContent = "Fortsätt  ▶️ "; [cite: 53]
    if (activeDraft) persistActiveWorkout(); [cite: 54]
} [cite: 54]

document.getElementById("timer-toggle-btn").onclick = () => { [cite: 54]
    if (isTimerRunning) pauseTimer(); [cite: 54]
    else startTimer(); [cite: 54]
}; [cite: 55]

// ============================================================================
// ÖVNINGSHANTERING
// ============================================================================
function openCreateExerciseModal(callback = null) { [cite: 55]
    const body = document.getElementById("modal-body"); [cite: 55]

    let selectedCategory = currentExerciseCategory || "Ben"; [cite: 55]

    const categories = [ [cite: 56]
        { id: "Ben", icon: " 🦵 " }, [cite: 56]
        { id: "Bröst", icon: " 🏋️ " }, [cite: 56]
        { id: "Rygg", icon: " 🪵 " }, [cite: 56]
        { id: "Axlar", icon: " 👐 " }, [cite: 56]
        { id: "Armar", icon: " 💪 " }, [cite: 56]
        { id: "Bål", icon: " 🧘 " } [cite: 56]
    ]; [cite: 56]

    body.innerHTML = ` [cite: 57]
    <h3 style="text-align:center; margin-bottom: 20px;">Skapa Ny Övning</h3> [cite: 57]

    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;"> [cite: 57]
    <div style="width: 100%; max-width: 300px;"> [cite: 57]
    <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 8px; text-align: center;">Namn på övning</label> [cite: 57]
    <input type="text" id="new-ex-name" class="log-input" placeholder="T.ex. Knäböj" style="text-align: center;"> [cite: 57]
    </div> [cite: 57]

    <div style="width: 100%;"> [cite: 57]
    <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 12px; text-align: center;">Välj Kategori</label> [cite: 57]

    <div id="category-selector-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 10px;"> [cite: 58]
    ${categories.map(cat => ` [cite: 58]
    <div class="cat-select-item ${cat.id === selectedCategory ? 'active' : ''}" [cite: 58]
    onclick="window.selectModalCategory('${cat.id}')" [cite: 58]
    id="modal-cat-${cat.id}" [cite: 58]
    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;"> [cite: 58]
    <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div> [cite: 59]
    <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${cat.id}</div> [cite: 59]
    </div> [cite: 59]
    `).join('')} [cite: 60]
    </div> [cite: 60]
    </div> [cite: 60]

    <button class="mode-btn blue" id="save-new-ex-btn" style="width: 100%; max-width: 300px; margin-top: 10px;">Spara Övning</button> [cite: 60]
    </div> [cite: 60]

    <style> [cite: 60]
    .cat-select-item.active { [cite: 60]
    background: rgba(59, 130, 246, 0.2) !important; [cite: 60]
    border-color: var(--primary) !important; [cite: 60]
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.2); [cite: 60]
    } [cite: 60]
    .cat-select-item.active div { [cite: 60]
    color: var(--text) !important; [cite: 60]
    } [cite: 60]
    </style> [cite: 60]
    `; [cite: 60]

    window.selectModalCategory = (catId) => { [cite: 60]
        selectedCategory = catId; [cite: 60]
        document.querySelectorAll('.cat-select-item').forEach(el => el.classList.remove('active')); [cite: 60]
        document.getElementById(`modal-cat-${catId}`).classList.add('active'); [cite: 60]
    }; [cite: 60]

    document.getElementById("save-new-ex-btn").onclick = () => { [cite: 60]
        const name = document.getElementById("new-ex-name").value.trim(); [cite: 60]
        if(!name) return alert("Ange ett namn!"); [cite: 60]

        const newEx = { [cite: 60]
            id: Date.now(), [cite: 60]
            name, [cite: 60]
            target: selectedCategory, [cite: 60]
            defaultSets: 3, [cite: 60]
            animation: "" [cite: 60]
        }; [cite: 60]

        masterExercises.push(newEx); [cite: 60]
        saveAll(); [cite: 60]

        if(callback) callback(newEx); [cite: 60]
        else { [cite: 60]
            closeModal(); [cite: 60]
            filterExercises(selectedCategory); [cite: 60]
        }
    }; [cite: 60]

    openModal(); [cite: 60]
} [cite: 60]

function filterExercises(category) { [cite: 60]
    currentExerciseCategory = category; [cite: 60]
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("active", b.dataset.cat === category)); [cite: 61]
    const results = document.getElementById("exercise-results"); [cite: 61]
    results.innerHTML = ""; [cite: 61]
    const filtered = masterExercises.filter(ex => category === "Armar" ? (ex.target === "Biceps" || ex.target === "Triceps") : ex.target === category); [cite: 62]
    filtered.forEach(ex => { [cite: 63]
        const div = document.createElement("div"); [cite: 63]
        div.className = "card glass"; [cite: 63]
        div.style.cssText = "padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; cursor:pointer;"; [cite: 63]

        div.onclick = (e) => { [cite: 63]
            if(e.target.tagName !== 'BUTTON') { [cite: 63]
                showExerciseAnimation(ex.id); [cite: 63]
            }
        }; [cite: 63]

        div.innerHTML = `<div><strong style="font-size:16px;">${ex.name}</strong><br><small style="color:var(--primary); font-weight:800; text-transform:uppercase; font-size:10px;">${ex.target}</small></div> [cite: 63]
        <button style="background:none; border:none; font-size:18px; cursor:pointer;" onclick="openEditExerciseModal(${ex.id})">  ⚙️  </button>`; [cite: 63]
        results.appendChild(div); [cite: 63]
    }); [cite: 63]
} [cite: 64]

function showExerciseAnimation(id) { [cite: 64]
    const ex = masterExercises.find(e => e.id == id); [cite: 64]
    if(!ex) return; [cite: 64]

    const body = document.getElementById("modal-body"); [cite: 64]
    let videoHtml = ""; [cite: 65]

    if(ex.animation) { [cite: 65]
        videoHtml = ` [cite: 65]
        <div style="border-radius:16px; overflow:hidden; background:#000; margin-bottom:15px; border:1px solid var(--glass-border);"> [cite: 65]
        <video src="${ex.animation}" autoplay loop muted playsinline style="width:100%; display:block;"></video> [cite: 65]
        </div> [cite: 65]
        `; [cite: 65]
    } else { [cite: 66]
        videoHtml = ` [cite: 66]
        <div style="padding:40px 20px; text-align:center; background:rgba(255,255,255,0.05); border-radius:16px; margin-bottom:15px; color:var(--text-light); font-size:14px;"> [cite: 66]
        Ingen videoanimation tillgänglig för denna övning.  🎥 [cite: 66]
        </div> [cite: 67]
        `; [cite: 67]
    } [cite: 67]

    body.innerHTML = ` [cite: 67]
    <h3>${ex.name}</h3> [cite: 67]
    ${videoHtml} [cite: 67]
    <div style="text-align:left; color:var(--text-light); font-size:14px; padding:10px;"> [cite: 67]
    <p><strong>Muskelgrupp:</strong> ${ex.target}</p> [cite: 67]
    </div> [cite: 67]
    `; [cite: 67]
    openModal(); [cite: 67]
} [cite: 68]

function openEditExerciseModal(id) { [cite: 68]
    const ex = masterExercises.find(e => e.id == id); [cite: 68]
    if(!ex) return; [cite: 68]
    const body = document.getElementById("modal-body"); [cite: 68]

    let selectedCategory = ex.target; [cite: 69]

    const categories = [ [cite: 69]
        { id: "Ben", icon: " 🦵 " }, [cite: 69]
        { id: "Bröst", icon: " 🏋️ " }, [cite: 69]
        { id: "Rygg", icon: " 🪵 " }, [cite: 69]
        { id: "Axlar", icon: " 👐 " }, [cite: 69]
        { id: "Armar", icon: " 💪 " }, [cite: 69]
        { id: "Bål", icon: " 🧘 " } [cite: 69]
    ]; [cite: 69]

    body.innerHTML = ` [cite: 70]
    <h3 style="text-align:center; margin-bottom: 20px;">Redigera Övning</h3> [cite: 70]

    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;"> [cite: 70]

    <div style="width: 100%; max-width: 300px; margin-bottom: 10px;"> [cite: 70]
    <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 8px; text-align: center;">Namn på övning</label> [cite: 70]
    <input type="text" id="edit-ex-name" class="log-input" value="${ex.name}" style="text-align: center;"> [cite: 70]
    </div> [cite: 70]

    <div style="width: 100%;"> [cite: 70]
    <label style="font-size:11px; color:var(--text-light); text-transform: uppercase; letter-spacing: 1px; display:block; margin-bottom: 12px; text-align: center;">Välj Kategori</label> [cite: 70]

    <div id="edit-category-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 10px;"> [cite: 70]
    ${categories.map(cat => ` [cite: 70]
    <div class="cat-select-item ${cat.id === selectedCategory ? 'active' : ''}" [cite: 70]
    onclick="window.selectEditModalCategory('${cat.id}')" [cite: 71]
    id="edit-modal-cat-${cat.id}" [cite: 71]
    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 5px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s ease;"> [cite: 71]
    <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div> [cite: 71]
    <div style="font-size: 10px; font-weight: 700; color: var(--text-light);">${cat.id}</div> [cite: 72]
    </div> [cite: 72]
    `).join('')} [cite: 72]
    </div> [cite: 72]
    </div> [cite: 72]

    <button class="mode-btn blue" style="width: 100%; max-width: 300px; margin-top: 15px;" onclick="handleUpdateExercise(${id})">Uppdatera</button> [cite: 72]
    <button class="mode-btn" style="color:var(--danger); background:none; font-size:13px; margin-top: 15px; padding: 5px;" onclick="deleteMasterExercise(${id})">Radera övning permanent</button> [cite: 73]
    </div> [cite: 74]

    <style> [cite: 74]
    .cat-select-item.active { [cite: 74]
    background: rgba(59, 130, 246, 0.2) !important; [cite: 74]
    border-color: var(--primary) !important; [cite: 74]
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.2); [cite: 74]
    } [cite: 74]
    .cat-select-item.active div { [cite: 74]
    color: var(--text) !important; [cite: 74]
    } [cite: 74]
    </style> [cite: 74]
    `; [cite: 74]

    window.selectEditModalCategory = (catId) => { [cite: 74]
        selectedCategory = catId; [cite: 74]
        document.querySelectorAll('#edit-category-grid .cat-select-item').forEach(el => el.classList.remove('active')); [cite: 74]
        document.getElementById(`edit-modal-cat-${catId}`).classList.add('active'); [cite: 74]
    }; [cite: 74]

    window.handleUpdateExercise = (exId) => { [cite: 74]
        const nameInput = document.getElementById("edit-ex-name").value.trim(); [cite: 74]
        if(!nameInput) return alert("Namnet får inte vara tomt!"); [cite: 74]

        const exIndex = masterExercises.findIndex(e => e.id == exId); [cite: 74]
        if(exIndex !== -1) { [cite: 74]
            const oldName = masterExercises[exIndex].name; [cite: 74]
            updateExerciseNameInHistory(oldName, nameInput); [cite: 75]

            masterExercises[exIndex].name = nameInput; [cite: 75]
            masterExercises[exIndex].target = selectedCategory; [cite: 75]
            saveAll(); [cite: 75]
            closeModal(); [cite: 75]
            filterExercises(currentExerciseCategory); [cite: 75]
        }
    }; [cite: 75]

    openModal(); [cite: 75]
} [cite: 75]

function updateExerciseNameInHistory(oldName, newName) { [cite: 75]
    if (!oldName || !newName || oldName === newName) return; [cite: 75]

    let updatedCount = 0; [cite: 76]

    workoutHistory.forEach(workout => { [cite: 76]
        if (workout.exercises && Array.isArray(workout.exercises)) { [cite: 76]
            workout.exercises.forEach(exercise => { [cite: 76]
                if (exercise.name === oldName) { [cite: 76]
                    exercise.name = newName; [cite: 76]
                    updatedCount++; [cite: 76]
                }
            }); [cite: 76]
        }
    }); [cite: 76]

    if (updatedCount > 0) { [cite: 77]
        saveAll(); [cite: 77]
        console.log(`Historiken uppdaterad: Ändrade "${oldName}" till "${newName}" på ${updatedCount} ställen.`); [cite: 77]
    } [cite: 78]
}

function renderCalendar(isFromStartBtn = false) { [cite: 78]
    const grid = document.getElementById("calendar-grid"); [cite: 78]
    const label = document.getElementById("month-label"); [cite: 78]
    const infoBox = document.getElementById("calendar-info-box"); [cite: 78]

    // SÄKERHETSKONTROLL: Om vi inte är på kalendervyn, avbryt eller visa vyn först
    if (!grid || !label || !infoBox) { [cite: 79]
        console.warn("Kalender-element hittades inte. Försöker byta vy..."); [cite: 79]
        showView("calendar-view"); [cite: 80]
        // Använd setTimeout för att låta DOM hinna rendera innan vi kör logiken igen
        setTimeout(() => renderCalendar(isFromStartBtn), 50); [cite: 80]
        return; [cite: 80]
    } [cite: 80]
    grid.innerHTML = ""; [cite: 81]
    infoBox.innerHTML = ""; [cite: 81]
    if(isFromStartBtn === true) { [cite: 81]
        infoBox.innerHTML = `<div style="background:rgba(34, 211, 238, 0.1); padding:12px; border-radius:12px; margin-bottom:15px; font-size:13px; text-align:center; color:var(--primary); border:1px solid var(--primary);"> Välj vilken dag du vill starta eller schemalägga ett pass i kalendern nedan 📅 </div>`; [cite: 81]
    } [cite: 81]
    const year = currentViewDate.getFullYear(); [cite: 82]
    const month = currentViewDate.getMonth(); [cite: 82]
    const monthText = currentViewDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' }); [cite: 82]
    label.textContent = monthText.charAt(0).toUpperCase() + monthText.slice(1); [cite: 83]
    const firstDay = new Date(year, month, 1).getDay(); [cite: 83]
    const offset = firstDay === 0 ? 6 : firstDay - 1; [cite: 83]
    const daysInMonth = new Date(year, month + 1, 0).getDate(); [cite: 84]
    const now = new Date(); [cite: 84]
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; [cite: 85]
    for (let i = 0; i < offset; i++) { [cite: 85]
        const emptyDiv = document.createElement("div"); [cite: 85]
        grid.appendChild(emptyDiv); [cite: 86]
    } [cite: 86]
    for (let d = 1; d <= daysInMonth; d++) { [cite: 86]
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; [cite: 86]
        const cell = document.createElement("div"); [cite: 87]
        cell.className = "calendar-cell"; [cite: 87]
        if (dateStr === todayStr) { [cite: 87]
            cell.classList.add("today"); [cite: 87]
        } [cite: 88]
        const hasWorkouts = workoutHistory.filter(w => w.date === dateStr); [cite: 88]
        const isOngoing = activeDraft && activeDraft.date === dateStr && activeDraft.isStarted; [cite: 88]
        const dayOfWeek = new Date(year, month, d).getDay(); [cite: 89]
        const isAutoDay = [1, 3, 5].includes(dayOfWeek); [cite: 89]
        const override = calendarOverrides[dateStr]; [cite: 89]
        let displayPass = null; [cite: 90]
        if (override && override !== "none") displayPass = programData.routine.find(p => p.id === override); [cite: 90]
        else if (isAutoDay && override !== "none") displayPass = programData.routine[d % programData.routine.length]; [cite: 91]
        let info = ""; [cite: 91]
        if (hasWorkouts.length > 0) { [cite: 91]
            cell.classList.add("cell-completed"); [cite: 92]
            info = "✓"; [cite: 92]
        } else if (isOngoing) { [cite: 92]
            cell.classList.add("cell-ongoing"); [cite: 92]
            info = displayPass ? displayPass.name.split(" ").pop() : ""; [cite: 92]
        } else if (displayPass) { [cite: 93]
            cell.classList.add("cell-planned"); [cite: 93]
            info = displayPass.name.split(" ").pop(); [cite: 93]
        } [cite: 93]
        cell.innerHTML = `<span>${d}</span><div class="cell-info">${info}</div>`; [cite: 93]
        cell.onclick = () => openDayManager(dateStr, displayPass, hasWorkouts, isOngoing); [cite: 94]
        grid.appendChild(cell); [cite: 94]
    } [cite: 94]
    showView("calendar-view"); [cite: 94]
} [cite: 95]

function showExercisesForWorkout(idx) { [cite: 95]
    console.log("Visar övningar för workout idx:", idx); [cite: 95]
} [cite: 95]

function startPress(idx, event) { [cite: 95]
    if (!event.target.classList.contains('plan-override-btn')) return; [cite: 95]
    isLongPress = false; [cite: 96]
    hasScrolled = false; [cite: 96]
    if (event.touches) { [cite: 96]
        touchStartY = event.touches[0].clientY; [cite: 96]
    } [cite: 97]
    pressTimer = setTimeout(() => { [cite: 97]
        isLongPress = true; [cite: 97]
        showExercisesForWorkout(idx); [cite: 97]
    }, 500); [cite: 97]
    touchTimeout = setTimeout(() => { [cite: 97]
        isLongPress = true; [cite: 98]
        openProgramPreviewModal(idx); [cite: 98]
    }, 500); [cite: 98]
} [cite: 98]

function cancelPress() { [cite: 98]
    if (pressTimer) { [cite: 98]
        clearTimeout(pressTimer); [cite: 98]
        pressTimer = null; [cite: 99]
    } [cite: 99]
    if (touchTimeout) { [cite: 99]
        clearTimeout(touchTimeout); [cite: 99]
        touchTimeout = null; [cite: 100]
    } [cite: 100]
} [cite: 100]

function handleTouchMove(event) { [cite: 100]
    if (event && event.touches && event.touches[0] && touchStartY > 0) { [cite: 100]
        const currentY = event.touches[0].clientY; [cite: 100]
        const moveDistance = Math.abs(currentY - touchStartY); [cite: 101]
        if (moveDistance > 6) { [cite: 101]
            hasScrolled = true; [cite: 101]
            cancelPress(); [cite: 101]
        } [cite: 102]
    } [cite: 102]
} [cite: 102]

function handleTouchEnd(idx, dateStr, programId, event) { [cite: 102]
    cancelPress(); [cite: 102]
    if (hasScrolled || isLongPress) { [cite: 103]
        if (event) { [cite: 103]
            if (event.cancelable) event.preventDefault(); [cite: 103]
            event.stopPropagation(); [cite: 103]
        } [cite: 103]
        return false; [cite: 104]
    } [cite: 104]
    if (event && event.cancelable) { [cite: 104]
        event.preventDefault(); [cite: 104]
    } [cite: 104]
    setOverrideSilent(dateStr, programId); [cite: 105]
} [cite: 105]

function openProgramPreviewModal(idx) { [cite: 105]
    const pass = programData.routine[idx]; [cite: 105]
    let previewModal = document.getElementById("preview-modal"); [cite: 105]
    if (!previewModal) { [cite: 105]
        previewModal = document.createElement("div"); [cite: 105]
        previewModal.id = "preview-modal"; [cite: 105]
        previewModal.style.position = "fixed"; [cite: 105]
        previewModal.style.top = "0"; [cite: 105]
        previewModal.style.left = "0"; [cite: 106]
        previewModal.style.width = "100vw"; [cite: 106]
        previewModal.style.height = "100vh"; [cite: 106]
        previewModal.style.backgroundColor = "rgba(0, 0, 0, 0.75)"; [cite: 106]
        previewModal.style.backdropFilter = "blur(8px)"; [cite: 106]
        previewModal.style.display = "flex"; [cite: 107]
        previewModal.style.justifyContent = "center"; [cite: 107]
        previewModal.style.alignItems = "flex-start"; [cite: 107]
        previewModal.style.zIndex = "10000"; [cite: 107]
        previewModal.style.transition = "opacity 0.2s ease-out"; [cite: 107]
        document.body.appendChild(previewModal); [cite: 107]
    } [cite: 108]
    previewModal.style.opacity = "0"; [cite: 108]
    previewModal.style.display = "flex"; [cite: 108]
    previewModal.innerHTML = ` [cite: 108]
    <div id="preview-modal-card" class="card glass" style="width: 90%; max-width: 400px; padding: 20px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.95); margin-top: 40px; transition: all 0.2s ease-out; transform: scale(0.95); opacity: 0;"> [cite: 108]
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);"> [cite: 108]
    <h3 style="margin: 0; font-size: 20px; color: #fff;">${pass.name}</h3> [cite: 108]
    <button onclick="closePreviewModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-light); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"> ✖ </button> [cite: 108]
    </div> [cite: 108]
    <div style="max-height: 65vh; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;"> [cite: 108]
    ${pass.exercises.map(e => ` [cite: 109]
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.03);"> [cite: 109]
    <span style="font-weight: 600; color: #ffffff; font-size: 14px;">${e.name}</span>
    <small style="color: var(--primary); font-weight: 800; text-transform: uppercase; font-size: 10px; background: rgba(59, 130, 246, 0.1); padding: 4px 8px; border-radius: 6px;">${e.target || 'Övning'}</small> [cite: 110]
    </div> [cite: 111]
    `).join("")} [cite: 111]
    </div> [cite: 111]
    <button onclick="closePreviewModal()" style="width: 100%; margin-top: 20px; padding: 12px; background: var(--primary); color: #0f172a; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;"> Stäng översikt </button> [cite: 111]
    </div> [cite: 113]
    `; [cite: 113]
    setTimeout(() => { [cite: 113]
        previewModal.style.opacity = "1"; [cite: 113]
        const card = document.getElementById("preview-modal-card"); [cite: 113]
        if (card) { [cite: 113]
            card.style.opacity = "1"; [cite: 113]
            card.style.transform = "scale(1)"; [cite: 113]
        } [cite: 113]
    }, 10); [cite: 113]
} [cite: 113]

function closePreviewModal() { [cite: 113]
    const previewModal = document.getElementById("preview-modal"); [cite: 113]
    const card = document.getElementById("preview-modal-card"); [cite: 113]
    if (card && previewModal) { [cite: 113]
        card.style.opacity = "0"; [cite: 113]
        card.style.transform = "scale(0.95)"; [cite: 113]
        previewModal.style.opacity = "0"; [cite: 113]
        setTimeout(() => { [cite: 113]
            previewModal.style.display = "none"; [cite: 113]
        }, 200); [cite: 113]
    } [cite: 113]
} [cite: 113]

function openDayManager(dateStr, planned, completed, isOngoing) { [cite: 113]
    if (typeof hideDefaultCloseButton === 'function') { [cite: 113]
        hideDefaultCloseButton(false); [cite: 113]
    } [cite: 113]
    const body = document.getElementById("modal-body"); [cite: 113]
    if (body) { [cite: 113]
        body.style.display = "flex"; [cite: 113]
        body.style.flexDirection = "column"; [cite: 113]
        body.style.justifyContent = "flex-start"; [cite: 113]
        body.style.alignItems = "stretch"; [cite: 113]
        body.style.gap = "20px"; [cite: 113]
    } [cite: 114]
    let html = ` [cite: 114]
    <div style="text-align: center; margin: 0 !important; padding: 0 !important;"> [cite: 114]
    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--text-light); font-weight: 600; display: block; margin: 0 !important; padding: 0 !important;">Valt datum</span> [cite: 114]
    <h2 class="section-title modern-header" style="margin: 8px 0 0 0 !important; padding: 0 !important; display: inline-block; font-size: 26px; line-height: 1.1 !important;"> ${dateStr} </h2> [cite: 116]
    </div> [cite: 117]
    `; [cite: 117]
    if (completed.length > 0) { [cite: 117]
        completed.forEach((w, idx) => { [cite: 117]
            const timeStr = w.totalTime ? `  ⏱️  ${w.totalTime}` : ""; [cite: 117]
            html += ` [cite: 117]
            <div class="card glass" style="border-left: 4px solid #22c55e; text-align: left; margin: 0; padding: 15px; border-radius: 16px;"> [cite: 117]
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;"> [cite: 117]
            <div> [cite: 117]
            <strong style="font-size: 16px; color: var(--text); display: block;">${w.programName}</strong> [cite: 117]
            <span style="font-size: 11px; color: var(--text-light); font-weight: 500;">${timeStr || 'Slutfört pass  ✅  '}</span> [cite: 117]
            </div> [cite: 117]
            <div style="display: flex; gap: 5px;"> [cite: 117]
            <button onclick="editLoggedWorkout('${dateStr}', ${idx})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--primary); cursor: pointer; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">  ✏️  </button> [cite: 117]
            <button onclick="openConfirmDeleteModal('${dateStr}', ${idx})" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--danger); cursor: pointer; font-size: 12px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">  ✖  </button> [cite: 118]
            </div> [cite: 120]
            </div> [cite: 120]
            <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px;">`; [cite: 120]
            w.exercises.forEach(ex => { [cite: 120]
                html += ` [cite: 121]
                <div style="font-size: 13px;"> [cite: 121]
                <span style="color: var(--text); font-weight: 600; display: block; margin-bottom: 8px;">${ex.name}</span> [cite: 121]
                <div style="display: flex; flex-direction: column; gap: 6px;">`; [cite: 121]
                if(ex.sets_data) { [cite: 121]
                    ex.sets_data.forEach((s, sIdx) => { [cite: 121]
                        const wVal = s.weight || 0; [cite: 121]
                        const rVal = s.reps || 0; [cite: 121]
                        html += ` [cite: 121]
                        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid var(--primary); padding: 6px 12px; border-radius: 8px; width: fit-content; display: flex; align-items: center; gap: 8px;"> [cite: 121]
                        <span style="color: var(--primary); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Set ${sIdx+1}</span> [cite: 121]
                        <span style="color: #ffffff; font-size: 13px; font-weight: 600;">${wVal} <small style="color: var(--primary); font-weight: 700;">kg</small> × ${rVal} <small style="color: var(--primary); font-weight: 700;">reps</small></span> [cite: 121]
                        </div>`; [cite: 121]
                    }); [cite: 122]
                } else { [cite: 122]
                    html += `<small style="color: var(--text-light);">Inga set registrerade</small>`; [cite: 122]
                } [cite: 122]
                html += `</div></div>`; [cite: 122]
            }); [cite: 123]
            html += `</div></div>`; [cite: 123]
        }); [cite: 123]
    } [cite: 123]
    if (isOngoing) { [cite: 123]
        html += ` [cite: 123]
        <div class="card glass" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 146, 60, 0.1) 100%); border-left: 4px solid #f59e0b; text-align: center; margin: 0; padding: 20px;"> [cite: 123]
        <div style="font-size: 32px; margin-bottom: 10px;">  🔥  </div> [cite: 123]
        <strong style="font-size: 16px; color: var(--text); display: block; margin-bottom: 8px;">Pågående träningspass</strong> [cite: 123]
        <p style="color: var(--text-light); font-size: 13px; margin-bottom: 15px;">Du har ett aktivt pass som inte är slutfört än.</p> [cite: 123]
        <button class="mode-btn" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; width: 100%;" onclick="closeModal(); startWorkout(activeDraft.workout, activeDraft.data, activeDraft.date)">Fortsätt träna</button> [cite: 123]
        </div>`; [cite: 124]
    } [cite: 124]
    if (planned && !isOngoing) { [cite: 124]
        html += ` [cite: 124]
        <div style="margin: 0;"> [cite: 124]
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-light); text-align: center; margin-bottom: 12px; font-weight: 600;">Planerat pass</p> [cite: 124]
        <div class="card glass" style="border-left: 4px solid var(--primary); text-align: center; margin: 0; padding:...
        `;
    }
}

// ============================================================================
// HUVUDINITIALISERING: initApp (Med de fixade klicklyssnarna!)
// ============================================================================
async function initApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;
    console.log(" 🚀  Initialiserar appen...");
    
    await checkUser();
    await loadFromSupabase();

    // Hämta status om aktiv draft
    if (!activeDraft) {
        try {
            const savedDraft = localStorage.getItem("activeWorkoutDraft");
            if (savedDraft) activeDraft = JSON.parse(savedDraft);
        } catch (err) {
            console.error("Kunde inte ladda program.json", err);
        }
    }
    if (activeDraft?.isStarted) {
        secondsElapsed = activeDraft.secondsElapsed || 0;
        activeDraft.wasTimerRunning ? startTimer() : updateTimerDisplay();
    }
    renderHome(); 

    // ==================================================================
    // HUVUDMENY: EVENT LISTENERS (Synkade med index.html)
    // ==================================================================
    
    // ÖVNINGAR (Fungerar redan)
    document.getElementById("view-exercises-btn")?.addEventListener("click", () => {
        console.log("Klick på övningar");
        filterExercises("Ben");
        showView("exercises-view");
    });

    // TRÄNINGSPROGRAM
    document.getElementById("view-programs-btn")?.addEventListener("click", () => {
        console.log("Klick på program");
        renderProgramView(); 
    });

    // TRÄNINGSDAGBOK (Ändrad till korrekt ID från din HTML: "calendar-mode")
    document.getElementById("calendar-mode")?.addEventListener("click", () => {
        console.log("Klick på kalender");
        renderCalendar(); 
    });

    // STATISTIK (Ändrad till korrekt ID från din HTML: "stats-mode")
    document.getElementById("stats-mode")?.addEventListener("click", () => {
        console.log("Klick på statistik");
        renderStats(); 
    });

    console.log(" ✅  Menyknappar inkopplade");
    console.log(" ✅  Appen är redo!");
}

// Starta appen när sidan laddats
if (document.readyState === 'complete') {
    initApp();
} else {
    window.addEventListener('DOMContentLoaded', initApp);
}
