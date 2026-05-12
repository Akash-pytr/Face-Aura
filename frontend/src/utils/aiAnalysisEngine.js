import * as faceapi from 'face-api.js';

// ─── Model Loading ────────────────────────────────────────────────
let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

// ─── Main AI Analysis ─────────────────────────────────────────────
export async function analyzeWithAI(videoElement, canvas) {
  const ctx = canvas.getContext('2d');

  // Draw current video frame onto canvas
  canvas.width = videoElement.videoWidth || 480;
  canvas.height = videoElement.videoHeight || 360;
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Run all detections in parallel
  const detections = await faceapi
    .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceExpressions()
    .withAgeAndGender();

  if (!detections || detections.length === 0) {
    return { faceDetected: false };
  }

  // Use the most prominent (largest) face
  const best = detections.reduce((prev, curr) =>
    curr.detection.box.area > prev.detection.box.area ? curr : prev
  );

  // ── Emotion Scores ──
  const rawExpressions = best.expressions; // { happy, sad, angry, fearful, disgusted, surprised, neutral }
  const emotionKeys = ['happy', 'neutral', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'];

  // Normalize to percentages that sum to 100
  const total = emotionKeys.reduce((s, k) => s + (rawExpressions[k] || 0), 0);
  const scores = {};
  emotionKeys.forEach(k => {
    scores[k] = Math.round(((rawExpressions[k] || 0) / total) * 100);
  });

  // Add 'depressed' as a computed blend (low happy + high sad/neutral)
  scores.depressed = Math.round((scores.sad * 0.4 + scores.neutral * 0.15) * (1 - scores.happy / 100));
  
  // Renormalize after adding depressed
  const total2 = Object.values(scores).reduce((s, v) => s + v, 0);
  Object.keys(scores).forEach(k => { scores[k] = Math.round(scores[k] / total2 * 100); });

  // Sort descending
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0][0];

  // ── Age & Gender ──
  const age = Math.round(best.age);
  const gender = best.gender; // 'male' | 'female'
  const genderProbability = Math.round(best.genderProbability * 100);

  // ── Skin Analysis from Canvas Pixels ──
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const skinConditions = analyzeSkiFromPixels(imageData, canvas.width, canvas.height);
  const brightnessScore = computeBrightness(imageData, canvas.width, canvas.height);

  return {
    faceDetected: true,
    emotion: { dominant, scores: Object.fromEntries(sorted) },
    age,
    gender,
    genderProbability,
    brightnessScore,
    skinConditions,
  };
}

// ─── Enhanced Skin Analysis ───────────────────────────────────────
function computeBrightness(imageData, w, h) {
  const data = imageData.data;
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const rx = Math.floor(w * 0.28), ry = Math.floor(h * 0.35);
  let sum = 0, count = 0;

  for (let y = cy - ry; y < cy + ry; y += 2) {
    for (let x = cx - rx; x < cx + rx; x += 2) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = (y * w + x) * 4;
      // Perceived luminance (ITU-R BT.601)
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
  }
  return Math.round(Math.min(100, (sum / count / 220) * 100));
}

function analyzeSkiFromPixels(imageData, w, h) {
  const data = imageData.data;
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const rx = Math.floor(w * 0.3), ry = Math.floor(h * 0.38);

  let rSum = 0, gSum = 0, bSum = 0;
  let redSpots = 0, darkSpots = 0, brightPixels = 0;
  let count = 0;

  for (let y = cy - ry; y < cy + ry; y += 2) {
    for (let x = cx - rx; x < cx + rx; x += 2) {
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b; count++;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 185) brightPixels++;
      if (r > 155 && r > g * 1.35 && r > b * 1.25) redSpots++;
      if (lum < 75) darkSpots++;
    }
  }

  const avgR = rSum / count, avgG = gSum / count, avgB = bSum / count;
  const redRatio = redSpots / count;
  const darkRatio = darkSpots / count;
  const brightRatio = brightPixels / count;
  const oiliness = Math.max(0, avgR - 80) / 180;
  const evenness = 1 - (Math.abs(avgR - avgG) + Math.abs(avgG - avgB)) / 255;
  const brightness = Math.round(Math.min(100, ((avgR + avgG + avgB) / 3 / 220) * 100));

  const conditions = [];

  // Glow / Dullness
  if (brightness >= 65) {
    conditions.push({ name: 'Skin Glow', icon: '✨', level: 'good', detail: 'Your skin appears bright and healthy.' });
  } else if (brightness >= 40) {
    conditions.push({ name: 'Dull Skin', icon: '🌫️', level: 'warning', detail: 'Skin looks slightly dull. Hydration can help.' });
  } else {
    conditions.push({ name: 'Very Dull Skin', icon: '😶', level: 'alert', detail: 'Skin appears quite dull. Consider exfoliation.' });
  }

  // Redness / Pimples
  if (redRatio > 0.055) {
    conditions.push({ name: 'Pimples/Redness', icon: '🔴', level: 'alert', detail: 'Significant redness detected in facial area.' });
  } else if (redRatio > 0.022) {
    conditions.push({ name: 'Mild Redness', icon: '🟠', level: 'warning', detail: 'Some redness visible. Could be irritation or mild acne.' });
  } else {
    conditions.push({ name: 'Clear Skin', icon: '💚', level: 'good', detail: 'No significant redness detected.' });
  }

  // Tanning / Dark patches
  if (darkRatio > 0.08) {
    conditions.push({ name: 'Heavy Tanning', icon: '☀️', level: 'alert', detail: 'Noticeable dark patches or heavy tanning.' });
  } else if (darkRatio > 0.03) {
    conditions.push({ name: 'Mild Tanning', icon: '🌤️', level: 'warning', detail: 'Slight tan or uneven pigmentation detected.' });
  } else {
    conditions.push({ name: 'Even Tone', icon: '🌟', level: 'good', detail: 'Skin tone appears even and balanced.' });
  }

  // Oiliness / Hydration / Texture
  if (oiliness > 0.55) {
    conditions.push({ name: 'Oily / Shiny', icon: '💧', level: 'warning', detail: 'Skin may be oily. Use a gentle cleanser.' });
  } else if (evenness < 0.58) {
    conditions.push({ name: 'Uneven Texture', icon: '🔵', level: 'warning', detail: 'Uneven skin texture noticed. Exfoliation may help.' });
  } else {
    conditions.push({ name: 'Good Hydration', icon: '💦', level: 'good', detail: 'Skin appears well-hydrated and smooth.' });
  }

  return conditions;
}

