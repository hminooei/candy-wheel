// Initial Candies Database
const INITIAL_CANDIES = [
    { id: 'haribo-wild-berry', name: 'Haribo Wild Berry', color: '#ec4899', status: 'remaining' }, // Premium Pink
    { id: 'skittles', name: 'Skittles', color: '#ef4444', status: 'remaining' },           // Candy Red
    { id: 'haribo-goldbears', name: 'Haribo Goldbears', color: '#eab308', status: 'remaining' },      // Gold Yellow
    { id: 'lollipop', name: 'Lollipop', color: '#14b8a6', status: 'remaining' },          // Teal/Cyan
    { id: 'airhead', name: 'Airhead', color: '#3b82f6', status: 'remaining' }             // Royal Blue
];

// App State
let state = {
    candies: JSON.parse(JSON.stringify(INITIAL_CANDIES)),
    dailyCandy: null, // Stores the candy object chosen for today, if not yet acknowledged
    lastSpinDate: null // To potentially restrict spins to once per calendar day
};

// Animation & Interaction Variables
let currentAngle = 0;
let isSpinning = false;
let audioCtx = null;
let currentTab = 'remaining'; // 'remaining' or 'eaten'

// DOM Elements
const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spin-btn');
const dailyCandyCard = document.getElementById('daily-candy-card');
const selectedCandyName = document.getElementById('selected-candy-name');
const ackBtn = document.getElementById('ack-btn');
const spinPromptCard = document.getElementById('spin-prompt-card');
const allGoneCard = document.getElementById('all-gone-card');
const refillBtn = document.getElementById('refill-btn');
const listRemaining = document.getElementById('list-remaining');
const listEaten = document.getElementById('list-eaten');
const countRemaining = document.getElementById('count-remaining');
const countEaten = document.getElementById('count-eaten');
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext('2d');
const pointerEl = document.querySelector('.wheel-pointer');

// Load State from LocalStorage
function loadState() {
    const saved = localStorage.getItem('candy_wheel_state');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse saved state, resetting to default.', e);
            resetState();
        }
    }
}

// Save State to LocalStorage
function saveState() {
    localStorage.setItem('candy_wheel_state', JSON.stringify(state));
}

// Reset/Refill candies
function resetState() {
    state.candies = JSON.parse(JSON.stringify(INITIAL_CANDIES));
    state.dailyCandy = null;
    saveState();
    updateUI();
}

// Switch between remaining and eaten tabs
window.switchTab = function(tab) {
    currentTab = tab;
    document.getElementById('tab-remaining').classList.toggle('active', tab === 'remaining');
    document.getElementById('tab-eaten').classList.toggle('active', tab === 'eaten');
    listRemaining.classList.toggle('hidden', tab !== 'remaining');
    listEaten.classList.toggle('hidden', tab !== 'eaten');
};

// Initialize audio context
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Play synthetic tick sound
function playTick() {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.05);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        console.error('Audio playback error', e);
    }
}

// Play synthetic success chime
function playChime() {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const playNote = (freq, delay, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            
            gain.gain.setValueAtTime(0.08, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.00001, now + delay + duration);
            
            osc.start(now + delay);
            osc.stop(now + delay + duration);
        };
        
        playNote(523.25, 0, 0.25);    // C5
        playNote(659.25, 0.08, 0.25); // E5
        playNote(783.99, 0.16, 0.35); // G5
        playNote(1046.50, 0.26, 0.5); // C6
    } catch (e) {
        console.error('Audio playback error', e);
    }
}

// Get the remaining candies list
function getRemainingCandies() {
    return state.candies.filter(c => c.status === 'remaining');
}

