import { login, register, initializeDatabase, fetchSutras, fetchSubSutras, fetchSutraById, fetchVideos, uploadVideo, deleteVideo, fetchQuizByType, submitQuizAnswers, fetchQuizHistory, fetchLeaderboard, saveDoubt, fetchDoubts, saveCalculatorHistory, fetchChats, saveChat, updateChat, deleteChat, uploadDoubtImage, solveWithVedicAI, fetchUserProfile, fetchUserStats, fetchUserHistory, fetchUserInsights, updateUserProfile, fetchAIChatHistory, fetchAIResponse, fetchAIInsights } from './services/database.js';

console.log("[Vedic Guru] script.js loading...");

// ── ERROR BOUNDARIES ─────────────────────────────────────
// Catch global unhandled errors to prevent app crashes and inform the user
window.addEventListener('error', (event) => {
    console.error("[Vedic Guru] Global Error:", event.error);
    if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast("An unexpected UI error occurred. Please refresh if issues persist.", 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error("[Vedic Guru] Unhandled Promise Rejection:", event.reason);
    if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast("Connection lost or data fetch failed. Retrying...", 'warning');
    }
});

// ── GLOBAL EXPOSURE ─────────────────────────────────────
// We expose functions to window immediately so they are available for HTML onclick handlers
window.showModule = showModule;
window.signIn = signIn;
window.logOut = logOut;
window.signInWithGoogle = signInWithGoogle;
window.closeAuthModal = closeAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.handleAuth = handleAuth;
window.switchSutraTab = switchSutraTab;
window.filterSutras = filterSutras;
window.openVideoUploadModal = openVideoUploadModal;
window.closeVideoUploadModal = closeVideoUploadModal;
window.openVideoPlayer = openVideoPlayer;
window.closeVideoPlayer = closeVideoPlayer;
window.switchSubTab = switchSubTab;
window.toggleAttachMenu = toggleAttachMenu;
window.toggleVideoMenu = toggleVideoMenu;
window.replyToMessage = replyToMessage;
window.cancelReply = cancelReply;
window.editMessage = editMessage;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteMessage = deleteMessage;
window.startQuiz = startQuiz;
window.selectOption = selectOption;
window.nextQuestion = nextQuestion;
window.submitCurrentQuiz = submitCurrentQuiz;
window.toggleAIChat = toggleAIChat;
window.sendAIMessage = sendAIMessage;
window.downloadReport = downloadReport;
window.handleDeleteVideo = handleDeleteVideo;

// ── UI UTILITY ──────────────────────────────────────────
const UI = {
    loader: null,
    loaderText: null,
    toastContainer: null,

    init: function() {
        this.loader = document.getElementById('global-loader');
        this.loaderText = document.getElementById('loader-text');
        this.toastContainer = document.getElementById('toast-container');
    },

    setLoading: function(show, text = 'Processing...') {
        if (!this.loader) this.init();
        if (show) {
            this.loaderText.innerText = text;
            this.loader.classList.remove('hidden');
        } else {
            this.loader.classList.add('hidden');
        }
    },

    showToast: function(message, type = 'info', duration = 4000) {
        if (!this.toastContainer) this.init();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';

        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    setButtonState: function(btn, loading, originalText) {
        if (!btn) return;
        const $btn = $(btn);
        if (loading) {
            $btn.prop('disabled', true).addClass('btn-loading');
        } else {
            $btn.prop('disabled', false).removeClass('btn-loading');
            if (originalText) $btn.text(originalText);
        }
    }
};

// ── NETWORK DETECTION ───────────────────────────────────
window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.remove('active');
    UI.showToast('You are back online!', 'success');
});
window.addEventListener('offline', () => {
    document.getElementById('offline-banner').classList.add('active');
    UI.showToast('You are offline. Some features may not work.', 'warning');
});

let currentUser = null;
let isLoginMode = true;

$(document).ready(async function(){
    try {
        // Check initial online status
        if (!navigator.onLine) {
            const offlineBanner = document.getElementById('offline-banner');
            if (offlineBanner) offlineBanner.classList.add('active');
        }
        
        // Handle Google OAuth callback — token and user arrive as URL params
        handleGoogleCallback();

        // Check for existing session
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            updateUIForLogin();
        }

        // Initialize Main Slick Slider
        if ($('.main-slider').length) {
            $('.main-slider').slick({
                dots: true,
                infinite: true,
                speed: 500,
                fade: true,
                cssEase: 'linear',
                autoplay: true,
                autoplaySpeed: 4000,
                arrows: true
            });
        }

        // Initialize Video Slider
        if ($('.video-slider').length) {
            $('.video-slider').slick({
                dots: true,
                infinite: true,
                speed: 300,
                slidesToShow: 3,
                slidesToScroll: 1,
                responsive: [
                    { breakpoint: 1024, settings: { slidesToShow: 2, slidesToScroll: 1 } },
                    { breakpoint: 600, settings: { slidesToShow: 1, slidesToScroll: 1 } }
                ]
            });
        }

        // Populate data dynamically from DB
        await Promise.allSettled([
            populateSutras(),
            populateVideos(),
            populateQuizzes()
        ]);
        
    } catch (err) {
        console.error("[Vedic Guru] Initialization Error:", err);
        if (typeof UI !== 'undefined' && UI.showToast) {
            UI.showToast("Failed to initialize some components correctly.", 'warning');
        }
    }
});

// Expose functions to window for onclick handlers in HTML
async function showModule(moduleId) {
    try {
        const modules = document.querySelectorAll('.module');
        modules.forEach(m => m.classList.add('hidden'));

        const target = document.getElementById('module-' + moduleId);
        if(target) {
            target.classList.remove('hidden');
            target.classList.add('active');
            window.scrollTo(0,0);
            
            // Highlight active link in navbar
            document.querySelectorAll('.nav-links li a').forEach(link => {
                const onclickAttr = link.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/'([^']+)'/);
                    const linkModule = match ? match[1] : null;
                    link.classList.toggle('active', linkModule === moduleId);
                }
            });

            if(moduleId === 'home') {
                if ($('.main-slider').hasClass('slick-initialized')) $('.main-slider').slick('setPosition');
                if ($('.video-slider').hasClass('slick-initialized')) $('.video-slider').slick('setPosition');
            }

            if(moduleId === 'community') {
                populateChats();
                populateDoubtsCommunity();
            }

            if(moduleId === 'videos') {
                populateVideos();
            }

            if(moduleId === 'quiz') {
                populateQuizDashboard();
            }

            if(moduleId === 'leaderboard') {
                const activeTab = document.querySelector('#module-leaderboard .tab-btn.active');
                let tabId = 'daily';
                if (activeTab) {
                    const match = activeTab.getAttribute('onclick')?.match(/'([^']+)'/);
                    if (match && match[1]) tabId = match[1];
                }
                updateLeaderboard(tabId);
            }

            if(moduleId === 'profile') {
                populateProfile();
            }
        }
    } catch (err) {
        console.error(`[Vedic Guru] Module ${moduleId} failed to load:`, err);
        UI.showToast(`Error switching to ${moduleId}. Please try again.`, 'error');
    }
}

