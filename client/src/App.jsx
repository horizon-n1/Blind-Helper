import { useEffect, useState, useRef, useCallback } from 'react';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useCamera from './hooks/useCamera';
import { getNavigation, navigateToRoom, checkProgress } from './services/llmService';
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

const LAYOUTS_KEY = 'blindnav_layouts';

const saveLayout = (buildingName, data) => {
  const layouts = JSON.parse(localStorage.getItem(LAYOUTS_KEY) || '{}');
  layouts[buildingName] = { ...data, savedAt: Date.now() };
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
};

const loadLayouts = () => {
  return JSON.parse(localStorage.getItem(LAYOUTS_KEY) || '{}');
};

function App() {
  const [stage, setStage] = useState(STAGE.IDLE);
  const [status, setStatus] = useState('Upload a video or load a saved location');
  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [destination, setDestination] = useState('');
  const [reply, setReply] = useState('');
  const [obstacle, setObstacle] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState(loadLayouts());
  const [currentPath, setCurrentPath] = useState(null);
  const [pathStepIndex, setPathStepIndex] = useState(0);

  const isSpeakingRef = useRef(false);
  const lastInstructionRef = useRef('');
  const handledTranscriptRef = useRef('');
  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Refs so camera callback always has latest values
  const stageRef = useRef(stage);
  const roomsRef = useRef(rooms);
  const summaryRef = useRef(summary);
  const destinationRef = useRef(destination);
  const currentPathRef = useRef(currentPath);
  const pathStepIndexRef = useRef(pathStepIndex);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);
  useEffect(() => { pathStepIndexRef.current = pathStepIndex; }, [pathStepIndex]);

  // ── Progress check loop ───────────────────────────
  useEffect(() => {
    if (stage === STAGE.GUIDING && currentPath) {
      progressIntervalRef.current = setInterval(async () => {
        if (isSpeakingRef.current) return;
        try {
          const { captureFrame } = useCamera;
          // progress check uses latest captured frame via ref below
        } catch (err) {
          console.error('Progress check error:', err);
        }
      }, 15000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [stage, currentPath]);

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

      // Advance path step index on non-obstacle instructions
      if (!hasObstacle && currentPathRef.current) {
        setPathStepIndex(i => Math.min(i + 1, currentPathRef.current.length - 1));
      }

      const safetyTimeout = setTimeout(() => {
        isSpeakingRef.current = false;
      }, 8000);

      await speakText(instruction);
      clearTimeout(safetyTimeout);
      isSpeakingRef.current = false;

      if (arrived) {
        setStage(STAGE.ROOM_LIST);
        setDestination('');
        setCurrentPath(null);
        setPathStepIndex(0);
        lastInstructionRef.current = '';
        setStatus('You have arrived! Say another room to navigate there.');
      }

    } catch (err) {
      console.error('Guidance frame error:', err);
      isSpeakingRef.current = false;
    }
  }, []);

  // ── Camera hook ───────────────────────────────────
  const { videoRef, captureFrame } = useCamera(
    handleCameraFrame,
    stage === STAGE.GUIDING,
    destination
  );

  // ── Progress check using captureFrame ────────────
  useEffect(() => {
    if (stage !== STAGE.GUIDING || !currentPath) return;

    const interval = setInterval(async () => {
      if (isSpeakingRef.current) return;
      const frame = captureFrame();
      if (!frame) return;

      try {
        const { offTrack, correction } = await checkProgress(
          frame,
          destinationRef.current,
          currentPathRef.current,
          pathStepIndexRef.current,
          summaryRef.current
        );

        if (offTrack && correction) {
          isSpeakingRef.current = true;
          setReply(correction);
          lastInstructionRef.current = correction;

          const safetyTimeout = setTimeout(() => {
            isSpeakingRef.current = false;
          }, 8000);

          await speakText(correction);
          clearTimeout(safetyTimeout);
          isSpeakingRef.current = false;
        }
      } catch (err) {
        console.error('Progress check error:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [stage, currentPath, captureFrame]);

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
      setWaypoints(data.waypoints || []);
      setStage(STAGE.ROOM_LIST);

      // Prompt to save layout
      const buildingName = window.prompt('Name this location for future use (e.g. Home, Office):');
      if (buildingName?.trim()) {
        saveLayout(buildingName.trim(), data);
        setSavedLayouts(loadLayouts());
      }

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

  // ── Load saved layout ─────────────────────────────
  const handleLoadLayout = async (name) => {
    const data = loadLayouts()[name];
    if (!data) return;

    setRooms(data.rooms);
    setSummary(data.summary);
    setWaypoints(data.waypoints || []);
    setStage(STAGE.ROOM_LIST);

    const spoken = `Loaded ${name}. I found: ${data.rooms.join(', ')}. Where would you like to go?`;
    setStatus('Where would you like to go?');
    setReply(spoken);
    await speakText(spoken);
  };

  // ── Handle voice input ────────────────────────────
  useEffect(() => {
    if (!transcript) return;
    if (transcript === handledTranscriptRef.current) return;
    handledTranscriptRef.current = transcript;

    if (stage === STAGE.ROOM_LIST) {
      const handleDestination = async () => {
        try {
          setDestination(transcript);
          setStage(STAGE.NAVIGATING);
          setStatus(`Getting directions to ${transcript}...`);

          const data = await navigateToRoom(transcript, rooms, summary, waypoints);
          setReply(data.directions);
          if (data.path) {
            setCurrentPath(data.path);
            setPathStepIndex(0);
          }

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
            setCurrentPath(null);
            setPathStepIndex(0);

            const data = await navigateToRoom(matchedRoom, rooms, summary, waypoints);
            setReply(data.directions);
            if (data.path) {
              setCurrentPath(data.path);
              setPathStepIndex(0);
            }

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

  // ── Reset ─────────────────────────────────────────
  const handleReset = () => {
    setStage(STAGE.IDLE);
    setRooms([]);
    setSummary('');
    setWaypoints([]);
    setDestination('');
    setReply('');
    setCurrentPath(null);
    setPathStepIndex(0);
    lastInstructionRef.current = '';
    handledTranscriptRef.current = '';
    isSpeakingRef.current = false;
    setStatus('Upload a video or load a saved location');
  };

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
        <>
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

          {Object.keys(savedLayouts).length > 0 && (
            <div className="saved-layouts">
              <p className="room-list-label">Saved locations:</p>
              {Object.entries(savedLayouts).map(([name]) => (
                <button
                  key={name}
                  className="room-chip"
                  onClick={() => handleLoadLayout(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </>
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

          <button className="reset-btn" onClick={handleReset}>
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