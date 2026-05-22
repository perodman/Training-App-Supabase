// ==========================================================================
// SUPABASE DATABASOPERATIONER (DUBBLETT-SÄKRAD MED UNIKA WORKOUT-ID:N)
// ==========================================================================

async function loadUserData() {
    if (!currentUser) return;

    try {
        console.log("Startar synkroniserad laddning av data från Supabase...");

        // 1. SÄKRA UPPA GRUNDSTRUKTURER I WINDOW-OBJEKTET SOM BACKUP
        if (!window.programData) {
            try { window.programData = JSON.parse(localStorage.getItem("myCustomProgram")); } catch(e) { window.programData = null; }
        }
        if (typeof masterExercises === 'undefined' || !masterExercises) {
            try { masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]"); } catch(e) { masterExercises = []; }
        }
        if (typeof workoutHistory === 'undefined' || !workoutHistory) {
            try { workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]"); } catch(e) { workoutHistory = []; }
        }
        if (typeof calendarOverrides === 'undefined' || !calendarOverrides) {
            try { calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}"); } catch(e) { calendarOverrides = {}; }
        }

        // 2. LADDAR CUSTOM_PROGRAM (Rutiner: Full Body A / Full Body B)
        const { data : programDataResult, error: programError } = await supabaseClient
            .from('custom_program')
            .select('data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (programError) {
            console.error('Fel vid laddning av program:', programError);
        }

        if (programDataResult && programDataResult.data && programDataResult.data.routine && programDataResult.data.routine.length > 0) {
            window.programData = programDataResult.data;
            localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
            if (programDataResult.data.masterExercises) {
                masterExercises = programDataResult.data.masterExercises;
                localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
            }
        } else {
            await loadDefaultProgram();
        }

        if (typeof programData !== 'undefined') programData = window.programData;

        // 3. LADDAR WORKOUT_HISTORY (Genomförda pass)
        const { data : historyData, error: historyError } = await supabaseClient
            .from('workout_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('workout_date', { ascending: false });

        if (historyError) {
            console.error('Fel vid laddning av historik:', historyError);
        } else if (historyData) {
            workoutHistory = historyData.map(w => ({
                id: w.workout_data ? w.workout_data.id : (w.id || Date.now() + Math.random()), // Rädda/skapa ID
                date: w.workout_date,
                programName: w.workout_data ? w.workout_data.programName : "Okänt pass",
                totalTime: w.workout_data ? w.workout_data.totalTime : 0,
                exercises: (w.workout_data && w.workout_data.exercises) ? w.workout_data.exercises : []
            }));
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        }

        // 4. LADDAR CALENDAR_OVERRIDES (Användarens egna planerade pass)
        const { data : calendarData, error: calendarError } = await supabaseClient
            .from('calendar_overrides')
            .select('data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (calendarError) {
            console.error('Fel vid laddning av kalender:', calendarError);
        }

        if (calendarData && calendarData.data) {
            calendarOverrides = calendarData.data;
            localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
        } else {
            calendarOverrides = {};
            localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
        }

        // 5. LADDAR ACTIVE_DRAFT
        const { data : draftData, error: draftError } = await supabaseClient
            .from('active_draft')
            .select('draft_data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (draftError) {
            console.error('Fel vid laddning av utkast:', draftError);
        }

        if (draftData && draftData.draft_data && Object.keys(draftData.draft_data).length > 0) {
            activeDraft = draftData.draft_data;
            localStorage.setItem("activeWorkoutDraft", JSON.stringify(activeDraft));
            
            if (activeDraft && activeDraft.isStarted) {
                secondsElapsed = activeDraft.secondsElapsed || 0;
                if (activeDraft.wasTimerRunning) {
                    if (typeof startTimer === 'function') startTimer();
                } else {
                    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
                }
            }
        } else {
            activeDraft = null;
            localStorage.removeItem("activeWorkoutDraft");
        }

        console.log("All data synkad i loadUserData. Renderar vyer.");
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();

    } catch (err) {
        console.error('Kritiskt fel i loadUserData:', err);
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

async function saveCustomProgram() {
    if (!currentUser) return;
    if (typeof programData !== 'undefined' && programData) window.programData = programData;
    if (!window.programData || !window.programData.routine || window.programData.routine.length === 0) return;

    const dataToSave = { ...window.programData, masterExercises: masterExercises };
    localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));

    const { data : existing } = await supabaseClient
        .from('custom_program')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        await supabaseClient.from('custom_program').update({ data:dataToSave }).eq('user_id', currentUser.id);
    } else {
        await supabaseClient.from('custom_program').insert([{ user_id: currentUser.id, data:dataToSave }]);
    }
}

