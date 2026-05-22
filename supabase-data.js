// ==========================================================================
// SUPABASE DATABASOPERATIONER (HELT KORRIGERAD & UTAN KRASCHER)
// ==========================================================================

async function loadUserData() {
    if (!currentUser) return;

    try {
        console.log("Startar laddning av data från Supabase...");

        // 1. Ladda workout_history
        const { data: historyData, error: historyError } = await supabaseClient
            .from('workout_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('workout_date', { ascending: false });

        if (historyError) {
            console.error('Fel vid laddning av historik:', historyError);
        } else if (historyData) {
            workoutHistory = historyData.map(w => ({
                date: w.workout_date,
                programName: w.workout_data.programName,
                totalTime: w.workout_data.totalTime,
                exercises: w.workout_data.exercises
            }));
            // MOLNET BESTÄMMER: Synka direkt till enhetens localStorage
            localStorage.setItem("workoutHistory", JSON.stringify(workoutHistory));
        }

        // 2. Ladda calendar_overrides
        const { data: calendarData, error: calendarError } = await supabaseClient
            .from('calendar_overrides')
            .select('data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (calendarError && calendarError.code !== 'PGRST116') {
            console.error('Fel vid laddning av kalender:', calendarError);
        }

        if (calendarData && calendarData.data) {
            calendarOverrides = calendarData.data;
            localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
        } else {
            calendarOverrides = {};
            localStorage.setItem("calendarOverrides", JSON.stringify(calendarOverrides));
        }

        // 3. Ladda active_draft
        const { data: draftData, error: draftError } = await supabaseClient
            .from('active_draft')
            .select('draft_data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (draftError && draftError.code !== 'PGRST116') {
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
            // MOLNET BESTÄMMER: Om inget utkast finns i databasen, rensa bort gamla rester från enheten
            activeDraft = null;
            localStorage.removeItem("activeWorkoutDraft");
        }

        // 4. Ladda custom_program
        const { data: programDataResult, error: programError } = await supabaseClient
            .from('custom_program')
            .select('data')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (programError && programError.code !== 'PGRST116') {
            console.error('Fel vid laddning av program:', programError);
        }

        // Ladda program.json som fallback eller grundstruktur
        const response = await fetch("program.json");
        const json = await response.json();

        if (programDataResult && programDataResult.data) {
            window.programData = programDataResult.data;
            localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
            
            if (programDataResult.data.masterExercises) {
                masterExercises = programDataResult.data.masterExercises;
                localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
            }
        } else {
            // Ingen sparad data i molnet - ladda från program.json
            window.programData = json;
            
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
            
            localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
            localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
            await saveCustomProgram();
        }

        // 5. Uppdatera animationer konsekvent
        masterExercises.forEach(ex => {
            if (ex.name === "Deadlift") ex.animation = "Gemini_Generated_Image_sqtn3ksqtn3ksqtn.mp4";
            if (ex.name === "Barbell Bench Press") ex.animation = "Skärmbild 2026-05-11 124104.mp4";
        });

        console.log("All data laddad utan fel! Uppdaterar gränssnittet.");

        // Tvinga gränssnittet att uppdateras och låsa upp vyerna med den nya synkade datan
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderHome === 'function') renderHome();

    } catch (err) {
        console.error('Oväntat fel vid laddning av data:', err);
    }
}

async function loadDefaultProgram() {
    try {
        const response = await fetch("program.json");
        const json = await response.json();
        
        window.programData = json;
        
        masterExercises = [];
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

        localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
        localStorage.setItem("masterExercises", JSON.stringify(masterExercises));
        await saveCustomProgram();
    } catch (err) {
        console.error('Fel vid laddning av standardprogram:', err);
    }
}

async function saveCustomProgram() {
    if (!currentUser) return;

    const dataToSave = {
        ...window.programData,
        masterExercises: masterExercises
    };

    localStorage.setItem("myCustomProgram", JSON.stringify(window.programData));
    localStorage.setItem("masterExercises", JSON.stringify(masterExercises));

    const { data: existing } = await supabaseClient
        .from('custom_program')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabaseClient
            .from('custom_program')
            .update({ data: dataToSave })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av program:', error);
    } else {
        const { error } = await supabaseClient
            .from('custom_program')
            .insert([{ user_id: currentUser.id, data: dataToSave }]);

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
            workout_data: {
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

    const { data: existing } = await supabaseClient
        .from('calendar_overrides')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabaseClient
            .from('calendar_overrides')
            .update({ data: calendarOverrides })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av kalender:', error);
    } else {
        const { error } = await supabaseClient
            .from('calendar_overrides')
            .insert([{ user_id: currentUser.id, data: calendarOverrides }]);

        if (error) console.error('Fel vid skapande av kalender:', error);
    }
}

async function saveActiveDraft() {
    if (!currentUser) return;

    const draftData = activeDraft || {};
    localStorage.setItem("activeWorkoutDraft", JSON.stringify(draftData));

    const { data: existing } = await supabaseClient
        .from('active_draft')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabaseClient
            .from('active_draft')
            .update({ draft_data: draftData })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av utkast:', error);
    } else {
        const { error } = await supabaseClient
            .from('active_draft')
            .insert([{ user_id: currentUser.id, draft_data: draftData }]);

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
        .update({ draft_data: null })
        .eq('user_id', currentUser.id);
 
    if (error) {
        console.error('Fel vid rensning av utkast:', error);
    }
}