function signIn() {
    isLoginMode = true;
    updateModalUI();
    document.getElementById('auth-modal').classList.remove('hidden');
}

// Google OAuth — redirect to backend
function signInWithGoogle() {
    window.location.href = 'https://vedic-guru-full-platform-backend.onrender.com/auth/google';
}

// Handle Google OAuth redirect back from backend
function handleGoogleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userParam = params.get('user');

    if (token && userParam) {
        try {
            const user = JSON.parse(decodeURIComponent(userParam));
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            currentUser = user;
            updateUIForLogin();
            // Clean up the URL so token doesn't stay visible
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
            console.error('Error parsing Google auth callback:', err);
        }
    }

    // Check for auth failure
    if (params.get('auth') === 'failed') {
        UI.showToast('Google sign-in failed. Please try again.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthMode(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateModalUI();
}

function updateModalUI() {
    document.getElementById('modal-title').innerText = isLoginMode ? 'Sign In' : 'Register';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'Sign In' : 'Register';
    document.getElementById('register-fields').classList.toggle('hidden', isLoginMode);
    document.getElementById('switch-auth-text').innerHTML = isLoginMode 
        ? `Don't have an account? <a href="#" onclick="toggleAuthMode(event)">Register</a>`
        : `Already have an account? <a href="#" onclick="toggleAuthMode(event)">Sign In</a>`;
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('auth-email').value;
    const btn = document.getElementById('auth-submit-btn');
    const originalText = btn.innerText;

    if (!username || !password || (!isLoginMode && !email)) {
        UI.showToast('Please fill in all required fields.', 'warning');
        return;
    }

    UI.setButtonState(btn, true);
    try {
        if (isLoginMode) {
            currentUser = await login(username, password);
            UI.showToast(`Welcome back, ${currentUser.username}!`, 'success');
        } else {
            currentUser = await register(username, email, password);
            UI.showToast(`Registration successful! Welcome, ${currentUser.username}!`, 'success');
        }
        updateUIForLogin();
        closeAuthModal();
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setButtonState(btn, false, originalText);
    }
}

function updateUIForLogin() {
    if (currentUser) {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('profile-section').classList.remove('hidden');
        const navProfile = document.getElementById('nav-item-profile');
        if (navProfile) navProfile.classList.remove('hidden');

        const displayName = currentUser.name || currentUser.username || 'User';
        const profilePic = currentUser.profilePic;

        const userInfoDiv = document.querySelector('.user-info');
        if (userInfoDiv) {
            userInfoDiv.innerHTML = `
                ${profilePic ? `<img src="${profilePic}" alt="Profile" class="user-avatar" referrerpolicy="no-referrer">` : ''}
                <p><strong>${displayName}</strong></p>
                <p>${currentUser.email || ''}</p>
            `;
        }

        // Update the profile button to show avatar if available
        const profileBtn = document.querySelector('.profile-btn');
        if (profileBtn && profilePic) {
            profileBtn.innerHTML = `<img src="${profilePic}" alt="" class="nav-avatar" referrerpolicy="no-referrer"> ${displayName}`;
        }

        // Refresh data
        populateSutras();
        populateVideos();
        populateQuizzes();
        updateUIState();
    }
}

function logOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    document.getElementById('profile-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    const navProfile = document.getElementById('nav-item-profile');
    if (navProfile) navProfile.classList.add('hidden');
    updateUIState();
    showModule('home');
}


let currentSutraCategory = 'sutras';
let cachedSutras = [];
let cachedSubSutras = [];

async function switchSutraTab(category) {
    currentSutraCategory = category;
    
    // Update UI tabs
    document.getElementById('tab-sutras').classList.toggle('active', category === 'sutras');
    document.getElementById('tab-sub-sutras').classList.toggle('active', category === 'sub-sutras');

    await populateSutras();
}

function filterSutras() {
    const query = document.getElementById('sutra-search').value.toLowerCase();
    const data = currentSutraCategory === 'sutras' ? cachedSutras : cachedSubSutras;
    
    const filtered = data.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.meaning.toLowerCase().includes(query) ||
        item.Sanskrit_name.toLowerCase().includes(query)
    );

    renderSutras(filtered);
}

// VIDEO UPLOAD & PLAYER LOGIC
function openVideoUploadModal() {
    const modal = document.getElementById('video-upload-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Force display flex for modal centering
    }
}

function closeVideoUploadModal() {
    const modal = document.getElementById('video-upload-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function openVideoPlayer(v) {
    const modal = document.getElementById('video-player-modal');
    const container = document.querySelector('.video-container');
    const title = document.getElementById('player-title');
    const desc = document.getElementById('player-desc');
    const meta = document.getElementById('player-meta');

    title.innerText = v.title;
    desc.innerText = v.description || 'No description provided.';
    meta.innerText = `Uploaded by: ${v.username || 'Admin'} (${v.type === 'admin' ? 'Official' : 'Community'})`;
    
    // Set video source
    let url = v.videoUrl;
    if (!url.startsWith('http')) {
        url = `https://vedic-guru-full-platform-backend.onrender.com${url}`;
    }
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        container.innerHTML = `<iframe width="100%" height="400" src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        container.innerHTML = `<video id="main-video-player" controls autoplay style="width: 100%; max-height: 400px;"><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
    }
    
    modal.classList.remove('hidden');
}

function closeVideoPlayer() {
    const modal = document.getElementById('video-player-modal');
    const container = document.querySelector('.video-container');
    container.innerHTML = ''; // Clears the video/iframe to stop playback
    modal.classList.add('hidden');
}

