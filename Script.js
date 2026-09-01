// ==========================================
// 1. FIREBASE CONFIG & MAGIC KEYS
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAmmv6EZ5I8BD_vtVTUUXtz4qo7z4jpW4Y",
    authDomain: "certisync-7f169.firebaseapp.com",
    projectId: "certisync-7f169",
    storageBucket: "certisync-7f169.firebasestorage.app",
    messagingSenderId: "15938509921",
    appId: "1:15938509921:web:58bce73254fffef1025e20"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 🛠️ BUG 3 FIX: Force Firebase to destroy the session when the browser/tab is closed
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
    .catch((error) => console.error("Persistence Error:", error));

const CLOUDINARY_CLOUD_NAME = "dhcfsz4my";
const CLOUDINARY_UPLOAD_PRESET = "certisync_uploads"; 
const OCR_SPACE_API_KEY = "K82327566988957";
const GEMINI_API_KEY = "AIzaSyCE6Ajv9c9SGtt7UMFQZorSduvt12CxF6k";

// ==========================================
// 2. DOM ELEMENTS & VARIABLES
// ==========================================
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const grid = document.getElementById('certificate-grid');

const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const uploadModal = document.getElementById('upload-modal');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const scanAgainUploadBtn = document.getElementById('scan-again-upload-btn'); 
const uploadPreviewImg = document.getElementById('upload-preview-img'); 

const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

const editModal = document.getElementById('edit-modal');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveEditBtn = document.getElementById('save-edit-btn');
const scanAgainEditBtn = document.getElementById('scan-again-edit-btn'); 

const searchBar = document.getElementById('search-bar');
const filterProvider = document.getElementById('filter-provider');
const filterYear = document.getElementById('filter-year');
const statsCounter = document.getElementById('stats-counter'); 

const shareModal = document.getElementById('share-modal');
const shareLinkInput = document.getElementById('share-link-input');
const closeShareBtn = document.getElementById('close-share-btn');
const copyShareBtn = document.getElementById('copy-share-btn');

const previewBtn = document.getElementById('preview-portfolio-btn');
const sharePortfolioBtn = document.getElementById('share-portfolio-btn');
const dashboardMainView = document.getElementById('dashboard-main-view');
const portfolioPreviewView = document.getElementById('portfolio-preview-view');
const backToVaultBtn = document.getElementById('back-to-vault-btn');
const previewFilterContainer = document.getElementById('preview-timeline-filters');

const shareProfileModal = document.getElementById('share-profile-modal');
const profileLinkInput = document.getElementById('profile-link-input');
const closeProfileBtn = document.getElementById('close-profile-btn');
const copyProfileBtn = document.getElementById('copy-profile-btn');

let pendingData = null; 
let itemToDelete = null;
let itemToEdit = null;
let currentUserLegalName = ""; 
let globalCertsArray = []; 
let radarChartInstance = null; 

// ==========================================
// 3. HELPER FUNCTIONS & AI SPINNER
// ==========================================
function showToast(message) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

async function runAIScan(imageUrl, prefix) {
    const courseInput = document.getElementById(`${prefix}-course`);
    const providerInput = document.getElementById(`${prefix}-provider`);
    const dateInput = document.getElementById(`${prefix}-date`);
    const urlInput = document.getElementById(`${prefix}-url-link`); 
    
    const formContainer = document.getElementById(`${prefix}-form-container`);
    const spinnerElement = document.getElementById(`${prefix}-spinner`);

    formContainer.style.display = 'none';
    spinnerElement.style.display = 'flex';
    
    courseInput.value = ""; providerInput.value = ""; dateInput.value = "";
    if (urlInput && prefix === 'cert') urlInput.value = ""; 

    try {
        const ocrFormData = new FormData();
        ocrFormData.append('url', imageUrl);
        ocrFormData.append('apikey', OCR_SPACE_API_KEY); 
        ocrFormData.append('OCREngine', '2');
        const ocrRes = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: ocrFormData });
        const ocrData = await ocrRes.json();
        
        if (ocrData.IsErroredOnProcessing || !ocrData.ParsedResults) throw new Error("OCR.space failed.");
        const extractedText = ocrData.ParsedResults[0].ParsedText;
        if (!extractedText || extractedText.trim() === "") throw new Error("No text found in image.");

        const prompt = `Extract the following details from this certificate text: Course Name, Provider/Issuer, Date, Student Name. Return ONLY a valid JSON object like {"course": "...", "provider": "...", "date": "...", "studentName": "..."}. Text: ${extractedText}`;
        
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const geminiData = await geminiRes.json();
        if (geminiData.error) throw new Error(geminiData.error.message);
        
        const aiRawText = geminiData.candidates[0].content.parts[0].text;
        const cleanedJsonText = aiRawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiParsedData = JSON.parse(cleanedJsonText);

        courseInput.value = aiParsedData.course || '';
        providerInput.value = aiParsedData.provider || '';
        dateInput.value = aiParsedData.date || '';

        if(prefix === 'cert') {
            pendingData.studentName = aiParsedData.studentName || 'Unknown';
        }

        showToast('✅ Extraction Complete!');
    } catch (error) {
        showToast('⚠️ AI Extraction Failed. You can type it manually.');
        console.error(error);
    } finally {
        spinnerElement.style.display = 'none';
        formContainer.style.display = 'block';
    }
}

