import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { decompressMatchData } from '../utils/qrCompression';
import { ArrowLeft, CheckCircle2, AlertTriangle, ScanLine } from 'lucide-react';
import { MatchScoutingV2 } from '../types';

export default function QRScannerView() {
  const navigate = useNavigate();
  const [scannedData, setScannedData] = useState<MatchScoutingV2 | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    function onScanSuccess(decodedText: string) {
      const parsed = decompressMatchData(decodedText);
      if (parsed) {
        setScannedData(parsed);
        scanner.pause(true); // Pause scanning after successful read
      } else {
        setStatus('error');
        setErrorMsg('Invalid QR Code format.');
      }
    }

    function onScanFailure(error: any) {
      // handle scan failure, usually better to ignore and keep scanning
    }

    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, []);

  const handleUpload = async () => {
    if (!scannedData) return;
    
    setStatus('idle');
    try {
      const docId = `${scannedData.matchKey}_${scannedData.teamNumber}`;
      const docRef = doc(db, 'events', scannedData.eventKey, 'matchScouting', docId);
      
      await setDoc(docRef, scannedData);
      
      setStatus('success');
      setTimeout(() => {
        setScannedData(null);
        setStatus('idle');
        // Resume scanning if possible, or force reload
        window.location.reload(); 
      }, 2000);
      
    } catch (err) {
      console.error("Error uploading scanned data:", err);
      setStatus('error');
      setErrorMsg('Failed to upload to Firestore. Check connection.');
    }
  };

  const handleCancel = () => {
    setScannedData(null);
    setStatus('idle');
    window.location.reload(); // Quick way to reset scanner state
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <ScanLine className="text-emerald-500 w-8 h-8" />
              QR SCOUT SCANNER
            </h1>
            <p className="text-slate-400 mt-1">Offline Protocol: Sync data from scout devices</p>
          </div>
        </div>

        {/* Scanner Container */}
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <div id="qr-reader" className="w-full max-w-md mx-auto overflow-hidden rounded-xl border-2 border-slate-800 bg-black"></div>
        </div>

        {/* Scanned Data Review */}
        {scannedData && (
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-black text-emerald-400 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              Payload Decoded Successfully
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Match</div>
                <div className="text-2xl font-black text-white">{scannedData.matchKey}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team</div>
                <div className="text-2xl font-black text-white">{scannedData.teamNumber}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scout</div>
                <div className="text-lg font-bold text-white">{scannedData.scoutName}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Alliance</div>
                <div className={`text-lg font-bold ${scannedData.alliance === 'Red' ? 'text-red-400' : 'text-blue-400'}`}>
                  {scannedData.alliance}
                </div>
              </div>
            </div>

            {status === 'error' && (
              <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {status === 'success' && (
              <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-900 rounded-xl flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">Data synced to Firestore!</span>
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={handleCancel}
                disabled={status === 'success'}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold tracking-wide transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button 
                onClick={handleUpload}
                disabled={status === 'success'}
                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black tracking-wide shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {status === 'success' ? 'SYNCED' : 'CONFIRM & UPLOAD ➔'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
