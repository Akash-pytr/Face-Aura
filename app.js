/* ============================================
   FACEAURA - Core Application Logic
   ============================================ */

let stream = null;
const video = document.getElementById('webcam');
const captureCanvas = document.getElementById('capture-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const cameraFrame = document.getElementById('camera-frame');
const cameraOverlay = document.getElementById('camera-overlay');
const scanLine = document.getElementById('scan-line');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// ── Database / LocalStorage ──────────────────────────────────
const DB_USER_KEY = 'faceaura_user';
const DB_RECORDS_KEY = 'faceaura_records';

function getUser() {
  const user = localStorage.getItem(DB_USER_KEY);
  return user ? JSON.parse(user) : null;
}

function saveUser(name) {
  const user = { name, joinedAt: new Date().toISOString() };
  localStorage.setItem(DB_USER_KEY, JSON.stringify(user));
  return user;
}

function getRecords() {
  const records = localStorage.getItem(DB_RECORDS_KEY);
  return records ? JSON.parse(records) : [];
}

function saveRecord(result) {
  const records = getRecords();
  const today = new Date().toISOString().split('T')[0];
  
  const newRecord = {
    date: today,
    timestamp: Date.now(),
    brightnessScore: result.brightnessScore,
    emotion: result.emotion,
    skinConditions: result.skinConditions,
    recommendations: result.recos.map(cat => ({
      category: cat.title,
      items: cat.items.map(item => ({ text: item, done: false }))
    }))
  };

  const existingIndex = records.findIndex(r => r.date === today);
  if (existingIndex !== -1) {
    // Keep existing checklist state if re-analyzing today
    const oldRecos = records[existingIndex].recommendations;
    newRecord.recommendations.forEach(newCat => {
      const oldCat = oldRecos.find(c => c.category === newCat.category);
      if (oldCat) {
        newCat.items.forEach(newItem => {
          const oldItem = oldCat.items.find(i => i.text === newItem.text);
          if (oldItem) newItem.done = oldItem.done;
        });
      }
    });
    records[existingIndex] = newRecord; // Update today's record
  } else {
    records.push(newRecord); // Add new record
  }

  localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(records));
  updateHeader();
  showToast('Today\'s check-in saved! ✅');
  document.getElementById('checkin-badge').style.display = 'block';
  return newRecord;
}

function updateChecklistItem(date, categoryTitle, itemText, isDone) {
  const records = getRecords();
  const record = records.find(r => r.date === date);
  if (record) {
    const cat = record.recommendations.find(c => c.category === categoryTitle);
    if (cat) {
      const item = cat.items.find(i => i.text === itemText);
      if (item) item.done = isDone;
    }
    localStorage.setItem(DB_RECORDS_KEY, JSON.stringify(records));
    renderChecklistProgress(record.recommendations);
    if(document.getElementById('page-dashboard').style.display !== 'none') {
      renderDashboardChecklist();
    }
  }
}

// ── Initialization & Profile ─────────────────────────────────
function init() {
  const user = getUser();
  if (!user) {
    document.getElementById('profile-modal').style.display = 'flex';
  } else {
    updateHeader();
  }
  initParticles();
}

function saveProfile() {
  const input = document.getElementById('profile-name-input').value.trim();
  if (input.length < 2) {
    alert('Please enter a valid name (at least 2 characters)');
    return;
  }
  saveUser(input);
  document.getElementById('profile-modal').style.display = 'none';
  updateHeader();
  showToast(`Welcome, ${input}! 👋`);
}

function updateHeader() {
  const user = getUser();
  if (!user) return;
  document.getElementById('user-name-display').textContent = user.name;
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
  
  const records = getRecords();
  const streak = calculateStreak(records);
  document.getElementById('user-streak-display').textContent = `🔥 ${streak} day streak`;
  document.getElementById('stat-streak').textContent = streak;
}

