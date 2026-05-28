// ==========================================================================
// SUPABASE KONFIGURATION & AUTENTISERING (KOMPLETT)
// ==========================================================================
const SUPABASE_URL = 'https://oixavkihfvbagzlyoocm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v6MqFHOeimJvtx-dZWFn1g_s0YOTUE8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

async function initAuth() {
    window.supabaseDataLoadedOnce = false;  // ← NOLLSTÄLLER FLAGGAN
    
    const response = await supabaseClient.auth.getSession();
    const session = response.data.session;
    
    if (session) {
        currentUser = session.user;
        await loadUserData();
        showApp();
    } else {
        showAuth();
    }
    
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            window.supabaseDataLoadedOnce = false;  // ← NOLLSTÄLLER FLAGGAN
            showAuth();
        }
    });
}

function showAuth() {
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('global-header').classList.add('hidden');
}

function showApp() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('global-header').classList.remove('hidden');
    
    // Vi väntar 50 millisekunder, sen tvingar vi toppen. 
    // Det brukar räcka för att webbläsaren ska "släppa" sin gamla scroll-position.
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 50);
}

// Kopplingar till UI-element för inloggning och registrering
document.addEventListener("DOMContentLoaded", () => {
    const loginCard = document.querySelector('#auth-view > .card');
    const registerCard = document.getElementById('register-card');

    // Den här koden öppnar registreringsfönstret när man klickar på "Skapa konto"
    if (document.getElementById('show-register-btn')) {
        document.getElementById('show-register-btn').onclick = () => {
            if (loginCard) loginCard.classList.add('hidden');
            if (registerCard) registerCard.classList.remove('hidden');
        };
    }
    
    if (document.getElementById('back-to-login-btn')) {
        document.getElementById('back-to-login-btn').onclick = () => {
            if (registerCard) registerCard.classList.add('hidden');
            if (loginCard) loginCard.classList.remove('hidden');
        };
    }
    
    if (document.getElementById('register-btn')) {
        document.getElementById('register-btn').onclick = async () => {
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            
            if (!email || !password) {
                alert('Fyll i både e-post och lösenord');
                return;
            }
            if (password.length < 6) {
                alert('Lösenordet måste vara minst 6 tecken');
                return;
            }
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });
            if (error) {
                alert('Registrering misslyckades: ' + error.message);
            } else {
                alert('Konto skapat! Kontrollera din e-post för att verifiera kontot.');
                document.getElementById('back-to-login-btn').click();
            }
        };
    }

    if (document.getElementById('login-btn')) {
        document.getElementById('login-btn').onclick = async () => {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                alert('Fyll i både e-post och lösenord');
                return;
            }
            
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                alert('Inloggning misslyckades: ' + error.message);
            }
        };
    }
    
    if (document.getElementById('global-logout')) {
        document.getElementById('global-logout').onclick = async () => {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                alert('Utloggning misslyckades: ' + error.message);
            } else {
                // VIKTIGT: Rensa bort ALL lokal data på denna enhet vid utloggning
                localStorage.removeItem("masterExercises");
                localStorage.removeItem("workoutHistory");
                localStorage.removeItem("activeWorkoutDraft");
                localStorage.removeItem("calendarOverrides");
                localStorage.removeItem("myCustomProgram");
                localStorage.removeItem("temp_exercise_draft");
                
                // Nollställ globala variabler i minnet
                window.programData = null;
                masterExercises = [];
                workoutHistory = [];
                activeDraft = null;
                calendarOverrides = {};
                
                currentUser = null;
                showAuth();
                
                // Scrollar upp till toppen innan sidan laddas om för en ren nystart
                window.scrollTo(0, 0);
                location.reload();
            }
        };
    }
    
    initAuth();
});
