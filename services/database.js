const API_URL = 'https://vedic-guru-full-platform-backend.onrender.com/api';

/**
 * Reusable API Service Wrapper
 * Standardizes fetch calls, auth headers, and error handling.
 */
const API = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        const config = {
            ...options,
            headers
        };

        console.log(`[API] Request: ${options.method || 'GET'} ${API_URL}${endpoint}`);

        try {
            const res = await fetch(`${API_URL}${endpoint}`, config);
            const data = await res.json();

            if (!res.ok) {
                console.error(`[API] Error: ${res.status}`, data);
                throw new Error(data.message || 'Something went wrong');
            }

            return data.data !== undefined ? data.data : data;
        } catch (err) {
            console.error('[API] Fatal Error:', err);
            throw err;
        }
    },

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    },

    post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
    },

    put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
};

// ── AUTH APIs ──────────────────────────────────────────

export async function login(usernameOrEmail, password) {
    const data = await API.post('/auth/login', { 
        username: usernameOrEmail, 
        email: usernameOrEmail, 
        password 
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
}

export async function register(username, email, password) {
    const data = await API.post('/auth/register', { 
        name: username, 
        username, 
        email, 
        password 
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
}

// ── DATA APIs ──────────────────────────────────────────

export async function fetchSutras() {
    return API.get('/sutras');
}

export async function fetchSubSutras() {
    return API.get('/sub-sutras');
}

export async function fetchSutraById(id) {
    return API.get(`/sutras/${id}`);
}

export async function fetchVideos() {
    return API.get('/videos');
}

export function uploadVideo(formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/videos/upload`);
        
        const token = localStorage.getItem('token');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            const data = JSON.parse(xhr.response);
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(data);
            } else {
                reject(new Error(data.message || 'Upload failed'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(formData);
    });
}

export async function deleteVideo(videoId) {
    return API.delete(`/videos/${videoId}`);
}

// ── QUIZ APIs ──────────────────────────────────────────

export async function fetchQuizByType(type) {
    return API.get(`/quiz/${type}`);
}

export async function submitQuizAnswers(quizId, answers, timeTaken) {
    return API.post('/quiz/submit', { quizId, answers, timeTaken });
}

export async function fetchQuizHistory() {
    try {
        return await API.get('/quiz/history');
    } catch (err) {
        return [];
    }
}

export async function fetchLeaderboard(type) {
    return API.get(`/leaderboard?type=${type}`);
}

// ── COMMUNITY & DOUBTS ──────────────────────────────────

export async function saveDoubt(doubtText) {
    return API.post('/doubts', { question: doubtText });
}

export async function uploadDoubtImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/doubts/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    
    if (!res.ok) {
        let errorMsg = 'Something went wrong. Try again';
        try {
            const errData = await res.json();
            if (errData.message) errorMsg = errData.message;
        } catch(e) {}
        throw new Error(errorMsg);
    }
    return await res.json();
}

export async function fetchDoubts() {
    return API.get('/doubts');
}

export async function fetchChats() {
    return API.get('/chat');
}

export async function saveChat(message, replyTo = null) {
    return API.post('/chat', { message, replyTo });
}

export async function updateChat(chatId, message) {
    return API.put(`/chat/${chatId}`, { message });
}

export async function deleteChat(chatId) {
    return API.delete(`/chat/${chatId}`);
}

// ── TOOLS & AI ─────────────────────────────────────────

export async function solveWithVedicAI(expression) {
    return API.post('/vedic-calculator', { expression });
}

export async function fetchAIResponse(message) {
    return API.post('/ai-tutor', { message });
}

export async function fetchAIChatHistory() {
    return API.get('/ai-tutor/history');
}

export async function fetchAIInsights() {
    return API.get('/ai-tutor/insights');
}

// ── USER APIs ──────────────────────────────────────────

export async function fetchUserProfile() {
    return API.get('/user/profile');
}

export async function fetchUserStats() {
    return API.get('/user/stats');
}

export async function fetchUserHistory() {
    return API.get('/user/history');
}

export async function updateUserProfile(data) {
    return API.put('/user/update', data);
}

export async function initializeDatabase() {}

export async function saveCalculatorHistory(expression, result, sutraUsed) {
    return API.post('/calculator-history', { expression, result, sutraUsed });
}

export async function fetchUserInsights() {
    return API.get('/user/insights');
}

