import { App } from "@capacitor/app";
import { Geolocation, Position } from "@capacitor/geolocation";
import { createClient, User } from "@supabase/supabase-js";
import "./index.css";

// NOTA: A UI do mapa (Leaflet) foi removida para focar na lógica de rastreamento nativo.
// A UI pode ser reconstruída posteriormente se necessário.

// Configuração do Supabase com Vite Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const appContainer = document.getElementById("app-container");

// Verifica se as chaves do Supabase foram carregadas
if (!supabaseUrl || !supabaseKey) {
  if (appContainer) {
    appContainer.innerHTML = `
            <div style="padding: 1rem; text-align: left; background: #fff1f1; border: 1px solid #d32f2f; border-radius: 8px; color: #333;">
                <h1 style="color: #d32f2f; font-size: 1.2rem;">Erro de Configuração</h1>
                <p>As variáveis de ambiente do Supabase não foram encontradas.</p>
            </div>
        `;
  }
  throw new Error(
    "Erro de Configuração: As variáveis de ambiente do Supabase não foram definidas."
  );
}

// Sistema de storage com fallback
const getStorage = () => {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch (e) {
    console.warn("localStorage não disponível, tentando sessionStorage");
  }

  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch (e) {
    console.warn("sessionStorage não disponível, usando memory storage");
  }

  const storageData: Record<string, any> = {};
  return {
    getItem: (key: string) =>
      storageData[key] ? JSON.stringify(storageData[key]) : null,
    setItem: (key: string, value: string) => {
      storageData[key] = JSON.parse(value);
    },
    removeItem: (key: string) => {
      delete storageData[key];
    },
  };
};

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: getStorage() },
});

// State
let watchId: string | null = null; // O ID do watch do Capacitor é uma string
let currentUser: User | null = null;

// DOM Elements
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const locationSection = document.getElementById(
  "location-section"
) as HTMLElement;
const locationStatus = document.getElementById(
  "location-status"
) as HTMLSpanElement;
const gpsIcon = document.getElementById(
  "gps-indicator-icon"
) as HTMLSpanElement;
const latitudeText = document.getElementById(
  "latitude-text"
) as HTMLSpanElement;
const longitudeText = document.getElementById(
  "longitude-text"
) as HTMLSpanElement;
const accuracyText = document.getElementById(
  "accuracy-text"
) as HTMLSpanElement;

function updateGpsVisuals(
  state: "inactive" | "requesting" | "active" | "error" | "sync-error",
  message: string
) {
  locationSection.classList.remove(
    "status-inactive",
    "status-requesting",
    "status-active",
    "status-error",
    "status-sync-error"
  );
  locationSection.classList.add(`status-${state}`);
  locationStatus.textContent = message;
  const iconMap = {
    active: "location_on",
    requesting: "gps_not_fixed",
    error: "location_disabled",
    "sync-error": "sync_problem",
    inactive: "location_off",
  };
  gpsIcon.textContent = iconMap[state] || "location_off";
}

function storeOfflineLocation(
  latitude: number,
  longitude: number,
  accuracy: number
) {
  if (!currentUser) return;
  const offlineData = {
    latitude,
    longitude,
    accuracy,
    timestamp: new Date().toISOString(),
    userId: currentUser.id,
  };
  const offlineLocations = JSON.parse(
    localStorage.getItem("offlineLocations") || "[]"
  );
  offlineLocations.push(offlineData);
  localStorage.setItem(
    "offlineLocations",
    JSON.stringify(offlineLocations.slice(-100))
  );
}

async function syncOfflineLocations() {
  const offlineLocations = JSON.parse(
    localStorage.getItem("offlineLocations") || "[]"
  );
  if (offlineLocations.length === 0) return;

  console.log(
    `Tentando sincronizar ${offlineLocations.length} localizações offline...`
  );

  for (const location of offlineLocations) {
    try {
      if (!currentUser || location.userId !== currentUser.id) continue;

      const { data: conductor } = await supabase
        .from("conductors")
        .select("id")
        .eq("user_id", currentUser.id)
        .single();
      if (!conductor) continue;

      const { error } = await supabase.from("active_conductors").upsert(
        {
          conductor_id: conductor.id,
          current_latitude: location.latitude,
          current_longitude: location.longitude,
          accuracy: location.accuracy,
          last_ping: location.timestamp,
          is_active: true,
          is_available: true,
          status: "available",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "conductor_id" }
      );

      if (!error) {
        const updatedLocations = JSON.parse(
          localStorage.getItem("offlineLocations") || "[]"
        ).filter((loc: any) => loc.timestamp !== location.timestamp);
        localStorage.setItem(
          "offlineLocations",
          JSON.stringify(updatedLocations)
        );
      }
    } catch (error) {
      console.error("Erro ao sincronizar localização offline:", error);
    }
  }
}

