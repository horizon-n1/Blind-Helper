import { useEffect, useState, useRef, useCallback } from 'react';
import { saveLayout, loadLayouts, enrichLayout } from './services/layoutService';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useCamera from './hooks/useCamera';
import { getNavigation, navigateToRoom, checkProgress } from './services/llmService';
import { scanVideo, getGuidanceStep } from './services/visionService';
import { speakText } from './services/elevenLabsService';
import VoiceButton from './components/VoiceButton';
import StatusBar from './components/StatusBar';
import ObstacleAlert from './components/ObstacleAlert';
import useBuzzerDetector from './hooks/useBuzzerDetector';
import Demo from './pages/Demo';
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
  const [status, setStatus] = useState('Upload a video or load a saved location');
  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [destination, setDestination] = useState('');
  const [reply, setReply] = useState('');
  const [obstacle, setObstacle] = useState(false);
  const [obstacleSource, setObstacleSource] = useState('sensor');
  const [savedLayouts, setSavedLayouts] = useState(loadLayouts());
  const [waypointIndex, setWaypointIndex] = useState(0);
  const [currentPath, setCurrentPath] = useState(null);
  const [stepsSinceLastWaypoint, setStepsSinceLastWaypoint] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);


  const isSpeakingRef = useRef(false);
  const lastInstructionRef = useRef('');
  const handledTranscriptRef = useRef('');
  const fileInputRef = useRef(null);
  const stageRef = useRef(stage);
  const roomsRef = useRef(rooms);
  const summaryRef = useRef(summary);
  const destinationRef = useRef(destination);
  const currentPathRef = useRef(currentPath);
  const waypointIndexRef = useRef(0);
  const stepsSinceLastWaypointRef = useRef(0);
  const waypointsRef = useRef(waypoints);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);
  useEffect(() => { waypointIndexRef.current = waypointIndex; }, [waypointIndex]);
  useEffect(() => { stepsSinceLastWaypointRef.current = stepsSinceLastWaypoint; }, [stepsSinceLastWaypoint]);
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);

  const getCurrentWaypoint = useCallback(() =>
    currentPathRef.current?.[waypointIndexRef.current] ?? null, []);

  const getNextWaypoint = useCallback(() =>
    currentPathRef.current?.[waypointIndexRef.current + 1] ?? null, []);

  const advanceWaypoint = useCallback(() => {
    setWaypointIndex(i => {
      const path = currentPathRef.current;
      if (!path) return i;
      const next = Math.min(i + 1, path.length - 1);
      console.log(`[nav] waypoint ${i} → ${next} of ${path.length - 1}`);
      return next;
    });
    setStepsSinceLastWaypoint(0);
    stepsSinceLastWaypointRef.current = 0;
  }, []);

  const resetNavState = useCallback(() => {
    setCurrentPath(null);
    setWaypointIndex(0);
    setStepsSinceLastWaypoint(0);
    stepsSinceLastWaypointRef.current = 0;
    lastInstructionRef.current = '';
    isSpeakingRef.current = false;
  }, []);

  // ── Buzzer detection handler ──────────────────────────
  const handleBuzzerDetected = useCallback(async () => {
    // Don't interrupt if already speaking
    if (isSpeakingRef.current) return;

    console.log('[buzzer] Hardware obstacle detected!');

    // Flash the obstacle alert
    setObstacle(true);
    setObstacleSource('sensor');
    setTimeout(() => setObstacle(false), 4000);

    // Speak the warning
    isSpeakingRef.current = true;
    const warning = 'Stop. Obstacle detected by sensor.';
    setReply(warning);
    lastInstructionRef.current = warning;

    const safetyTimeout = setTimeout(() => {
      isSpeakingRef.current = false;
    }, 8000);

    await speakText(warning);
    clearTimeout(safetyTimeout);
    isSpeakingRef.current = false;
  }, []);

  // ── Buzzer detector hook ──────────────────────────────
  // Active whenever the app is open — hardware safety layer
  // runs independently of navigation stage
  useBuzzerDetector(handleBuzzerDetected, true);

  const handleCameraFrame = useCallback(async (base64Image) => {
    if (isSpeakingRef.current) return;
    if (stageRef.current !== STAGE.GUIDING) return;

    try {
      isSpeakingRef.current = true;

      const {
        instruction,
        arrived,
        arrivedAtWaypoint,
        obstacle: hasObstacle,
        _debug,
      } = await getGuidanceStep(
        base64Image,
        destinationRef.current,
        roomsRef.current,
        summaryRef.current,
        lastInstructionRef.current,
        getCurrentWaypoint(),
        getNextWaypoint(),
        waypointIndexRef.current,
        stepsSinceLastWaypointRef.current,
      );

      if (_debug) {
        console.log(
          `[guide] action=${_debug.action} conf=${_debug.confidence} ` +
          `steps=${_debug.stepsSinceLastWaypoint}/${_debug.expectedSteps} ` +
          `plausible=${_debug.stepCountPlausible} gate=${_debug.gatePassed}`
        );
      }

      if (instruction === lastInstructionRef.current) {
        isSpeakingRef.current = false;
        return;
      }

      lastInstructionRef.current = instruction;
      setReply(instruction);

      if (hasObstacle) {
        setObstacle(true);
        setObstacleSource('camera');
        setTimeout(() => setObstacle(false), 4000);
      }

      if (arrivedAtWaypoint) {
        advanceWaypoint();
      } else if (!hasObstacle && !arrived) {
        setStepsSinceLastWaypoint(n => n + 1);
        stepsSinceLastWaypointRef.current += 1;
      }

      if (currentPathRef.current) {
        const total = currentPathRef.current.length;
        const current = waypointIndexRef.current + 1;
        setStatus(`Step ${current} of ${total} → ${destinationRef.current}`);
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
        resetNavState();
        setStatus('You have arrived! Say another room to navigate there.');
      }

    } catch (err) {
      console.error('Guidance frame error:', err);
      isSpeakingRef.current = false;
    }
  }, [getCurrentWaypoint, getNextWaypoint, advanceWaypoint, resetNavState]);

  const { videoRef, captureFrame } = useCamera(
    handleCameraFrame,
    stage === STAGE.GUIDING,
    destination
  );

  const { transcript, isListening, error, startListening } = useSpeechRecognition();

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
          waypointIndexRef.current,
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

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setStage(STAGE.SCANNING);
      setStatus('Analyzing your space... this may take 30 seconds');
      setReply('');

      const baseData = await scanVideo(file);

      setStatus('Adding sensory details...');
      const enrichedData = await enrichLayout(baseData);

      setRooms(enrichedData.rooms);
      setSummary(enrichedData.summary);
      setWaypoints(enrichedData.waypoints || []);
      setStage(STAGE.ROOM_LIST);

      const buildingName = window.prompt('Name this location (e.g. Home, Office):');
      if (buildingName?.trim()) {
        saveLayout(buildingName.trim(), enrichedData);
        setSavedLayouts(loadLayouts());
      }

      const spoken = `I found the following areas: ${enrichedData.rooms.join(', ')}. Where would you like to go?`;
      setStatus('Where would you like to go?');
      setReply(spoken);
      await speakText(spoken);

    } catch (err) {
      console.error(err);
      setStatus('Scan failed — try again');
      setStage(STAGE.IDLE);
    }
  };

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

  const startNavigation = useCallback(async (dest) => {
    try {
      setDestination(dest);
      setStage(STAGE.NAVIGATING);
      setStatus(`Getting directions to ${dest}...`);
      resetNavState();

      const data = await navigateToRoom(
        dest,
        roomsRef.current,
        summaryRef.current,
        waypointsRef.current
      );

      setReply(data.directions);

      if (data.path?.length) {
        setCurrentPath(data.path);
        currentPathRef.current = data.path;
        setWaypointIndex(0);
        waypointIndexRef.current = 0;
        setStepsSinceLastWaypoint(0);
        stepsSinceLastWaypointRef.current = 0;
      }

      setStatus(`Step 1 of ${data.totalSteps ?? '?'} → ${dest}`);
      await speakText(data.directions);
      setStage(STAGE.GUIDING);

    } catch (err) {
      console.error(err);
      setStatus('Navigation failed — try again');
      setStage(STAGE.ROOM_LIST);
    }
  }, [resetNavState]);

  useEffect(() => {
    if (!transcript) return;
    if (transcript === handledTranscriptRef.current) return;
    handledTranscriptRef.current = transcript;

    if (stage === STAGE.ROOM_LIST) {
      startNavigation(transcript);
      return;
    }

    if (stage === STAGE.GUIDING) {
      const lower = transcript.toLowerCase();
      const matched = rooms.find(r => lower.includes(r.toLowerCase()));
      if (matched) {
        startNavigation(matched);
        return;
      }
    }

    if (stage === STAGE.IDLE) {
      const handleSpeech = async () => {
        try {
          setStatus('Thinking...');
          const data = await getNavigation(transcript);
          setReply(data.reply);
          await speakText(data.reply);
          setStatus('Ready to guide');
        } catch (err) {
          console.error(err);
          setStatus('Error — please try again');
        }
      };
      handleSpeech();
    }
  }, [transcript, stage, rooms, startNavigation]);

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

  const handleReset = () => {
    setStage(STAGE.IDLE);
    setRooms([]);
    setSummary('');
    setWaypoints([]);
    setDestination('');
    setReply('');
    resetNavState();
    handledTranscriptRef.current = '';
    setStatus('Upload a video or load a saved location');
  };

  const totalSteps = currentPath?.length ?? 0;
  const currentStepDisplay = totalSteps > 0 ? waypointIndex + 1 : null;

  if (isDemoMode) {
    return <Demo onExit={() => setIsDemoMode(false)} />;
  }


  return (
    <div className="app-container">
      <button
        onClick={() => setIsDemoMode(true)}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          background: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          color: 'var(--text-primary)',
          borderRadius: '8px',
          padding: '0.4rem 0.8rem',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: '600',
          zIndex: 10,
        }}
      >
        Demo
      </button>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-feed"
        style={{ display: stage === STAGE.GUIDING ? 'block' : 'none' }}
      />

      {obstacle && <ObstacleAlert source={obstacleSource} />}

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
            <div key={i} className={`room-chip ${destination === room ? 'active' : ''}`}>
              {room}
            </div>
          ))}

          {stage === STAGE.GUIDING && (
            <div className="guiding-indicator">
              <div className="guiding-dot" />
              <span>
                {currentStepDisplay && totalSteps > 0
                  ? `Step ${currentStepDisplay} of ${totalSteps}`
                  : 'Live guidance active'}
              </span>
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