// VIDEO UPLOAD FORM SUBMIT
$(document).ready(function() {
    $('#video-upload-form').on('submit', async function(e) {
        e.preventDefault();
        
        const title = $('#upload-video-title').val();
        const description = $('#upload-video-desc').val();
        const category = $('#upload-video-category').val();
        const file = $('#upload-video-file')[0].files[0];
        const btn = $(this).find('button[type="submit"]');

        if (!currentUser) {
            UI.showToast("Please sign in to upload videos.", "warning");
            return;
        }

        if (!file) return UI.showToast('Please select a video file.', 'warning');

        // Size validation (50MB)
        if (file.size > 50 * 1024 * 1024) {
            return UI.showToast("Video file is too large (max 50MB).", "error");
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('video', file);

        $('#upload-progress-container').removeClass('hidden');
        UI.setButtonState(btn, true);
        
        try {
            await uploadVideo(formData, (percent) => {
                $('#upload-progress-bar').css('width', percent + '%');
                $('#upload-progress-text').text(percent + '%');
            });

            UI.showToast('Video uploaded successfully!', 'success');
            closeVideoUploadModal();
            $('#video-upload-form')[0].reset();
            $('#upload-progress-container').addClass('hidden');
            console.log(`[Video] Upload successful, refreshing grid...`);
            cachedVideos = []; // Clear cache to fetch updated list
            populateVideos(); 
        } catch (err) {
            UI.showToast(err.message, 'error');
            $('#upload-progress-container').addClass('hidden');
        } finally {
            UI.setButtonState(btn, false, 'Upload Now');
        }
    });
});

async function switchSubTab(moduleName, tabId) {
    let container = document.getElementById(`module-${moduleName}`);
    if(!container && moduleName === 'engine') container = document.getElementById('module-computational-engine');
    
    if(container) {
        const contents = container.querySelectorAll('.leaderboard-content, .sub-tab-content');
        contents.forEach(c => {
            c.classList.add('hidden');
            c.classList.remove('active');
        });

        let targetId = `${moduleName}-${tabId}`;
        let targetContent = document.getElementById(targetId);
        
        if(targetContent) {
            targetContent.classList.remove('hidden');
            targetContent.classList.add('active');
        }

        const btns = container.querySelectorAll('.tab-btn');
        btns.forEach(b => b.classList.remove('active'));
        
        if (event && event.currentTarget) {
            event.currentTarget.classList.add('active');
        }

        // Specific logic for leaderboard tabs
        if (moduleName === 'leaderboard') {
            updateLeaderboard(tabId);
        }
    }
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) {
        return `${m}m ${s}s`;
    }
    return `${s}s`;
}