// ==========================================
// 3.5 LOGIN UI
// ==========================================
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const strengthMeter = document.getElementById('strength-meter');
const strengthBar = document.getElementById('strength-bar');
const strengthText = document.getElementById('strength-text');

if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? '👁️' : '🙈'; 
    });
}

if (passwordInput && strengthMeter && strengthBar && strengthText) {
    passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;
        if (val.length > 0) { strengthMeter.style.display = 'block'; strengthText.style.display = 'block'; } 
        else { strengthMeter.style.display = 'none'; strengthText.style.display = 'none'; return; }
        
        let strength = 0;
        if (val.length >= 6) strength += 1; 
        if (val.match(/[A-Z]/) && val.match(/[a-z]/)) strength += 1; 
        if (val.match(/[0-9]/)) strength += 1; 
        if (val.match(/[^a-zA-Z0-9]/)) strength += 1; 
        switch(strength) {
            case 0: case 1: strengthBar.style.width = '25%'; strengthBar.style.backgroundColor = '#ff4d4d'; strengthText.textContent = 'Weak'; strengthText.style.color = '#ff4d4d'; break;
            case 2: strengthBar.style.width = '50%'; strengthBar.style.backgroundColor = '#f1c40f'; strengthText.textContent = 'Fair'; strengthText.style.color = '#f1c40f'; break;
            case 3: strengthBar.style.width = '75%'; strengthBar.style.backgroundColor = '#2ecc71'; strengthText.textContent = 'Good'; strengthText.style.color = '#2ecc71'; break;
            case 4: strengthBar.style.width = '100%'; strengthBar.style.backgroundColor = '#00f2fe'; strengthText.textContent = 'Very Strong'; strengthText.style.color = '#00f2fe'; break;
        }
    });
}

const toggleAuthMode = document.getElementById('toggle-auth-mode');
const nameGroup = document.getElementById('name-group');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const forgotPwdLink = document.getElementById('forgot-pwd-link');

if (toggleAuthMode && nameGroup && loginBtn && signupBtn && forgotPwdLink) {
    let isSignupMode = false;
    toggleAuthMode.addEventListener('click', () => {
        isSignupMode = !isSignupMode;
        if (isSignupMode) {
            nameGroup.style.display = 'block'; loginBtn.style.display = 'none'; signupBtn.style.display = 'block'; forgotPwdLink.style.display = 'none';
            toggleAuthMode.innerHTML = `Already have an account? <span style="color: #00f2fe; font-weight: bold;">Log In</span>`;
        } else {
            nameGroup.style.display = 'none'; loginBtn.style.display = 'block'; signupBtn.style.display = 'none'; forgotPwdLink.style.display = 'block';
            toggleAuthMode.innerHTML = `Don't have an account? <span style="color: #00f2fe; font-weight: bold;">Sign Up</span>`;
        }
    });
}

// ==========================================
// 4. THE BRAIN (Auth Routing & Loading)
// ==========================================
auth.onAuthStateChanged(async user => {
    const isLoginPage = !!document.getElementById('login-form');
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if(userDoc.exists) currentUserLegalName = userDoc.data().legalName || "";
        } catch(e) { console.error(e); }

        if (isLoginPage) window.location.href = "dashboard.html"; 
        else loadCertificates(user.uid); 
    } else {
        if (!isLoginPage) window.location.href = "index.html"; 
    }
});

if (loginBtn) {
    loginBtn.addEventListener('click', () => { 
        const email = document.getElementById('email').value; 
        const pass = document.getElementById('password').value; 
        if (!email || !pass) return showToast("⚠️ Please enter credentials"); 
        
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            let msg = "Oops! Something went wrong.";
            if (error.code === 'auth/user-not-found') msg = "We couldn't find an account with that email.";
            else if (error.code === 'auth/wrong-password') msg = "Incorrect password. Please try again.";
            else if (error.code === 'auth/invalid-email') msg = "Please enter a valid email format.";
            showToast("⚠️ " + msg); 
        }); 
    });
}

