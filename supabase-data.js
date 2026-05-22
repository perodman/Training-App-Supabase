// ==========================================================================
// SUPABASE DATABASOPERATIONER (FIXAT PROBLEM MED NAVIGERING OCH PASS)
// ==========================================================================

async function loadUserData() {
    if (!currentUser) return;

    try {
        console.log("Startar synkroniserad laddning av data från Supabase...");

        // 1. UNITIALISERA/SÄKRA VARIABLER FRÅN LOCALSTORAGE DIREKT
        // Vi läser in existerande data på båda sätten (med och utan window) så app.js är synkad
        if (!window.programData) {
            window.programData = JSON.parse(localStorage.getItem("myCustomProgram"));
            if (window.programData) programData = window.programData;
        }
        if (typeof masterExercises === 'undefined' || !masterExercises) {
            masterExercises = JSON.parse(localStorage.getItem("masterExercises") || "[]");
        }
        if (typeof workoutHistory === 'undefined' || !workoutHistory) {
            workoutHistory = JSON.parse(localStorage.getItem("workoutHistory") || "[]");
        }
        if (typeof calendarOverrides === 'undefined' || !calendarOverrides) {
            calendarOverrides = JSON.parse(localStorage.getItem("calendarOverrides") || "{}");
        }

        // 2. LADDAR CUSTOM_PROGRAM (Dina planerade pass)
        const { data : programDataResult, error: programError } = await supabaseClient
            .from('custom_program')
            .select('data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (programError) {
            console.error('Fel vid laddning av program:', programError);
        }

        if (programDataResult && programDataResult.data) {
            // Sätt datan på BÅDA ställena så att app.js inte tappar bort den vid sidbyten
            window.programData = programDataResult.data;
            programData = programDataResult.data; 
            localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
            
            if (programDataResult.data.masterExercises) {
                masterExercises = programDataResult.data.masterExercises;
                localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
            }
        } else {
            // Om inget program fanns i molnet och inget i minnet, ladda default
            if (!window.programData || !window.programData.routine || window.programData.routine.length === 0) {
                await loadDefaultProgram();
            }
        }

        // Absolut sista spärren: Tillåt aldrig programData att bli helt tomt eller sakna routine-fältet
        if (!window.programData) {
            window.programData = JSON.parse(localStorage.getItem("myCustomProgram")) || { routine: [] };
        }
        if (!window.programData.routine) {
            window.programData.routine = [];
        }
        programData = window.programData; // Håll app.js-variabeln identisk

        // 3. LADDAR WORKOUT_HISTORY (Dina genomförda pass)
        const { data : historyData, error: historyError } = await supabaseClient
            .from('workout_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('workout_date', { ascending: false });

        if (historyError) {
            console.error('Fel vid laddning av historik:', historyError);
        } else if (historyData) {
            workoutHistory = historyData.map(w => ({
                date: w.workout_date,
                programName: w.workout_data ? w.workout_data.programName : "Okänt pass",
                totalTime: w.workout_data ? w.workout_data.totalTime : 0,
                exercises: (w.workout_data && w.workout_data.exercises) ? w.workout_data.exercises : []
            }));
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        }

        // 4. LADDAR CALENDAR_OVERRIDES
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

        console.log("All data är fullständigt synkroniserad och säkrad.");
        
        // Rita upp vyerna
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();

    } catch (err) {
        console.error('Kritiskt fel i loadUserData:', err);
    }
}

async function loadDefaultProgram() {
    try {
        const response = await fetch("program.json");
        const json = await response.json();
        
        window.programData = json;
        programData = json; // Synka app.js lokala variabel
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

    // Säkerställ synk innan sparande
    if (window.programData) programData = window.programData;
    if (programData) window.programData = programData;

    const dataToSave = {
        ...window.programData,
        masterExercises: masterExercises
    };

    localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));

    const { data : existing } = await supabaseClient
        .from('custom_program')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabaseClient
            .from('custom_program')
            .update({ data:dataToSave })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av program:', error);
    } else {
        const { error } = await supabaseClient
            .from('custom_program')
            .insert([{ user_id: currentUser.id, data:dataToSave }]);

        if (error) console.error('Fel vid skapande av program:', error);
    }
}

async function saveWorkoutHistory(workout) {
    if (!currentUser) return;

    const { error } = await supabaseClient
        .from('workout_history')
        .insert([{
            user_id: currentUser.id,
            workout_date: workout.date,
            workout_data:{
                programName: workout.programName,
                totalTime: workout.totalTime,
                exercises: workout.exercises
            }
        }]);

    if (error) {
        console.error('Fel vid sparande av träningshistorik:', error);
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
        const { error } = await supabaseClient
            .from('calendar_overrides')
            .update({ data : calendarOverrides })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av kalender:', error);
    } else {
        const { error } = await supabaseClient
            .from('calendar_overrides')
            .insert([{ user_id: currentUser.id, data : calendarOverrides }]);

        if (error) console.error('Fel vid skapande av kalender:', error);
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
        const { error } = await supabaseClient
            .from('active_draft')
            .update({ draft_data : draftData })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av utkast:', error);
    } else {
        const { error } = await supabaseClient
            .from('active_draft')
            .insert([{ user_id: currentUser.id, draft_data : draftData }]);

        if (error) console.error('Fel vid skapande av utkast:', error);
    }
}

async function deleteWorkoutFromHistory(date, idx) {
    if (!currentUser) return;

    const filtered = workoutHistory.filter(w => w.date === date);
    const item = filtered[idx];
    
    const { error } = await supabaseClient
        .from('workout_history')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('workout_date', date)
        .eq('workout_data->programName', item.programName);

    if (error) {
        console.error('Fel vid radering av träning:', error);
    } else {
        workoutHistory = workoutHistory.filter(w => w !== item);
        localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();
    }
}

async function clearActiveDraft() {
    if (!currentUser) return;
 
    activeDraft = null;
    localStorage.removeItem("activeWorkoutDraft");

    const { error } = await supabaseClient
        .from('active_draft')
        .update({ draft_data : null })
        .eq('user_id', currentUser.id);
 
    if (error) {
        console.error('Fel vid rensning av utkast:', error);
    }
}
