// Fix: Removed `/// <reference types="vite/client" />` which was causing a "Cannot find type definition file" error. The necessary type definitions for `import.meta.env` are now handled globally by `src/vite-env.d.ts`.
import { createClient, User } from '@supabase/supabase-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Configuração do Supabase com Vite Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const appContainer = document.getElementById('app-container');

// Verifica se as chaves do Supabase foram carregadas
if (!supabaseUrl || !supabaseKey) {
    if (appContainer) {
        appContainer.innerHTML = `
            <div style="padding: 1rem; text-align: left; background: #fff1f1; border: 1px solid #d32f2f; border-radius: 8px; color: #333;">
                <h1 style="color: #d32f2f; font-size: 1.2rem;">Erro de Configuração</h1>
                <p>As variáveis de ambiente do Supabase não foram encontradas.</p>
                <p><strong>Para resolver:</strong></p>
                <ol style="padding-left: 20px;">
                    <li>Se estiver a desenvolver localmente, copie <code>.env.example</code> para <code>.env</code> e preencha as suas chaves.</li>
                    <li>Se estiver a fazer o deploy (ex: Vercel), adicione as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nas configurações do projeto.</li>
                </ol>
                <p>Após configurar, reinicie o servidor de desenvolvimento.</p>
            </div>
        `;
    }
  // Interrompe a execução do script para evitar mais erros
  throw new Error("Erro de Configuração: As variáveis de ambiente do Supabase não foram definidas.");
}

// Sistema de storage com fallback para diferentes ambientes
const getStorage = () => {
    try {
        // Primeiro tenta localStorage (persistente entre sessões)
        if (typeof localStorage !== 'undefined') {
            return localStorage;
        }
    } catch (e) {
        console.warn('localStorage não disponível, tentando sessionStorage');
    }
    
    try {
        // Se localStorage falhar, tenta sessionStorage (persistente durante a sessão)
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage;
        }
    } catch (e) {
        console.warn('sessionStorage não disponível, usando memory storage');
    }
    
    // Último recurso: storage em memória (dados perdidos no refresh)
    const storageData: Record<string, any> = {};
    return {
        getItem: (key: string) => {
            const item = storageData[key];
            return item ? JSON.stringify(item) : null;
        },
        setItem: (key: string, value: string) => {
            storageData[key] = JSON.parse(value);
        },
        removeItem: (key: string) => {
            delete storageData[key];
        }
    };
};

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: getStorage(),
    }
});

// State
let watchId: number | null = null;
let currentUser: User | null = null;
let map: L.Map | null = null;
let tuktukMarker: L.Marker | null = null;

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
const mapContainer = document.getElementById('map') as HTMLElement;

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
 * Initializes the map view.
 * @param lat - Initial latitude.
 * @param lng - Initial longitude.
 */
