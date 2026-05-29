// ==========================================================================
// SUPABASE DATABASOPERATIONER (DUBBLETT-SÄKRAD MED UNIKA WORKOUT-ID:N)
// ==========================================================================
// SÄKERHETSSPÄRR: Förhindrar att appen gör dolda total-omladdningar mitt under en session
if (typeof window.supabaseDataLoadedOnce === 'undefined') {
    window.supabaseDataLoadedOnce = false;
}

// Global kontrollvariabel för att förhindra parallell rendering och autosave under sparning
window.isSavingWorkout = false;

// LÄGG TILL PARAMETERN isSilent = false HÄR FÖR ATT KUNNA KÖRA I BAKGRUNDEN UTAN HOPP
async function loadUserData(isSilent = false) {
    if (!currentUser) return;
    // JÄRNRIDÅ: Om data redan har synkats en gång, totalvägra att köra om denna tunga funktion!
    if (window.supabaseDataLoadedOnce === true) {
        console.log(" 🛑  [SUPABASE-DATA] loadUserData avbröts aktivt. Sessionen är redan initierad. Skyddar lokalt minne.");
        return;
    }
    try {
        console.log("Startar synkroniserad laddning av data från Supabase...");
        // 1. SÄKRA UPP GRUNDSTRUKTURER I WINDOW-OBJEKTET SOM BACKUP
        if (!window.programData) {
            try { window.programData = JSON.parse(localStorage.getItem("myCustomProgram")); } catch(e) { window.programData = null; }
        }
        if (typeof window.masterExercises === 'undefined' || !window.masterExercises) {
            try { window.masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]"); } catch(e) { window.masterExercises = []; }
        }
        if (typeof window.workoutHistory === 'undefined' || !window.workoutHistory) {
            try { window.workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]"); } catch(e) { window.workoutHistory = []; }
        }
        if (typeof window.calendarOverrides === 'undefined' || !window.calendarOverrides) {
            try { window.calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}"); } catch(e) { window.calendarOverrides = {}; }
        }
        if (typeof window.activeDraft === 'undefined') {
            try { window.activeDraft = JSON.parse(localStorage.getItem("activeWorkoutDraft") || "null"); } catch(e) { window.activeDraft = null; }
        }
        // 2. LADDAR CUSTOM_PROGRAM
        const { data : programDataResult, error: programError } = await supabaseClient
            .from('custom_program')
            .select('data')
            .eq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle();
        if (programError && programError.code !== 'PGRST116') {
            console.error('Fel vid laddning av program:', programError);
        }
        if (programDataResult && programDataResult.data && programDataResult.data.routine && programDataResult.data.routine.length > 0) {
            window.programData = programDataResult.data;
            localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
            if (programDataResult.data.masterExercises) {
                window.masterExercises = programDataResult.data.masterExercises;
                localStorage.setItem("masterExercises", JSON.stringify(window.masterExercises));
            }
        } else {
            if (!window.programData || !window.programData.routine || window.programData.routine.length === 0) {
                await loadDefaultProgram();
            }
        }
        // Synka globala variabler i app.js
        if (typeof programData !== 'undefined') programData = window.programData;
        if (typeof masterExercises !== 'undefined') masterExercises = window.masterExercises;
        if (typeof workoutHistory !== 'undefined') workoutHistory = window.workoutHistory;
        if (typeof calendarOverrides !== 'undefined') calendarOverrides = window.calendarOverrides;
        // 3. LADDAR WORKOUT_HISTORY
        const { data : historyData, error: historyError } = await supabaseClient
            .from('workout_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('workout_date', { ascending: false });
        if (historyError) {
            console.error('Fel vid laddning av historik:', historyError);
        } else if (historyData) {
            window.workoutHistory = historyData.map(w => ({
                id: w.workout_data ? w.workout_data.id : (w.id || Date.now() + Math.random()),
                date: w.workout_date,
                programName: w.workout_data ? w.workout_data.programName : "Okänt pass",
                totalTime: w.workout_data ? w.workout_data.totalTime : 0,
                exercises: (w.workout_data && w.workout_data.exercises) ? w.workout_data.exercises : []
            }));
            localStorage.setItem("workoutHistory", JSON.stringify(window.workoutHistory));
            if (typeof workoutHistory !== 'undefined') workoutHistory = window.workoutHistory;
        }
        // 4. LADDAR CALENDAR_OVERRIDES
        const { data : calendarData, error: calendarError } = await supabaseClient
            .from('calendar_overrides')
            .select('data')
            .eq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle();
        if (calendarError && calendarError.code !== 'PGRST116') {
            console.error('Fel vid laddning av kalender:', calendarError);
        }
        if (calendarData && calendarData.data) {
            window.calendarOverrides = calendarData.data;
            localStorage.setItem("calendarOverrides", JSON.stringify(window.calendarOverrides));
        } else {
            window.calendarOverrides = {};
            localStorage.setItem("calendarOverrides", JSON.stringify(window.calendarOverrides));
        }
        if (typeof calendarOverrides !== 'undefined') calendarOverrides = window.calendarOverrides;
        // 5. LADDAR ACTIVE_DRAFT (UPPDATERAD TILL KOLUMNEN 'data')
        const { data : draftRow, error: draftError } = await supabaseClient
            .from('active_draft')
            .select('data')
            .eq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle();
        if (draftError && draftError.code !== 'PGRST116') {
            console.error('Fel vid laddning av utkast:', draftError);
        }
        // Kontrollerar att vi har en rad och att den har innehåll i kolumnen 'data'
        if (draftRow && draftRow.data && Object.keys(draftRow.data).length > 0) {
            window.activeDraft = draftRow.data;
            localStorage.setItem("activeWorkoutDraft", JSON.stringify(window.activeDraft));

            // Synka till app.js om variabeln finns
            if (typeof activeDraft !== 'undefined') activeDraft = window.activeDraft;

            if (window.activeDraft && window.activeDraft.isStarted) {
                if (typeof secondsElapsed !== 'undefined') {
                    secondsElapsed = window.activeDraft.secondsElapsed || 0;
                }
                if (window.activeDraft.wasTimerRunning) {
                    if (typeof startTimer === 'function') startTimer();
                } else {
                    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
                }
            }
        } else {
            if (!window.activeDraft || !window.activeDraft.isStarted) {
                window.activeDraft = null;
                localStorage.removeItem("activeWorkoutDraft");
                if (typeof activeDraft !== 'undefined') activeDraft = null;
            }
        }
        console.log(" ✅  All data synkad i loadUserData. Kontrollerar rendering...");
        window.supabaseDataLoadedOnce = true;

        // KONTROLL: Om anropet är tyst (isSilent), rör INTE gränssnittet mitt under en aktiv session!
        if (!isSilent) {
            if (typeof renderCalendar === 'function') renderCalendar();
            if (typeof renderHome === 'function') renderHome();
            // Scrolla till toppen (mobil + desktop)
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
            }, 100);
        } else {
            console.log(" 🤫 [SILENT] Ignorerade rendering av kalendern för att skydda skärmens scrollposition.");
        }
    } catch (err) {
        console.error(' ❌  Kritiskt fel i loadUserData:', err);
    }
}

