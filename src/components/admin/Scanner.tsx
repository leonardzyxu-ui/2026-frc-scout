import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { MatchData } from '../../types';

interface ScannerProps {
  onScanSuccess: () => void;
  existingMatches: MatchData[];
}

export default function Scanner({ onScanSuccess, existingMatches }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [logMsg, setLogMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [failedFiles, setFailedFiles] = useState<{file: File, url: string}[]>([]);
  
  // Keep track of newly added hashes in this session to prevent duplicate imports in the same batch
  const sessionHashes = useRef<Set<string>>(new Set());

  const hashMatch = (d: any) => {
    return `${d.match}|${d.team}|${d.scout}|${d.counters?.auto_score}|${d.counters?.teleop_fuel}|${d.toggles?.auto_tower}|${d.toggles?.auto_mobility}|${d.endgame}|${d.notes}`;
  };

  useEffect(() => {
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
      // Cleanup object URLs
      failedFiles.forEach(f => URL.revokeObjectURL(f.url));
    };
  }, [html5QrCode, failedFiles]);

  const initScanner = () => {
    if (!html5QrCode) {
      setHtml5QrCode(new Html5Qrcode("reader"));
    }
  };

  const processDecodedText = async (decodedText: string) => {
    const parts = decodedText.split('|');
    if (parts[0] !== 'V2' && parts[0] !== 'V3' && parts[0] !== 'V4' && parts[0] !== 'V5') {
      throw new Error("Invalid QR Code Format!");
    }

    let parsedNotes = "";
    if (parts[0] === 'V3' || parts[0] === 'V4' || parts[0] === 'V5') parsedNotes = parts[18] || "";

    const parsedData = {
      match: parseInt(parts[1]), 
      team: parts[2], 
      alliance: parts[3] === 'R' ? 'Red' : 'Blue',
      counters: { auto_score: parseInt(parts[4]), teleop_fuel: parseInt(parts[7]), hoard_fuel: parseInt(parts[8]) },
      toggles: { auto_tower: parts[5] === '1', auto_mobility: parts[6] === '1', robot_died: parts[15] === '1' },
      endgame: parts[9],
      rp: { win: parts[10] === '1', tie: parts[11] === '1', fuel100: parts[12] === '1', fuel360: parts[13] === '1', climb: parts[14] === '1' },
      scout: parts[16], 
      allianceScore: parseInt(parts[17]), 
      startPos: (parts[0] === 'V4' || parts[0] === 'V5') ? { x: parseFloat(parts[18]), y: parseFloat(parts[19]) } : { x: null, y: null },
      notes: (parts[0] === 'V4' || parts[0] === 'V5') ? (parts[20] || "") : parsedNotes,
      deviceId: parts[0] === 'V5' ? (parts[21] || "") : "",
      userAgent: parts[0] === 'V5' ? (parts[22] || "") : "",
      importedViaQR: true, 
      timestamp: new Date().toISOString()
    };

    const dataHash = hashMatch(parsedData);
    
    // Check against existing matches in DB
    const isDuplicateInDB = existingMatches.some(m => hashMatch(m) === dataHash);
    // Check against matches imported in this session
    const isDuplicateInSession = sessionHashes.current.has(dataHash);

    if (isDuplicateInDB || isDuplicateInSession) {
      console.log(`Skipping duplicate match data: ${parsedData.match} - ${parsedData.team}`);
      return false; // Indicate it was skipped
    }

    await addDoc(collection(db, "matches"), parsedData);
    sessionHashes.current.add(dataHash);
    return true; // Indicate it was added
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (html5QrCode && html5QrCode.isScanning) {
      await html5QrCode.stop();
      setIsScanning(false);
    }

    try {
      const added = await processDecodedText(decodedText);
      if (added) {
        setLogMsg(`✅ Successfully imported match from camera!`);
      } else {
        setLogMsg(`⚠️ Skipped duplicate match from camera.`);
      }
      setTimeout(() => { setLogMsg(null); setIsProcessing(false); }, 3000);
      onScanSuccess();
    } catch (e: any) {
      alert("Error: " + e.message);
      setIsProcessing(false);
    }
  };

  const startCam = () => {
    initScanner();
    if (html5QrCode) {
      setIsScanning(true);
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: {width: 250, height: 250} },
        handleScanSuccess,
        () => {} // ignore errors
      ).catch(err => {
        alert("Camera start failed: " + err);
        setIsScanning(false);
      });
    }
  };

  const stopCam = () => {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => {
        setIsScanning(false);
      }).catch(console.error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    let successCount = 0;
    let duplicateCount = 0;
    let failCount = 0;
    const successfulMatches: string[] = [];
    const newFailedFiles: {file: File, url: string}[] = [];

    setIsProcessing(true);
    setLogMsg(`Processing ${files.length} file(s)...`);

    const scanner = html5QrCode || new Html5Qrcode("reader");
    if (!html5QrCode) setHtml5QrCode(scanner);

    for (const file of files) {
      try {
        if (file.name.endsWith('.json')) {
          // Handle Local JSON Upload
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            let fileSuccess = 0;
            let fileDupes = 0;
            for (const item of parsed) {
              if (typeof item === 'string' && item.startsWith('V')) {
                const added = await processDecodedText(item);
                if (added) {
                  successCount++;
                  fileSuccess++;
                } else {
                  duplicateCount++;
                  fileDupes++;
                }
              }
            }
            successfulMatches.push(`JSON File: ${file.name} (${fileSuccess} added, ${fileDupes} skipped)`);
          } else {
            throw new Error("Invalid JSON format");
          }
        } else {
          // Handle Image Upload
          const decodedText = await scanner.scanFile(file, true);
          const parts = decodedText.split('|');
          const matchNum = parts[1];
          const added = await processDecodedText(decodedText);
          if (added) {
            successfulMatches.push(`Match ${matchNum}`);
            successCount++;
          } else {
            successfulMatches.push(`Match ${matchNum} (Duplicate Skipped)`);
            duplicateCount++;
          }
        }
      } catch (err) {
        console.warn(`Failed to process ${file.name}`, err);
        failCount++;
        if (!file.name.endsWith('.json')) {
          newFailedFiles.push({ file, url: URL.createObjectURL(file) });
        }
      }
    }

    let msg = `✅ Bulk import complete!\nAdded: ${successCount} | Skipped: ${duplicateCount} | Failed: ${failCount}\n`;
    if (successfulMatches.length > 0) {
      msg += successfulMatches.join('\n');
    }

    setFailedFiles(prev => [...prev, ...newFailedFiles]);
    setLogMsg(msg);
    setIsProcessing(false);
    onScanSuccess();
    e.target.value = "";
  };

  return (
    <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto h-full">
      <h2 className="text-3xl font-black text-emerald-400 mb-2 mt-4 text-center">Custom QR Data Importer</h2>
      <p className="text-slate-400 mb-6 text-center max-w-md mx-auto">Use the buttons below to control the webcam or manually upload a screenshot.</p>
      
      <div className="flex gap-4 mb-6">
        {!isScanning ? (
          <button onClick={startCam} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-bold text-white shadow-lg active:scale-95">
            📷 Start Camera
          </button>
        ) : (
          <button onClick={stopCam} className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-bold text-white shadow-lg active:scale-95">
            🛑 Stop Camera
          </button>
        )}
        
        <label className={`bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-bold text-white shadow-lg active:scale-95 cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
          📁 Upload Screenshots / JSON
          <input type="file" className="hidden" accept="image/*,.json" multiple onChange={handleFileUpload} />
        </label>
      </div>

      <div className="w-full max-w-xl aspect-square flex items-center justify-center text-slate-600 font-mono shadow-2xl relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black">
        {!isScanning && <span className="absolute z-10">Camera Offline</span>}
        <div id="reader" className="absolute inset-0 w-full h-full"></div>
      </div>

      {logMsg && (
        <div className="mt-6 text-green-400 font-mono text-sm bg-green-900/20 p-4 rounded-xl w-full max-w-xl border border-green-800 text-center whitespace-pre-wrap">
          {logMsg}
        </div>
      )}

      {failedFiles.length > 0 && (
        <div className="mt-6 w-full max-w-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black text-red-500">Failed Images ({failedFiles.length})</h3>
            <button 
              onClick={() => {
                failedFiles.forEach(f => URL.revokeObjectURL(f.url));
                setFailedFiles([]);
              }}
              className="text-sm bg-red-900/50 hover:bg-red-800/50 text-red-300 px-3 py-1 rounded-lg border border-red-500/30"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {failedFiles.map((fileObj, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-red-500/30 bg-black aspect-[3/4]">
                <img src={fileObj.url} alt={fileObj.file.name} className="w-full h-full object-contain" />
                <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-xs text-red-300 truncate text-center">
                  {fileObj.file.name}
                </div>
                <button 
                  onClick={() => {
                    URL.revokeObjectURL(fileObj.url);
                    setFailedFiles(prev => prev.filter((_, i) => i !== idx));
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