function calculateStreak(records) {
  if (!records || records.length === 0) return 0;
  
  const sortedDates = [...new Set(records.map(r => r.date))].sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStreak = 0;
  let d = new Date(today);
  
  // Check if today is in records
  const todayStr = d.toISOString().split('T')[0];
  if (sortedDates.includes(todayStr)) {
    currentStreak++;
    d.setDate(d.getDate() - 1);
  } else {
    // If not today, maybe yesterday?
    d.setDate(d.getDate() - 1);
    const yestStr = d.toISOString().split('T')[0];
    if(sortedDates.includes(yestStr)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      return 0; // Missed yesterday and today
    }
  }

  // Count backwards
  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    if (sortedDates.includes(dateStr)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  
  return currentStreak;
}

// ── Tab Switching ────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.getElementById(`tab-btn-${tabId}`).classList.add('active');
  document.getElementById(`tab-btn-${tabId}`).setAttribute('aria-selected', 'true');
  
  if (tabId === 'analyze') {
    document.getElementById('page-analyze').style.display = 'flex';
    document.getElementById('page-dashboard').style.display = 'none';
  } else {
    document.getElementById('page-analyze').style.display = 'none';
    document.getElementById('page-dashboard').style.display = 'flex';
    if(stream) stopCamera();
    renderDashboard();
  }
}

// ── Particles Background ──────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,160,255,${p.alpha})`;
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── UI Utils ─────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Camera Controls ──────────────────────────────────────────
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    cameraFrame.classList.add('active');
    cameraOverlay.classList.add('hidden');
    scanLine.classList.add('active');
    setStatus('active', 'Camera active – ready to analyze');
    document.getElementById('start-camera-btn').disabled = true;
    document.getElementById('capture-btn').disabled = false;
    document.getElementById('stop-btn').disabled = false;
  } catch (e) {
    setStatus('error', 'Camera access denied');
    alert('Please allow camera access to use FaceAura.');
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  video.srcObject = null;
  cameraFrame.classList.remove('active');
  cameraOverlay.classList.remove('hidden');
  scanLine.classList.remove('active');
  setStatus('', 'Camera stopped');
  document.getElementById('start-camera-btn').disabled = false;
  document.getElementById('capture-btn').disabled = true;
  document.getElementById('stop-btn').disabled = true;
}

function setStatus(type, msg) {
  statusDot.className = 'status-dot' + (type ? ' ' + type : '');
  statusText.textContent = msg;
}

// ── Capture & Analyze ────────────────────────────────────────
async function captureAndAnalyze() {
  if (!stream) { alert('Please start camera first.'); return; }
  captureCanvas.width = video.videoWidth || 480;
  captureCanvas.height = video.videoHeight || 360;
  const ctx = captureCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  showAnalyzing();
  setStatus('analyzing', 'Analyzing...');

  await simulateSteps();
  const imageData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);
  const analysisRaw = analyzeImage(imageData, captureCanvas.width, captureCanvas.height);
  
  const result = {
    ...analysisRaw,
    recos: buildRecommendations(analysisRaw.emotion.dominant, analysisRaw.brightnessScore, analysisRaw.skinConditions)
  };
  
  const savedRecord = saveRecord(result);

  hideAnalyzing();
  setStatus('active', 'Analysis complete!');
  renderResults(savedRecord);
}

// ── Analysis Engine ──────────────────────────────────────────
function analyzeImage(imageData, w, h) {
  const data = imageData.data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  let redSpots = 0, darkSpots = 0, brightPixels = 0;

  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const rx = Math.floor(w * 0.3), ry = Math.floor(h * 0.38);

  for (let y = cy - ry; y < cy + ry; y += 3) {
    for (let x = cx - rx; x < cx + rx; x += 3) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2];
      rSum += r; gSum += g; bSum += b; count++;
      const brightness = (r + g + b) / 3;
      if (brightness > 180) brightPixels++;
      if (r > 160 && r > g * 1.4 && r > b * 1.3) redSpots++;
      if (brightness < 80) darkSpots++;
    }
  }

  const avgR = rSum / count, avgG = gSum / count, avgB = bSum / count;
  const avgBrightness = (avgR + avgG + avgB) / 3;
  const brightnessScore = Math.round(Math.min(100, (avgBrightness / 220) * 100));
  const redRatio = redSpots / count;
  const darkRatio = darkSpots / count;
  const brightRatio = brightPixels / count;

  const emotion = inferEmotion(avgR, avgG, avgB, brightRatio);
  const skinConditions = inferSkin(brightnessScore, redRatio, darkRatio, avgR, avgG, avgB);

  return { emotion, brightnessScore, skinConditions };
}