async function updateLeaderboard(type) {
    const container = document.getElementById(`leaderboard-${type}`);
    if (!container) return;
    
    container.innerHTML = '<p style="padding: 2rem">Loading rankings...</p>';
    
    try {
        const response = await fetchLeaderboard(type);
        const data = response.leaderboard;
        const userRank = response.userRank;

        if (data.length === 0) {
            container.innerHTML = '<p style="padding: 2rem">No entries for this period yet. Be the first!</p>';
            return;
        }

        let userInTop = false;
        if (userRank && data.find(u => u._id === userRank._id)) {
            userInTop = true;
        }

        container.innerHTML = `
            <table class="lb-table">
                <thead>
                    <tr><th>Rank</th><th>User</th><th>Total Points</th><th>Time Taken</th><th>Attempts</th></tr>
                </thead>
                <tbody>
                    ${data.map((user, i) => {
                        const isCurrentUser = userRank && user._id && userRank._id && user._id.toString() === userRank._id.toString();
                        const displayName = user.username || "Anonymous User";
                        const initial = (displayName[0] || "A").toUpperCase();
                        const formattedTime = formatTime(user.timeTaken ?? 0);
                        
                        return `
                        <tr class="${isCurrentUser ? 'current-user-row' : ''}">
                            <td>${user.rank || (i + 1)}</td>
                            <td>
                                <div class="user-info-cell">
                                    ${user.profileImage ? `<img src="${user.profileImage}" class="lb-avatar" alt="" referrerpolicy="no-referrer">` : `<div class="lb-avatar-placeholder">${initial}</div>`}
                                    <strong>${displayName}</strong>
                                </div>
                            </td>
                            <td>${user.score ?? 0} pts</td>
                            <td>${formattedTime}</td>
                            <td>${user.attempts ?? 0}</td>
                        </tr>
                    `}).join('')}
                    ${!userInTop && userRank ? `
                        <tr class="separator-row"><td colspan="5">...</td></tr>
                        <tr class="current-user-row">
                            <td>${userRank.rank}</td>
                            <td>
                                <div class="user-info-cell">
                                    ${userRank.profileImage ? `<img src="${userRank.profileImage}" class="lb-avatar" alt="" referrerpolicy="no-referrer">` : `<div class="lb-avatar-placeholder">${(userRank.username || "A")[0].toUpperCase()}</div>`}
                                    <strong>${userRank.username || "Anonymous User"}</strong> (You)
                                </div>
                            </td>
                            <td>${userRank.score ?? 0} pts</td>
                            <td>${formatTime(userRank.timeTaken ?? 0)}</td>
                            <td>${userRank.attempts ?? 0}</td>
                        </tr>
                    ` : ''}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error("Error updating leaderboard:", err);
        container.innerHTML = '<p style="color: red">Failed to load leaderboard.</p>';
    }
}


function toggleAttachMenu() {
    const menu = document.getElementById('attach-menu');
    menu.classList.toggle('hidden');
}

function toggleVideoMenu(element) {
    const menu = element.nextElementSibling;
    menu.classList.toggle('hidden');
}

// ── COMMUNITY CHAT STATE ────────────────────────────────
let replyingTo = null; // { messageId, messageText, username }
let editingMessageId = null;

function replyToMessage(id, username, text) {
    replyingTo = { messageId: id, messageText: text, username: username };
    document.getElementById('reply-username').innerText = username;
    document.getElementById('reply-text').innerText = text;
    document.getElementById('reply-preview').classList.remove('hidden');
    document.getElementById('community-chat-input').focus();
}

function cancelReply() {
    replyingTo = null;
    document.getElementById('reply-preview').classList.add('hidden');
}

function editMessage(id, text) {
    editingMessageId = id;
    populateChats(); // Re-render to show edit UI for this message
}

function cancelEdit() {
    editingMessageId = null;
    populateChats();
}

async function saveEdit(id) {
    const newText = document.getElementById(`edit-input-${id}`).value;
    if (newText.trim() === "") return;

    try {
        await updateChat(id, newText);
        editingMessageId = null;
        populateChats();
    } catch (err) {
        alert("Failed to update message.");
    }
}

async function deleteMessage(id) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
        await deleteChat(id);
        populateChats();
    } catch (err) {
        alert("Failed to delete message.");
    }
}

// ── NEW QUIZ LOGIC ───────────────────────────────────────
let activeQuiz = null;
let currentQuestionIndex = 0;
let selectedAnswers = {}; // Map of questionId -> selectedOptionIndex
let quizTimerInterval = null;
let quizStartTime = null;

window.showQuizDashboard = function() {
    document.getElementById('quiz-dashboard').classList.remove('hidden');
    document.getElementById('quiz-active').classList.add('hidden');
    document.getElementById('quiz-results').classList.add('hidden');
    populateQuizDashboard();
}

async function populateQuizDashboard() {
    if (!currentUser) return;
    
    // Fetch history
    try {
        const history = await fetchQuizHistory();
        renderQuizHistory(history);
        updateQuizStatuses(history);
    } catch (err) {
        console.error("Error fetching history:", err);
    }
}

function renderQuizHistory(history) {
    const container = document.getElementById('quiz-history-list');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-text">No quiz attempts yet. Start your journey today!</p>';
        return;
    }

    container.innerHTML = history.slice(0, 5).map(h => `
        <div class="history-card">
            <div class="history-info">
                <h4>${h.quizType.charAt(0).toUpperCase() + h.quizType.slice(1)} Quiz</h4>
                <p>${new Date(h.attemptedAt).toLocaleDateString()} at ${new Date(h.attemptedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
            <div class="history-score">${h.score}/${h.maxScore}</div>
        </div>
    `).join('');
}

function updateQuizStatuses(history) {
    const types = ['daily', 'weekly', 'monthly'];
    const now = new Date();
    
    types.forEach(type => {
        const el = document.getElementById(`status-${type}`);
        if (!el) return;
        
        // Find if attempted in current period
        const attempted = history.find(h => {
            const date = new Date(h.attemptedAt);
            if (type === 'daily') return date.toDateString() === now.toDateString();
            // Simple check for weekly/monthly
            if (type === 'weekly') return (now - date) < 7 * 24 * 60 * 60 * 1000;
            if (type === 'monthly') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            return false;
        });

        if (attempted) {
            el.innerHTML = `<span style="color: #00b894"><i class="fas fa-check-circle"></i> Completed (${attempted.score}/${attempted.maxScore})</span>`;
        } else {
            el.innerHTML = `<span style="color: #6c5ce7"><i class="fas fa-play-circle"></i> Available</span>`;
        }
    });
}

async function startQuiz(type) {
    if (!currentUser) {
        signIn();
        return;
    }

    const btn = event?.currentTarget;
    const originalText = btn?.innerHTML;
    
    UI.setButtonState(btn, true);
    UI.setLoading(true, 'Preparing your Vedic Challenge...');

    try {
        const data = await fetchQuizByType(type);

        if (data.attempted) {
            activeQuiz = data.quiz;
            renderResults(data.result);
            return;
        }

        activeQuiz = data.quiz;
        if (!activeQuiz || !activeQuiz.questions) {
            throw new Error("Invalid quiz data received");
        }

        currentQuestionIndex = 0;
        selectedAnswers = {};
        
        document.getElementById('quiz-dashboard').classList.add('hidden');
        document.getElementById('quiz-active').classList.remove('hidden');
        document.getElementById('quiz-results').classList.add('hidden');
        document.getElementById('active-quiz-title').innerText = `${type.charAt(0).toUpperCase() + type.slice(1)} Challenge`;
        
        startTimer();
        renderQuestion();
        UI.showToast('Quiz started! Good luck.', 'success');
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setLoading(false);
        UI.setButtonState(btn, false, originalText);
    }
}

function startTimer() {
    quizStartTime = Date.now();
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    
    const timerEl = document.getElementById('quiz-timer');
    quizTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        timerEl.innerHTML = `<i class="fas fa-clock"></i> ${mins}:${secs}`;
    }, 1000);
}

function renderQuestion() {
    const q = activeQuiz.questions[currentQuestionIndex];
    const qId = q._id || `q-${currentQuestionIndex}`;
    const container = document.getElementById('question-container');
    
    // Update progress
    const total = activeQuiz.questions.length;
    const answeredCount = Object.keys(selectedAnswers).length;
    
    document.getElementById('quiz-progress-text').innerHTML = `
        Question ${currentQuestionIndex + 1} of ${total} <br>
        <small class="answered-count">(${answeredCount} questions answered)</small>
    `;
    document.getElementById('quiz-progress-bar').style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;

    container.innerHTML = `
        <div class="question-text">${q.question}</div>
        <div class="options-grid">
            ${q.options.map((opt, i) => `
                <button class="option-btn ${selectedAnswers[qId] === i ? 'selected' : ''}" 
                        onclick="selectOption('${qId}', ${i})">
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;

    // Show/hide buttons
    if (currentQuestionIndex === total - 1) {
        document.getElementById('btn-next-question').classList.add('hidden');
        document.getElementById('btn-submit-quiz').classList.remove('hidden');
    } else {
        document.getElementById('btn-next-question').classList.remove('hidden');
        document.getElementById('btn-submit-quiz').classList.add('hidden');
    }
}

function selectOption(qId, index) {
    selectedAnswers[qId] = index;
    console.log(`[Quiz] Option selected for ${qId}: ${index}`);
    console.log("[Quiz] Current selectedAnswers:", selectedAnswers);
    
    // Re-render to show selection and update answered count
    renderQuestion();
}

function nextQuestion() {
    const q = activeQuiz.questions[currentQuestionIndex];
    const qId = q._id || `q-${currentQuestionIndex}`;
    
    if (selectedAnswers[qId] === undefined) {
        alert("Please select an answer!");
        return;
    }
    currentQuestionIndex++;
    renderQuestion();
}

async function submitCurrentQuiz() {
    const q = activeQuiz.questions[currentQuestionIndex];
    const qId = q._id || `q-${currentQuestionIndex}`;
    
    if (selectedAnswers[qId] === undefined) {
        UI.showToast("Please select an answer for the last question!", "warning");
        return;
    }

    const btn = document.getElementById('btn-submit-quiz');
    const originalText = btn.innerText;

    UI.setButtonState(btn, true);
    UI.setLoading(true, 'Evaluating your Vedic wisdom...');

    clearInterval(quizTimerInterval);
    const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);

    try {
        const results = await submitQuizAnswers(activeQuiz._id, selectedAnswers, timeTaken);
        UI.showToast('Quiz submitted successfully!', 'success');
        renderResults(results);
        
        if (activeQuiz && activeQuiz.quizType) {
            updateLeaderboard(activeQuiz.quizType);
        }
    } catch (err) {
        UI.showToast(err.message, 'error');
        // Restart timer if submission failed so user can try again
        startTimer();
    } finally {
        UI.setLoading(false);
        UI.setButtonState(btn, false, originalText);
    }
}

function renderResults(results) {
    if (!results) {
        console.error("[Quiz] renderResults called with null results");
        return;
    }
    document.getElementById('quiz-active').classList.add('hidden');
    document.getElementById('quiz-results').classList.remove('hidden');
    
    document.getElementById('result-score').innerText = results.score ?? 0;
    document.getElementById('result-max').innerText = results.maxScore ?? 0;
    document.getElementById('result-suggestion').innerText = results.suggestion || "Keep practicing!";
    
    const breakdown = document.getElementById('results-breakdown');
    const details = results.details || [];
    
    breakdown.innerHTML = details.map((d, i) => {
        // Use question text from details, fallback to activeQuiz if available
        const questionText = d.question || (activeQuiz && activeQuiz.questions[i] ? activeQuiz.questions[i].question : "Question " + (i+1));
        const options = (activeQuiz && activeQuiz.questions[i]) ? activeQuiz.questions[i].options : [];
        const userAns = options[d.selectedAnswer] || "None";
        const correctAns = options[d.correctAnswer] || "Correct Answer";

        return `
        <div class="result-item ${d.isCorrect ? 'correct' : 'wrong'}">
            <h4>Question ${i + 1}: ${d.isCorrect ? '✅ Correct' : '❌ Incorrect'}</h4>
            <p><strong>Q:</strong> ${questionText}</p>
            <p><strong>Your Answer:</strong> ${userAns}</p>
            ${!d.isCorrect ? `<p><strong>Correct Answer:</strong> ${correctAns}</p>` : ''}
            <div class="result-explanation">
                <strong>Vedic Explanation:</strong><br>
                ${d.explanation || "No explanation available."}
            </div>
        </div>
    `}).join('');
}


window.calculateVedic = async function() {
    const num1 = parseFloat(document.getElementById('calc-num1').value);
    const num2 = parseFloat(document.getElementById('calc-num2').value);
    const op = document.getElementById('calc-op').value;
    const btn = document.querySelector('.calc-inputs .btn-primary');

    if (isNaN(num1) || isNaN(num2)) {
        UI.showToast('Please enter valid numbers for both fields.', 'warning');
        return;
    }

    const resultBox = document.getElementById('calc-result');
    const sutraEl = document.getElementById('calc-sutra-name');
    const stepsEl = document.getElementById('calc-steps');

    UI.setButtonState(btn, true);
    UI.setLoading(true, 'Computing Vedic solution...');
    resultBox.style.display = 'block';
    sutraEl.innerHTML = '<em>⏳ Analyzing calculation…</em>';
    stepsEl.innerHTML = '';

    const opSymbols = { '*': '×', '/': '÷', '+': '+', '-': '−' };
    const expression = `${num1} ${opSymbols[op] || op} ${num2}`;

    try {
        const solution = await solveWithVedicAI(expression);

        sutraEl.innerHTML = `
            <span class="sutra-badge">📿 Sutra</span>
            <strong>${solution.sutra}</strong>`;

        const formattedSteps = solution.steps
            .split('\n\n')
            .map(block => {
                const lines = block.split('\n');
                const heading = lines[0];
                const rest = lines.slice(1).join('<br>');
                return `<div class="vedic-step">
                    <p class="step-heading">${heading}</p>
                    ${rest ? `<p class="step-body">${rest}</p>` : ''}
                </div>`;
            }).join('');

        stepsEl.innerHTML = formattedSteps +
            `<div class="final-answer-box">🏆 Final Answer: <strong>${solution.finalAnswer}</strong></div>`;

        if (currentUser) {
            await saveCalculatorHistory(expression, solution.finalAnswer, solution.sutra);
        }
        UI.showToast('Calculation complete!', 'success');
    } catch (err) {
        UI.showToast(err.message, 'error');
        sutraEl.innerHTML = '<span style="color:red">Vedic Solver unavailable.</span>';
    } finally {
        UI.setLoading(false);
        UI.setButtonState(btn, false, 'Calculate');
    }
}

async function populateSutras() {
    const container = document.getElementById('sutras-container');
    const loader = document.getElementById('sutras-loader');
    const emptyState = document.getElementById('sutras-empty');
    
    if (!container) return;

    // Show loader
    container.classList.add('hidden');
    emptyState.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        let data;
        if (currentSutraCategory === 'sutras') {
            if (cachedSutras.length === 0) cachedSutras = await fetchSutras();
            data = cachedSutras;
        } else {
            if (cachedSubSutras.length === 0) cachedSubSutras = await fetchSubSutras();
            data = cachedSubSutras;
        }

        renderSutras(data);
    } catch (err) {
        console.error("Error populating sutras:", err);
        container.innerHTML = '<p class="error">Failed to load data. Please refresh.</p>';
        container.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
    }
}

function updateUIState() {
    if (currentUser) {
        $('.auth-only').removeClass('hidden');
        $('#btn-upload-video').removeClass('hidden');
    } else {
        $('.auth-only').addClass('hidden');
        $('#btn-upload-video').addClass('hidden');
    }
}

function renderSutras(data) {
    const container = document.getElementById('sutras-container');
    const emptyState = document.getElementById('sutras-empty');
    
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    data.forEach(s => {
        const card = document.createElement('div');
        card.className = 'sutra-card';
        card.innerHTML = `
            <div class="sutra-header">
                <h4>${s.title}</h4>
                <p class="sutra-sanskrit">${s.Sanskrit_name}</p>
            </div>
            <p class="sutra-meaning"><strong>Meaning:</strong> ${s.meaning}</p>
            <div class="sutra-example">
                <strong>Example:</strong><br>${s.example}
            </div>
        `;
        container.appendChild(card);
    });
}

let cachedVideos = [];

async function populateVideos() {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;
    
    // Lazy loading
    if (cachedVideos.length > 0) {
        renderVideos(cachedVideos);
        return;
    }

    const $grid = $(videoGrid);
    if ($grid.hasClass('slick-initialized')) {
        $grid.slick('unslick');
    }

    videoGrid.innerHTML = `
        <div class="skeleton" style="height: 200px; grid-column: 1/-1;"></div>
        <p style="text-align: center; grid-column: 1/-1;">Loading Vedic Videos...</p>
    `;

    try {
        cachedVideos = await fetchVideos();
        renderVideos(cachedVideos);
    } catch (err) {
        UI.showToast('Failed to load videos.', 'error');
        videoGrid.innerHTML = '<p class="error">Failed to load videos.</p>';
    }
}

function renderVideos(videos) {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;

    const $grid = $(videoGrid);
    if ($grid.hasClass('slick-initialized')) {
        $grid.slick('unslick');
    }

    videoGrid.innerHTML = '';
    
    if (videos.length === 0) {
        videoGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-video-slash" style="font-size: 3rem; color: #ccc;"></i>
                <p>No videos available yet. Be the first to upload!</p>
            </div>`;
        return;
    }
    
    videos.forEach((v, index) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.index = index; // Store index for retrieval
        
        const isOwner = currentUser && ((v.uploadedBy && (v.uploadedBy === currentUser._id || v.uploadedBy === currentUser.id)) || (v.userId && (v.userId === currentUser._id || v.userId === currentUser.id)));
        const badgeClass = v.type === 'admin' ? 'badge-admin' : 'badge-user';
        const badgeText = v.type === 'admin' ? 'Official' : 'Community';
        
        card.innerHTML = `
            <div class="video-badge ${badgeClass}">${badgeText}</div>
            ${isOwner ? `<button class="video-delete-btn" data-id="${v._id}" title="Delete Video"><i class="fas fa-trash"></i></button>` : ''}
            <div class="video-thumbnail">
                <i class="fas fa-play-circle"></i>
            </div>
            <div class="video-info">
                <h4>${v.title}</h4>
                <p>${v.description ? (v.description.length > 60 ? v.description.substring(0, 60) + '...' : v.description) : 'No description.'}</p>
                <div class="uploader-info">
                    <i class="fas fa-user-circle"></i>
                    <span>${v.username || 'Admin'}</span>
                </div>
            </div>
        `;
        videoGrid.appendChild(card);
    });

    // Event Delegation for Video Clicks
    $grid.off('click', '.video-card').on('click', '.video-card', function(e) {
        if ($(e.target).closest('.video-delete-btn').length) {
            const videoId = $(e.target).closest('.video-delete-btn').data('id');
            handleDeleteVideo(e, videoId);
            return;
        }
        const index = $(this).data('index');
        const video = videos[index];
        if (video) openVideoPlayer(video);
    });

    // Re-initialize Slick
    $grid.slick({
        dots: true,
        infinite: true,
        speed: 300,
        slidesToShow: 3,
        slidesToScroll: 1,
        responsive: [
            { breakpoint: 1024, settings: { slidesToShow: 2, slidesToScroll: 1 } },
            { breakpoint: 600, settings: { slidesToShow: 1, slidesToScroll: 1 } }
        ]
    });
}

async function handleDeleteVideo(event, videoId) {
    if (event) event.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this video? This action cannot be undone.")) return;

    UI.setLoading(true, 'Deleting video...');
    try {
        console.log(`[Video] Requesting deletion for video: ${videoId}`);
        await deleteVideo(videoId);
        UI.showToast('Video deleted successfully!', 'success');
        
        // Refresh videos list
        cachedVideos = []; // Clear cache to force re-fetch
        await populateVideos();
    } catch (err) {
        console.error("Delete video error:", err);
        UI.showToast(err.message, 'error');
    } finally {
        UI.setLoading(false);
    }
}

async function populateQuizzes() {
    // This is called on load and login
    if (currentUser) {
        populateQuizDashboard();
        updateLeaderboard('daily');
    }
}

window.handleImageUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!currentUser) {
        UI.showToast("Please sign in to upload images.", "warning");
        signIn();
        return;
    }

    // Validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        UI.showToast("Only JPG, PNG and WebP images are allowed.", "error");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        UI.showToast("Image size should be less than 5MB.", "error");
        return;
    }

    const uploadBtn = document.querySelector('.doubt-actions .btn-outline');
    const originalText = uploadBtn.innerHTML;
    
    UI.setButtonState(uploadBtn, true);
    UI.setLoading(true, 'Analyzing image with OCR...');

    try {
        const result = await uploadDoubtImage(file);
        console.log("API response:", result);
        UI.showToast("Image processed successfully!", "success");
        
        const solutionDiv = document.querySelector('.doubt-solution');
        const stepsDiv = document.getElementById('solution-steps');
        solutionDiv.classList.remove('hidden');
        stepsDiv.innerHTML = `
            <p><strong>Extracted Question:</strong> ${result.extractedQuestion || "No question detected"}</p>
            <hr>
            <p><strong>AI Solution:</strong></p>
            <p style="white-space: pre-wrap;">${result.solution || "No solution available"}</p>
        `;

        if(document.getElementById('module-community').classList.contains('active')) {
            populateDoubtsCommunity();
        }
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setLoading(false);
        UI.setButtonState(uploadBtn, false, originalText);
        event.target.value = ''; // Reset input
    }
}

