import React from 'react';
import { Mic, MicOff } from 'lucide-react';

const VoiceButton = ({ isListening, onClick }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <button
        onClick={onClick}
        className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 ${
          isListening 
            ? 'bg-red-500 animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.7)]' 
            : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
        }`}
      >
        {isListening ? (
          <Mic size={64} className="text-white" />
        ) : (
          <MicOff size={64} className="text-white" />
        )}
      </button>
      <p className="text-2xl font-bold uppercase tracking-widest text-white">
        {isListening ? "Listening..." : "Tap to Speak"}
      </p>
    </div>
  );
};

export default VoiceButton;
