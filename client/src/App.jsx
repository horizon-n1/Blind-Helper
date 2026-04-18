import { useEffect, useState, useRef, useCallback } from 'react';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useCamera from './hooks/useCamera';
import { getNavigation, navigateToRoom } from './services/llmService';
import { scanVideo, getGuidanceStep } from './services/visionService';
import { speakText } from './services/elevenLabsService';
import VoiceButton from './components/VoiceButton';
import StatusBar from './components/StatusBar';
import ObstacleAlert from './components/ObstacleAlert';
import './App.css';

const STAGE = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  ROOM_LIST: 'room_list',
  NAVIGATING: 'navigating',
  GUIDING: 'guiding',
};

function App() {
  const [stage, setStage] = useState(STAGE.IDLE);
  const [status, setStatus] = useState('Upload a video of your space to begin');
  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState('');
  const [destination, setDestination] = useState('');
  const [reply, setReply] = useState('');
  const [obstacle, setObstacle] = useState(false);

  const isSpeakingRef = useRef(false);
  const lastInstructionRef = useRef('');
  const handledTranscriptRef = useRef('');  // ← prevents double-firing
  const fileInputRef = useRef(null);

  // Refs so camera callback always has latest values
  const stageRef = useRef(stage);
  const roomsRef = useRef(rooms);
  const summaryRef = useRef(summary);
  const destinationRef = useRef(destination);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);

  // ── Camera frame handler ──────────────────────────
  const handleCameraFrame = useCallback(async (base64Image) => {
    if (isSpeakingRef.current) return;
    if (stageRef.current !== STAGE.GUIDING) return;

    try {
      isSpeakingRef.current = true;

      const { instruction, arrived, obstacle: hasObstacle } = await getGuidanceStep(
        base64Image,
        destinationRef.current,
        roomsRef.current,
        summaryRef.current,
        lastInstructionRef.current
      );

      if (instruction === lastInstructionRef.current) {
        isSpeakingRef.current = false;
        return;
      }

      lastInstructionRef.current = instruction;
      setReply(instruction);

      if (hasObstacle) {
        setObstacle(true);
        setTimeout(() => setObstacle(false), 4000);
      }

      // Set a safety timeout — if ElevenLabs takes more than 8 seconds, unlock
      const safetyTimeout = setTimeout(() => {
        isSpeakingRef.current = false;
      }, 8000);

      await speakText(instruction);
      clearTimeout(safetyTimeout);
      isSpeakingRef.current = false;

      if (arrived) {
        setStage(STAGE.ROOM_LIST);
        setDestination('');
        lastInstructionRef.current = '';
        setStatus('You have arrived! Say another room to navigate there.');
      }

    } catch (err) {
      console.error('Guidance frame error:', err);
      isSpeakingRef.current = false; // always unlock on error
    }
  }, []);

  // ── Camera hook ───────────────────────────────────
  const { videoRef } = useCamera(
    handleCameraFrame,
    stage === STAGE.GUIDING,
    destination
  );

  const { transcript, isListening, error, startListening } = useSpeechRecognition();

  // ── Handle video upload ───────────────────────────
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setStage(STAGE.SCANNING);
      setStatus('Analyzing your space... this may take 30 seconds');
      setReply('');

      const data = await scanVideo(file);
      setRooms(data.rooms);
      setSummary(data.summary);
      setStage(STAGE.ROOM_LIST);

      const roomList = data.rooms.join(', ');
      const spoken = `I found the following areas: ${roomList}. Where would you like to go? Press the microphone and say the room name.`;
      setStatus('Where would you like to go?');
      setReply(spoken);

      await speakText(spoken);

    } catch (err) {
      console.error(err);
      setStatus('Scan failed — try again');
      setStage(STAGE.IDLE);
    }
  };

  // ── Handle voice input ────────────────────────────
  useEffect(() => {
    if (!transcript) return;
    if (transcript === handledTranscriptRef.current) return; // already handled
    handledTranscriptRef.current = transcript;

    // Waiting for destination after room scan
    if (stage === STAGE.ROOM_LIST) {
      const handleDestination = async () => {
        try {
          setDestination(transcript);
          setStage(STAGE.NAVIGATING);
          setStatus(`Getting directions to ${transcript}...`);

          const data = await navigateToRoom(transcript, rooms, summary);
          setReply(data.directions);

          setStatus(`Navigating to ${transcript}`);
          await speakText(data.directions);

          setStage(STAGE.GUIDING);
          setStatus(`Guiding you to ${transcript}...`);

        } catch (err) {
          console.error(err);
          setStatus('Navigation failed — try again');
          setStage(STAGE.ROOM_LIST);
        }
      };

      handleDestination();
      return;
    }

    // While guiding — allow user to change destination
    if (stage === STAGE.GUIDING) {
      const lowerTranscript = transcript.toLowerCase();
      const matchedRoom = rooms.find(room =>
        lowerTranscript.includes(room.toLowerCase())
      );

      if (matchedRoom) {
        const handleNewDestination = async () => {
          try {
            setDestination(matchedRoom);
            setStage(STAGE.NAVIGATING);
            setStatus(`Rerouting to ${matchedRoom}...`);
            lastInstructionRef.current = '';
            isSpeakingRef.current = false;

            const data = await navigateToRoom(matchedRoom, rooms, summary);
            setReply(data.directions);

            setStatus(`Navigating to ${matchedRoom}`);
            await speakText(data.directions);

            setStage(STAGE.GUIDING);
            setStatus(`Guiding you to ${matchedRoom}...`);
          } catch (err) {
            console.error(err);
            setStatus('Reroute failed — try again');
            setStage(STAGE.GUIDING);
          }
        };

        handleNewDestination();
        return;
      }
    }

    // Default — only when IDLE
    if (stage === STAGE.IDLE) {
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
    }

  }, [transcript]);

  // ── Spacebar shortcut ─────────────────────────────
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

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-feed"
        style={{ display: stage === STAGE.GUIDING ? 'block' : 'none' }}
      />

      {obstacle && <ObstacleAlert />}

      <div className="header">
        <h1>BlindNav</h1>
        <p>AI-Powered Spatial Intelligence</p>
      </div>

      <StatusBar status={isListening ? 'Listening...' : status} />

      {stage === STAGE.IDLE && (
        <div className="upload-area" onClick={() => fileInputRef.current.click()}>
          <div className="upload-icon">🎥</div>
          <p className="upload-label">Tap to upload a video of your space</p>
          <p className="upload-sub">MP4, MOV, or WebM</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {stage === STAGE.SCANNING && (
        <div className="scanning-area">
          <div className="scan-spinner" />
          <p className="upload-label">Analyzing your space...</p>
        </div>
      )}

      {(stage === STAGE.ROOM_LIST || stage === STAGE.NAVIGATING || stage === STAGE.GUIDING) && (
        <div className="room-list">
          <p className="room-list-label">Rooms found:</p>
          {rooms.map((room, i) => (
            <div
              key={i}
              className={`room-chip ${destination === room ? 'active' : ''}`}
            >
              {room}
            </div>
          ))}

          {stage === STAGE.GUIDING && (
            <div className="guiding-indicator">
              <div className="guiding-dot" />
              <span>Live guidance active</span>
            </div>
          )}

          <button className="reset-btn" onClick={() => {
            setStage(STAGE.IDLE);
            setRooms([]);
            setSummary('');
            setDestination('');
            setReply('');
            lastInstructionRef.current = '';
            handledTranscriptRef.current = '';
            isSpeakingRef.current = false;
            setStatus('Upload a video of your space to begin');
          }}>
            Upload New Video
          </button>
        </div>
      )}

      <VoiceButton isListening={isListening} onClick={startListening} />

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
          <div>{reply || 'Upload a video to get started.'}</div>
        )}
      </div>

      {error && <div className="error-text">Connection Error: {error}</div>}
    </div>
  );
}

export default App;