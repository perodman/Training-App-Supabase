// --- 1. SUPABASE INITIALISERING ---
const supabaseUrl = 'https://oixavkihfvbagzlyoocm.supabase.co';
const supabaseKey = 'sb_publishable_v6MqFHOeimJvtx-dZWFn1g_s0YOTUE8'; 

// Vi använder den globala 'supabase' som laddades via din HTML-script-tagg
// Vi skapar klienten och sparar den i en variabel som heter 'client'
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. DINA VARIABLER ---
let masterExercises = [];
let workoutHistory = [];

// --- 3. HÄMTA DATA FRÅN SUPABASE ---
async function loadData() {
    console.log("Hämtar data från Supabase...");
    
    const { data, error } = await client
        .from('workouts')
        .select('*');

    if (error) {
        console.error("Kunde inte hämta data:", error);
    } else {
        console.log("Data hämtad!", data);
        workoutHistory = data; 
    }
}

// --- 4. SPARA DATA TILL SUPABASE ---
async function saveWorkoutToSupabase(workout) {
    const { data, error } = await client
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
