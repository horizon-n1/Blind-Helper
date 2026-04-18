import { useEffect, useState } from 'react';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import { getNavigation } from './services/llmService';
import { speakText } from './services/elevenLabsService';
import VoiceButton from './components/VoiceButton';
import StatusBar from './components/StatusBar';
import ObstacleAlert from './components/ObstacleAlert';

function App() {
  const { transcript, isListening, error, startListening } = useSpeechRecognition();
  const [status, setStatus] = useState('Ready');
  const [reply, setReply] = useState('');
  const [obstacle, setObstacle] = useState(false);

  // When the user finishes speaking, send to LLM then ElevenLabs
  useEffect(() => {
    if (!transcript) return;

    const handleSpeech = async () => {
      try {
        setStatus('Thinking...');
        const data = await getNavigation(transcript);   // → Node → OpenAI
        setReply(data.reply);

        setStatus('Speaking...');
        await speakText(data.reply);                    // → Node → ElevenLabs

        setStatus('Ready');
      } catch (err) {
        console.error(err);
        setStatus('Error — try again');
      }
    };

    handleSpeech();
  }, [transcript]);

  return (
    <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>BlindNav</h1>

      <StatusBar status={status} />

      {obstacle && <ObstacleAlert />}

      <VoiceButton isListening={isListening} onClick={startListening} />

      {transcript && <p><strong>You said:</strong> {transcript}</p>}
      {reply && <p><strong>Guide:</strong> {reply}</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}

export default App;