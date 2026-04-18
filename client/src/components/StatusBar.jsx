import React from 'react';

const StatusBar = ({ status }) => {
  // Determine the dot style based on status
  let dotClass = '';
  if (status.toLowerCase().includes('listen')) dotClass = 'listening';
  else if (status.toLowerCase().includes('think')) dotClass = 'thinking';
  else if (status.toLowerCase().includes('speak')) dotClass = 'speaking';

  return (
    <div className="status-bar">
      <div className={`status-dot ${dotClass}`}></div>
      <span className="status-text">{status}</span>
    </div>
  );
};

export default StatusBar;
