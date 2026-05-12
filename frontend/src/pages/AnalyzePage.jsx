import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { loadModels, analyzeWithAI, buildRecommendations } from '../utils/aiAnalysisEngine';
import ResultsCard from '../components/ResultsCard';

export default function AnalyzePage({ user, onRecordSaved }) {
  const [stream, setStream]       = useState(null);
  const [status, setStatus]       = useState({ type: '', text: 'Camera not started' });
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep]           = useState(0);
  const [result, setResult]       = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [noFaceError, setNoFaceError]   = useState(false);

  const videoRef         = useRef(null);
  const captureCanvasRef = useRef(null);

  // Load AI models on mount
  useEffect(() => {
    (async () => {
      setModelLoading(true);
      setStatus({ type: 'analyzing', text: '🧠 Loading AI models...' });
      try {
        await loadModels();
        setModelReady(true);
        setStatus({ type: '', text: 'AI ready — start camera to begin' });
      } catch (err) {
        console.error('Model load error:', err);
        setStatus({ type: 'error', text: 'AI model failed to load' });
      } finally {
        setModelLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setStatus({ type: 'active', text: 'Camera active – ready to analyze' });
      setResult(null);
      setNoFaceError(false);
    } catch {
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

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const captureAndAnalyze = async () => {
    if (!stream || !videoRef.current) { alert('Please start camera first.'); return; }
    if (!modelReady) { alert('AI models are still loading. Please wait a moment.'); return; }

    const video  = videoRef.current;
    const canvas = captureCanvasRef.current;

    setAnalyzing(true);
    setNoFaceError(false);
    setStatus({ type: 'analyzing', text: 'AI analyzing your face...' });

    // Animate steps
    for (let i = 1; i <= 4; i++) { setStep(i); await sleep(650); }

    try {
      const aiResult = await analyzeWithAI(video, canvas);

      if (!aiResult.faceDetected) {
        setNoFaceError(true);
        setStatus({ type: 'error', text: 'No face detected — try better lighting' });
        setAnalyzing(false);
        setStep(0);
        return;
      }

      const recommendations = buildRecommendations(
        aiResult.emotion.dominant,
        aiResult.brightnessScore,
        aiResult.skinConditions
      );

      const recordPayload = {
        brightnessScore: aiResult.brightnessScore,
        emotion:         aiResult.emotion,
        skinConditions:  aiResult.skinConditions,
        age:             aiResult.age,
        gender:          aiResult.gender,
        genderProbability: aiResult.genderProbability,
        recommendations: recommendations.map(cat => ({
          category: cat.title,
          items: cat.items.map(i => ({ text: i, done: false })),
        })),
      };

      if (user) {
        try {
          const res = await axios.post('/records', { ...recordPayload, userId: user._id, date: new Date().toISOString().split('T')[0], timestamp: Date.now() });
          onRecordSaved(res.data);
          setResult(res.data);
          setStatus({ type: 'active', text: 'Analysis complete!' });
          const toast = document.getElementById('toast');
          if (toast) { toast.textContent = "Today's check-in saved! ✅"; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
        } catch (err) {
          console.error(err);
          setResult(recordPayload);
          setStatus({ type: 'active', text: 'Analysis complete (save failed)' });
        }
      } else {
        setResult(recordPayload);
        setStatus({ type: 'active', text: 'Analysis complete!' });
        const toast = document.getElementById('toast');
        if (toast) { toast.textContent = 'Log in to save this result to your journal! 🔒'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 4000); }
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      setStatus({ type: 'error', text: 'Analysis failed. Please try again.' });
    }

    setAnalyzing(false);
    setStep(0);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  return (
    <main className="main-container">
      <section className="camera-section glass-card">
        <div className="camera-header">
          <h1 className="section-title">📷 Live Face Analysis</h1>
          <p className="section-subtitle">
            {modelLoading
              ? '🧠 Loading AI neural network models...'
              : 'AI-powered emotion & skin analysis — real ML, no guesswork'}
          </p>
          {result && user  && <div className="checkin-badge">✅ Today's check-in saved!</div>}
          {result && !user && <div className="checkin-badge" style={{ color:'var(--warning)', borderColor:'var(--warning)', background:'rgba(250,204,21,0.1)' }}>🔒 Log in to save to your journal</div>}
        </div>

        {/* AI Model loading banner */}
        {modelLoading && (
          <div className="ai-model-banner">
            <div className="ai-spinner-small"></div>
            <span>Loading TensorFlow.js emotion detection model…</span>
          </div>
        )}

        {!modelLoading && modelReady && (
          <div className="ai-model-banner ai-model-ready">
            <span>⚡</span>
            <span>AI Model Ready — face-api.js (TensorFlow.js)</span>
          </div>
        )}

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
            <button className="btn btn-primary" onClick={startCamera} disabled={!!stream || modelLoading}>
              <span className="btn-icon">🎥</span><span>Start Camera</span>
            </button>
            <button className="btn btn-secondary" onClick={captureAndAnalyze} disabled={!stream || analyzing || !modelReady}>
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

          {noFaceError && (
            <div className="no-face-warning">
              😕 No face detected. Make sure your face is clearly visible, well-lit, and centered.
            </div>
          )}
        </div>
      </section>

      {analyzing && (
        <div className="analyzing-overlay">
          <div className="analyzing-content">
            <div className="ai-spinner"></div>
            <p className="analyzing-text">AI analyzing your face…</p>
            <div className="analyzing-steps">
              <div className={`step ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}>🎭 Detecting face landmarks…</div>
              <div className={`step ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}>🧠 Running emotion neural network…</div>
              <div className={`step ${step >= 3 ? (step > 3 ? 'done' : 'active') : ''}`}>✨ Analyzing skin brightness…</div>
              <div className={`step ${step >= 4 ? (step > 4 ? 'done' : 'active') : ''}`}>💾 Building recommendations…</div>
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