window.submitDoubt = async function() {
    const doubtText = document.getElementById('doubt-text').value;

    if (!currentUser) {
        UI.showToast('Please sign in to ask a doubt!', 'warning');
        signIn();
        return;
    }
    if (doubtText.trim() === '') {
        UI.showToast('Please enter a question or computation!', 'warning');
        return;
    }

    const btn = document.querySelector('.doubt-actions .btn-primary');
    const originalText = btn.innerHTML;

    UI.setButtonState(btn, true);
    UI.setLoading(true, 'Consulting the Vedic Sutras...');

    try {
        const solution = await solveWithVedicAI(doubtText);

        const solutionDiv = document.querySelector('.doubt-solution');
        const stepsDiv = document.getElementById('solution-steps');
        solutionDiv.classList.remove('hidden');

        const formattedSteps = solution.steps
            .split('\n\n')
            .map(block => {
                const lines = block.split('\n');
                const heading = lines[0];
                const rest = lines.slice(1).join('<br>');
                return `<div class="vedic-step">
                    <p class="step-heading">${heading}</p>
                    ${rest ? `<p class="step-body">${rest}</p>` : ''}
                </div>`;
            }).join('');

        stepsDiv.innerHTML = `
            <div class="sutra-badge-block">📿 <strong>${solution.sutra}</strong></div>
            ${formattedSteps}
            <div class="final-answer-box">🏆 Final Answer: <strong>${solution.finalAnswer}</strong></div>
        `;

        await saveDoubt(doubtText);
        document.getElementById('doubt-text').value = '';
        UI.showToast('Solution found and saved!', 'success');
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setLoading(false);
        UI.setButtonState(btn, false, originalText);
    }
}

