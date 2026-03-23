import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { decompressMatchData } from '../utils/qrCompression';
import { ArrowLeft, CheckCircle2, AlertTriangle, ScanLine, Upload, Trash2, Database, X } from 'lucide-react';
import { MatchScoutingV2 } from '../types';

export default function QRScannerView({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const navigate = useNavigate();
  const [stagedData, setStagedData] = useState<MatchScoutingV2[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logMsg, setLogMsg] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<{file: File, url: string}[]>([]);
  
  const sessionHashes = useRef<Set<string>>(new Set());

  const hashMatch = (d: MatchScoutingV2) => {
    return `${d.eventKey}|${d.matchKey}|${d.teamNumber}|${d.scoutName}|${d.timestamp}`;
  };

  useEffect(() => {
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
      failedFiles.forEach(f => URL.revokeObjectURL(f.url));
    };
  }, [html5QrCode, failedFiles]);

  const initScanner = () => {
    if (!html5QrCode) {
      setHtml5QrCode(new Html5Qrcode("qr-reader"));
    }
  };

  const processDecodedText = (decodedText: string) => {
    const parsed = decompressMatchData(decodedText);
    if (!parsed) return false;

    const dataHash = hashMatch(parsed);
    
    // Check against matches imported in this session
    if (sessionHashes.current.has(dataHash) || stagedData.some(d => hashMatch(d) === dataHash)) {
      console.log(`Skipping duplicate match data: ${parsed.matchKey} - ${parsed.teamNumber}`);
      return false;
    }

    setStagedData(prev => [...prev, parsed]);
    sessionHashes.current.add(dataHash);
    return true;
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const added = processDecodedText(decodedText);
      if (added) {
        setLogMsg(`✅ Successfully staged match from camera!`);
      } else {
        setLogMsg(`⚠️ Skipped duplicate match from camera.`);
      }
      setTimeout(() => { setLogMsg(null); setIsProcessing(false); }, 3000);
    } catch (e: unknown) {
      setLogMsg("Error: " + (e instanceof Error ? e.message : String(e)));
      setIsProcessing(false);
      setTimeout(() => setLogMsg(null), 3000);
    }
  };

  const startCam = () => {
    initScanner();
    if (html5QrCode || !html5QrCode) {
      const scanner = html5QrCode || new Html5Qrcode("qr-reader");
      if (!html5QrCode) setHtml5QrCode(scanner);
      
      setIsScanning(true);
      scanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: {width: 250, height: 250} },
        handleScanSuccess,
        () => {} // ignore errors
      ).catch(err => {
        setLogMsg("Camera start failed: " + err);
        setIsScanning(false);
        setTimeout(() => setLogMsg(null), 3000);
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
    const newFailedFiles: {file: File, url: string}[] = [];

    setIsProcessing(true);
    setLogMsg(`Processing ${files.length} file(s)...`);

    const scanner = html5QrCode || new Html5Qrcode("qr-reader");
    if (!html5QrCode) setHtml5QrCode(scanner);

    for (const file of files) {
      try {
        if (file.name.endsWith('.json')) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string' && item.startsWith('V4|')) {
                const added = processDecodedText(item);
                if (added) successCount++;
                else duplicateCount++;
              }
            }
          }
        } else {
          const decodedText = await scanner.scanFile(file, true);
          const added = processDecodedText(decodedText);
          if (added) successCount++;
          else duplicateCount++;
        }
      } catch (err) {
        console.warn(`Failed to process ${file.name}`, err);
        failCount++;
        if (!file.name.endsWith('.json')) {
          newFailedFiles.push({ file, url: URL.createObjectURL(file) });
        }
      }
    }

    setFailedFiles(prev => [...prev, ...newFailedFiles]);
    setLogMsg(`✅ Bulk import complete! Staged: ${successCount} | Skipped: ${duplicateCount} | Failed: ${failCount}`);
    setIsProcessing(false);
    e.target.value = "";
  };

  const handlePushToDatabase = async () => {
    if (stagedData.length === 0) return;
    setIsProcessing(true);
    setLogMsg("Pushing to database...");
    
    let successCount = 0;
    let failCount = 0;

    for (const data of stagedData) {
      try {
        const docId = `${data.matchKey}_${data.teamNumber}`;
        const docRef = doc(db, 'events', data.eventKey, 'matchScouting', docId);
        await setDoc(docRef, data);
        successCount++;
      } catch (err) {
        console.error("Error uploading data:", err);
        failCount++;
      }
    }

    setLogMsg(`✅ Push complete! Uploaded: ${successCount} | Failed: ${failCount}`);
    if (failCount === 0) {
      setStagedData([]);
    }
    setIsProcessing(false);
  };

  const removeStagedItem = (index: number) => {
    setStagedData(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={isEmbedded ? "" : "min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans"}>
      <div className={isEmbedded ? "space-y-8" : "max-w-5xl mx-auto space-y-8"}>
        
        {/* Header */}
        {!isEmbedded && (
          <div className="flex items-center gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <button 
              onClick={() => navigate('/')}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <ScanLine className="text-emerald-500 w-8 h-8" />
                DATA IMPORT & STAGING
              </h1>
              <p className="text-slate-400 mt-1">Offline Protocol: Scan QR codes or upload screenshots/JSON</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Scanner & Controls */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center">
              <div className="flex gap-4 mb-6 w-full">
                {!isScanning ? (
                  <button onClick={startCam} className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold text-white shadow-lg active:scale-95 transition-all">
                    📷 Start Camera
                  </button>
                ) : (
                  <button onClick={stopCam} className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-white shadow-lg active:scale-95 transition-all">
                    🛑 Stop Camera
                  </button>
                )}
                
                <label className={`flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold text-white shadow-lg active:scale-95 cursor-pointer transition-all ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="w-5 h-5" />
                  Upload Files
                  <input type="file" className="hidden" accept="image/*,.json" multiple onChange={handleFileUpload} />
                </label>
              </div>

              <div className="w-full aspect-square flex items-center justify-center text-slate-600 font-mono shadow-2xl relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black">
                {!isScanning && <span className="absolute z-10">Camera Offline</span>}
                <div id="qr-reader" className="absolute inset-0 w-full h-full"></div>
              </div>

              {logMsg && (
                <div className="mt-6 text-emerald-400 font-mono text-sm bg-emerald-950/50 p-4 rounded-xl w-full border border-emerald-900 text-center whitespace-pre-wrap">
                  {logMsg}
                </div>
              )}
            </div>

            {failedFiles.length > 0 && (
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-red-900/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-red-500 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Failed Images ({failedFiles.length})
                  </h3>
                  <button 
                    onClick={() => {
                      failedFiles.forEach(f => URL.revokeObjectURL(f.url));
                      setFailedFiles([]);
                    }}
                    className="text-sm bg-red-950 hover:bg-red-900 text-red-400 px-3 py-1 rounded-lg border border-red-800 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {failedFiles.map((fileObj, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-red-900 bg-black aspect-[3/4]">
                      <img src={fileObj.url} alt={fileObj.file.name} className="w-full h-full object-contain" />
                      <button 
                        onClick={() => {
                          URL.revokeObjectURL(fileObj.url);
                          setFailedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Staging Area */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[800px]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Database className="w-6 h-6 text-blue-400" />
                  Staging Area
                </h2>
                <p className="text-sm text-slate-400">{stagedData.length} matches ready to push</p>
              </div>
              <button
                onClick={handlePushToDatabase}
                disabled={stagedData.length === 0 || isProcessing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Push All
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {stagedData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <Database className="w-12 h-12 opacity-20" />
                  <p>No data staged. Scan QR codes or upload files.</p>
                </div>
              ) : (
                stagedData.map((data, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded-full ${data.alliance === 'Red' ? 'bg-red-500' : 'bg-blue-500'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg text-white">{data.teamNumber}</span>
                          <span className="text-sm font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">{data.matchKey}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Scout: {data.scoutName} | Event: {data.eventKey}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeStagedItem(idx)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
