// ==========================================================================
// SUPABASE DATABASOPERATIONER
// ==========================================================================

async function loadUserData() {
    if (!currentUser) return;

    try {
        // Ladda custom_program
        const { data : programData, error: programError } = await supabase
            .from('custom_program')
            .select('data')
            .eq('user_id', currentUser.id)
            .single();

        if (programError && programError.code !== 'PGRST116') {
            console.error('Fel vid laddning av program:', programError);
        }

        if (programData && programData.data) {
            window.programData = programData.data;
            if (programData.data.masterExercises) {
                masterExercises = programData.data.masterExercises;
            }
        } else {
            await loadDefaultProgram();
        }

        // Ladda workout_history
        const { data : historyData, error: historyError } = await supabase
            .from('workout_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('workout_date', { ascending: false });

        if (historyError) {
            console.error('Fel vid laddning av historik:', historyError);
        } else {
            workoutHistory = historyData.map(w => ({
                date: w.workout_date,
                programName: w.workout_data.programName,
                totalTime: w.workout_data.totalTime,
                exercises: w.workout_data.exercises
            }));
        }

        // Ladda calendar_overrides
        const { data : calendarData, error: calendarError } = await supabase
            .from('calendar_overrides')
            .select('data')
            .eq('user_id', currentUser.id)
            .single();

        if (calendarError && calendarError.code !== 'PGRST116') {
            console.error('Fel vid laddning av kalender:', calendarError);
        }

        if (calendarData && calendarData.data) {
            calendarOverrides = calendarData.data;
        }

        // Ladda active_draft
        const { data : draftData, error: draftError } = await supabase
            .from('active_draft')
            .select('data')
            .eq('user_id', currentUser.id)
            .single();

        if (draftError && draftError.code !== 'PGRST116') {
            console.error('Fel vid laddning av utkast:', draftError);
        }

        if (draftData && draftData.data && Object.keys(draftData.data).length > 0) {
            activeDraft = draftData.data;
            if (activeDraft && activeDraft.isStarted) {
                secondsElapsed = activeDraft.secondsElapsed || 0;
                if (activeDraft.wasTimerRunning) {
                    startTimer();
                } else {
                    updateTimerDisplay();
                }
            }
        }

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

    const { data : existing } = await supabase
        .from('custom_program')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

    if (existing) {
        const { error } = await supabase
            .from('custom_program')
            .update({ data:dataToSave })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av program:', error);
    } else {
        const { error } = await supabase
            .from('custom_program')
            .insert([{ user_id: currentUser.id, data:dataToSave }]);

        if (error) console.error('Fel vid skapande av program:', error);
    }
}

async function saveWorkoutHistory(workout) {
    if (!currentUser) return;

    const { error } = await supabase
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

    const { data : existing } = await supabase
        .from('calendar_overrides')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

    if (existing) {
        const { error } = await supabase
            .from('calendar_overrides')
            .update({ data : calendarOverrides })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av kalender:', error);
    } else {
        const { error } = await supabase
            .from('calendar_overrides')
            .insert([{ user_id: currentUser.id, data : calendarOverrides }]);

        if (error) console.error('Fel vid skapande av kalender:', error);
    }
}

async function saveActiveDraft() {
    if (!currentUser) return;

    const { data : existing } = await supabase
        .from('active_draft')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

    const draftData = activeDraft || {};

    if (existing) {
        const { error } = await supabase
            .from('active_draft')
            .update({ draft_data : draftData })
            .eq('user_id', currentUser.id);

        if (error) console.error('Fel vid uppdatering av utkast:', error);
    } else {
        const { error } = await supabase
            .from('active_draft')
            .insert([{ user_id: currentUser.id, draft_data : draftData }]);

        if (error) console.error('Fel vid skapande av utkast:', error);
    }
}

async function deleteWorkoutFromHistory(date, idx) {
    if (!currentUser) return;

    const filtered = workoutHistory.filter(w => w.date === date);
    const item = filtered[idx];
    
    const { error } = await supabase
        .from('workout_history')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('workout_date', date)
        .eq('workout_data->programName', item.programName);

    if (error) {
        console.error('Fel vid radering av träning:', error);
    } else {
        workoutHistory = workoutHistory.filter(w => w !== item);
    }
}

async function clearActiveDraft() {
    if (!currentUser) return;
 
    const { error } = await supabase
        .from('active_draft')
        .update({ draft_data : null })
        .eq('user_id', currentUser.id);
 
    if (error) {
        console.error('Fel vid rensning av utkast:', error);
    }
}
