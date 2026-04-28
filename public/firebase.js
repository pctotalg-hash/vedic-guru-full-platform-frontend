const API_URL = 'https://vedic-guru-full-platform-backend.onrender.com/api';

let currentUser = null;
let authStateListeners = [];

function notifyListeners(user) {
    authStateListeners.forEach(listener => listener(user));
}

export function onAuthStateChanged(auth, listener) {
    authStateListeners.push(listener);
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
        currentUser = JSON.parse(userStr);
        listener(currentUser);
    } else {
        listener(null);
    }
}

export const auth = {};
export const googleProvider = {};

export async function signInWithPopup(auth, provider) {
    // Mock login since we don't have Google OAuth in our backend yet.
    // Instead we will call login API. Since it's popup, we might use a prompt.
    // To make it fully functional without UI changes, we can register/login an anonymous or test user.
    const email = prompt("Enter email (test@test.com):", "test@test.com");
    const password = prompt("Enter password (password):", "password");
    if (!email || !password) throw new Error("Login cancelled");
    
    try {
        let res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
            // Try register if login fails
            res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: email.split('@')[0], email, password })
            });
            if (!res.ok) throw new Error("Auth failed");
        }
        
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        notifyListeners(currentUser);
        return data.user;
    } catch (err) {
        throw err;
    }
}

export async function signInAnonymously(auth) {
    return signInWithPopup(auth, null);
}

export async function signOut(auth) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    notifyListeners(null);
}
