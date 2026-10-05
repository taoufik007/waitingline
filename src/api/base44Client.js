const STORAGE_KEYS = {
  user: 'waitingline_user',
  token: 'waitingline_token',
  activeUser: 'waitingline_active_user',
  sessionMap: 'waitingline_session_map',
  impersonating: 'waitingline_impersonating',
  sessionMode: 'waitingline_session_mode',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Stockage de la session : on reste sur localStorage pour la session standard,
// mais les sessions temporaires d'impersonation restent isolées dans
// sessionStorage pour éviter de remplacer la session réelle d'un approbateur.
const storage = window.localStorage;
const sessionStorageRef = window.sessionStorage;

const readJson = (key, fallback, target = storage) => {
  try {
    const raw = target.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value, target = storage) => {
  target.setItem(key, JSON.stringify(value));
};

const getSessionMap = () => {
  const sessionMap = readJson(STORAGE_KEYS.sessionMap, {}, sessionStorageRef);
  if (sessionMap && Object.keys(sessionMap).length > 0) {
    return sessionMap;
  }
  return readJson(STORAGE_KEYS.sessionMap, {});
};

const isTemporarySession = () => sessionStorageRef.getItem(STORAGE_KEYS.sessionMode) === 'temporary';

const setTemporarySessionMode = (enabled) => {
  if (enabled) {
    sessionStorageRef.setItem(STORAGE_KEYS.sessionMode, 'temporary');
    return;
  }
  sessionStorageRef.removeItem(STORAGE_KEYS.sessionMode);
};

const getCurrentUserEmail = () => {
  const activeUser = sessionStorageRef.getItem(STORAGE_KEYS.activeUser);
  if (activeUser) return activeUser;

  const fallbackUser = storage.getItem(STORAGE_KEYS.activeUser);
  if (fallbackUser) return fallbackUser;

  const fallbackData = readJson(STORAGE_KEYS.user, null);
  return fallbackData?.email || null;
};

const getStoredUser = () => {
  const email = getCurrentUserEmail();
  if (email) {
    const session = getSessionMap()[email];
    if (session?.user) return session.user;
  }

  const sessionUser = sessionStorageRef.getItem(STORAGE_KEYS.user);
  if (sessionUser) {
    try {
      return JSON.parse(sessionUser);
    } catch {
      // ignore invalid JSON and fallback to local storage below
    }
  }

  return readJson(STORAGE_KEYS.user, null);
};

const setStoredUser = (user, options = {}) => {
  const persistToLocal = options.persistToLocal !== false;

  if (!user?.email) {
    sessionStorageRef.setItem(STORAGE_KEYS.user, JSON.stringify(user || null));
    if (persistToLocal) writeJson(STORAGE_KEYS.user, user);
    return;
  }

  const email = String(user.email).trim();
  const map = getSessionMap();
  const currentToken = map[email]?.token || getAuthToken();
  map[email] = { ...(map[email] || {}), user, token: currentToken || map[email]?.token || null };

  if (persistToLocal) {
    writeJson(STORAGE_KEYS.sessionMap, map);
  } else {
    writeJson(STORAGE_KEYS.sessionMap, map, sessionStorageRef);
  }

  sessionStorageRef.setItem(STORAGE_KEYS.activeUser, email);
  sessionStorageRef.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  if (persistToLocal) writeJson(STORAGE_KEYS.user, user);
};

const getAuthToken = () => {
  const email = getCurrentUserEmail();
  if (email) {
    const session = getSessionMap()[email];
    if (session?.token) return session.token;
  }

  const tabToken = sessionStorageRef.getItem(STORAGE_KEYS.token);
  if (tabToken) return tabToken;

  return storage.getItem(STORAGE_KEYS.token) || null;
};

const setAuthToken = (token, options = {}) => {
  const persistToLocal = options.persistToLocal !== false;
  const email = getCurrentUserEmail() || getStoredUser()?.email;

  if (token) {
    sessionStorageRef.setItem(STORAGE_KEYS.token, token);
    if (persistToLocal) storage.setItem(STORAGE_KEYS.token, token);

    if (email) {
      const map = getSessionMap();
      map[email] = { ...(map[email] || {}), token, user: map[email]?.user || getStoredUser() };
      if (persistToLocal) {
        writeJson(STORAGE_KEYS.sessionMap, map);
      } else {
        writeJson(STORAGE_KEYS.sessionMap, map, sessionStorageRef);
      }
      sessionStorageRef.setItem(STORAGE_KEYS.activeUser, email);
      sessionStorageRef.setItem(STORAGE_KEYS.user, JSON.stringify(map[email].user));
    }
  } else {
    sessionStorageRef.removeItem(STORAGE_KEYS.token);
    sessionStorageRef.removeItem(STORAGE_KEYS.user);
    sessionStorageRef.removeItem(STORAGE_KEYS.activeUser);
    if (persistToLocal) storage.removeItem(STORAGE_KEYS.token);

    if (email) {
      const map = getSessionMap();
      if (map[email]) delete map[email];
      if (persistToLocal) {
        writeJson(STORAGE_KEYS.sessionMap, map);
      } else {
        writeJson(STORAGE_KEYS.sessionMap, map, sessionStorageRef);
      }
    }

    if (persistToLocal) {
      storage.removeItem(STORAGE_KEYS.activeUser);
      storage.removeItem(STORAGE_KEYS.user);
    }
  }
};

const notifyEntityChange = (entityName) => {
  window.dispatchEvent(new CustomEvent('waitingline:entity-change', { detail: { entityName } }));
};

const requestJson = async (path, options = {}) => {
  const token = getAuthToken();
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-session-token': token } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return payload;
};

const createEntityApi = (entityName, endpoint) => ({
  list: async (sortField = 'name', limit = 300) => {
    const { items } = await requestJson(`/api/entities/${endpoint}`);
    const sorted = [...items].sort((a, b) => {
      const left = a[sortField] ?? '';
      const right = b[sortField] ?? '';
      return String(left).localeCompare(String(right));
    });
    return sorted.slice(0, limit);
  },
  filter: async (query = {}, sortField = 'name', limit = 300) => {
    const { items } = await requestJson(`/api/entities/${endpoint}`);
    const filtered = items.filter((item) => Object.entries(query).every(([field, value]) => item[field] === value));
    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortField] ?? '';
      const right = b[sortField] ?? '';
      return String(left).localeCompare(String(right));
    });
    return sorted.slice(0, limit);
  },
  create: async (data) => {
    const { item } = await requestJson(`/api/entities/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    notifyEntityChange(entityName);
    return item;
  },
  update: async (id, patch) => {
    const { item } = await requestJson(`/api/entities/${endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    notifyEntityChange(entityName);
    return item;
  },
  delete: async (id) => {
    await requestJson(`/api/entities/${endpoint}/${id}`, { method: 'DELETE' });
    notifyEntityChange(entityName);
    return true;
  },
  subscribe: (callback) => {
    const handler = (event) => {
      if (event.detail?.entityName === entityName) callback();
    };
    window.addEventListener('waitingline:entity-change', handler);
    return () => window.removeEventListener('waitingline:entity-change', handler);
  },
});

const localAuth = {
  me: async () => {
    const user = getStoredUser();
    const token = getAuthToken();
    if (!user || !token) {
      const error = new Error('Not authenticated');
      error.status = 401;
      throw error;
    }
    return user;
  },
  setToken: (token) => {
    setAuthToken(token);
    const user = getStoredUser();
    if (user && token) {
      setStoredUser({ ...user, token });
    }
  },
  logout: (redirectUrl = null) => {
    const email = getCurrentUserEmail();
    const map = getSessionMap();
    const temporarySession = isTemporarySession();

    if (email && map[email]) delete map[email];

    if (temporarySession) {
      writeJson(STORAGE_KEYS.sessionMap, map, sessionStorageRef);
    } else {
      writeJson(STORAGE_KEYS.sessionMap, map);
    }

    sessionStorageRef.removeItem(STORAGE_KEYS.user);
    sessionStorageRef.removeItem(STORAGE_KEYS.token);
    sessionStorageRef.removeItem(STORAGE_KEYS.activeUser);
    sessionStorageRef.removeItem(STORAGE_KEYS.sessionMode);

    if (!temporarySession) {
      storage.removeItem(STORAGE_KEYS.user);
      storage.removeItem(STORAGE_KEYS.token);
      storage.removeItem(STORAGE_KEYS.activeUser);
    }

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },
  redirectToLogin: (redirectUrl = '/login') => {
    window.location.href = redirectUrl.includes('/login') ? redirectUrl : '/login';
  },
  loginViaEmailPassword: async (email, password) => {
    const normalizedEmail = String(email || '').trim();
    const response = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    if (response.access_token) {
      setStoredUser(response.user);
      setAuthToken(response.access_token);
    }

    return response;
  },
  register: async ({ name, email, password }) => {
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim();
    if (!normalizedName) {
      const error = new Error('Please enter your full name');
      error.status = 400;
      throw error;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      const error = new Error('Please enter a valid email address');
      error.status = 400;
      throw error;
    }

    if (String(password || '').length < 6) {
      const error = new Error('Password must be at least 6 characters long');
      error.status = 400;
      throw error;
    }

    const response = await requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: normalizedName, email: normalizedEmail, password }),
    });

    if (response.user) {
      setStoredUser({ ...response.user, email: normalizedEmail });
    }

    return response;
  },
  verifyOtp: async ({ email, otpCode }) => {
    const normalizedEmail = String(email || '').trim();
    const response = await requestJson('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, otpCode }),
    });

    if (response.access_token) {
      setStoredUser(response.user);
      setAuthToken(response.access_token);
    }

    return response;
  },
  resendOtp: async (email) => {
    const normalizedEmail = String(email || '').trim();
    return requestJson('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail }),
    });
  },
  resetPasswordRequest: async (email) => {
    const normalizedEmail = String(email || '').trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      const error = new Error('Please enter a valid email address');
      error.status = 400;
      throw error;
    }

    const response = await requestJson('/api/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail }),
    });

    return response;
  },
  resetPassword: async ({ resetToken, newPassword }) => {
    if (!resetToken) {
      const error = new Error('Invalid password reset token');
      error.status = 400;
      throw error;
    }

    if (String(newPassword || '').length < 6) {
      const error = new Error('Password must be at least 6 characters long');
      error.status = 400;
      throw error;
    }

    const response = await requestJson('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password: newPassword }),
    });

    return response;
  },
  isAuthenticated: async () => !!getStoredUser() && !!getAuthToken(),
  // Utilisé par AuthContext.jsx / SessionGuard.jsx pour savoir s'il existe
  // un token, sans jamais lire sessionStorage/localStorage directement.
  hasToken: () => !!getAuthToken(),
  getToken: () => getAuthToken(),
  // Utilisé par Login.jsx / Register.jsx / ImpersonateBridge.jsx pour
  // enregistrer une session (token + user) reçue depuis Google ou une
  // impersonation, sans jamais écrire dans localStorage/sessionStorage
  // directement depuis ces fichiers.
  setSession: (token, user, options = {}) => {
    const persistToLocal = options.persistToLocal !== false;
    setTemporarySessionMode(!persistToLocal);
    setAuthToken(token, { persistToLocal });
    if (user) setStoredUser(user, { persistToLocal });
  },
  // Drapeau "je suis en train d'impersonner quelqu'un", utilisé par
  // ImpersonateBridge.jsx (pour le poser) et ImpersonationBanner.jsx
  // (pour l'afficher / le retirer).
  setImpersonating: (info) => {
    if (info) {
      sessionStorageRef.setItem(STORAGE_KEYS.impersonating, JSON.stringify(info));
    } else {
      sessionStorageRef.removeItem(STORAGE_KEYS.impersonating);
    }
  },
  getImpersonating: () => readJson(STORAGE_KEYS.impersonating, null, sessionStorageRef) || readJson(STORAGE_KEYS.impersonating, null),
  clearImpersonating: () => sessionStorageRef.removeItem(STORAGE_KEYS.impersonating),
};

export const base44 = {
  auth: localAuth,
  entities: {
    Service: createEntityApi('Service', 'services'),
    Counter: createEntityApi('Counter', 'counters'),
    Ticket: {
      ...createEntityApi('Ticket', 'tickets'),
      create: async (data) => {
        const payload = { status: 'waiting', created_date: new Date().toISOString(), ...data };
        const { item } = await requestJson(`/api/entities/tickets`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notifyEntityChange('Ticket');
        return item;
      },
    },
  },
};