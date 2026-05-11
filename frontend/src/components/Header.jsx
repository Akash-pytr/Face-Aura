import { NavLink } from 'react-router-dom';
import { Camera, BarChart2 } from 'lucide-react';

export default function Header({ user, records, onLogout }) {
  const calculateStreak = () => {
    if (!records || records.length === 0) return 0;
    
    const sortedDates = [...new Set(records.map(r => r.date))].sort().reverse();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentStreak = 0;
    let d = new Date(today);
    
    const todayStr = d.toISOString().split('T')[0];
    if (sortedDates.includes(todayStr)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 1);
      const yestStr = d.toISOString().split('T')[0];
      if(sortedDates.includes(yestStr)) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else {
        return 0;
      }
    }

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
  };

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-icon">✦</div>
        <span className="logo-text">FaceAura</span>
        <span className="logo-badge">AI</span>
      </div>
      
      <nav className="nav-tabs">
        <NavLink 
          to="/analyze" 
          className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          <Camera size={16} style={{display:'inline', marginRight:'6px', verticalAlign:'text-bottom'}} /> Analyze
        </NavLink>
        <NavLink 
          to="/progress" 
          className={({isActive}) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          <BarChart2 size={16} style={{display:'inline', marginRight:'6px', verticalAlign:'text-bottom'}} /> My Progress
        </NavLink>
      </nav>

      <div className="header-user" style={{ gap: '20px' }}>
        {user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-streak">🔥 {calculateStreak()} day streak</div>
              </div>
            </div>
            <button 
              onClick={onLogout}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
              onMouseOver={(e) => { e.target.style.color = '#fff'; e.target.style.borderColor = 'rgba(255,255,255,0.5)'; }}
              onMouseOut={(e) => { e.target.style.color = 'var(--text-muted)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            >
              Logout
            </button>
          </>
        ) : (
          <NavLink 
            to="/auth" 
            style={{ textDecoration: 'none', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            Sign In / Sign Up
          </NavLink>
        )}
      </div>
    </header>
  );
}