if (signupBtn) {
    signupBtn.addEventListener('click', () => { 
        const nameInput = document.getElementById('legal-name'); 
        const legalName = nameInput ? nameInput.value.trim() : ""; 
        const email = document.getElementById('email').value; 
        const pass = document.getElementById('password').value; 
        
        if (nameInput && !legalName) return showToast("⚠️ Please enter your Full Legal Name!"); 
        if (!email || !pass) return showToast("⚠️ Please enter credentials"); 
        if (pass.length < 6) return showToast("⚠️ Password must be at least 6 characters!"); 
        
        auth.createUserWithEmailAndPassword(email, pass).then((userCred) => { 
            return db.collection('users').doc(userCred.user.uid).set({ legalName: legalName, email: email }); 
        }).then(() => {
            showToast("✅ Account created successfully!");
        }).catch((error) => {
            let msg = "Error creating account.";
            if (error.code === 'auth/email-already-in-use') msg = "An account already exists with this email.";
            else if (error.code === 'auth/invalid-email') msg = "Please enter a valid email format.";
            showToast("⚠️ " + msg); 
        }); 
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        const loginPage = document.getElementById('login-form');
        if (loginPage) {
            if (loginBtn && loginBtn.style.display !== 'none') {
                loginBtn.click();
            } else if (signupBtn && signupBtn.style.display !== 'none') {
                signupBtn.click();
            }
        }
    }
});

if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

function loadCertificates(userId) {
    if (!grid) return;
    
    if(previewBtn) previewBtn.style.display = 'block';
    if(sharePortfolioBtn) sharePortfolioBtn.style.display = 'block';

    db.collection('certificates').where('userId', '==', userId).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        grid.innerHTML = ''; 
        globalCertsArray = []; 

        if (statsCounter) statsCounter.textContent = `🏆 ${snapshot.size} Certificate${snapshot.size !== 1 ? 's' : ''} in Vault`;

        if (snapshot.empty) {
            grid.innerHTML = '<div class="empty-state">Your vault is empty. Upload your first certificate!</div>';
            if(filterProvider) filterProvider.innerHTML = '<option value="all">All Providers</option>';
            if(filterYear) filterYear.innerHTML = '<option value="all">All Years</option>';
            return;
        }

        const providers = new Set();
        const years = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            globalCertsArray.push(data); 
            
            if (data.provider) providers.add(data.provider);
            if (data.date) { const yearMatch = data.date.match(/\d{4}/); if (yearMatch) years.add(yearMatch[0]); }

            const card = document.createElement('div');
            card.className = 'cert-card';
            const safeYear = data.date ? (data.date.match(/\d{4}/) || [''])[0] : '';
            card.setAttribute('data-provider', (data.provider || '').toLowerCase());
            card.setAttribute('data-year', safeYear);
            
            let verifyHtml = '';
            if (data.credentialUrl && data.credentialUrl.trim() !== "") {
                verifyHtml = `<a href="${data.credentialUrl}" target="_blank" class="verify-link-btn" title="View Official Credential"><svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg></a>`;
            }

            const isPublic = data.isPublic || false;
            const visibilityClass = isPublic ? 'public' : 'private';
            const visibilityTitle = isPublic ? 'Make Private' : 'Make Public';
            const visibilityIcon = isPublic 
                ? `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>` 
                : `<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2.01 3.87l2.68 2.68C3.06 7.83 1.77 9.79 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l3.29 3.29 1.41-1.41L3.42 2.45 2.01 3.87zm7.5 7.5l2.61 2.61c-.04.14-.06.27-.06.41 0 1.66 1.34 3 3 3 .15 0 .28-.02.42-.05l2.6 2.6c-.85.34-1.78.54-2.76.54-2.76 0-5-2.24-5-5 0-.98.2-1.91.54-2.76-.05.15-.05.28-.05.42z"/></svg>`; 

            card.innerHTML = `
                <div class="cert-image-wrapper">
                    <img src="${data.imageUrl}" alt="Certificate">
                    <div class="cert-action-overlay">
                        <button class="view-btn" data-url="${data.imageUrl}" title="View Fullscreen"><svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
                        
                        <button class="visibility-btn ${visibilityClass}" data-id="${doc.id}" data-public="${isPublic}" title="${visibilityTitle}">${visibilityIcon}</button>
                        <button class="share-btn" data-url="${data.imageUrl}" data-course="${data.course}" data-provider="${data.provider}" title="Create View-Once Link"><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg></button>
                        ${verifyHtml}
                        <button class="download-btn" data-url="${data.imageUrl}" data-course="${data.course}" title="Download Certificate"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
                        <button class="edit-btn" data-id="${doc.id}" data-course="${data.course}" data-provider="${data.provider}" data-date="${data.date}" data-url="${data.imageUrl}" data-credential="${data.credentialUrl || ''}" title="Edit"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                        <button class="delete-btn" data-id="${doc.id}" data-url="${data.imageUrl}" title="Delete"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                    </div>
                </div>
                <div class="cert-card-info">
                    <h3>${data.course || 'Unknown Course'}</h3>
                    <p>${data.provider || 'Unknown Provider'}</p>
                    <p class="date">${data.date || 'Unknown Date'}</p>
                </div>
            `;
            grid.appendChild(card);
        });

        if (filterProvider && filterYear) {
            const currentProvider = filterProvider.value; const currentYear = filterYear.value;
            filterProvider.innerHTML = '<option value="all">All Providers</option>';
            Array.from(providers).sort().forEach(prov => { filterProvider.innerHTML += `<option value="${prov.toLowerCase()}">${prov}</option>`; });
            filterYear.innerHTML = '<option value="all">All Years</option>';
            Array.from(years).sort((a,b)=>b-a).forEach(yr => { filterYear.innerHTML += `<option value="${yr}">${yr}</option>`; });
            if (Array.from(filterProvider.options).some(opt => opt.value === currentProvider)) filterProvider.value = currentProvider;
            if (Array.from(filterYear.options).some(opt => opt.value === currentYear)) filterYear.value = currentYear;
            filterCards();
        }
    }, error => { console.error("Firebase Error:", error); });
}