// Drawing logic for the Wheel
function drawWheel() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 15;
    
    ctx.clearRect(0, 0, width, height);
    
    const remaining = getRemainingCandies();
    
    // Draw outer glow border
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b'; // Deep indigo ring
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(139, 92, 246, 0.3)';
    ctx.fill();
    ctx.restore();

    if (remaining.length === 0) {
        // Draw empty state wheel placeholder
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1e1a38';
        ctx.fill();
        ctx.restore();
        return;
    }
    
    const sectorSize = (2 * Math.PI) / remaining.length;
    
    remaining.forEach((candy, index) => {
        const startAngle = currentAngle + index * sectorSize;
        const endAngle = startAngle + sectorSize;
        
        // Draw sector slice
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = candy.color;
        ctx.fill();
        
        // Add elegant inner shading to each slice
        const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Sector stroke lines
        ctx.strokeStyle = '#0b0914';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        
        // Draw segment text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sectorSize / 2);
        
        // Configure typography
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px "Poppins", sans-serif';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        
        // Truncate name if it's too long
        let text = candy.name;
        if (text.length > 15) {
            text = text.substring(0, 13) + '...';
        }
        ctx.fillText(text, radius - 25, 0);
        ctx.restore();
    });

    // Draw central node/pin bezel
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 44, 0, 2 * Math.PI);
    ctx.fillStyle = '#0b0914';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2d2755';
    ctx.stroke();
    ctx.restore();
}

// Confetti Particle Class
class ConfettiParticle {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.x = Math.random() * w;
        this.y = Math.random() * -h - 20;
        this.size = Math.random() * 8 + 6;
        // Beautiful bright candy colors
        this.color = ['#d946ef', '#ef4444', '#eab308', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 7)];
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 5 + 4;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 4 - 2;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
    }
    draw(c) {
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.rotation * Math.PI / 180);
        c.fillStyle = this.color;
        c.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        c.restore();
    }
}

// Confetti Engine
let confettiParticles = [];
let confettiInterval = null;

function startConfetti() {
    confettiParticles = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    confettiCanvas.width = w;
    confettiCanvas.height = h;
    
    // Generate initial batch of particles
    for (let i = 0; i < 150; i++) {
        confettiParticles.push(new ConfettiParticle(w, h));
    }
    
    if (confettiInterval) clearInterval(confettiInterval);
    
    function animateConfetti() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        
        let alive = false;
        confettiParticles.forEach(p => {
            p.update();
            if (p.y < confettiCanvas.height) {
                p.draw(confettiCtx);
                alive = true;
            }
        });
        
        if (alive) {
            requestAnimationFrame(animateConfetti);
        } else {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }
    
    animateConfetti();
}

// Spinning physics setup
function spinWheel() {
    if (isSpinning) return;
    
    const remaining = getRemainingCandies();
    if (remaining.length === 0) return;
    
    initAudio();
    isSpinning = true;
    spinBtn.disabled = true;
    
    const durationSelect = document.getElementById('spin-duration-select');
    if (durationSelect) durationSelect.disabled = true;
    
    // Hide panels
    dailyCandyCard.classList.add('hidden');
    spinPromptCard.classList.remove('hidden');
    
    const selectedDuration = parseInt(durationSelect?.value || '4500', 10);
    // Randomize duration slightly to ensure random stopping position
    const spinDuration = selectedDuration + Math.random() * 2000;
    
    console.log(`Spin initiated: selected duration = ${selectedDuration}ms, total animated duration = ${spinDuration.toFixed(0)}ms`);
    
    const startTimestamp = performance.now();
    const sectorSize = (2 * Math.PI) / remaining.length;
    
    const initialAngle = currentAngle;
    
    // Phase parameters
    const decelDuration = Math.min(4500, spinDuration);
    const constDuration = spinDuration - decelDuration;
    
    // Constant speed of ~1.75 rotations per second
    const speed = 0.0035 * Math.PI; 
    
    // Deceleration distance based on continuous derivatives
    const decelDistance = (speed * decelDuration) / 3;
    
    let lastTickIndex = -1;
    
    function animateSpin(timestamp) {
        const elapsed = timestamp - startTimestamp;
        
        if (elapsed < constDuration) {
            // Stage 1: Constant velocity cruise
            currentAngle = initialAngle + speed * elapsed;
        } else if (elapsed < spinDuration) {
            // Stage 2: Smooth derivative-matched ease-out
            const progressDecel = (elapsed - constDuration) / decelDuration;
            const easeOut = 1 - Math.pow(1 - progressDecel, 3);
            currentAngle = (initialAngle + speed * constDuration) + decelDistance * easeOut;
        } else {
            // Finished
            currentAngle = (initialAngle + speed * constDuration) + decelDistance;
        }
        
        // Trigger pointer tic audio
        const relativeAngle = (1.5 * Math.PI - currentAngle) % (2 * Math.PI);
        const normalizedAngle = relativeAngle < 0 ? relativeAngle + 2 * Math.PI : relativeAngle;
        const currentTickIndex = Math.floor(normalizedAngle / sectorSize);
        
        if (currentTickIndex !== lastTickIndex) {
            playTick();
            lastTickIndex = currentTickIndex;
            
            // Add subtle physical visual twitch to pointer
            pointerEl.style.transform = 'rotate(-15deg)';
            setTimeout(() => {
                pointerEl.style.transform = 'rotate(0deg)';
            }, 50);
        }
        
        drawWheel();
        
        if (elapsed < spinDuration) {
            requestAnimationFrame(animateSpin);
        } else {
            // Spin Finished
            isSpinning = false;
            spinBtn.disabled = false;
            if (durationSelect) durationSelect.disabled = false;
            
            // Compute resulting segment index
            const resultingIndex = currentTickIndex;
            const chosenCandy = remaining[resultingIndex];
            
            state.dailyCandy = chosenCandy;
            saveState();
            
            // Play celebration sounds & confetti
            playChime();
            startConfetti();
            
            // Show alert
            showDailyCandy(chosenCandy);
        }
    }
    
    requestAnimationFrame(animateSpin);
}

