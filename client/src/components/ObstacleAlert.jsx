import React from 'react';

const ObstacleAlert = ({ source = 'sensor' }) => {
  return (
    <div className="obstacle-alert">
      <span>⚠️</span>
      <span>
        {source === 'sensor'
          ? 'STOP — Hardware sensor detected obstacle!'
          : 'STOP — Obstacle ahead!'}
      </span>
    </div>
  );
};

export default ObstacleAlert;