async function loadDefaultProgram() {
    try {
        console.log("Hämtar exempelpass från program.json...");
        const response = await fetch("program.json");
        const json = await response.json();

        window.programData = json;
        if (typeof programData !== 'undefined') programData = window.programData;
        masterExercises = [];

        if (json && json.routine) {
            json.routine.forEach(p => {
                if (p.exercises) {
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
                }
            });
        }
        localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
        localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
        await saveCustomProgram();
    } catch (err) {
        console.error('Fel vid laddning av standardprogram:', err);
    }
}

// Högst upp i supabase-data.js (eller precis ovanför funktionen)
let isSyncingCustomProgramGlobal = false;

async function saveCustomProgram() {
    if (!currentUser) return;

    // Om en synk redan pågår, avbryt direkt för att förhindra 409-krockar i databasen
    if (isSyncingCustomProgramGlobal) {
        console.log(" ⏳ [DEBUG] Synk av custom_program pågår redan, hoppar över detta anrop.");
        return;
    }

    if (typeof programData !== 'undefined' && programData) {
        window.programData = programData;
    } else if (window.programData) {
        programData = window.programData;
    }
    const currentData = window.programData || { routine: [] };
    const dataToSave = { ...currentData, masterExercises: (typeof masterExercises !== 'undefined' ? masterExercises : []) };

    localStorage.setItem("myCustomProgram", JSON.stringify(currentData));
    if (typeof masterExercises !== 'undefined') {
        localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
    }

    // Lås dörren för efterföljande anrop
    isSyncingCustomProgramGlobal = true;

    console.log("Skickar uppdaterat custom_program till Supabase:", dataToSave);
    try {
        const { data: existing, error: fetchErr } = await supabaseClient
            .from('custom_program')
            .select('id')
            .eq('user_id', currentUser.id)
            .maybeSingle();
            
        if (fetchErr) throw fetchErr;
        
        if (existing) {
            console.log("Uppdaterar befintligt program i Supabase (ID:", existing.id, ")");
            const { error: updateErr } = await supabaseClient
                .from('custom_program')
                .update({ data: dataToSave })
                .eq('user_id', currentUser.id);

            if (updateErr) throw updateErr;
        } else {
            console.log("Skapar nytt program i Supabase för användaren");
            const { error: insertErr } = await supabaseClient
                .from('custom_program')
                .insert([{ user_id: currentUser.id, data: dataToSave }]);

            if (insertErr) throw insertErr;
        }
        console.log(" ✅  Custom program sparades framgångsrikt i Supabase!");
    } catch (err) {
        console.error("Fel vid sparande av custom_program i Supabase:", err);
    } finally {
        // Lås upp dörren när anropet är helt klart (oavsett om det gick bra eller fel)
        isSyncingCustomProgramGlobal = false;
    }
}