// Display daily candy panel
function showDailyCandy(candy) {
    spinPromptCard.classList.add('hidden');
    dailyCandyCard.classList.remove('hidden');
    selectedCandyName.textContent = candy.name;
    // Set matching neon shadow for the card
    dailyCandyCard.style.boxShadow = `0 0 35px rgba(${hexToRgb(candy.color)}, 0.25)`;
}

// Convert Hex to RGB helper for custom neon box-shadows
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '139, 92, 246';
}

// Render Lists in the Inventory Tab
function renderCandyLists() {
    listRemaining.innerHTML = '';
    listEaten.innerHTML = '';
    
    const remaining = state.candies.filter(c => c.status === 'remaining');
    const eaten = state.candies.filter(c => c.status === 'eaten');
    
    countRemaining.textContent = remaining.length;
    countEaten.textContent = eaten.length;
    
    // Populate On Wheel list
    if (remaining.length === 0) {
        listRemaining.innerHTML = '<div class="info-card" style="padding: 1.5rem;"><p>No candies remaining on the wheel.</p></div>';
    } else {
        remaining.forEach(candy => {
            const item = document.createElement('div');
            item.className = 'candy-item';
            item.innerHTML = `
                <div class="candy-item-left">
                    <span class="candy-color-dot" style="color: ${candy.color}; background-color: ${candy.color}"></span>
                    <span class="candy-name">${candy.name}</span>
                </div>
                <div class="candy-item-right">
                    <button class="btn-action btn-eat" onclick="markCandyAsEaten('${candy.id}')" title="Eat this candy">
                        😋 Eat
                    </button>
                    <button class="btn-action btn-delete" onclick="removeCandy('${candy.id}')" title="Delete candy">
                        🗑️
                    </button>
                </div>
            `;
            listRemaining.appendChild(item);
        });
    }
    
    // Populate Eaten list
    if (eaten.length === 0) {
        listEaten.innerHTML = '<div class="info-card" style="padding: 1.5rem;"><p>You haven\'t eaten any candies yet!</p></div>';
    } else {
        eaten.forEach(candy => {
            const item = document.createElement('div');
            item.className = 'candy-item';
            item.innerHTML = `
                <div class="candy-item-left">
                    <span class="candy-color-dot" style="color: ${candy.color}; background-color: ${candy.color}; opacity: 0.5;"></span>
                    <span class="candy-name" style="text-decoration: line-through; opacity: 0.6;">${candy.name}</span>
                </div>
                <div class="candy-item-right">
                    <button class="btn-action btn-undo" onclick="undoEatenCandy('${candy.id}')" title="Put back on wheel">
                        ↩️ Put back
                    </button>
                    <button class="btn-action btn-delete" onclick="removeCandy('${candy.id}')" title="Delete candy">
                        🗑️
                    </button>
                </div>
            `;
            listEaten.appendChild(item);
        });
    }
}