// STRÄNGT DUBBLETT-SÄKRAD FUNKTION MED UNIKA ID:N
// GLOBAL VARIABEL FÖR ATT STOPPA BLIXTSNABBA DUBBELANROP (Lägg denna precis ovanför funktionen)
let lastWorkoutSavedTime = 0;

async function saveWorkoutHistory(workout) {
    if (!currentUser) return;

    const nowTimestamp = Date.now();
    
    // 1. TIDSSPÄRR: Om det var mindre än 5 sekunder sedan vi sparade ett pass, blockera direkt!
    if (nowTimestamp - lastWorkoutSavedTime < 5000) {
        console.warn("⚠️ DUBBLETT-SPÄRR (Tidslås): Funktionen anropades igen alldeles för snabbt! Avbryter.");
        return; 
    }
    
    // Uppdatera tidsstämpeln direkt så att nästa anrop (inom 5 sek) kraschar i spärren ovan
    lastWorkoutSavedTime = nowTimestamp;

    // 2. ID-KONTROLL: Skapa eller kontrollera unikt ID
    const workoutId = workout.id || "workout_" + nowTimestamp + "_" + Math.floor(Math.random() * 1000);
    const idExists = workoutHistory.some(existing => existing.id === workoutId);

    if (idExists) {
        console.warn(`⚠️ DUBBLETT-SPÄRR (ID): Passet med ID ${workoutId} finns redan! Avbryter.`);
        return;
    }

    try {
        console.log("🚀 saveWorkoutHistory körs! Sparar passet:", workout.programName);

        const fullWorkoutObject = {
            id: workoutId,
            date: workout.date,
            programName: workout.programName,
            totalTime: workout.totalTime,
            exercises: workout.exercises
        };

        // Lägg till i localStorage direkt för snabb UX
        workoutHistory.unshift(fullWorkoutObject);
        localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));

        // Skicka till Supabase
        const { error } = await supabaseClient
            .from('workout_history')
            .insert([{
                user_id: currentUser.id,
                workout_date: workout.date,
                workout_data: fullWorkoutObject
            }]);

        if (error) {
            console.error('Fel vid sparande till Supabase:', error);
            workoutHistory.shift(); // Ångra om det misslyckades
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
            lastWorkoutSavedTime = 0; // Återställ tidslåset vid fel
        } else {
            console.log("✅ Passet sparades framgångsrikt i Supabase!");
        }

        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();

    } catch (err) {
        console.error("Internt fel i saveWorkoutHistory:", err);
        lastWorkoutSavedTime = 0;
    }
}

async function saveCalendarOverrides() {
    if (!currentUser) return;
    localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));

    const { data : existing } = await supabaseClient
        .from('calendar_overrides')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        await supabaseClient.from('calendar_overrides').update({ data : calendarOverrides }).eq('user_id', currentUser.id);
    } else {
        await supabaseClient.from('calendar_overrides').insert([{ user_id: currentUser.id, data : calendarOverrides }]);
    }
}

async function saveActiveDraft() {
    if (!currentUser) return;
    const draftData = activeDraft || {};
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(draftData));

    const { data : existing } = await supabaseClient
        .from('active_draft')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        await supabaseClient.from('active_draft').update({ draft_data : draftData }).eq('user_id', currentUser.id);
    } else {
        await supabaseClient.from('active_draft').insert([{ user_id: currentUser.id, draft_data : draftData }]);
    }
}

async function deleteWorkoutFromHistory(date, idx) {
    if (!currentUser) return;

    const filtered = workoutHistory.filter(w => w.date === date);
    const item = filtered[idx];
    if (!item) return;
    
    const { error } = await supabaseClient
        .from('workout_history')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('workout_date', date)
        .eq('workout_data->id', item.id); // Raderar specifikt utifrån ID:t nu!

    if (!error) {
        workoutHistory = workoutHistory.filter(w => w.id !== item.id);
        localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();
    }
}

async function clearActiveDraft() {
    if (!currentUser) return;
    activeDraft = null;
    localStorage.removeItem("activeWorkoutDraft");
    await supabaseClient.from('active_draft').update({ draft_data : null }).eq('user_id', currentUser.id);
}