let lastWorkoutSavedTime = 0;
async function saveWorkoutHistory(workoutInput) {
    if (!currentUser) return;

    // 1. APPLIKATIONSLÅS: Blockera dubbelklick och stoppa autosaves från att köras parallellt
    if (window.isSavingWorkout) {
        console.warn(" ⚠️  [GUARD] saveWorkoutHistory blockerad eftersom en sparprocess redan pågår.");
        return;
    }
    window.isSavingWorkout = true;

    // Stoppa omedelbart eventuella aktiva timer-intervaller så de inte triggar igång under sparningen
    if (typeof timerInterval !== 'undefined' && timerInterval) clearInterval(timerInterval);
    if (typeof window.timerInterval !== 'undefined' && window.timerInterval) clearInterval(window.timerInterval);

    // Säkerställ att vi arbetar med den absolut senaste datan om det är det aktiva passet
    const workout = (activeDraft && activeDraft.workout && activeDraft.workout.id === workoutInput.id)
        ? {
            ...activeDraft.workout,
            exercises: activeDraft.workout.exercises.map((ex, i) => ({
                name: ex.name,
                target: ex.target,
                sets_data: (activeDraft.data[i]?.sets_data || []).map(s => ({
                    weight: s.weight || 0,
                    reps: s.reps || 0,
                    userConfirmed: s.userConfirmed || false
                }))
            })),
            date: workoutInput.date,
            totalTime: workoutInput.totalTime
        }
        : workoutInput;

    console.log(" 🔍  [DEBUG] saveWorkoutHistory mottog pass:", workout.programName, "med ID:", workout.id);
    const nowTimestamp = Date.now();
    let workoutId = workout.id;
    let isEdit = false;
    let supabaseRowId = null;

    // 2. KOLL: Är detta en edit? (Kontrollera om workoutId redan finns i historiken)
    if (workoutId && workoutHistory.some(e => e.id === workoutId)) {
        isEdit = true;
        console.log(" ✏️  [DEBUG] Detta är en EDIT av befintligt pass med ID:", workoutId);
    }

    // BACKUP-KOLL: Matcha även via datum + programnamn om ID:t inte hittades
    if (!isEdit) {
        const matchandeLokaltPass = workoutHistory.find(e => e.date === workout.date && e.programName === workout.programName);
        if (matchandeLokaltPass) {
            isEdit = true;
            workoutId = matchandeLokaltPass.id;
            console.log(" 🕵️‍♂️ [DETEKTIV] Matchade lokalt pass. Återanvänder ID:", workoutId);
        }
    }

    // 3. TIDSLÅS (endast för nya pass, inte editeringar)
    if (!isEdit && (nowTimestamp - lastWorkoutSavedTime < 5000)) {
        console.warn(" ⚠️  DUBBLETT-SPÄRR: Funktionen anropades för snabbt.");
        window.isSavingWorkout = false;
        return;
    }

    if (!isEdit) {
        lastWorkoutSavedTime = nowTimestamp;
    }
    if (!workoutId) {
        workoutId = "workout_" + nowTimestamp + "_" + Math.floor(Math.random() * 1000);
    }
    const fullWorkoutObject = {
        id: workoutId,
        date: workout.date,
        programName: workout.programName,
        totalTime: workout.totalTime,
        exercises: workout.exercises
    };

    try {
        // 4. DATABAS-DETEKTIV: Hitta rätt rad i Supabase om det är en edit
        if (isEdit) {
            console.log(" 🔎  [DEBUG] Letar i Supabase efter datum:", workout.date);
            const { data: rows, error: fetchErr } = await supabaseClient
                .from('workout_history')
                .select('id, workout_data')
                .eq('user_id', currentUser.id)
                .eq('workout_date', workout.date);

            console.log(" 📊  [DEBUG] Databasen returnerade antal rader:", rows ? rows.length : 0);

            if (!fetchErr && rows && rows.length > 0) {
                const rättRad = rows.find(r => {
                    if (!r.workout_data) return false;
                    const innerId = r.workout_data.id;
                    return innerId === workoutId;
                });
                if (rättRad) {
                    supabaseRowId = rättRad.id;
                    console.log(" 🎯  [DEBUG] MATCHNING HITTAD! Databasens unika Rad-ID:", supabaseRowId);
                }
            }
        }

        // --- LOKAL MINNESHANTERING ---
        if (isEdit) {
            const index = workoutHistory.findIndex(existing => existing.id === workoutId);
            if (index !== -1) {
                workoutHistory[index] = fullWorkoutObject;
                console.log(" ✅  [DEBUG] Uppdaterade lokalt pass på index:", index);
            }
        } else {
            workoutHistory.unshift(fullWorkoutObject);
            console.log(" ➕  [DEBUG] Lade till nytt pass lokalt");
        }

        localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));

        // --- DATABASHANTERING ---
        if (isEdit && supabaseRowId) {
            console.log(" 📝  [DEBUG] Uppdaterar Supabase-rad:", supabaseRowId);
            const { error: updateError } = await supabaseClient
                .from('workout_history')
                .update({
                    workout_date: workout.date,
                    workout_data: fullWorkoutObject
                })
                .eq('id', supabaseRowId);

            if (updateError) throw updateError;
            console.log(" ✅  [DEBUG] Databasen uppdaterad!");
        } else if (isEdit && !supabaseRowId) {
            console.warn(" ⚠️  [DEBUG] Kunde inte hitta Supabase-rad för uppdatering. Försöker skapa ny...");
            const { error: insertError } = await supabaseClient
                .from('workout_history')
                .insert([{
                    user_id: currentUser.id,
                    workout_date: workout.date,
                    workout_data: fullWorkoutObject
                }]);

            if (insertError) throw insertError;
            console.log(" ✅  [DEBUG] Nytt pass sparat (fallback)!");
        } else {
            console.log(" ➕  [DEBUG] Skapar ny rad i Supabase...");
            const { error: insertError } = await supabaseClient
                .from('workout_history')
                .insert([{
                    user_id: currentUser.id,
                    workout_date: workout.date,
                    workout_data: fullWorkoutObject
                }]);

            if (insertError) throw insertError;
            console.log(" ✅  [DEBUG] Nytt pass sparat!");
        }

        // Rendering koordineras och exekveras säkert härifrån
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();

    } catch (err) {
        console.error(" ❌  Allvarligt fel i saveWorkoutHistory:", err);
        if (!isEdit) {
            workoutHistory.shift();
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        }
        lastWorkoutSavedTime = 0;
    } finally {
        // Släpp låset först efter en kort fördröjning för att garantera att alla renderingar körts klart i low-key-mode
        setTimeout(() => {
            window.isSavingWorkout = false;
        }, 400);
    }
}

