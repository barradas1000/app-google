import { createClient, User } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// State
let watchId: number | null = null;
let currentUser: User | null = null;

// DOM Elements
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const locationSection = document.getElementById('location-section') as HTMLElement;
const locationStatus = document.getElementById('location-status') as HTMLSpanElement;
const gpsIcon = document.getElementById('gps-indicator-icon') as HTMLSpanElement;
const latitudeText = document.getElementById('latitude-text') as HTMLSpanElement;
const longitudeText = document.getElementById('longitude-text') as HTMLSpanElement;
const accuracyText = document.getElementById('accuracy-text') as HTMLSpanElement;

/**
 * Updates the visual state of the GPS indicator.
 * @param state - The current state: 'inactive', 'requesting', 'active', 'error', 'sync-error'.
 * @param message - The text message to display.
 */
function updateGpsVisuals(state: 'inactive' | 'requesting' | 'active' | 'error' | 'sync-error', message: string) {
    locationSection.classList.remove('status-inactive', 'status-requesting', 'status-active', 'status-error', 'status-sync-error');
    locationSection.classList.add(`status-${state}`);
    locationStatus.textContent = message;

    switch (state) {
        case 'active':
            gpsIcon.textContent = 'location_on';
            break;
        case 'requesting':
            gpsIcon.textContent = 'gps_not_fixed';
            break;
        case 'error':
            gpsIcon.textContent = 'location_disabled';
            break;
        case 'sync-error':
            gpsIcon.textContent = 'sync_problem';
            break;
        case 'inactive':
        default:
            gpsIcon.textContent = 'location_off';
            break;
    }
}


/**
 * Handles successful location updates.
 * Sends the coordinates to Supabase.
 * @param {GeolocationPosition} position - The position object.
 */
async function handleLocationSuccess(position: GeolocationPosition) {
  const { latitude, longitude, accuracy } = position.coords;

  latitudeText.textContent = latitude.toFixed(6);
  longitudeText.textContent = longitude.toFixed(6);
  accuracyText.textContent = `${accuracy.toFixed(1)}m`;

  if (!currentUser) return;

  try {
    const { error } = await supabase
      .from('active_conductors')
      .upsert({
        conductor_id: currentUser.id,
        current_latitude: latitude,
        current_longitude: longitude,
        accuracy: accuracy,
        last_ping: new Date().toISOString(),
        is_active: true,
        status: 'available',
      }, { onConflict: 'conductor_id' });
    
    if (error) throw error;
    
    // If successful, update visuals to active
    updateGpsVisuals('active', 'Ativo');

  } catch (dbError) {
    console.error('Erro ao atualizar localização:', (dbError as Error).message);
    updateGpsVisuals('sync-error', 'Erro de Sincronização');
  }
}

/**
 * Handles location-related errors.
 * @param {GeolocationPositionError} error - The error object.
 */
function handleLocationError(error: GeolocationPositionError) {
  let errorMessage = 'Ocorreu um erro desconhecido.';
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = 'Permissão de localização negada.';
      alert('Permissão de localização negada.\n\nPara usar a aplicação, por favor, ative os serviços de localização nas configurações do seu dispositivo ou navegador.');
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = 'Informação de localização indisponível.';
      break;
    case error.TIMEOUT:
      errorMessage = 'Tempo esgotado ao obter localização.';
      break;
  }
  updateGpsVisuals('error', errorMessage);
  latitudeText.textContent = '-';
  longitudeText.textContent = '-';
  accuracyText.textContent = '-';
}

/**
 * Starts watching the user's position.
 */
function startTracking() {
  if (watchId !== null) return;

  if (!navigator.geolocation) {
    updateGpsVisuals('error', 'Geolocalização não suportada.');
    return;
  }
  
  updateGpsVisuals('requesting', 'A obter localização...');
  
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  };
  
  watchId = navigator.geolocation.watchPosition(handleLocationSuccess, handleLocationError, options);
}

/**
 * Stops watching the user's position.
 */
function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  updateGpsVisuals('inactive', 'Inativo');
  latitudeText.textContent = '-';
  longitudeText.textContent = '-';
  accuracyText.textContent = '-';
}


/**
 * Handles the login process.
 */
async function handleLogin() {
    const email = prompt("Digite seu e-mail:");
    if (!email) return;
    const password = prompt("Digite sua senha:");
    if (!password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'A iniciar...';

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // UI is updated by onAuthStateChange listener
    } catch (error) {
        alert('E-mail ou senha inválidos.');
        console.error('Erro no login:', (error as Error).message);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sessão';
    }
}

/**
 * Handles the logout process.
 */
async function handleLogout() {
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'A terminar...';

    if (currentUser) {
        try {
            const { error } = await supabase
              .from('active_conductors')
              .upsert({
                  conductor_id: currentUser.id,
                  is_active: false,
                  status: 'offline',
                  session_end: new Date().toISOString(),
              }, { onConflict: 'conductor_id' });
            if (error) throw error;
        } catch (dbError) {
            console.error('Erro ao finalizar sessão na base de dados:', (dbError as Error).message);
        }
    }

    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // UI is updated by onAuthStateChange listener
    } catch (error) {
        alert(`Erro no logout: ${(error as Error).message}`);
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Terminar Sessão';
    }
}

/**
 * Updates UI and tracking based on the user's session.
 * @param user The current user object from Supabase, or null.
 */
async function updateUserState(user: User | null) {
    currentUser = user;

    if (user) {
        loginBtn.style.display = 'none';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sessão';
        
        logoutBtn.style.display = 'inline-block';
        statusText.textContent = `Conectado como ${user.email}`;

        try {
            const { error } = await supabase
              .from('active_conductors')
              .upsert({
                  conductor_id: user.id,
                  is_active: true,
                  status: 'available',
                  session_start: new Date().toISOString(),
                  last_ping: new Date().toISOString(),
                  name: user.email,
                  session_end: null,
              }, { onConflict: 'conductor_id' });
            if (error) throw error;
        } catch (dbError) {
            console.error('Erro ao iniciar sessão na base de dados:', (dbError as Error).message);
            alert('Não foi possível iniciar a sessão de rastreamento. Por favor, tente novamente.');
            handleLogout();
            return;
        }

        startTracking();
    } else {
        loginBtn.style.display = 'inline-block';
        
        logoutBtn.style.display = 'none';
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Terminar Sessão';
        
        statusText.textContent = 'Desconectado';
        stopTracking();
    }
}

// Attach event listeners and set initial state
document.addEventListener('DOMContentLoaded', () => {
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    supabase.auth.onAuthStateChange((_event, session) => {
        updateUserState(session?.user ?? null);
    });
});