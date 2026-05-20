// --- 1. SUPABASE INITIALISERING ---
const supabaseUrl = 'https://oixavkihfvbagzlyoocm.supabase.co';
const supabaseKey = 'sb_publishable_v6MqFHOeimJvtx-dZWFn1g_s0YOTUE8'; 

// Vi skapar klienten. Om 'supabase' redan finns definierad via HTML-scriptet,
// så använder vi den direkt för att undvika "already declared"-felet.
window.supabase = window.supabase || supabase;
const client = supabase.createClient(supabaseUrl, supabaseKey);

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