async function handleLocationSuccess(position: Position | null) {
  if (!position) return;
  const { latitude, longitude, accuracy } = position.coords;

  latitudeText.textContent = latitude.toFixed(6);
  longitudeText.textContent = longitude.toFixed(6);
  accuracyText.textContent = `${accuracy.toFixed(1)}m`;

  if (!currentUser) return;

  storeOfflineLocation(latitude, longitude, accuracy);

  try {
    const { data: conductor } = await supabase
      .from("conductors")
      .select("id")
      .eq("user_id", currentUser.id)
      .single();
    if (!conductor)
      throw new Error("Nenhum condutor encontrado para este utilizador");

    const { error } = await supabase.from("active_conductors").upsert(
      {
        conductor_id: conductor.id,
        current_latitude: latitude,
        current_longitude: longitude,
        accuracy: accuracy,
        last_ping: new Date().toISOString(),
        is_active: true,
        is_available: true,
        status: "available",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conductor_id" }
    );

    if (error) throw error;
    updateGpsVisuals("active", "Ativo");
  } catch (dbError) {
    console.error("Erro ao atualizar localização:", (dbError as Error).message);
    updateGpsVisuals("sync-error", "Offline - Dados guardados localmente");
  }
}

function handleLocationError(error: any) {
  console.error("Erro de geolocalização do Capacitor:", error);
  updateGpsVisuals("error", "Erro de GPS");
  latitudeText.textContent = "-";
  longitudeText.textContent = "-";
  accuracyText.textContent = "-";
}

async function startTracking() {
  if (watchId !== null) return;

  try {
    // Pedir permissões primeiro
    const permissions = await Geolocation.requestPermissions();
    if (permissions.location !== "granted") {
      updateGpsVisuals("error", "Permissão de localização negada.");
      alert("A permissão de localização é necessária para o rastreamento.");
      return;
    }

    updateGpsVisuals("requesting", "A obter localização...");

    // Usar o watchPosition do Capacitor
    watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
      (position, error) => {
        if (error) {
          handleLocationError(error);
        } else {
          handleLocationSuccess(position);
        }
      }
    );
  } catch (e) {
    handleLocationError(e);
  }
}

async function stopTracking() {
  if (watchId !== null) {
    await Geolocation.clearWatch({ id: watchId });
    watchId = null;
  }
  updateGpsVisuals("inactive", "Inativo");
  latitudeText.textContent = "-";
  longitudeText.textContent = "-";
  accuracyText.textContent = "-";
}

async function handleLogin() {
  const email = prompt("Digite seu email:");
  if (!email) return;
  const password = prompt("Digite sua senha:");
  if (!password) return;

  loginBtn.disabled = true;
  loginBtn.textContent = "A iniciar...";

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  } catch (error) {
    alert("Email ou senha inválidos.");
    console.error("Erro no login:", (error as Error).message);
    loginBtn.disabled = false;
    loginBtn.textContent = "Iniciar Sessão";
  }
}

async function handleLogout() {
  logoutBtn.disabled = true;
  logoutBtn.textContent = "A terminar...";

  if (currentUser) {
    try {
      const { data: conductor } = await supabase
        .from("conductors")
        .select("id")
        .eq("user_id", currentUser.id)
        .single();
      if (conductor) {
        await supabase.from("active_conductors").upsert(
          {
            conductor_id: conductor.id,
            is_active: false,
            status: "offline",
          },
          { onConflict: "conductor_id" }
        );
      }
    } catch (dbError) {
      console.error(
        "Erro ao finalizar sessão na base de dados:",
        (dbError as Error).message
      );
    }
  }

  try {
    await stopTracking(); // Parar o rastreamento antes do logout
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    alert(`Erro no logout: ${(error as Error).message}`);
    logoutBtn.disabled = false;
    logoutBtn.textContent = "Terminar Sessão";
  }
}

async function updateUserState(user: User | null) {
  currentUser = user;

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    const displayName =
      user.user_metadata?.full_name || user.user_metadata?.name || user.email;
    statusText.textContent = `Conectado como ${displayName}`;

    try {
      const { data: conductor } = await supabase
        .from("conductors")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!conductor) {
        alert(
          "Não foi possível encontrar um condutor associado a este utilizador."
        );
        handleLogout();
        return;
      }
      await startTracking();
    } catch (dbError) {
      console.error(
        "Erro ao iniciar sessão de rastreamento:",
        (dbError as Error).message
      );
      alert("Não foi possível iniciar a sessão de rastreamento.");
      handleLogout();
    }
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    statusText.textContent = "Desconectado";
    await stopTracking();
  }
}

// Listeners
document.addEventListener("DOMContentLoaded", () => {
  loginBtn.addEventListener("click", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateUserState(session?.user ?? null);
  });

  // Usar o App plugin do Capacitor para gerir o estado da app
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      console.log("App voltou ao primeiro plano, a sincronizar...");
      syncOfflineLocations();
    }
  });
});
