// ==========================================================================
// SUPABASE KONFIGURATION & AUTENTISERING
// ==========================================================================

const SUPABASE_URL = 'https://oixavkihfvbagzlyoocm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9peGF2a2loZnZiYWd6bHlvb2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkwMDAwMDAsImV4cCI6MTg0Njg1MjgwMH0.PLACEHOLDER_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserData();
        showApp();
    } else {
        showAuth();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
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
    renderHome();
}

// Event listeners för autentisering
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-btn').onclick = async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            alert('Fyll i både e-post och lösenord');
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            alert('Inloggning misslyckades: ' + error.message);
        }
    };

    document.getElementById('github-login-btn').onclick = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github'
        });

        if (error) {
            alert('GitHub-inloggning misslyckades: ' + error.message);
        }
    };

    document.getElementById('show-register-btn').onclick = () => {
        document.querySelector('#auth-view > .card').classList.add('hidden');
        document.getElementById('register-card').classList.remove('hidden');
    };

    document.getElementById('back-to-login-btn').onclick = () => {
        document.getElementById('register-card').classList.add('hidden');
        document.querySelector('#auth-view > .card').classList.remove('hidden');
    };

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

        const { data, error } = await supabase.auth.signUp({
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

    document.getElementById('global-logout').onclick = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            alert('Utloggning misslyckades: ' + error.message);
        }
    };

    initAuth();
});
