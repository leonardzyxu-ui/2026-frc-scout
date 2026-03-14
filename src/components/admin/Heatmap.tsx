import React from 'react';

interface HeatmapProps {
  positions: { x: number | null; y: number | null }[];
}

export default function Heatmap({ positions }: HeatmapProps) {
  return (
    <div className="relative w-full border-2 border-white/20 rounded-xl overflow-hidden bg-slate-900">
      <img 
        src="field.png" 
        alt="Field Map"
        className="w-full h-auto opacity-80"
      />

      {/* Heatmap Markers */}
      {positions.map((pos, idx) => {
        if (!pos || pos.x === null || pos.y === null || pos.x === undefined || pos.y === undefined) return null;
        return (
          <div 
            key={idx}
            className="absolute w-6 h-6 bg-yellow-400/60 rounded-full blur-[2px] pointer-events-none"
            style={{ 
              left: `${pos.x}%`, 
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      })}
    </div>
  );
}