function inferEmotion(r, g, b, brightRatio) {
  const warmth = r - b;
  const saturation = Math.max(r,g,b) - Math.min(r,g,b);

  let scores = {
    happy:     clamp(brightRatio * 90 + warmth * 0.12 + Math.random() * 15, 5, 95),
    neutral:   clamp(50 + (Math.random() - 0.5) * 30, 10, 80),
    sad:       clamp((1 - brightRatio) * 60 + (b - r) * 0.1 + Math.random() * 12, 3, 85),
    angry:     clamp(r * 0.05 + Math.random() * 10, 2, 40),
    surprised: clamp(saturation * 0.1 + Math.random() * 12, 2, 35),
    fearful:   clamp((1 - brightRatio) * 30 + Math.random() * 12, 2, 40),
    disgusted: clamp(Math.random() * 15, 1, 25),
    depressed: clamp((1 - brightRatio) * 50 + Math.random() * 15, 3, 70)
  };

  const total = Object.values(scores).reduce((a,b) => a+b, 0);
  Object.keys(scores).forEach(k => scores[k] = Math.round(scores[k] / total * 100));

  const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
  const dominant = sorted[0][0];
  return { dominant, scores: Object.fromEntries(sorted) };
}

function inferSkin(brightness, redRatio, darkRatio, r, g, b) {
  const conditions = [];
  const oiliness = Math.max(0, r - 80) / 180;
  const evenness = 1 - (Math.abs(r-g) + Math.abs(g-b)) / 255;

  if (brightness >= 65) {
    conditions.push({ name: 'Skin Glow', icon: '✨', level: 'good', detail: 'Your skin appears bright and healthy.' });
  } else if (brightness >= 40) {
    conditions.push({ name: 'Dull Skin', icon: '🌫️', level: 'warning', detail: 'Skin looks slightly dull. Hydration can help.' });
  } else {
    conditions.push({ name: 'Very Dull Skin', icon: '😶', level: 'alert', detail: 'Skin appears quite dull. Consider exfoliation.' });
  }

  if (redRatio > 0.06) {
    conditions.push({ name: 'Pimples/Redness', icon: '🔴', level: 'alert', detail: 'Significant redness detected.' });
  } else if (redRatio > 0.025) {
    conditions.push({ name: 'Mild Redness', icon: '🟠', level: 'warning', detail: 'Some redness visible.' });
  } else {
    conditions.push({ name: 'Clear Skin', icon: '💚', level: 'good', detail: 'No significant redness detected.' });
  }

  if (darkRatio > 0.08) {
    conditions.push({ name: 'Heavy Tanning', icon: '☀️', level: 'alert', detail: 'Noticeable dark patches or tanning.' });
  } else if (darkRatio > 0.03) {
    conditions.push({ name: 'Mild Tanning', icon: '🌤️', level: 'warning', detail: 'Slight tan detected.' });
  } else {
    conditions.push({ name: 'Even Tone', icon: '🌟', level: 'good', detail: 'Skin tone appears even.' });
  }

  if (oiliness > 0.55) {
    conditions.push({ name: 'Oily / Shiny', icon: '💧', level: 'warning', detail: 'Skin may be oily.' });
  } else if (evenness < 0.6) {
    conditions.push({ name: 'Uneven Texture', icon: '🔵', level: 'warning', detail: 'Uneven skin texture noticed.' });
  } else {
    conditions.push({ name: 'Good Hydration', icon: '💦', level: 'good', detail: 'Skin appears well-hydrated.' });
  }

  return conditions;
}

function clamp(v, mn, mx) { return Math.min(mx, Math.max(mn, v)); }

// ── Render Analysis Results ──────────────────────────────────
const EMOTION_META = {
  happy:     { emoji: '😊', label: 'Happy', color: '#facc15' },
  neutral:   { emoji: '😐', label: 'Neutral', color: '#94a3b8' },
  sad:       { emoji: '😢', label: 'Sad', color: '#60a5fa' },
  angry:     { emoji: '😠', label: 'Angry', color: '#f87171' },
  surprised: { emoji: '😲', label: 'Surprised', color: '#c084fc' },
  fearful:   { emoji: '😨', label: 'Fearful', color: '#818cf8' },
  disgusted: { emoji: '🤢', label: 'Disgusted', color: '#4ade80' },
  depressed: { emoji: '😞', label: 'Depressed', color: '#64748b' }
};

