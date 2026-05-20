// --- 1. SUPABASE INITIALISERING ---
const supabaseUrl = 'https://oixavkihfvbagzlyoocm.supabase.co';
const supabaseKey = 'sb_publishable_v6MqFHOeimJvtx-dZWFn1g_s0YOTUE8'; 

// Vi skapar variabeln 'supabase' här. 
// OBS: Vi använder 'supabase.createClient' istället för 'supabaseClient.createClient'
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. DINA VARIABLER ---
let masterExercises = [];
let workoutHistory = [];

// --- 3. HÄMTA DATA FRÅN SUPABASE ---
async function loadData() {
    console.log("Hämtar data från Supabase...");
    
    // Vi hämtar data från tabellen 'workouts'
    const { data, error } = await supabase
        .from('workouts')
        .select('*');

    if (error) {
        console.error("Kunde inte hämta data:", error);
    } else {
        console.log("Data hämtad!", data);
        workoutHistory = data; 
        // Här kan du anropa din funktion som ritar upp din vy
        // renderHome(); 
    }
}

// --- 4. SPARA DATA TILL SUPABASE ---
async function saveWorkoutToSupabase(workout) {
    const { data, error } = await supabase
        .from('workouts')
        .insert([{ workout_data: workout }]);

    if (error) {
        console.error("Kunde inte spara:", error);
    } else {
        console.log("Pass sparad i molnet!");
    }
}

// Kör igång appen
loadData();