window.switchCommunityTab = function(tab) {
    document.querySelectorAll('.community-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`community-${tab}`).classList.remove('hidden');
    
    document.querySelectorAll('#module-community .tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if(tab === 'chat') populateChats();
    if(tab === 'doubts') populateDoubtsCommunity();
}

window.sendMessage = async function() {
    const input = document.getElementById('community-chat-input');
    const msg = input.value;
    const btn = document.querySelector('.btn-send');

    if(!currentUser) {
        UI.showToast("Please sign in to join the discussion!", "warning");
        signIn();
        return;
    }

    if(msg.trim() === "") {
        UI.showToast("Message cannot be empty.", "warning");
        return;
    }

    UI.setButtonState(btn, true);
    try {
        await saveChat(msg, replyingTo);
        input.value = '';
        cancelReply();
        populateChats();
        UI.showToast('Message sent', 'success', 2000);
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setButtonState(btn, false);
    }
}

async function populateChats() {
    const container = document.getElementById('community-chat-messages');
    if(!container) return;

    const chats = await fetchChats();
    container.innerHTML = '';

    chats.forEach(c => {
        const isOwn = currentUser && (c.userId === currentUser._id || (currentUser.id && c.userId === currentUser.id));
        const isEditing = editingMessageId === c._id;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isOwn ? 'outgoing' : 'incoming'}`;
        
        const now = new Date();
        const msgDate = new Date(c.createdAt);
        const updateDate = new Date(c.updatedAt);
        const isEdited = c.updatedAt && (updateDate - msgDate > 1000); // More than 1s diff
        
        const diffInHours = (now - msgDate) / (1000 * 60 * 60);
        let timeStr;
        if (diffInHours < 24) {
            timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            timeStr = msgDate.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ", " + msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        let replyHtml = '';
        if (c.replyTo) {
            replyHtml = `
                <div class="reply-container">
                    <span class="reply-user">@${c.replyTo.username}</span>
                    <p class="reply-text-preview">${c.replyTo.messageText}</p>
                </div>
            `;
        }

        let contentHtml = '';
        if (isEditing) {
            contentHtml = `
                <div class="edit-area">
                    <textarea id="edit-input-${c._id}" class="edit-input">${c.message}</textarea>
                    <div class="edit-buttons">
                        <button class="btn btn-outline btn-mini" onclick="cancelEdit()">Cancel</button>
                        <button class="btn btn-primary btn-mini" onclick="saveEdit('${c._id}')">Save</button>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                ${!isOwn ? `<small><strong>${c.username}</strong></small>` : ''}
                ${replyHtml}
                <p>${c.message}${isEdited ? '<span class="edited-label">(edited)</span>' : ''}</p>
                <span class="msg-time">${timeStr}</span>
                <div class="msg-actions">
                    <button class="action-link" onclick="replyToMessage('${c._id}', '${c.username}', '${c.message.replace(/'/g, "\\'")}')">Reply</button>
                    ${isOwn ? `
                        <button class="action-link" onclick="editMessage('${c._id}', '${c.message.replace(/'/g, "\\'")}')">Edit</button>
                        <button class="action-link delete" onclick="deleteMessage('${c._id}')">Delete</button>
                    ` : ''}
                </div>
            `;
        }
        
        msgDiv.innerHTML = `
            ${!isOwn ? `<div class="msg-avatar">${c.username[0].toUpperCase()}</div>` : ''}
            <div class="msg-content">
                ${contentHtml}
            </div>
        `;
        container.appendChild(msgDiv);
    });
    container.scrollTop = container.scrollHeight;
}

async function populateDoubtsCommunity() {
    const container = document.getElementById('community-doubts-list');
    if(!container) return;

    const doubts = await fetchDoubts();
    container.innerHTML = '';

    if(doubts.length === 0) {
        container.innerHTML = '<p>No community doubts yet. Be the first to ask!</p>';
        return;
    }

    doubts.forEach(d => {
        const card = document.createElement('div');
        card.className = 'doubt-card';
        
        const now = new Date();
        const msgDate = new Date(d.createdAt);
        const diffInHours = (now - msgDate) / (1000 * 60 * 60);
        let timeStr;
        if (diffInHours < 24) {
            timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            timeStr = msgDate.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ", " + msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        card.innerHTML = `
            <div class="doubt-header">
                <span class="doubt-user"><strong>${d.username || 'User'}</strong></span>
                <span class="doubt-time">${timeStr}</span>
            </div>
            <div class="doubt-body">
                <p class="doubt-q">${d.question}</p>
                ${d.imageUrl ? `
                    <div class="doubt-img">
                        <img src="${d.imageUrl}" 
                             onerror="this.src='https://via.placeholder.com/400x300?text=Question+Image+Unavailable'; this.onerror=null;" 
                             alt="Doubt Image" style="max-width: 100%; border-radius: 8px; margin: 10px 0;">
                    </div>
                    <div class="extracted-text">
                        <small><strong>Extracted Text:</strong> ${d.extractedText}</small>
                    </div>
                ` : ''}
                ${d.aiAnswer ? `
                    <div class="ai-answer">
                        <p><strong><i class="fas fa-robot"></i> AI Answer:</strong></p>
                        <p style="white-space: pre-wrap; font-style: italic; color: #555;">${d.aiAnswer}</p>
                    </div>
                ` : ''}
            </div>
            <div class="doubt-answers">
                ${d.answers && d.answers.length > 0 ? `
                    <h4>Community Answers:</h4>
                    ${d.answers.map(a => `
                        <div class="answer-item">
                            <strong>${a.username}:</strong> ${a.answer}
                        </div>
                    `).join('')}
                ` : '<p class="no-ans">No community answers yet.</p>'}
            </div>
        `;
        container.appendChild(card);
    });
}

// ── USER PROFILE DASHBOARD ───────────────────────────

let scoreChartInstance = null;
let activityChartInstance = null;

let populateProfile = async function() {
    if (!currentUser) {
        UI.showToast('Please sign in to view your dashboard.', 'warning');
        signIn();
        return;
    }

    UI.setLoading(true, 'Fetching your Vedic journey...');

    try {
        const profile = await fetchUserProfile();
        const stats = await fetchUserStats();
        const history = await fetchUserHistory();
        const insights = await fetchUserInsights();

        // Populate Basic Info
        document.getElementById('profile-display-name').innerText = profile.name;
        document.getElementById('profile-display-email').innerText = profile.email;
        document.getElementById('profile-display-rank').innerText = profile.rank || 'Scholar';
        document.getElementById('profile-display-points').innerText = profile.points || 0;
        document.getElementById('profile-display-img').src = profile.profilePic || 'https://via.placeholder.com/150';
        document.getElementById('profile-joined-date').innerText = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        document.getElementById('profile-streak-count').innerText = profile.streak?.count || 0;
        document.getElementById('profile-ai-insight').innerText = insights.insight;

        // Populate Stats
        document.getElementById('stat-total-quizzes').innerText = stats.totalQuizzes;
        document.getElementById('stat-avg-score').innerText = `${stats.accuracy}%`;
        document.getElementById('stat-best-score').innerText = stats.bestScore;
        document.getElementById('stat-total-time').innerText = `${Math.round(stats.totalTime / 60)}m`;

        // Render Badges
        renderBadges(profile.badges);

        // Render History
        renderProfileHistory(history);

        // Render Charts
        renderPerformanceCharts(history);

    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setLoading(false);
    }
}

function renderBadges(badges) {
    const grid = document.getElementById('badges-grid');
    grid.innerHTML = '';

    if (!badges || badges.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1;">No badges earned yet. Keep solving quizzes!</p>';
        return;
    }

    const badgeIcons = {
        'First Quiz Completed': '🎖️',
        'Vedic Perfectionist': '💎',
        '7-Day Warrior': '⚡',
        'Top 10 Leaderboard': '🥇'
    };

    badges.forEach(b => {
        const item = document.createElement('div');
        item.className = 'badge-item';
        item.innerHTML = `
            <div class="badge-circle">${badgeIcons[b.badgeName] || '🏅'}</div>
            <p>${b.badgeName}</p>
            <small>${new Date(b.earnedAt).toLocaleDateString()}</small>
        `;
        grid.appendChild(item);
    });
}

function renderProfileHistory(history) {
    const list = document.getElementById('profile-history-list');
    list.innerHTML = '';

    if (!history || history.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center">No quiz attempts yet.</td></tr>';
        return;
    }

    history.forEach(h => {
        const accuracy = Math.round((h.score / h.maxScore) * 100);
        const accuracyClass = accuracy >= 80 ? 'accuracy-high' : (accuracy >= 50 ? 'accuracy-mid' : 'accuracy-low');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(h.attemptedAt).toLocaleDateString()}</td>
            <td><span class="quiz-badge ${h.quizType}">${h.quizType}</span></td>
            <td>${h.score}/${h.maxScore}</td>
            <td>${h.timeTaken || 0}s</td>
            <td class="history-accuracy ${accuracyClass}">${accuracy}%</td>
        `;
        list.appendChild(row);
    });
}