// ==========================================
// 4.5 SINGLE PAGE APP PORTFOLIO PREVIEW
// ==========================================
function parseDateString(dateStr) {
    if(!dateStr) return 0;
    const d = new Date(dateStr); if(!isNaN(d.getTime())) return d.getTime();
    const yearMatch = dateStr.match(/\d{4}/); if(yearMatch) return new Date(yearMatch[0], 0, 1).getTime(); return 0;
}

function getCategory(cert) {
    const text = (cert.course + " " + cert.provider).toLowerCase();
    if (text.match(/html|css|javascript|react|vue|angular|ui|ux|frontend|web/)) return "Frontend";
    if (text.match(/node|python|java|c\+\+|sql|mongo|database|backend|api/)) return "Backend/DB";
    if (text.match(/aws|azure|gcp|cloud|docker|kubernetes|linux|devops/)) return "Cloud & DevOps";
    if (text.match(/data|ai|machine learning|deep learning|analytics|gpt/)) return "Data & AI";
    if (text.match(/security|cyber|hack|pentest|comptia/)) return "Security";
    return "General IT";
}

function buildPreviewChipsAndTimeline(allCerts) {
    const availableCategories = new Set();
    allCerts.forEach(cert => availableCategories.add(getCategory(cert)));
    
    if(previewFilterContainer) {
        previewFilterContainer.innerHTML = '';
        
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-chip active';
        allBtn.textContent = `All (${allCerts.length})`;
        allBtn.onclick = () => filterPreviewTimeline("All", allCerts, allBtn);
        previewFilterContainer.appendChild(allBtn);

        Array.from(availableCategories).sort().forEach(cat => {
            const count = allCerts.filter(c => getCategory(c) === cat).length;
            const btn = document.createElement('button');
            btn.className = 'filter-chip';
            btn.textContent = `${cat} (${count})`;
            btn.onclick = () => filterPreviewTimeline(cat, allCerts, btn);
            previewFilterContainer.appendChild(btn);
        });
    }
    renderPreviewTimeline(allCerts);
}

function filterPreviewTimeline(category, allCerts, activeBtn) {
    document.querySelectorAll('#preview-timeline-filters .filter-chip').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
    const filtered = category === "All" ? allCerts : allCerts.filter(c => getCategory(c) === category);
    renderPreviewTimeline(filtered);
}

