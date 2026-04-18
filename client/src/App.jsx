import React, { useState } from 'react';
import StatusBar from './components/StatusBar';
import NavigationMap from './components/NavigationMap';
import VoiceButton from './components/VoiceButton';
import ObstacleAlert from './components/ObstacleAlert';

function App() {
  // Local state to test the UI before the hooks are finished
  const [isListening, setIsListening] = useState(false);
  const [hasObstacle, setHasObstacle] = useState(false);
  const [destination, setDestination] = useState("None");
  const [steps, setSteps] = useState([]);

  const toggleMic = () => {
    setIsListening(!isListening);
    // Mocking a response for the demo
    if (!isListening) {
      setDestination("Kitchen");
      setSteps(["Walk 5 steps forward", "Turn right at the couch"]);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between p-4 pb-12 font-sans">
      
      {/* Top Section: System Stats */}
      <StatusBar 
        connectionStatus="online" 
        batteryLevel={92} 
        hardwareConnected={true} 
      />

      {/* Middle Section: Route Guidance */}
      <main className="flex-1 flex flex-col items-center justify-center w-full space-y-8">
        <NavigationMap 
          currentDestination={destination} 
          steps={steps} 
        />
        
        {/* The Big Interaction Hub */}
        <VoiceButton 
          isListening={isListening} 
          onClick={toggleMic} 
        />
      </main>

      {/* Emergency Overlay (Triggered by hardware/vision) */}
      <ObstacleAlert 
        isPresent={hasObstacle} 
        distance={45} 
      />

      {/* Secret Debug Button (for your demo tomorrow) */}
      <button 
        className="opacity-10 absolute bottom-2 right-2 text-xs"
        onClick={() => setHasObstacle(!hasObstacle)}
      >
        Toggle Alert
      </button>
      
    </div>
  );
}

export default App;