async function saveCalendarOverrides() {
    if (!currentUser) return;
    try {
        const { data: existingRows, error: checkErr } = await supabaseClient
            .from('calendar_overrides')
            .select('id')
            .eq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle();

        if (checkErr && checkErr.code !== 'PGRST116') throw checkErr;
        if (existingRows && existingRows.id) {
            const { error: updateError } = await supabaseClient
                .from('calendar_overrides')
                .update({ data: calendarOverrides })
                .eq('user_id', currentUser.id);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient
                .from('calendar_overrides')
                .insert([{ user_id: currentUser.id, data: calendarOverrides }]);

            if (insertError) throw insertError;
        }
    } catch (err) {
        console.error(" ❌  Fel vid sparning av calendar_overrides:", err);
    }
}

async function saveActiveDraft() {
    if (!currentUser) return;

    // JÄRNRIDÅ-GUARD: Om vi sparar passet till historiken, blockera och totalvägra att synka utkast parallellt!
    if (window.isSavingWorkout) {
        console.log(" 🧠 [GUARD] saveActiveDraft ignorerades helt eftersom passet håller på att slutgiltigt sparas.");
        return;
    }

    const draftData = activeDraft || {};
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(draftData));
    // Använd 'data' istället för 'draft_data'
    const { data: existing } = await supabaseClient
        .from('active_draft')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();
    if (existing) {
        await supabaseClient.from('active_draft').update({ data : draftData }).eq('user_id', currentUser.id);
    } else {
        await supabaseClient.from('active_draft').insert([{ user_id: currentUser.id, data : draftData }]);
    }
}

