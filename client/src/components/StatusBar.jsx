import React from 'react';

const StatusBar = ({ status }) => {
  let dotClass = '';
  if (status.toLowerCase().includes('listen')) dotClass = 'listening';
  else if (status.toLowerCase().includes('think')) dotClass = 'thinking';
  else if (status.toLowerCase().includes('speak')) dotClass = 'speaking';
  else if (status.toLowerCase().includes('scan')) dotClass = 'scanning';
  else if (status.toLowerCase().includes('guid')) dotClass = 'listening';
  else if (status.toLowerCase().includes('navigat')) dotClass = 'thinking';

  return (
    <div className="status-bar">
      <div className={`status-dot ${dotClass}`}></div>
      <span className="status-text">{status}</span>
    </div>
  );
};

export default StatusBar;