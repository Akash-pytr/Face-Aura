import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { analyzeImage, buildRecommendations } from '../utils/analysisEngine';
import ResultsCard from '../components/ResultsCard';

export default function AnalyzePage({ user, onRecordSaved }) {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState({ type: '', text: 'Camera not started' });
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, facingMode: 'user' }, audio: false });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStatus({ type: 'active', text: 'Camera active – ready to analyze' });
      setResult(null);
    } catch (e) {
      setStatus({ type: 'error', text: 'Camera access denied' });
      alert('Please allow camera access to use FaceAura.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus({ type: '', text: 'Camera stopped' });
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const captureAndAnalyze = async () => {
    if (!stream || !videoRef.current) { alert('Please start camera first.'); return; }
    
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setAnalyzing(true);
    setStatus({ type: 'analyzing', text: 'Analyzing...' });

    for (let i = 1; i <= 4; i++) {
      setStep(i);
      await sleep(700);
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const analysisRaw = analyzeImage(imageData, canvas.width, canvas.height);
    const recommendations = buildRecommendations(analysisRaw.emotion.dominant, analysisRaw.brightnessScore, analysisRaw.skinConditions);
    
    if (user) {
      const newRecordData = {
        userId: user._id,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        brightnessScore: analysisRaw.brightnessScore,
        emotion: analysisRaw.emotion,
        skinConditions: analysisRaw.skinConditions,
        recommendations: recommendations.map(cat => ({
          category: cat.title,
          items: cat.items.map(i => ({ text: i, done: false }))
        }))
      };

      try {
        const res = await axios.post('/records', newRecordData);
        onRecordSaved(res.data);
        setResult(res.data);
        setStatus({ type: 'active', text: 'Analysis complete!' });
        
        const toast = document.getElementById('toast');
        if (toast) {
          toast.textContent = 'Today\'s check-in saved! ✅';
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 3000);
        }
      } catch (err) {
        console.error(err);
        setStatus({ type: 'error', text: 'Failed to save analysis' });
        setResult({
          emotion: analysisRaw.emotion,
          brightnessScore: analysisRaw.brightnessScore,
          skinConditions: analysisRaw.skinConditions,
          recommendations: recommendations.map(cat => ({
            category: cat.title,
            items: cat.items.map(i => ({ text: i, done: false }))
          }))
        });
      }
    } else {
      // Guest mode - don't save to DB
      setResult({
        emotion: analysisRaw.emotion,
        brightnessScore: analysisRaw.brightnessScore,
        skinConditions: analysisRaw.skinConditions,
        recommendations: recommendations.map(cat => ({
          category: cat.title,
          items: cat.items.map(i => ({ text: i, done: false }))
        }))
      });
      setStatus({ type: 'active', text: 'Analysis complete!' });
      
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'Log in to save this result to your journal! 🔒';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
      }
    }

    setAnalyzing(false);
    setStep(0);
    
    // smooth scroll to results
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  return (
    <main className="main-container">
      <section className="camera-section glass-card">
        <div className="camera-header">
          <h1 className="section-title">📷 Live Face Analysis</h1>
          <p className="section-subtitle">Allow camera access and click analyze to detect emotions & skin conditions</p>
          {result && user && <div className="checkin-badge">✅ Today's check-in saved!</div>}
          {result && !user && <div className="checkin-badge" style={{color:'var(--warning)', borderColor:'var(--warning)', background:'rgba(250, 204, 21, 0.1)'}}>🔒 Log in to save to your journal</div>}
        </div>

        <div className="camera-wrapper">
          <div className={`camera-frame ${stream ? 'active' : ''}`}>
            <video ref={videoRef} autoPlay muted playsInline style={{ display: stream ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }}></video>
            {!stream && (
              <div className="camera-overlay">
                <div className="camera-icon">📷</div>
                <p>Camera preview will appear here</p>
              </div>
            )}
            {stream && !analyzing && <div className="scan-line active"></div>}
            <div className="corner tl"></div><div className="corner tr"></div>
            <div className="corner bl"></div><div className="corner br"></div>
          </div>

          <div className="camera-controls">
            <button className="btn btn-primary" onClick={startCamera} disabled={!!stream}>
              <span className="btn-icon">🎥</span><span>Start Camera</span>
            </button>
            <button className="btn btn-secondary" onClick={captureAndAnalyze} disabled={!stream || analyzing}>
              <span className="btn-icon">🔍</span><span>Analyze Face</span>
            </button>
            <button className="btn btn-danger" onClick={stopCamera} disabled={!stream}>
              <span className="btn-icon">⏹</span><span>Stop</span>
            </button>
          </div>

          <div className="status-bar">
            <div className={`status-dot ${status.type}`}></div>
            <span>{status.text}</span>
          </div>
        </div>
      </section>

      {analyzing && (
        <div className="analyzing-overlay">
          <div className="analyzing-content">
            <div className="ai-spinner"></div>
            <p className="analyzing-text">AI analyzing your face...</p>
            <div className="analyzing-steps">
              <div className={`step ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}>🎭 Detecting expressions...</div>
              <div className={`step ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}>✨ Analyzing skin brightness...</div>
              <div className={`step ${step >= 3 ? (step > 3 ? 'done' : 'active') : ''}`}>🔬 Checking skin conditions...</div>
              <div className={`step ${step >= 4 ? (step > 4 ? 'done' : 'active') : ''}`}>💾 Saving to your journal...</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <>
          <ResultsCard record={result} onChecklistToggle={setResult} />
          <div className="reanalyze-row" style={{ marginTop: '20px' }}>
            <button className="btn btn-primary btn-large" onClick={captureAndAnalyze}>
              <span className="btn-icon">🔄</span><span>Analyze Again</span>
            </button>
          </div>
        </>
      )}

      <canvas ref={captureCanvasRef} style={{ display: 'none' }}></canvas>
    </main>
  );
}
