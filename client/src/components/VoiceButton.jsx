import React from 'react';

const VoiceButton = ({ isListening, onClick }) => {
  return (
    <div className="voice-button-container">
      <div className={`ripple ${isListening ? 'listening' : ''}`}></div>
      <button 
        className={`voice-btn ${isListening ? 'listening' : ''}`} 
        onClick={onClick}
        aria-label={isListening ? "Listening..." : "Tap to Speak"}
      >
        <span className="material-icons" style={{ fontSize: '48px' }}>
          {isListening ? 'mic' : 'mic_none'}
        </span>
      </button>
    </div>
  );
};

export default VoiceButton;
