import { useEffect, useState } from 'react';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useCamera from './hooks/useCamera';
import { getNavigation } from './services/llmService';
import { speakText } from './services/elevenLabsService';
import { scanRoom } from './services/visionService';
import VoiceButton from './components/VoiceButton';
import StatusBar from './components/StatusBar';
import ObstacleAlert from './components/ObstacleAlert';
import './App.css';

function App() {
  const { transcript, isListening, error, startListening } = useSpeechRecognition();
  const { videoRef, captureFrame } = useCamera();
  const [status, setStatus] = useState('Ready to guide');
  const [reply, setReply] = useState('');
  const [obstacle, setObstacle] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // ── Voice navigation (unchanged) ─────────────────────
  useEffect(() => {
    if (!transcript) return;

    const handleSpeech = async () => {
      try {
        setStatus('Thinking...');
        const data = await getNavigation(transcript);
        setReply(data.reply);

        setStatus('Speaking...');
        await speakText(data.reply);

        setStatus('Ready to guide');
      } catch (err) {
        console.error(err);
        setStatus('Error — please try again');
      }
    };

    handleSpeech();
  }, [transcript]);

  // ── Spacebar shortcut (unchanged) ────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isListening) {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, startListening]);

  // ── NEW: Scan Room handler ────────────────────────────
  const handleScanRoom = async () => {
    try {
      setIsScanning(true);
      setStatus('Scanning room...');

      const base64Image = captureFrame();
      if (!base64Image) {
        setStatus('Camera not ready');
        return;
      }

      const { description } = await scanRoom(base64Image);
      setReply(description);

      setStatus('Speaking...');
      await speakText(description);
      setStatus('Ready to guide');
    } catch (err) {
      console.error(err);
      setStatus('Scan failed — try again');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="app-container">

      {/* Hidden camera stream — unchanged UI, just needs to exist in DOM */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
      />

      {obstacle && <ObstacleAlert />}

      {/* Header (unchanged) */}
      <div className="header">
        <h1>BlindNav</h1>
        <p>AI-Powered Spatial Intelligence</p>
      </div>

      {/* StatusBar (unchanged) */}
      <StatusBar status={isListening ? 'Listening...' : isScanning ? 'Scanning...' : status} />

      {/* VoiceButton (unchanged) */}
      <VoiceButton
        isListening={isListening}
        onClick={startListening}
      />

      {/* NEW: Scan Room button */}
      <button
        onClick={handleScanRoom}
        disabled={isScanning || isListening}
        className={`scan-button ${isScanning ? 'scanning' : ''}`}
      >
        {isScanning ? '🔍 Scanning...' : '📷 Scan Room'}
      </button>

      {/* Transcript box (unchanged) */}
      <div className="transcript-box">
        {transcript ? (
          <div>
            <strong>You:</strong> {transcript}
            {reply && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Guide:</strong>
                <span style={{ color: 'var(--accent-color)' }}>{reply}</span>
              </div>
            )}
          </div>
        ) : (
          <div>Tap the microphone or press Space to ask for directions.</div>
        )}
      </div>

      {/* Error (unchanged) */}
      {error && <div className="error-text">Connection Error: {error}</div>}

    </div>
  );
}

export default App;