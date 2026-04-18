import React from 'react';
import { Wifi, Battery, Radio } from 'lucide-react';

const StatusBar = ({ connectionStatus, batteryLevel, hardwareConnected }) => {
  return (
    <div className="w-full bg-slate-900 p-4 flex justify-between items-center rounded-t-3xl border-b border-slate-800">
      <div className="flex items-center space-x-2">
        <Radio className={hardwareConnected ? "text-green-400" : "text-red-500"} size={20} />
        <span className="text-xs font-mono text-slate-300">
          {hardwareConnected ? "CANE: ACTIVE" : "CANE: DISCONNECTED"}
        </span>
      </div>
      
      <div className="flex items-center space-x-4 text-slate-300">
        <Wifi size={18} className={connectionStatus === 'online' ? "text-blue-400" : "text-slate-500"} />
        <div className="flex items-center space-x-1">
          <span className="text-xs font-mono">{batteryLevel}%</span>
          <Battery size={18} className="text-green-400" />
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