function renderPerformanceCharts(history) {
    if (!history || history.length === 0) return;

    // Destroy existing instances if they exist
    if (scoreChartInstance) scoreChartInstance.destroy();
    if (activityChartInstance) activityChartInstance.destroy();

    const reversedHistory = [...history].reverse();
    const dates = reversedHistory.map(h => new Date(h.attemptedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const scores = reversedHistory.map(h => (h.score / h.maxScore) * 100);

    // Score History (Line Chart)
    const ctxScore = document.getElementById('scoreChart').getContext('2d');
    scoreChartInstance = new Chart(ctxScore, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Accuracy (%)',
                data: scores,
                borderColor: '#6c5ce7',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });

    // Quiz Activity (Bar Chart)
    // Count quizzes per day
    const activityMap = {};
    dates.forEach(d => activityMap[d] = (activityMap[d] || 0) + 1);
    
    const ctxActivity = document.getElementById('activityChart').getContext('2d');
    activityChartInstance = new Chart(ctxActivity, {
        type: 'bar',
        data: {
            labels: Object.keys(activityMap),
            datasets: [{
                label: 'Quizzes Attempted',
                data: Object.values(activityMap),
                backgroundColor: '#a29bfe',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

window.openEditProfileModal = function() {
    if (!currentUser) return;
    document.getElementById('edit-name').value = currentUser.name;
    document.getElementById('edit-profile-pic').value = currentUser.profilePic;
    document.getElementById('edit-profile-modal').classList.remove('hidden');
}

window.closeEditProfileModal = function() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

window.handleEditProfile = async function(e) {
    e.preventDefault();
    const name = document.getElementById('edit-name').value;
    const profilePic = document.getElementById('edit-profile-pic').value;
    const btn = document.getElementById('edit-profile-submit-btn');

    UI.setButtonState(btn, true);
    try {
        const updatedUser = await updateUserProfile({ name, profilePic });
        currentUser = updatedUser;
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        UI.showToast('Profile updated successfully!', 'success');
        closeEditProfileModal();
        populateProfile();
        updateUIForLogin();
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setButtonState(btn, false, 'Save Changes');
    }
}

window.handleAvatarUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    UI.showToast('Please use a URL for the profile image in this version.', 'info');
}

function downloadReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    UI.showToast('Generating your Vedic Progress Report...', 'info');

    doc.setFontSize(22);
    doc.text('Vedic Guru - Progress Report', 20, 20);
    
    doc.setFontSize(14);
    doc.text(`User: ${currentUser.name}`, 20, 35);
    doc.text(`Email: ${currentUser.email}`, 20, 42);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 49);

    doc.text('Performance Summary:', 20, 65);
    doc.text(`Total Quizzes: ${document.getElementById('stat-total-quizzes').innerText}`, 20, 75);
    doc.text(`Average Accuracy: ${document.getElementById('stat-avg-score').innerText}`, 20, 82);
    doc.text(`Best Score: ${document.getElementById('stat-best-score').innerText}`, 20, 89);
    doc.text(`Total Time Spent: ${document.getElementById('stat-total-time').innerText}`, 20, 96);

    doc.text('AI Personalized Insights:', 20, 110);
    const insightLines = doc.splitTextToSize(document.getElementById('profile-ai-insight').innerText, 170);
    doc.text(insightLines, 20, 120);

    doc.save(`Vedic_Guru_Report_${currentUser.username}.pdf`);
    UI.showToast('Report downloaded successfully!', 'success');
}

// ── AI TUTOR & ADAPTIVE LEARNING ─────────────────────

let isAIChatOpen = false;

async function toggleAIChat() {
    if (!currentUser) {
        UI.showToast('Please sign in to chat with the AI Tutor.', 'warning');
        signIn();
        return;
    }

    const aiWindow = document.getElementById('ai-chat-window');
    isAIChatOpen = !isAIChatOpen;
    aiWindow.classList.toggle('hidden', !isAIChatOpen);

    if (isAIChatOpen) {
        document.querySelector('.ai-badge').classList.add('hidden');
        await loadAIChatHistory();
        document.getElementById('ai-chat-input').focus();
    }
}

async function loadAIChatHistory() {
    const container = document.getElementById('ai-chat-messages');
    
    try {
        const history = await fetchAIChatHistory();
        container.innerHTML = '';
        
        if (history && history.length > 0) {
            history.forEach(chat => {
                appendAIMessage('user', chat.message);
                appendAIMessage('bot', chat.reply);
            });
        }
    } catch (err) {
        console.error('History load failed:', err);
    }
}

window.handleAIQuickAction = function(action) {
    const input = document.getElementById('ai-chat-input');
    let message = "";
    
    if (action === 'Explain sutra') message = "Explain a Vedic Mathematics sutra clearly.";
    else if (action === 'Solve problem') message = "Solve a math problem step-by-step.";
    else if (action === 'Give example') message = "Give me an example of Vedic Math in action.";
    
    if (message) {
        input.value = message;
        sendAIMessage();
    }
}

async function sendAIMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    appendAIMessage('user', message);
    
    const indicator = document.getElementById('ai-typing-indicator');
    indicator.classList.remove('hidden');
    
    console.log("Sending message to AI Tutor...");
    try {
        const data = await fetchAIResponse(message);
        console.log("AI Tutor response:", data);
        
        indicator.classList.add('hidden');
        
        // Display AI response directly
        if (data && data.reply) {
            appendAIMessage('bot', data.reply);
        } else {
            appendAIMessage('bot', "Sorry, I couldn't process your request. Please try again.");
        }
        
    } catch (err) {
        console.error("AI Tutor Error:", err);
        indicator.classList.add('hidden');
        appendAIMessage('bot', "Sorry, I couldn't process your request. Please try again.");
    }
}

function appendAIMessage(sender, text) {
    const container = document.getElementById('ai-chat-messages');
    const msg = document.createElement('div');
    msg.className = `ai-message ${sender}`;
    msg.innerHTML = text.replace(/\n/g, '<br>');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// ── ADAPTIVE INSIGHTS IN PROFILE ──────────────────────
// Update populateProfile to include adaptive insights
const originalPopulateProfile = populateProfile;
populateProfile = async function() {
    await originalPopulateProfile();
    
    // Add Adaptive Insights
    try {
        const data = await fetchAIInsights();
        
        const insightsCard = document.querySelector('.insights-card');
        if (insightsCard) {
            insightsCard.innerHTML = `
                <h3><i class="fas fa-brain"></i> Adaptive Learning</h3>
                <p><strong>Recommendation:</strong> ${data.recommendation}</p>
                <div style="margin-top: 1rem; font-size: 0.85rem;">
                    ${data.weakAreas && data.weakAreas.length > 0 ? `<p>🔴 Focus: ${data.weakAreas.join(', ')}</p>` : ''}
                    ${data.strongAreas && data.strongAreas.length > 0 ? `<p>🟢 Mastered: ${data.strongAreas.join(', ')}</p>` : ''}
                </div>
            `;
        }
    } catch (err) {
        console.error("Failed to fetch adaptive insights:", err);
    }
}

console.log("[Vedic Guru] script.js fully loaded.");
