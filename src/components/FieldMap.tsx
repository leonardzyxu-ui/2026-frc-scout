import React, { useRef } from 'react';
import { useScout } from '../context/ScoutContext';

export default function FieldMap() {
  const { matchData, updateMatchData } = useScout();
  const imgRef = useRef<HTMLImageElement>(null);

  const handleMapClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    updateMatchData({
      startPos: { 
        x: parseFloat(x.toFixed(1)), 
        y: parseFloat(y.toFixed(1)) 
      }
    });
  };

  return (
    <div className="relative w-full border-2 border-white/20 rounded-xl overflow-hidden bg-slate-900 cursor-crosshair">
      <img 
        ref={imgRef}
        onClick={handleMapClick}
        src="field.png" 
        alt="Field Map"
        className="w-full h-auto opacity-80"
      />

      {/* Start Marker */}
      {matchData.startPos.x !== null && matchData.startPos.y !== null && (
        <div 
          className="absolute w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-[0_0_10px_#facc15] pointer-events-none transition-all duration-200"
          style={{ 
            left: `${matchData.startPos.x}%`, 
            top: `${matchData.startPos.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      )}
    </div>
  );
}
