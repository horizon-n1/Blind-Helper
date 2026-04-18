import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ObstacleAlert = ({ isPresent, distance }) => {
  if (!isPresent) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-600 animate-fade-in">
      <AlertTriangle size={120} className="text-white animate-bounce" />
      <h1 className="text-6xl font-black text-white mt-8">STOP</h1>
      <p className="text-2xl text-white font-bold mt-4 uppercase tracking-wider">
        Obstacle {distance}cm Ahead
      </p>
      
      {/* Visual haptic simulation for the screen */}
      <div className="absolute inset-0 border-[20px] border-white animate-ping pointer-events-none opacity-20"></div>
    </div>
  );
};

export default ObstacleAlert;
