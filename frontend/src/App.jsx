import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import Header from './components/Header'
import AuthPage from './pages/AuthPage'
import AnalyzePage from './pages/AnalyzePage'
import DashboardPage from './pages/DashboardPage'

// Configure axios base URL
axios.defaults.baseURL = '/api';

function App() {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initParticles();
    
    // Check for token on load
    const token = localStorage.getItem('faceaura_token');
    
    if (token) {
      setAuthToken(token);
      fetchUserAndRecords();
    } else {
      setLoading(false);
    }
  }, [])

  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  const fetchUserAndRecords = async () => {
    try {
      const userRes = await axios.get('/auth/me');
      setUser(userRes.data);
      setIsAuthenticated(true);
      
      const recordsRes = await axios.get(`/records`);
      setRecords(recordsRes.data);
    } catch (err) {
      console.error("Session expired or invalid", err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = (token, userData) => {
    localStorage.setItem('faceaura_token', token);
    setAuthToken(token);
    setUser(userData);
    setIsAuthenticated(true);
    fetchUserAndRecords(); // Fetch their historical records
  }

  const handleLogout = () => {
    localStorage.removeItem('faceaura_token');
    setAuthToken(null);
    setUser(null);
    setRecords([]);
    setIsAuthenticated(false);
  }

  const handleRecordSaved = (newRecord) => {
    setRecords(prev => {
      const existingIdx = prev.findIndex(r => r.date === newRecord.date);
      if (existingIdx !== -1) {
        const newRecords = [...prev];
        newRecords[existingIdx] = newRecord;
        return newRecords;
      }
      return [newRecord, ...prev];
    });
  }

  if (loading) {
    return <div style={{height: '100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'white'}}>Loading FaceAura...</div>
  }

  return (
    <Router>
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>
      <canvas id="particles-canvas"></canvas>

      <Header user={user} records={records} onLogout={handleLogout} />
      
      <Routes>
        <Route path="/" element={<Navigate to="/analyze" />} />
        <Route path="/analyze" element={<AnalyzePage user={user} onRecordSaved={handleRecordSaved} />} />
        
        <Route path="/progress" element={
          isAuthenticated ? (
            <DashboardPage user={user} records={records} setRecords={setRecords} />
          ) : (
            <Navigate to="/auth" />
          )
        } />
        
        <Route path="/auth" element={
          !isAuthenticated ? (
            <AuthPage onLogin={handleLogin} />
          ) : (
            <Navigate to="/progress" />
          )
        } />

        <Route path="*" element={<Navigate to="/analyze" />} />
      </Routes>

      <footer className="footer" style={{ zIndex: 10 }}>
        <p>FaceAura AI &nbsp;•&nbsp; Powered by MERN Stack &nbsp;•&nbsp; Private & Secure 🔒</p>
      </footer>
    </Router>
  )
}

function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if(!canvas) return;
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

export default App;
