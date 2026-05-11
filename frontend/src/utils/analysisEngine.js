export function analyzeImage(imageData, w, h) {
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

function clamp(v, mn, mx) { return Math.min(mx, Math.max(mn, v)); }

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

export function buildRecommendations(emotion, brightness, conditions) {
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

export const EMOTION_META = {
  happy:     { emoji: '😊', label: 'Happy', color: '#facc15' },
  neutral:   { emoji: '😐', label: 'Neutral', color: '#94a3b8' },
  sad:       { emoji: '😢', label: 'Sad', color: '#60a5fa' },
  angry:     { emoji: '😠', label: 'Angry', color: '#f87171' },
  surprised: { emoji: '😲', label: 'Surprised', color: '#c084fc' },
  fearful:   { emoji: '😨', label: 'Fearful', color: '#818cf8' },
  disgusted: { emoji: '🤢', label: 'Disgusted', color: '#4ade80' },
  depressed: { emoji: '😞', label: 'Depressed', color: '#64748b' }
};