function initializeMap(lat: number, lng: number) {
  if (map) return; // Already initialized

  mapContainer.style.display = 'block';
  map = L.map(mapContainer).setView([lat, lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const tuktukIcon = L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00796b" width="36px" height="36px">
        <path d="M0 0h24v24H0z" fill="none"/>
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11C5.84 5 5.28 5.42 5.08 6.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    `,
    className: 'tuktuk-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });

  tuktukMarker = L.marker([lat, lng], { icon: tuktukIcon }).addTo(map);
  
  // Add initial tooltip
  if (currentUser) {
      const displayName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email;
      const formattedTime = new Date().toLocaleTimeString('pt-PT');
      tuktukMarker.bindTooltip(
          `<b>${displayName}</b><br>Atualizado: ${formattedTime}`,
          { permanent: false, sticky: true }
      );
  }
}

/**
 * Destroys the map instance to free up resources.
 */
function destroyMap() {
    if (map) {
        map.remove();
        map = null;
        tuktukMarker = null;
    }
    mapContainer.style.display = 'none';
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

  if (!map) {
    initializeMap(latitude, longitude);
  } else if (tuktukMarker && map) {
    const newLatLng = new L.LatLng(latitude, longitude);
    tuktukMarker.setLatLng(newLatLng);
    map.panTo(newLatLng);

    // Update tooltip content
    if (currentUser) {
        const displayName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email;
        const formattedTime = new Date().toLocaleTimeString('pt-PT');
        tuktukMarker.setTooltipContent(`<b>${displayName}</b><br>Atualizado: ${formattedTime}`);
    }
  }

  if (!currentUser) return;

  try {
    // Primeiro busca o perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentUser.id)
      .single();
    
    if (profileError || !profile) {
        throw new Error('Nenhum perfil encontrado para este utilizador');
    }

    // Depois busca o condutor usando o ID do perfil
    const { data: conductor, error: conductorError } = await supabase
      .from('conductors')
      .select('id')
      .eq('user_id', profile.id)
      .single();
    
    if (conductorError || !conductor) {
        throw new Error('Nenhum condutor encontrado para este utilizador');
    }

    const { error } = await supabase
      .from('active_conductors')
      .upsert({
        conductor_id: conductor.id,
        current_latitude: latitude,
        current_longitude: longitude,
        accuracy: accuracy,
        last_ping: new Date().toISOString(),
        is_active: true,
        is_available: true,
        status: 'available',
        updated_at: new Date().toISOString()
      }, { onConflict: 'conductor_id' });
    
    if (error) throw error;
    
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
  destroyMap();
}


/**
 * Handles the login process.
 */
async function handleLogin() {
    const email = prompt("Digite seu email:");
    if (!email) return;
    const password = prompt("Digite sua senha:");
    if (!password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'A iniciar...';

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    } catch (error) {
        alert('Email ou senha inválidos.');
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
            // Primeiro busca o perfil do usuário
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', currentUser.id)
              .single();
            
            if (!profileError && profile) {
                // Depois busca o condutor usando o ID do perfil
                const { data: conductor, error: conductorError } = await supabase
                  .from('conductors')
                  .select('id')
                  .eq('user_id', profile.id)
                  .single();
                
                if (!conductorError && conductor) {
                    const { error: upsertError } = await supabase
                      .from('active_conductors')
                      .upsert({
                          conductor_id: conductor.id,
                          is_active: false,
                          is_available: false,
                          status: 'offline',
                          session_end: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                      }, { onConflict: 'conductor_id' });
                    if (upsertError) throw upsertError;
                }
            }
        } catch (dbError) {
            console.error('Erro ao finalizar sessão na base de dados:', (dbError as Error).message);
        }
    }

    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        alert(`Erro no logout: ${(error as Error).message}`);
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Terminar Sessão';
    }
}

/**
 * Shows a welcome popup message.
 * @param name - The name of the user to welcome.
 */
function showWelcomePopup(name: string) {
    const popup = document.createElement('div');
    popup.className = 'welcome-popup';
    popup.textContent = `Bem-vindo, ${name}! Pronto para começar a aventura?`;
    document.body.appendChild(popup);

    // Trigger fade in animation
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);

    // Set timeout to fade out and remove the popup
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(popup)) {
                document.body.removeChild(popup);
            }
        }, 500); // Wait for fade out transition to finish
    }, 3000); // Popup visible for 3 seconds
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
        
        const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
        statusText.textContent = `Conectado como ${displayName}`;

        try {
            // Primeiro busca o perfil do usuário
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', user.id)
              .single();
            
            if (profileError || !profile) {
                throw new Error('Nenhum perfil encontrado para este utilizador');
            }

            // Depois busca o condutor usando o ID do perfil
            const { data: conductor, error: conductorError } = await supabase
              .from('conductors')
              .select('id')
              .eq('user_id', profile.id)
              .single();
            
            if (conductorError || !conductor) {
                throw new Error('Nenhum condutor encontrado para este utilizador');
            }

            const { error } = await supabase
              .from('active_conductors')
              .upsert({
                  conductor_id: conductor.id,
                  is_active: true,
                  is_available: true,
                  status: 'available',
                  session_start: new Date().toISOString(),
                  last_ping: new Date().toISOString(),
                  name: displayName,
                  session_end: null,
                  current_latitude: 0, // Valor temporário, será atualizado pelo GPS
                  current_longitude: 0, // Valor temporário, será atualizado pelo GPS
                  accuracy: 0, // Valor temporário, será atualizado pelo GPS
                  updated_at: new Date().toISOString()
              }, { onConflict: 'conductor_id' });
            if (error) throw error;
        } catch (dbError) {
            console.error('Erro ao iniciar sessão na base de dados:', (dbError as Error).message);
            alert('Não foi possível iniciar a sessão de rastreamento. Verifique se existe um condutor registado para o seu utilizador.');
            handleLogout();
            return;
        }

        startTracking();
        showWelcomePopup(displayName);

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