function renderResults(record) {
  const { emotion, brightnessScore, skinConditions, recommendations, date } = record;
  const dom = EMOTION_META[emotion.dominant] || EMOTION_META.neutral;

  // Emotion card
  document.getElementById('emotion-emoji').textContent = dom.emoji;
  document.getElementById('emotion-name').textContent = dom.label;
  const topScore = emotion.scores[emotion.dominant] || 0;
  document.getElementById('emotion-confidence').textContent = `${topScore}% confidence`;

  const barsEl = document.getElementById('emotion-bars');
  barsEl.innerHTML = '';
  Object.entries(emotion.scores).forEach(([key, pct]) => {
    const m = EMOTION_META[key] || { emoji: '❓', label: key, color: '#888' };
    barsEl.innerHTML += `
      <div class="emotion-bar-row">
        <span class="emotion-bar-emoji">${m.emoji}</span>
        <span class="emotion-bar-label">${m.label}</span>
        <div class="emotion-bar-track">
          <div class="emotion-bar-fill" style="width:${pct}%;background:${m.color};"></div>
        </div>
        <span class="emotion-bar-pct">${pct}%</span>
      </div>`;
  });

  // Brightness
  const meterFill = document.getElementById('brightness-fill');
  meterFill.style.width = `${100 - brightnessScore}%`;
  document.getElementById('bright-score').textContent = brightnessScore;
  let bLabel, bDesc;
  if (brightnessScore >= 70) { bLabel = 'Bright & Glowing'; bDesc = 'Your skin radiates a healthy, natural glow!'; }
  else if (brightnessScore >= 45) { bLabel = 'Moderately Bright'; bDesc = 'Your skin has decent brightness but could use more glow.'; }
  else { bLabel = 'Dull & Tired'; bDesc = 'Your skin looks dull. Hydration and rest can help.'; }
  document.getElementById('bright-label').textContent = bLabel;
  document.getElementById('bright-desc').textContent = bDesc;

  // Skin conditions
  const grid = document.getElementById('conditions-grid');
  grid.innerHTML = '';
  skinConditions.forEach(c => {
    grid.innerHTML += `
      <div class="condition-item">
        <div class="condition-top">
          <span class="condition-icon">${c.icon}</span>
          <span class="condition-badge badge-${c.level}">${c.level === 'good' ? 'Good' : c.level === 'warning' ? 'Warning' : 'Alert'}</span>
        </div>
        <div class="condition-name">${c.name}</div>
        <div class="condition-detail">${c.detail}</div>
      </div>`;
  });

  // Recommendations (Interactive Checklist)
  const recoEl = document.getElementById('recommendations');
  recoEl.innerHTML = '';
  
  recommendations.forEach(cat => {
    const iconMeta = getCategoryIcon(cat.category);
    
    let itemsHtml = '';
    cat.items.forEach((item, idx) => {
      const id = `chk-${date}-${cat.category.replace(/\\s+/g,'-')}-${idx}`;
      itemsHtml += `
        <li class="check-item ${item.done ? 'done' : ''}">
          <label class="check-label" for="${id}">
            <input type="checkbox" id="${id}" class="check-input" 
                   ${item.done ? 'checked' : ''} 
                   onchange="handleChecklistToggle(this, '${date}', '${cat.category}', '${item.text.replace(/'/g, "\\'")}')">
            <span class="check-custom"></span>
            <span class="check-text">${item.text}</span>
          </label>
        </li>`;
    });

    recoEl.innerHTML += `
      <div class="reco-category">
        <div class="reco-cat-header">
          <div class="reco-cat-icon ${iconMeta.class}">${iconMeta.icon}</div>
          <div>
            <div class="reco-cat-title">${cat.category}</div>
          </div>
        </div>
        <ul class="reco-list">${itemsHtml}</ul>
      </div>`;
  });

  renderChecklistProgress(recommendations);
  document.getElementById('results-section').style.display = 'grid';
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getCategoryIcon(title) {
  if (title.includes('Emotion')) return { icon: '🧠', class: 'reco-emotion-icon' };
  if (title.includes('Skin')) return { icon: '💆', class: 'reco-skin-icon' };
  if (title.includes('Routine')) return { icon: '🌅', class: 'reco-routine-icon' };
  if (title.includes('Nutrition')) return { icon: '🥗', class: 'reco-diet-icon' };
  return { icon: '💡', class: 'reco-routine-icon' };
}

function handleChecklistToggle(checkbox, date, category, text) {
  const isDone = checkbox.checked;
  const li = checkbox.closest('.check-item');
  if (isDone) li.classList.add('done');
  else li.classList.remove('done');
  
  updateChecklistItem(date, category, text, isDone);
}

function renderChecklistProgress(recommendations, dashPrefix = '') {
  let total = 0, done = 0;
  recommendations.forEach(c => {
    c.items.forEach(i => { total++; if (i.done) done++; });
  });
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  
  const pPrefix = dashPrefix ? 'dash-' : '';
  const pctEl = document.getElementById(`${pPrefix}checklist-pct`);
  const fillEl = document.getElementById(`${pPrefix}checklist${dashPrefix ? '-fill' : '-bar-fill'}`);
  const lblEl = document.getElementById(`${pPrefix}checklist${dashPrefix ? '-lbl' : '-done-lbl'}`);
  
  if(pctEl && fillEl && lblEl) {
    pctEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;
    lblEl.textContent = `${done} of ${total} done`;
  }
}

function buildRecommendations(emotion, brightness, conditions) {
  const recs = [];

  const emotionRec = { icon: '🧠', iconClass: 'reco-emotion-icon', title: 'Emotional Wellness', subtitle: 'Tips for your current mood', items: [] };
  switch (emotion) {
    case 'happy': emotionRec.items = ['Maintain positive energy with gratitude journaling.', 'Share your happiness – connect with friends.']; break;
    case 'sad': emotionRec.items = ['Try deep breathing: inhale 4s, hold 4s, exhale 6s.', 'Go for a 15-min walk in sunlight.', 'Listen to upbeat music.']; break;
    case 'depressed': emotionRec.items = ['Break tasks into tiny steps – celebrate small wins.', 'Sunlight exposure for 20 min daily.', 'Avoid isolation – chat with someone.']; break;
    case 'angry': emotionRec.items = ['Take 10 slow deep breaths before reacting.', 'Physical exercise to release tension.', 'Write down what is making you angry.']; break;
    case 'fearful': emotionRec.items = ['Ground yourself: name 5 things you can see.', 'Try the 4-7-8 breathing technique.']; break;
    default: emotionRec.items = ['Take a 5-min mindfulness break.', 'Hydrate well.', 'Step outside for fresh air.'];
  }
  recs.push(emotionRec);

  const skinRec = { icon: '💆', iconClass: 'reco-skin-icon', title: 'Skincare Routine', subtitle: 'Personalized for your skin', items: [] };
  if (brightness < 50) skinRec.items.push('Use Vitamin C serum in morning.', 'Exfoliate gently 2x a week.');
  const hasPimple = conditions.some(c => c.name.includes('Pimple') || c.name.includes('Redness'));
  if (hasPimple) skinRec.items.push('Apply tea tree oil on spots.', 'Use salicylic acid treatment.', 'Wash face gently twice daily.');
  const hasTanning = conditions.some(c => c.name.includes('Tan'));
  if (hasTanning) skinRec.items.push('Apply SPF 50+ sunscreen.', 'Use a de-tan mask twice a week.');
  if (skinRec.items.length === 0) skinRec.items.push('Moisturize morning and night.', 'Stay consistent with SPF.');
  recs.push(skinRec);

  recs.push({
    icon: '🌅', iconClass: 'reco-routine-icon', title: 'Daily Routine', subtitle: 'Small habits',
    items: ['Sleep 7–8 hours.', 'Drink 2.5 litres of water.', '10 min morning sunlight.']
  });

  return recs;
}

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const records = getRecords().sort((a,b) => b.timestamp - a.timestamp); // latest first
  document.getElementById('stat-total').textContent = records.length;
  
  if (records.length === 0) return;
  
  // Last 7 days stats
  const last7 = records.slice(0, 7);
  const avgBright = Math.round(last7.reduce((sum, r) => sum + r.brightnessScore, 0) / last7.length);
  document.getElementById('stat-avg-brightness').textContent = avgBright;
  
  const emotionCounts = {};
  last7.forEach(r => {
    emotionCounts[r.emotion.dominant] = (emotionCounts[r.emotion.dominant] || 0) + 1;
  });
  const topEmotion = Object.keys(emotionCounts).sort((a,b) => emotionCounts[b] - emotionCounts[a])[0];
  const domMeta = EMOTION_META[topEmotion];
  document.getElementById('stat-top-emotion').innerHTML = `<span style="font-size:1.4rem;margin-right:6px;">${domMeta.emoji}</span>${domMeta.label}`;

  // Check if today has a record
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = records.find(r => r.date === todayStr);
  
  renderDashboardChecklist(todayRecord);
  renderHistoryLog(records);
  renderSkinHistory(records);
  drawCharts(records);
}