// Undo an eaten candy
window.undoEatenCandy = function(candyId) {
    const match = state.candies.find(c => c.id === candyId);
    if (match) {
        match.status = 'remaining';
        saveState();
        updateUI();
    }
};

// Manually mark a candy as eaten
window.markCandyAsEaten = function(candyId) {
    const match = state.candies.find(c => c.id === candyId);
    if (match) {
        match.status = 'eaten';
        if (state.dailyCandy && state.dailyCandy.id === candyId) {
            state.dailyCandy = null;
        }
        saveState();
        updateUI();
    }
};

// Completely remove a candy from stock
window.removeCandy = function(candyId) {
    state.candies = state.candies.filter(c => c.id !== candyId);
    if (state.dailyCandy && state.dailyCandy.id === candyId) {
        state.dailyCandy = null;
    }
    saveState();
    updateUI();
};

// Color palette for newly added candies
const CANDY_COLORS = [
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7'  // Purple
];

// Setup the add candy form submissions
function setupAddCandyForm() {
    const form = document.getElementById('add-candy-form');
    const input = document.getElementById('new-candy-name');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = input.value.trim();
            if (!name) return;
            
            const nextColorIndex = state.candies.length % CANDY_COLORS.length;
            const newCandy = {
                id: 'candy-' + Date.now(),
                name: name,
                color: CANDY_COLORS[nextColorIndex],
                status: 'remaining'
            };
            
            state.candies.push(newCandy);
            input.value = '';
            saveState();
            updateUI();
        });
    }
}

// Update UI Layout states
function updateUI() {
    const remaining = getRemainingCandies();
    
    renderCandyLists();
    drawWheel();
    
    if (state.dailyCandy) {
        // If there's an un-acknowledged daily selection, keep showing it
        showDailyCandy(state.dailyCandy);
        allGoneCard.classList.add('hidden');
    } else if (remaining.length === 0) {
        // All candies have been eaten!
        dailyCandyCard.classList.add('hidden');
        spinPromptCard.classList.add('hidden');
        allGoneCard.classList.remove('hidden');
        spinBtn.disabled = true;
    } else {
        // Ready to spin
        dailyCandyCard.classList.add('hidden');
        allGoneCard.classList.add('hidden');
        spinPromptCard.classList.remove('hidden');
        spinBtn.disabled = false;
    }
}

// Acknowledge eating today's candy
function ackDailyCandy() {
    if (!state.dailyCandy) return;
    
    // Mark as eaten
    const candyId = state.dailyCandy.id;
    const match = state.candies.find(c => c.id === candyId);
    if (match) {
        match.status = 'eaten';
    }
    
    state.dailyCandy = null;
    saveState();
    
    // Soft sound effect
    initAudio();
    if (audioCtx) {
        const now = audioCtx.currentTime;
        const playSoftChime = (freq, delay) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            gain.gain.setValueAtTime(0.04, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.00001, now + delay + 0.15);
            osc.start(now + delay);
            osc.stop(now + delay + 0.15);
        };
        playSoftChime(587.33, 0);   // D5
        playSoftChime(880.00, 0.08); // A5
    }
    
    updateUI();
}

// Setup canvas high-DPI scaling
function setupCanvasScale() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    drawWheel();
}

// Event Listeners
spinBtn.addEventListener('click', spinWheel);
ackBtn.addEventListener('click', ackDailyCandy);
refillBtn.addEventListener('click', resetState);

// Resize canvas when window size changes
window.addEventListener('resize', setupCanvasScale);

// Page Load Initialization
window.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupCanvasScale();
    setupAddCandyForm();
    updateUI();
});
