import { EMOTION_META } from '../utils/aiAnalysisEngine';
import axios from 'axios';

export default function ResultsCard({ record, onChecklistToggle }) {
  if (!record) return null;

  const { emotion, brightnessScore, skinConditions, recommendations, date, _id, age, gender, genderProbability } = record;
  const dom = EMOTION_META[emotion.dominant] || EMOTION_META.neutral;

  let totalTasks = 0, doneTasks = 0;
  recommendations.forEach(c => c.items.forEach(i => { totalTasks++; if(i.done) doneTasks++; }));
  const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  const getCategoryIcon = (title) => {
    if (title.includes('Emotion')) return { icon: '🧠', class: 'reco-emotion-icon' };
    if (title.includes('Skin')) return { icon: '💆', class: 'reco-skin-icon' };
    if (title.includes('Routine')) return { icon: '🌅', class: 'reco-routine-icon' };
    if (title.includes('Nutrition')) return { icon: '🥗', class: 'reco-diet-icon' };
    return { icon: '💡', class: 'reco-routine-icon' };
  };

  const toggleTask = async (catTitle, itemText, currentStatus) => {
    try {
      const res = await axios.put(`/records/${_id}/checklist`, {
        category: catTitle,
        text: itemText,
        done: !currentStatus
      });
      onChecklistToggle(res.data);
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <section className="results-section">
      {/* Emotion Card */}
      <div className="result-card glass-card">
        <div className="card-header">
          <div className="card-icon">🎭</div>
          <div>
            <h2 className="card-title">Facial Expression Analysis</h2>
            <p className="card-subtitle">Real ML — face-api.js (TensorFlow.js) ⚡</p>
          </div>
        </div>
        <div className="emotion-display">
          <div className="primary-emotion">
            <div className="emotion-emoji">{dom.emoji}</div>
            <div className="emotion-name">{dom.label}</div>
            <div className="emotion-confidence">{emotion.scores[emotion.dominant] || 0}% confident</div>
            {(age || gender) && (
              <div className="age-gender-row">
                {age    && <span className="age-gender-chip">🎂 ~{age} yrs</span>}
                {gender && <span className="age-gender-chip">👤 {gender === 'male' ? '♂ Male' : '♀ Female'} ({genderProbability}%)</span>}
              </div>
            )}
          </div>
          <div className="emotion-bars">
            {Object.entries(emotion.scores).map(([key, p]) => {
              const m = EMOTION_META[key] || { emoji: '❓', label: key, color: '#888' };
              return (
                <div key={key} className="emotion-bar-row">
                  <span className="emotion-bar-emoji">{m.emoji}</span>
                  <span className="emotion-bar-label">{m.label}</span>
                  <div className="emotion-bar-track">
                    <div className="emotion-bar-fill" style={{ width: `${p}%`, background: m.color }}></div>
                  </div>
                  <span className="emotion-bar-pct">{p}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Brightness Card */}
      <div className="result-card glass-card">
        <div className="card-header">
          <div className="card-icon">✨</div>
          <div>
            <h2 className="card-title">Skin Brightness & Glow</h2>
            <p className="card-subtitle">Face luminosity analysis</p>
          </div>
        </div>
        <div className="brightness-display">
          <div className="brightness-meter">
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${100 - brightnessScore}%` }}></div>
            </div>
            <div className="meter-labels">
              <span>Dull</span><span>Normal</span><span>Bright</span>
            </div>
          </div>
          <div className="brightness-info">
            <div className="bright-score">{brightnessScore}</div>
            <div className="bright-label">{brightnessScore >= 70 ? 'Bright & Glowing' : brightnessScore >= 45 ? 'Moderately Bright' : 'Dull & Tired'}</div>
            <div className="bright-desc">{brightnessScore >= 70 ? 'Your skin radiates a healthy glow!' : brightnessScore >= 45 ? 'Your skin has decent brightness.' : 'Your skin looks dull. Hydration helps.'}</div>
          </div>
        </div>
      </div>

      {/* Skin Condition Card */}
      <div className="result-card glass-card condition-card">
        <div className="card-header">
          <div className="card-icon">🔬</div>
          <div>
            <h2 className="card-title">Skin Condition Report</h2>
            <p className="card-subtitle">Detailed skin health analysis</p>
          </div>
        </div>
        <div className="conditions-grid">
          {skinConditions.map((c, i) => (
            <div key={i} className="condition-item">
              <div className="condition-top">
                <span className="condition-icon">{c.icon}</span>
                <span className={`condition-badge badge-${c.level}`}>{c.level === 'good' ? 'Good' : c.level === 'warning' ? 'Warning' : 'Alert'}</span>
              </div>
              <div className="condition-name">{c.name}</div>
              <div className="condition-detail">{c.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations Checklist */}
      <div className="result-card glass-card reco-card">
        <div className="card-header">
          <div className="card-icon">💊</div>
          <div>
            <h2 className="card-title">Personalized Recommendations</h2>
            <p className="card-subtitle">Check off each task as you complete it today</p>
          </div>
          <div className="checklist-progress-wrap" style={{ marginLeft: 'auto' }}>
            <div className="checklist-pct">{pct}%</div>
            <div className="checklist-bar-track">
              <div className="checklist-bar-fill" style={{ width: `${pct}%` }}></div>
            </div>
            <div className="checklist-done-lbl">{doneTasks} of {totalTasks} done</div>
          </div>
        </div>
        <div className="recommendations">
          {recommendations.map((cat, i) => {
            const iconMeta = getCategoryIcon(cat.category);
            return (
              <div key={i} className="reco-category">
                <div className="reco-cat-header">
                  <div className={`reco-cat-icon ${iconMeta.class}`}>{iconMeta.icon}</div>
                  <div><div className="reco-cat-title">{cat.category}</div></div>
                </div>
                <ul className="reco-list">
                  {cat.items.map((item, j) => (
                    <li key={j} className={`check-item ${item.done ? 'done' : ''}`}>
                      <label className="check-label">
                        <input 
                          type="checkbox" 
                          className="check-input" 
                          checked={item.done}
                          onChange={() => toggleTask(cat.category, item.text, item.done)}
                        />
                        <span className="check-custom"></span>
                        <span className="check-text">{item.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
