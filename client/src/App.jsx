import { useEffect, useState } from 'react';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import { getNavigation }    from './services/llmService';
import { speakText }        from './services/elevenLabsService';
import VoiceButton          from './components/VoiceButton';
import StatusBar            from './components/StatusBar';
import ObstacleAlert        from './components/ObstacleAlert';
import './App.css'; // Make sure to import the styling

function App() {
  const { transcript, isListening, error, startListening } = useSpeechRecognition();
  const [status, setStatus]     = useState('Ready to guide');
  const [reply, setReply]       = useState('');
  const [obstacle, setObstacle] = useState(false);

  // When the user finishes speaking, send to LLM then ElevenLabs
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

  // Optionally listen for keyboard spacebar to trigger the mic (accessibility shortcut)
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

  return (
    <div className="app-container">
      {obstacle && <ObstacleAlert />}
      
      <div className="header">
        <h1>BlindNav</h1>
        <p>AI-Powered Spatial Intelligence</p>
      </div>

      <StatusBar status={isListening ? 'Listening...' : status} />

      <VoiceButton 
        isListening={isListening} 
        onClick={startListening} 
      />

      <div className="transcript-box">
        {transcript ? (
          <div>
            <strong>You:</strong>
            {transcript}
            
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

      {error && <div className="error-text">Connection Error: {error}</div>}
    </div>
  );
}

export default App;