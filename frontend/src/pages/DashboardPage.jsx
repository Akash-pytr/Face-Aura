import { useMemo } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EMOTION_META } from '../utils/analysisEngine';

export default function DashboardPage({ user, records, setRecords }) {
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => b.timestamp - a.timestamp);
  }, [records]);

  const last7 = sortedRecords.slice(0, 7);
  const avgBright = last7.length > 0 
    ? Math.round(last7.reduce((sum, r) => sum + r.brightnessScore, 0) / last7.length)
    : '–';

  const topEmotion = useMemo(() => {
    if (last7.length === 0) return null;
    const counts = {};
    last7.forEach(r => counts[r.emotion.dominant] = (counts[r.emotion.dominant] || 0) + 1);
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return EMOTION_META[top];
  }, [last7]);

  const chartData = useMemo(() => {
    return [...sortedRecords].slice(0, 14).reverse().map((r, i) => ({
      name: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      brightness: r.brightnessScore,
      emotion: r.emotion.dominant,
      color: EMOTION_META[r.emotion.dominant]?.color || '#888'
    }));
  }, [sortedRecords]);

  const emotionFreqData = useMemo(() => {
    const data = [...sortedRecords].slice(0, 14);
    const counts = {};
    data.forEach(r => counts[r.emotion.dominant] = (counts[r.emotion.dominant] || 0) + 1);
    return Object.keys(counts).map(key => ({
      name: EMOTION_META[key].emoji,
      count: counts[key],
      fill: EMOTION_META[key].color
    })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [sortedRecords]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = sortedRecords.find(r => r.date === todayStr);

  let dashTotal = 0, dashDone = 0;
  if (todayRecord) {
    todayRecord.recommendations.forEach(c => c.items.forEach(i => { dashTotal++; if (i.done) dashDone++; }));
  }
  const dashPct = dashTotal === 0 ? 0 : Math.round((dashDone / dashTotal) * 100);

  const toggleDashTask = async (catTitle, itemText, currentStatus) => {
    if (!todayRecord) return;
    try {
      const res = await axios.put(`/records/${todayRecord._id}/checklist`, {
        category: catTitle,
        text: itemText,
        done: !currentStatus
      });
      // update state
      setRecords(prev => {
        const newRecords = [...prev];
        const idx = newRecords.findIndex(r => r._id === res.data._id);
        if(idx !== -1) newRecords[idx] = res.data;
        return newRecords;
      });
    } catch(err) {
      console.error(err);
    }
  };

  // Skin History
  const skinCatNames = new Set();
  last7.forEach(r => r.skinConditions.forEach(c => {
    let name = c.name;
    if(name.includes('Dull')) name = 'Brightness';
    if(name.includes('Redness') || name.includes('Pimple') || name.includes('Clear')) name = 'Acne/Redness';
    if(name.includes('Tan') || name.includes('Even')) name = 'Tanning';
    if(name.includes('Hydration') || name.includes('Oily') || name.includes('Texture')) name = 'Hydration';
    skinCatNames.add(name);
  }));

  return (
    <main className="main-container">
      <div className="dash-header">
        <h1 className="section-title">📊 My Wellness Progress</h1>
        <p className="section-subtitle">Track your daily skin & emotional journey</p>
      </div>

      <div className="stats-row">
        <div className="stat-card glass-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{/* STREAK is in header, showing total sessions here instead or re-calculating streak */}
            {sortedRecords.length > 0 ? 'Active' : '0'}
          </div>
          <div className="stat-label">Status</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{sortedRecords.length}</div>
          <div className="stat-label">Total Check-ins</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon">✨</div>
          <div className="stat-value">{avgBright}</div>
          <div className="stat-label">Avg Brightness (7d)</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-icon">🎭</div>
          <div className="stat-value">
            {topEmotion ? <><span style={{fontSize:'1.4rem',marginRight:'6px'}}>{topEmotion.emoji}</span>{topEmotion.label}</> : '–'}
          </div>
          <div className="stat-label">Common Emotion (7d)</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card glass-card">
          <div className="card-header">
            <div className="card-icon">📈</div>
            <div>
              <h2 className="card-title">Skin Brightness Trend</h2>
              <p className="card-subtitle">Last 14 days</p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="chart-canvas" style={{height: 250}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid #4c1d95', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="brightness" stroke="#facc15" strokeWidth={3} dot={{ fill: '#facc15', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">No data yet – start your first check-in!</div>
          )}
        </div>

        <div className="chart-card glass-card">
          <div className="card-header">
            <div className="card-icon">🎭</div>
            <div>
              <h2 className="card-title">Emotion Frequency</h2>
              <p className="card-subtitle">Last 14 days</p>
            </div>
          </div>
          {emotionFreqData.length > 0 ? (
            <div className="chart-canvas" style={{height: 250}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emotionFreqData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={24} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid #4c1d95', borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {emotionFreqData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">No data yet – start your first check-in!</div>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="card-header">
          <div className="card-icon">🩺</div>
          <div>
            <h2 className="card-title">Skin Condition History</h2>
            <p className="card-subtitle">Daily status per condition</p>
          </div>
        </div>
        {last7.length > 0 ? (
          <div className="skin-history-table">
            <div className="sht-row sht-header">
              <div className="sht-cell sht-label">Condition</div>
              {last7.map((r,i) => {
                const d = new Date(r.timestamp);
                return <div key={i} className="sht-cell sht-date">{d.getDate()}/{d.getMonth()+1}</div>;
              })}
            </div>
            {Array.from(skinCatNames).map((catName, idx) => (
              <div key={idx} className="sht-row">
                <div className="sht-cell sht-label">{catName}</div>
                {last7.map((r, i) => {
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
                  return <div key={i} className="sht-cell"><div className="sht-dot" style={{background: dotColor}}></div></div>;
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="chart-empty">No data yet.</div>
        )}
      </div>

      <div className="glass-card">
        <div className="card-header">
          <div className="card-icon">✅</div>
          <div>
            <h2 className="card-title">Today's Recommendations</h2>
            <p className="card-subtitle">Mark tasks as done to track your routine</p>
          </div>
          <div className="checklist-progress-wrap" style={{ marginLeft: 'auto' }}>
            <div className="checklist-pct">{dashPct}%</div>
            <div className="checklist-bar-track">
              <div className="checklist-bar-fill" style={{ width: `${dashPct}%` }}></div>
            </div>
            <div className="checklist-done-lbl">{dashDone} of {dashTotal} done</div>
          </div>
        </div>
        {todayRecord ? (
          <div className="dash-checklist-items">
            {todayRecord.recommendations.map((cat, i) => (
              <div key={i} className="dash-reco-cat">
                <div className="dash-reco-title">{cat.category}</div>
                <ul className="reco-list">
                  {cat.items.map((item, j) => (
                    <li key={j} className={`check-item ${item.done ? 'done' : ''}`}>
                      <label className="check-label">
                        <input 
                          type="checkbox" 
                          className="check-input" 
                          checked={item.done}
                          onChange={() => toggleDashTask(cat.category, item.text, item.done)}
                        />
                        <span className="check-custom"></span>
                        <span className="check-text">{item.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="chart-empty">Analyze your face today to get personalized tasks!</div>
        )}
      </div>

      <div className="glass-card">
        <div className="card-header">
          <div className="card-icon">🗓️</div>
          <div>
            <h2 className="card-title">Check-in History</h2>
            <p className="card-subtitle">All your past sessions</p>
          </div>
        </div>
        {sortedRecords.length > 0 ? (
          <div className="history-log">
            {sortedRecords.map((r, i) => {
              const d = new Date(r.timestamp);
              const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit' });
              const emoMeta = EMOTION_META[r.emotion.dominant];
              
              let total = 0, done = 0;
              r.recommendations.forEach(c => c.items.forEach(it => { total++; if(it.done) done++; }));

              return (
                <div key={i} className="history-item glass-card">
                  <div className="hist-date">
                    <div className="hist-d">{dateStr}</div>
                    <div className="hist-t">{timeStr}</div>
                  </div>
                  <div className="hist-metrics">
                    <div className="hist-metric">
                      <span className="hist-m-icon">{emoMeta.emoji}</span>
                      <span>{emoMeta.label}</span>
                    </div>
                    <div className="hist-metric">
                      <span className="hist-m-icon">✨</span>
                      <span>{r.brightnessScore}</span>
                    </div>
                    <div className="hist-metric">
                      <span className="hist-m-icon">✅</span>
                      <span>{done}/{total} tasks</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="chart-empty">No check-ins yet.</div>
        )}
      </div>
      
      {/* Invisible toast div for simple alerts if needed */}
      <div className="toast" id="toast"></div>
    </main>
  );
}