function renderPreviewTimeline(certs) {
    const timelineContainer = document.getElementById('preview-timeline-container');
    if(!timelineContainer) return;
    timelineContainer.innerHTML = '';
    
    certs.forEach((cert, index) => {
        const side = index % 2 === 0 ? 'left' : 'right';
        const cleanUrl = cert.imageUrl;
        const watermarkParams = 'co_white,l_text:Arial_60_bold:VERIFIED%20VIA%20CertifySync,a_-30,o_40';
        const watermarkedUrl = cleanUrl.replace('/upload/', `/upload/${watermarkParams}/`);

        let verifyHtml = '';
        if (cert.credentialUrl) verifyHtml = `<a href="${cert.credentialUrl}" target="_blank" class="timeline-verify-btn">🔗 Verify Credential</a>`;

        const item = document.createElement('div');
        item.className = `timeline-item ${side}`;
        item.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <img src="${watermarkedUrl}" alt="Certificate">
                <h3 class="timeline-title-compact">${cert.course || 'Certificate'}</h3>
                <div class="timeline-details">
                    <h4>${cert.provider || 'Provider'}</h4>
                    <span class="timeline-date">${cert.date || 'Completed'}</span>
                    ${verifyHtml}
                </div>
            </div>
        `;
        timelineContainer.appendChild(item);
    });
}

if (previewBtn && dashboardMainView && portfolioPreviewView && backToVaultBtn) {
    previewBtn.addEventListener('click', () => {
        const publicCerts = globalCertsArray.filter(cert => cert.isPublic === true);
        
        if(publicCerts.length === 0) {
            showToast("⚠️ You haven't made any certificates public yet! Click the Eye icon on a certificate.");
            return;
        }

        dashboardMainView.style.display = 'none';
        portfolioPreviewView.style.display = 'block';
        previewBtn.style.display = 'none';

        publicCerts.sort((a, b) => parseDateString(b.date) - parseDateString(a.date));

        buildPreviewChipsAndTimeline(publicCerts);

        let skills = { "Frontend": 0, "Backend/DB": 0, "Cloud & DevOps": 0, "Data & AI": 0, "Security": 0, "General IT": 0 };
        publicCerts.forEach(cert => { skills[getCategory(cert)] += 1; });
        const dataValues = Object.values(skills).map(v => v === 0 ? 0.5 : v + 1); 

        if(radarChartInstance) radarChartInstance.destroy(); 
        const ctx = document.getElementById('previewRadarChart').getContext('2d');
        radarChartInstance = new Chart(ctx, {
            type: 'radar',
            data: { labels: Object.keys(skills), datasets: [{ label: 'Skill Proficiency', data: dataValues, backgroundColor: 'rgba(0, 242, 254, 0.2)', borderColor: '#00f2fe', pointBackgroundColor: '#f1c40f', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#f1c40f', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: 'rgba(255, 255, 255, 0.1)' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, pointLabels: { color: '#e0ffff', font: { size: 14, family: 'Segoe UI' } }, ticks: { display: false, min: 0 } } }, plugins: { legend: { display: false } } }
        });
    });

    backToVaultBtn.addEventListener('click', () => {
        portfolioPreviewView.style.display = 'none';
        dashboardMainView.style.display = 'block';
        previewBtn.style.display = 'block';
    });
}

if (sharePortfolioBtn && shareProfileModal) {
    sharePortfolioBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if(user) {
            const publicLink = window.location.origin + '/portfolio.html?user=' + user.uid;
            profileLinkInput.value = publicLink;
            shareProfileModal.classList.add('active');
        }
    });

    closeProfileBtn.addEventListener('click', () => shareProfileModal.classList.remove('active'));
    copyProfileBtn.addEventListener('click', () => {
        profileLinkInput.select(); document.execCommand('copy');
        showToast('📋 Portfolio Link Copied!');
        copyProfileBtn.textContent = 'Copied!';
        setTimeout(() => copyProfileBtn.textContent = 'Copy Link', 2000);
    });
}

// ==========================================
// 5. UPLOAD LOGIC & PREVIEW IMAGE
// ==========================================
if (uploadBtn && fileInput) uploadBtn.addEventListener('click', () => fileInput.click());

if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const courseInput = document.getElementById('cert-course');
        const providerInput = document.getElementById('cert-provider');
        const dateInput = document.getElementById('cert-date');
        const urlInput = document.getElementById('cert-url-link');
        
        if (courseInput) courseInput.value = "";
        if (providerInput) providerInput.value = "";
        if (dateInput) dateInput.value = "";
        if (urlInput) urlInput.value = "";

        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            showToast('⚠️ Invalid format. Only JPG, PNG, or PDF allowed.');
            fileInput.value = ''; return; 
        }
        
        if (uploadModal) uploadModal.classList.add('active');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const cRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
            const cData = await cRes.json();
            
            if (!cData.secure_url) throw new Error("Cloudinary Error");
            
            let cleanUrl = cData.secure_url;
            if (cleanUrl.toLowerCase().endsWith('.pdf')) cleanUrl = cleanUrl.replace(/\.pdf$/i, '.jpg');
            
            pendingData = { imageUrl: cleanUrl, studentName: '' }; 

            if (uploadPreviewImg) {
                uploadPreviewImg.src = cleanUrl;
                uploadPreviewImg.style.display = 'block';
            }

            await runAIScan(pendingData.imageUrl, 'cert'); 
        } catch (error) {
            showToast('⚠️ Upload Failed.');
            document.getElementById('cert-spinner').style.display = 'none';
            document.getElementById('cert-form-container').style.display = 'block';
        }
        fileInput.value = ''; 
    });
}

if (scanAgainUploadBtn) { scanAgainUploadBtn.addEventListener('click', () => { if (!pendingData) return; runAIScan(pendingData.imageUrl, 'cert'); }); }

// ==========================================
// 6. SAVE & ANTI-FRAUD ENGINE
// ==========================================
if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user || !pendingData) return;
        
        confirmBtn.disabled = true; confirmBtn.textContent = 'Verifying...';
        
        const courseStr = document.getElementById('cert-course').value.trim();
        const providerStr = document.getElementById('cert-provider').value.trim();
        const newDate = document.getElementById('cert-date').value.trim();

        // 🛠️ BUG 2 FIX: Ultra-strict Name Comparison Engine
        if (currentUserLegalName && pendingData.studentName && pendingData.studentName !== 'Unknown') {
            // Function to strip out noise (titles, punctuation, extra spaces)
            const cleanName = (name) => name.toLowerCase().replace(/\b(mr|mrs|ms|dr|prof|sri|smt|kumar|kumari)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

            const legalParts = cleanName(currentUserLegalName).split(' ').filter(w => w.length > 1);
            const certParts = cleanName(pendingData.studentName).split(' ').filter(w => w.length > 1);
            
            let matchCount = 0;
            for (let lp of legalParts) { if (certParts.includes(lp)) matchCount++; }

            let match = false;
            // If legal name is only 1 word, accept 1 match. If it's 2+ words, demand at least a 2-word match (First + Last Name)
            if (legalParts.length === 1 && matchCount >= 1) match = true;
            if (legalParts.length >= 2 && matchCount >= 2) match = true;

            if(!match) {
                showToast(`🛑 AUTH EXCEPTION: Document issued to [${pendingData.studentName.toUpperCase()}]. Vault locked to [${currentUserLegalName.toUpperCase()}].`);
                confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm & Save';
                return; 
            }
        }

        try {
            const allUserCerts = await db.collection('certificates').where('userId', '==', user.uid).get();
            let isDuplicate = false;
            
            // 🛠️ BUG 1 FIX: Alias Dictionary for precise Provider matching
            const cleanString = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizeProvider = (prov) => {
                const p = cleanString(prov);
                const aliases = {
                    'aws': 'amazonwebservices', 'amazon': 'amazonwebservices',
                    'gcp': 'googlecloud', 'googlecloudplatform': 'googlecloud',
                    'ibm': 'ibm', 'tcs': 'tataconsultancyservices',
                    'ms': 'microsoft', 'meta': 'facebook', 'hw': 'huawei',
                    'nptel': 'nationalprogrammeontechnologyenhancedlearning'
                };
                return aliases[p] || p;
            };

            const newCourseClean = cleanString(courseStr);
            const newProvClean = normalizeProvider(providerStr);

            allUserCerts.forEach(doc => {
                const data = doc.data();
                const exCourseClean = cleanString(data.course);
                const exProvClean = normalizeProvider(data.provider || '');
                const exDate = data.date ? data.date.trim() : '';

                // If the exact course matches AND (the providers match or one is missing), block it.
                if (newCourseClean === exCourseClean && (newProvClean === exProvClean || exProvClean === '' || newProvClean === '')) { 
                    isDuplicate = true; 
                }
                else if (newCourseClean.length > 5 && newCourseClean.substring(0, 6) === exCourseClean.substring(0, 6) && newProvClean.substring(0, 4) === exProvClean.substring(0, 4) && newDate === exDate && newDate !== "") { 
                    isDuplicate = true; 
                }
            });

            if (isDuplicate) { showToast('🛑 DATA COLLISION: Exact duplicate record detected in vault. Upload blocked.'); confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm & Save'; return; }
        } catch(e) { console.error("Duplicate check failed:", e); }

        const finalData = {
            course: courseStr, provider: providerStr, date: newDate,
            credentialUrl: document.getElementById('cert-url-link').value, 
            imageUrl: pendingData.imageUrl, userId: user.uid, isPublic: false, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('certificates').add(finalData);
            uploadModal.classList.remove('active'); pendingData = null; showToast('✅ Saved to vault!');
            
            if(uploadPreviewImg) { uploadPreviewImg.src = ""; uploadPreviewImg.style.display = 'none'; }

        } catch (error) { showToast('⚠️ Failed to save.'); } finally { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm & Save'; }
    });
}

if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
        uploadModal.classList.remove('active');
        if (pendingData && pendingData.imageUrl) {
            const publicId = pendingData.imageUrl.split('/').pop().split('.')[0];
            try { 
                await fetch('https://certifysync-backend.onrender.com/api/delete-image', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ public_id: publicId }) 
                }); 
            } catch (error) { console.error("Cleanup failed", error); }
        }
        pendingData = null;
        if(uploadPreviewImg) { uploadPreviewImg.src = ""; uploadPreviewImg.style.display = 'none'; }
    });
}
// ==========================================
// 7. EDIT, DELETE, DOWNLOAD, SHARE, & TOGGLE
// ==========================================
if (grid) {
    grid.addEventListener('click', (e) => {
        
        const viewBtn = e.target.closest('.view-btn');
        if (viewBtn) {
            const url = viewBtn.getAttribute('data-url');
            const lightboxModal = document.getElementById('lightbox-modal');
            const lightboxImg = document.getElementById('lightbox-img');
            if(lightboxModal && lightboxImg) {
                lightboxImg.src = url;
                lightboxModal.classList.add('active');
            }
            return;
        }

        const visBtn = e.target.closest('.visibility-btn');
        if (visBtn) {
            const docId = visBtn.getAttribute('data-id');
            const currentlyPublic = visBtn.getAttribute('data-public') === 'true';
            db.collection('certificates').doc(docId).update({ isPublic: !currentlyPublic }).then(() => {
                showToast(currentlyPublic ? '🔒 Removed from Portfolio' : '👁️ Added to Public Portfolio!');
            }).catch(err => console.error(err));
            return;
        }

        const delBtn = e.target.closest('.delete-btn'); 
        if (delBtn) { itemToDelete = { docId: delBtn.getAttribute('data-id'), imageUrl: delBtn.getAttribute('data-url') }; if (deleteModal) deleteModal.classList.add('active'); return; }
        
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            itemToEdit = { id: editBtn.getAttribute('data-id'), imageUrl: editBtn.getAttribute('data-url') };
            document.getElementById('edit-course').value = editBtn.getAttribute('data-course') || '';
            document.getElementById('edit-provider').value = editBtn.getAttribute('data-provider') || '';
            document.getElementById('edit-date').value = editBtn.getAttribute('data-date') || '';
            document.getElementById('edit-url-link').value = editBtn.getAttribute('data-credential') || '';
            if (editModal) editModal.classList.add('active'); return;
        }

        const dlBtn = e.target.closest('.download-btn');
        if (dlBtn) {
            const url = dlBtn.getAttribute('data-url');
            const courseName = dlBtn.getAttribute('data-course') || 'Certificate';
            let words = courseName.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
            let shortName = words.slice(0, 3).join("_"); 
            if (!shortName) shortName = "Cert";
            const dynamicFileName = `${shortName}.jpg`;
            showToast('⏳ Starting download...');
            fetch(url).then(response => response.blob()).then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = blobUrl; a.download = dynamicFileName; 
                document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(blobUrl); showToast('✅ Download complete!');
            }).catch(() => { showToast('⚠️ Download blocked. Opening in new tab.'); window.open(url, '_blank'); }); return;
        }

        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const url = shareBtn.getAttribute('data-url');
            const course = shareBtn.getAttribute('data-course');
            const provider = shareBtn.getAttribute('data-provider');
            const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
            showToast('⏳ Encrypting link...');
            db.collection('shared_links').doc(token).set({
                imageUrl: url, course: course || 'Verified Certificate', provider: provider || 'CertifySync Vault', createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                const shareLink = window.location.origin + '/view.html?token=' + token;
                shareLinkInput.value = shareLink;
                if (shareModal) shareModal.classList.add('active');
            }).catch(err => { console.error(err); showToast('⚠️ Failed to generate link'); });
            return;
        }
    });
}

const closeLightboxBtn = document.getElementById('close-lightbox-btn');
const lightboxModal = document.getElementById('lightbox-modal');
if (closeLightboxBtn && lightboxModal) {
    closeLightboxBtn.addEventListener('click', () => {
        lightboxModal.classList.remove('active');
        setTimeout(() => {
            const img = document.getElementById('lightbox-img');
            if(img) img.src = "";
        }, 300); 
    });
}

if (closeShareBtn && shareModal) closeShareBtn.addEventListener('click', () => shareModal.classList.remove('active'));
if (copyShareBtn) { copyShareBtn.addEventListener('click', () => { shareLinkInput.select(); document.execCommand('copy'); showToast('📋 Link copied to clipboard!'); copyShareBtn.textContent = 'Copied!'; setTimeout(() => copyShareBtn.textContent = 'Copy Link', 2000); }); }
if (cancelDeleteBtn && deleteModal) cancelDeleteBtn.addEventListener('click', () => { deleteModal.classList.remove('active'); itemToDelete = null; });
if (cancelEditBtn && editModal) cancelEditBtn.addEventListener('click', () => { editModal.classList.remove('active'); itemToEdit = null; });
if (scanAgainEditBtn) { scanAgainEditBtn.addEventListener('click', () => { if (!itemToEdit || !itemToEdit.imageUrl) return; runAIScan(itemToEdit.imageUrl, 'edit'); }); }

if (saveEditBtn && editModal) {
    saveEditBtn.addEventListener('click', async () => {
        if (!itemToEdit) {
            return showToast('⚠️ Error: Memory lost. Please close and try again.');
        }

        const updatedCourse = document.getElementById('edit-course').value.trim();
        const updatedProvider = document.getElementById('edit-provider').value.trim();
        const updatedDate = document.getElementById('edit-date').value.trim();
        const updatedUrl = document.getElementById('edit-url-link') ? document.getElementById('edit-url-link').value.trim() : "";

        try {
            showToast('💾 Saving updates...');
            saveEditBtn.disabled = true;
            saveEditBtn.textContent = "Saving...";
            
            await db.collection('certificates').doc(itemToEdit.id).update({
                course: updatedCourse,
                provider: updatedProvider,
                date: updatedDate,
                credentialUrl: updatedUrl
            });
            
            editModal.classList.remove('active'); 
            itemToEdit = null; 
            showToast('✅ Certificate updated successfully!');
            
        } catch (error) { 
            console.error("🚨 FIREBASE UPDATE ERROR:", error);
            showToast('⚠️ Error saving to database.'); 
        } finally {
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = "Save Changes";
        }
    });
}

if (confirmDeleteBtn && deleteModal) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!itemToDelete) return; 

        const { docId, imageUrl } = itemToDelete; 
        itemToDelete = null; 

        deleteModal.classList.remove('active'); 
        
        const publicId = imageUrl.split('/').pop().split('.')[0];
        
        try {
            showToast('🔥 Burning physical file...');
            
            const response = await fetch('https://certifysync-backend.onrender.com/api/delete-image', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ public_id: publicId }) 
            });
            
            if (!response.ok) throw new Error('Backend deletion failed');
            
            await db.collection('certificates').doc(docId).delete(); 
            showToast('✅ Certificate permanently deleted!');
            
        } catch (error) { 
            console.error(error);
            showToast('⚠️ Error deleting file.'); 
        }
    });
}

function filterCards() {
    const term = searchBar ? searchBar.value.toLowerCase() : '';
    const selectedProvider = filterProvider ? filterProvider.value : 'all';
    const selectedYear = filterYear ? filterYear.value : 'all';
    const cards = document.querySelectorAll('.cert-card');
    cards.forEach(card => {
        const text = card.querySelector('.cert-card-info').textContent.toLowerCase();
        const cardProvider = card.getAttribute('data-provider');
        const cardYear = card.getAttribute('data-year');
        const matchesText = text.includes(term);
        const matchesProvider = (selectedProvider === 'all' || cardProvider === selectedProvider);
        const matchesYear = (selectedYear === 'all' || cardYear === selectedYear);
        if (matchesText && matchesProvider && matchesYear) card.style.display = 'flex';
        else card.style.display = 'none';
    });
}
if (searchBar) searchBar.addEventListener('input', filterCards);
if (filterProvider) filterProvider.addEventListener('change', filterCards);
if (filterYear) filterYear.addEventListener('change', filterCards);

document.addEventListener('contextmenu', (e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') { e.preventDefault(); showToast("⚠️ Action disabled for security."); } });