// ─── Emotion Metadata ─────────────────────────────────────────────
export const EMOTION_META = {
  happy:     { emoji: '😊', label: 'Happy',     color: '#facc15' },
  neutral:   { emoji: '😐', label: 'Neutral',   color: '#94a3b8' },
  sad:       { emoji: '😢', label: 'Sad',       color: '#60a5fa' },
  angry:     { emoji: '😠', label: 'Angry',     color: '#f87171' },
  surprised: { emoji: '😲', label: 'Surprised', color: '#c084fc' },
  fearful:   { emoji: '😨', label: 'Fearful',   color: '#818cf8' },
  disgusted: { emoji: '🤢', label: 'Disgusted', color: '#4ade80' },
  depressed: { emoji: '😞', label: 'Depressed', color: '#64748b' },
};

// ─── Recommendations (unchanged logic, reused) ────────────────────
export function buildRecommendations(emotion, brightness, conditions) {
  const recs = [];

  const emotionRec = {
    icon: '🧠', iconClass: 'reco-emotion-icon',
    title: 'Emotional Wellness', subtitle: 'Tips for your current mood',
    items: []
  };
  switch (emotion) {
    case 'happy':     emotionRec.items = ['Maintain positive energy with gratitude journaling.', 'Share your happiness – connect with friends.']; break;
    case 'sad':       emotionRec.items = ['Try deep breathing: inhale 4s, hold 4s, exhale 6s.', 'Go for a 15-min walk in sunlight.', 'Listen to upbeat music.']; break;
    case 'depressed': emotionRec.items = ['Break tasks into tiny steps – celebrate small wins.', 'Sunlight exposure for 20 min daily.', 'Avoid isolation – chat with someone.']; break;
    case 'angry':     emotionRec.items = ['Take 10 slow deep breaths before reacting.', 'Physical exercise to release tension.', 'Write down what is making you angry.']; break;
    case 'fearful':   emotionRec.items = ['Ground yourself: name 5 things you can see.', 'Try the 4-7-8 breathing technique.']; break;
    case 'surprised': emotionRec.items = ['Take a moment to process what surprised you.', 'Journal your thoughts to gain clarity.']; break;
    case 'disgusted': emotionRec.items = ['Identify the source of discomfort.', 'Practice mindful acceptance exercises.']; break;
    default:          emotionRec.items = ['Take a 5-min mindfulness break.', 'Hydrate well.', 'Step outside for fresh air.'];
  }
  recs.push(emotionRec);

  const skinRec = {
    icon: '💆', iconClass: 'reco-skin-icon',
    title: 'Skincare Routine', subtitle: 'Personalized for your skin',
    items: []
  };
  if (brightness < 50) skinRec.items.push('Use Vitamin C serum in morning.', 'Exfoliate gently 2x a week.');
  const hasPimple = conditions.some(c => c.name.includes('Pimple') || c.name.includes('Redness'));
  if (hasPimple) skinRec.items.push('Apply tea tree oil on spots.', 'Use salicylic acid treatment.', 'Wash face gently twice daily.');
  const hasTanning = conditions.some(c => c.name.includes('Tan'));
  if (hasTanning) skinRec.items.push('Apply SPF 50+ sunscreen.', 'Use a de-tan mask twice a week.');
  if (skinRec.items.length === 0) skinRec.items.push('Moisturize morning and night.', 'Stay consistent with SPF.');
  recs.push(skinRec);

  recs.push({
    icon: '🌅', iconClass: 'reco-routine-icon',
    title: 'Daily Routine', subtitle: 'Small habits, big results',
    items: ['Sleep 7–8 hours.', 'Drink 2.5 litres of water.', '10 min morning sunlight.']
  });

  return recs;
}