function renderDashboardChecklist(todayRecord) {
  const container = document.getElementById('dash-checklist-items');
  const empty = document.getElementById('dash-checklist-empty');
  
  if (!todayRecord) {
    container.innerHTML = '';
    empty.style.display = 'block';
    renderChecklistProgress([], true);
    return;
  }
  
  empty.style.display = 'none';
  container.innerHTML = '';
  
  todayRecord.recommendations.forEach(cat => {
    let itemsHtml = '';
    cat.items.forEach((item, idx) => {
      const id = `dash-chk-${todayRecord.date}-${cat.category.replace(/\\s+/g,'-')}-${idx}`;
      itemsHtml += `
        <li class="check-item ${item.done ? 'done' : ''}">
          <label class="check-label" for="${id}">
            <input type="checkbox" id="${id}" class="check-input" 
                   ${item.done ? 'checked' : ''} 
                   onchange="handleChecklistToggle(this, '${todayRecord.date}', '${cat.category}', '${item.text.replace(/'/g, "\\'")}')">
            <span class="check-custom"></span>
            <span class="check-text">${item.text}</span>
          </label>
        </li>`;
    });
    container.innerHTML += `<div class="dash-reco-cat"><div class="dash-reco-title">${cat.category}</div><ul class="reco-list">${itemsHtml}</ul></div>`;
  });
  
  renderChecklistProgress(todayRecord.recommendations, true);
}

