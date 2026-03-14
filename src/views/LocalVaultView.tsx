import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalFile } from '../context/LocalFileContext';
import { QRCodeSVG } from 'qrcode.react';

export default function LocalVaultView() {
  const navigate = useNavigate();
  const { fileHandle } = useLocalFile();
  const [records, setRecords] = useState<string[]>([]);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);

  useEffect(() => {
    const loadFile = async () => {
      if (!fileHandle) return;
      try {
        const file = await fileHandle.getFile();
        const content = await file.text();
        if (content.trim()) {
          const arr = JSON.parse(content);
          if (Array.isArray(arr)) {
            setRecords(arr);
          }
        }
      } catch (e) {
        console.error("Failed to load local vault:", e);
      }
    };
    loadFile();
  }, [fileHandle]);

  if (!fileHandle) {
    return (
      <div className="flex flex-col p-6 h-full items-center justify-center text-center">
        <h2 className="text-3xl font-black text-white mb-4">LOCAL VAULT</h2>
        <p className="text-gray-400 mb-8">No output file selected. Please go back to Setup and open or create a JSON file.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-blue-600 rounded-2xl font-bold text-white"
        >
          Back to Setup
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="p-6 pb-2 shrink-0">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-black text-white tracking-tighter">LOCAL VAULT</h2>
          <span className="text-xs font-mono text-yellow-400 bg-yellow-900/30 px-3 py-1 rounded-full border border-yellow-500/30">
            {records.length} RECORDS
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-3">
        {records.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 font-bold">No records found in this file.</div>
        ) : (
          records.map((qrString, idx) => {
            const parts = qrString.split('|');
            const match = parts[1] || '?';
            const team = parts[2] || '?';
            const alliance = parts[3] === 'R' ? 'Red' : parts[3] === 'B' ? 'Blue' : '?';
            
            return (
              <div 
                key={idx}
                onClick={() => setSelectedQR(qrString)}
                className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/10 p-4 flex justify-between items-center active:scale-95 transition-transform cursor-pointer"
              >
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Match {match}</div>
                  <div className={`text-2xl font-black ${alliance === 'Red' ? 'text-red-400' : 'text-blue-400'}`}>
                    Team {team}
                  </div>
                </div>
                <div className="text-4xl">📱</div>
              </div>
            );
          })
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pointer-events-none flex justify-center">
        <button 
          onClick={() => navigate('/')}
          className="w-full max-w-md py-4 bg-slate-800 rounded-2xl font-bold text-lg text-white border border-white/10 pointer-events-auto active:scale-95 transition-transform"
        >
          BACK TO SETUP
        </button>
      </div>

      {selectedQR && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-3xl font-black text-white mb-6">SCAN QR CODE</h2>
          
          <div className="bg-white p-6 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.2)] mb-8">
            <QRCodeSVG value={selectedQR} size={300} level="L" />
          </div>
          
          <button 
            onClick={() => setSelectedQR(null)} 
            className="w-full max-w-md py-5 bg-slate-800 border border-white/20 rounded-2xl font-black text-xl text-white active:scale-95 transition-transform"
          >
            CLOSE
          </button>
        </div>
      )}
    </div>
  );
}
