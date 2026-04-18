import React from 'react';
import { ChevronRight, MapPin } from 'lucide-react';

const NavigationMap = ({ currentDestination, steps }) => {
  return (
    <div className="w-full max-w-md bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="bg-blue-600 p-4 flex items-center space-x-2">
        <MapPin size={20} className="text-white" />
        <h2 className="text-white font-bold">Target: {currentDestination || "None"}</h2>
      </div>
      
      <div className="p-4 space-y-4 max-h-64 overflow-y-auto">
        {steps.length > 0 ? (
          steps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3 text-slate-200">
              <ChevronRight className="text-blue-400 mt-1 shrink-0" size={18} />
              <p className={`${index === 0 ? "text-white font-bold" : "text-slate-400 line-through"}`}>
                {step}
              </p>
            </div>
          ))
        ) : (
          <p className="text-slate-500 italic text-center py-8">
            Waiting for destination...
          </p>
        )}
      </div>
    </div>
  );
};

export default NavigationMap;