function renderHistoryLog(records) {
  const container = document.getElementById('history-log');
  const empty = document.getElementById('history-empty');
  
  if(records.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = '';
  
  records.forEach(r => {
    const d = new Date(r.timestamp);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit' });
    const emoMeta = EMOTION_META[r.emotion.dominant];
    
    // Calculate tasks done
    let total = 0, done = 0;
    r.recommendations.forEach(c => c.items.forEach(i => { total++; if(i.done) done++; }));
    
    container.innerHTML += `
      <div class="history-item glass-card">
        <div class="hist-date">
          <div class="hist-d">${dateStr}</div>
          <div class="hist-t">${timeStr}</div>
        </div>
        <div class="hist-metrics">
          <div class="hist-metric">
            <span class="hist-m-icon">${emoMeta.emoji}</span>
            <span>${emoMeta.label}</span>
          </div>
          <div class="hist-metric">
            <span class="hist-m-icon">✨</span>
            <span>${r.brightnessScore}</span>
          </div>
          <div class="hist-metric">
            <span class="hist-m-icon">✅</span>
            <span>${done}/${total} tasks</span>
          </div>
        </div>
      </div>
    `;
  });
}

function renderSkinHistory(records) {
  const container = document.getElementById('skin-history-table');
  const empty = document.getElementById('skin-history-empty');
  
  if(records.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  
  // Get last 7 days
  const last7 = records.slice(0,7).reverse(); // chronological for table columns
  
  // Collect all unique condition categories
  const conditionNames = new Set();
  last7.forEach(r => r.skinConditions.forEach(c => {
    // group by general name avoiding specific adjectives if possible
    let name = c.name;
    if(name.includes('Dull')) name = 'Brightness';
    if(name.includes('Redness') || name.includes('Pimple') || name.includes('Clear')) name = 'Acne/Redness';
    if(name.includes('Tan') || name.includes('Even')) name = 'Tanning';
    if(name.includes('Hydration') || name.includes('Oily') || name.includes('Texture')) name = 'Hydration';
    conditionNames.add(name);
  }));

  let tableHtml = `<div class="sht-row sht-header">
    <div class="sht-cell sht-label">Condition</div>`;
    
  last7.forEach(r => {
    const d = new Date(r.timestamp);
    tableHtml += `<div class="sht-cell sht-date">${d.getDate()}/${d.getMonth()+1}</div>`;
  });
  tableHtml += `</div>`;

  Array.from(conditionNames).forEach(catName => {
    tableHtml += `<div class="sht-row">
      <div class="sht-cell sht-label">${catName}</div>`;
      
    last7.forEach(r => {
      // Find condition matching category
      let foundLevel = 'unknown';
      r.skinConditions.forEach(c => {
        let n = c.name;
        if((n.includes('Dull') && catName==='Brightness') || (n.includes('Glow') && catName==='Brightness') ) foundLevel = c.level;
        if((n.includes('Redness') || n.includes('Pimple') || n.includes('Clear')) && catName==='Acne/Redness') foundLevel = c.level;
        if((n.includes('Tan') || n.includes('Even')) && catName==='Tanning') foundLevel = c.level;
        if((n.includes('Hydration') || n.includes('Oily') || n.includes('Texture')) && catName==='Hydration') foundLevel = c.level;
      });
      
      let dotColor = 'transparent';
      if(foundLevel === 'good') dotColor = 'var(--success)';
      else if (foundLevel === 'warning') dotColor = 'var(--warning)';
      else if (foundLevel === 'alert') dotColor = 'var(--danger)';
      
      tableHtml += `<div class="sht-cell"><div class="sht-dot" style="background:${dotColor}"></div></div>`;
    });
    tableHtml += `</div>`;
  });
  
  container.innerHTML = tableHtml;
}

// ── Pure Canvas Charts ───────────────────────────────────────
function drawCharts(records) {
  // Last 14 days
  const last14 = records.slice(0,14).reverse();
  
  if (last14.length === 0) {
    document.getElementById('brightness-chart-empty').style.display = 'block';
    document.getElementById('emotion-chart-empty').style.display = 'block';
    return;
  }
  
  document.getElementById('brightness-chart-empty').style.display = 'none';
  document.getElementById('emotion-chart-empty').style.display = 'none';
  
  drawBrightnessChart(last14);
  drawEmotionChart(last14);
}

function drawBrightnessChart(data) {
  const canvas = document.getElementById('brightness-chart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.parentElement.clientWidth - 40;
  canvas.height = 200;
  
  const w = canvas.width, h = canvas.height;
  const padding = 30;
  
  ctx.clearRect(0,0,w,h);
  
  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  for(let i=0; i<=4; i++) {
    let y = padding + (h-padding*2) * (i/4);
    ctx.moveTo(padding, y); ctx.lineTo(w-padding, y);
  }
  ctx.stroke();
  
  // Data points
  const points = data.map((r, i) => {
    let x = padding + (w - padding*2) * (i / Math.max(1, data.length-1));
    let y = h - padding - ((r.brightnessScore / 100) * (h - padding*2));
    return {x, y};
  });
  
  // Draw line
  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1; i<points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  
  // Draw points
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawEmotionChart(data) {
  const canvas = document.getElementById('emotion-chart');
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.parentElement.clientWidth - 40;
  canvas.height = 200;
  
  const w = canvas.width, h = canvas.height;
  const padding = 40;
  
  ctx.clearRect(0,0,w,h);
  
  // Count frequencies
  const counts = {};
  data.forEach(r => counts[r.emotion.dominant] = (counts[r.emotion.dominant]||0) + 1);
  
  const maxCount = Math.max(...Object.values(counts), 1);
  const keys = Object.keys(counts).sort((a,b) => counts[b] - counts[a]).slice(0, 5); // top 5
  
  const barWidth = Math.min(40, (w - padding*2) / keys.length - 10);
  
  keys.forEach((key, i) => {
    const val = counts[key];
    const meta = EMOTION_META[key];
    const barH = (val / maxCount) * (h - padding*2);
    
    const x = padding + i * ((w - padding*2) / keys.length) + ((w - padding*2) / keys.length - barWidth)/2;
    const y = h - padding - barH;
    
    // Bar
    ctx.fillStyle = meta.color;
    ctx.fillRect(x, y, barWidth, barH);
    
    // Emoji
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(meta.emoji, x + barWidth/2, h - padding + 20);
    
    // Value
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(val, x + barWidth/2, y - 10);
  });
}

// ── Analyzing Animation ───────────────────────────────────────
async function simulateSteps() {
  const overlay = document.getElementById('analyzing-overlay');
  overlay.style.display = 'flex';
  const steps = ['step-1','step-2','step-3','step-4'];
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) document.getElementById(steps[i-1]).className = 'step done';
    document.getElementById(steps[i]).className = 'step active';
    await sleep(700);
  }
  document.getElementById(steps[steps.length-1]).className = 'step done';
  await sleep(400);
}

function showAnalyzing() {
  ['step-1','step-2','step-3','step-4'].forEach(id => {
    document.getElementById(id).className = 'step';
  });
  document.getElementById('analyzing-overlay').style.display = 'flex';
}

function hideAnalyzing() {
  document.getElementById('analyzing-overlay').style.display = 'none';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Start
init();
