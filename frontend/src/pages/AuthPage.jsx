import { useState } from 'react';
import axios from 'axios';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await axios.post('/auth/login', { email, password });
        onLogin(res.data.token, res.data.user);
      } else {
        const res = await axios.post('/auth/signup', { name, email, password });
        onLogin(res.data.token, res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box glass-card" style={{ maxWidth: '450px' }}>
        <div className="modal-icon">✦</div>
        <h2 className="modal-title">FaceAura AI</h2>
        <p className="modal-sub">{isLogin ? 'Welcome back! Please login.' : 'Create an account to track your progress.'}</p>
        
        {error && <div className="checkin-badge" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {!isLogin && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Full Name</label>
              <input 
                type="text" 
                className="profile-input" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ marginBottom: '0', marginTop: '4px' }}
              />
            </div>
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Email Address</label>
            <input 
              type="email" 
              className="profile-input" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ marginBottom: '0', marginTop: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Password</label>
            <input 
              type="password" 
              className="profile-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
              style={{ marginBottom: '0', marginTop: '4px' }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            <span className="btn-icon">{isLogin ? '🔑' : '🚀'}</span> 
            {loading ? 'Processing...' : isLogin ? 'Login to Dashboard' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary-glow)', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