// ==========================================================================
// UPPDATERAD OCH SÄKRAD RADERING DIREKT VIA JSON-MATCHNING PÅ SERVERBOTTEN
// ==========================================================================
async function deleteWorkoutFromHistoryV2(dateStr, idx, passedId = null) {
    console.log("📥 [SUPABASE-DATA] deleteWorkoutFromHistoryV2 startad. Datum:", dateStr, "Index:", idx, "Skickat ID:", passedId);

    if (!currentUser) {
        console.warn("⚠️ [SUPABASE-DATA] Ingen inloggad användare, avbryter databasradering.");
        return { success: false, error: "No user" };
    }
    
    try {
        let workoutIdToDelete = passedId;
        
        // Om inget ID skickades, hitta det i localStorage
        if (!workoutIdToDelete) {
            const localHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
            const filtered = localHistory.filter(w => w.date === dateStr);
            
            if (filtered[idx]) {
                workoutIdToDelete = filtered[idx].id;
                console.log("🔍 [SUPABASE-DATA] Hittade träningspass med ID:", workoutIdToDelete);
            }
        }
        
        console.log("🔎 [SUPABASE-DATA] Letar i Supabase efter datum:", dateStr);
        
        // Hämta alla rader för detta datum
        const { rows, error: fetchErr } = await supabaseClient
            .from('workout_history')
            .select('id, workout_data')
            .eq('user_id', currentUser.id)
            .eq('workout_date', dateStr);
        
        if (fetchErr) {
            console.error("❌ [SUPABASE-DATA] Fel vid hämtning:", fetchErr);
            throw fetchErr;
        }
        
        console.log("📊 [SUPABASE-DATA] Hittade", rows ? rows.length : 0, "rader för detta datum");
        
        if (!rows || rows.length === 0) {
            console.warn("⚠️ [SUPABASE-DATA] Ingen rad hittades i Supabase för detta datum");
            return { success: false, error: "No row found in database" };
        }
        
        let supabaseRowId = null;
        
        // Om vi har ett ID, försök matcha det
        if (workoutIdToDelete) {
            for (const row of rows) {
                if (row.workout_data && row.workout_data.id === workoutIdToDelete) {
                    supabaseRowId = row.id;
                    console.log("✅ [SUPABASE-DATA] Matchade Supabase rad-ID via workout_data.id:", supabaseRowId);
                    break;
                }
            }
        }
        
        // Om ingen matchning hittades (gammalt pass utan ID) → ta första passet för datumet
        if (!supabaseRowId) {
            console.warn("⚠️ [SUPABASE-DATA] Inget ID eller ingen matchning. Raderar första passet för detta datum.");
            supabaseRowId = rows[0].id;
            console.log("🗑️ [SUPABASE-DATA] Använder första radens ID:", supabaseRowId);
        }
        
        // Radera baserat på Supabase rad-ID
        console.log("🗑️ [SUPABASE-DATA] Raderar Supabase-rad:", supabaseRowId);
        const { error: deleteError } = await supabaseClient
            .from('workout_history')
            .delete()
            .eq('id', supabaseRowId);
        
        if (deleteError) {
            console.error("❌ [SUPABASE-DATA] Supabase returnerade ett fel vid radering:", deleteError);
            throw deleteError;
        }
        
        console.log("✅ [SUPABASE-DATA] Raden raderades framgångsrikt från Supabase!");
        return { success: true };
        
    } catch (err) {
        console.error("❌ [SUPABASE-DATA] Allvarligt fel i deleteWorkoutFromHistoryV2:", err);
        return { success: false, error: err.message };
    }
}

async function deleteWorkoutFromHistory(date, idx) {
    return await deleteWorkoutFromHistoryV2(date, idx);
}

async function clearActiveDraft() {
    if (!currentUser) return;
    activeDraft = null;
    localStorage.removeItem("activeWorkoutDraft");
    // Ändra till 'data'
    await supabaseClient.from('active_draft').update({ data : null }).eq('user_id', currentUser.id);
}
