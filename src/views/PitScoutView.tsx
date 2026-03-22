import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, Check, Upload, Camera, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PitScoutView() {
  const navigate = useNavigate();
  const [eventKey, setEventKey] = useState(() => localStorage.getItem('globalEventKey') || '2026mnum');
  const [teamNumber, setTeamNumber] = useState('');
  const [drivetrain, setDrivetrain] = useState<'Swerve' | 'Tank/West Coast' | 'Mecanum' | 'Other' | ''>('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [autoStart, setAutoStart] = useState<'Left' | 'Center' | 'Right' | 'Flexible' | ''>('');
  const [photoBase64, setPhotoBase64] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to Base64 to save directly to Firestore (saving storage bandwidth)
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!teamNumber || !drivetrain || !weight || !dimensions || !autoStart) {
      setError('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docRef = doc(db, `events/${eventKey}/pitScouting`, teamNumber);
      await setDoc(docRef, {
        teamNumber,
        drivetrain,
        weight: parseFloat(weight),
        dimensions,
        autoStart,
        photoBase64,
        timestamp: Date.now()
      });

      setSuccessMessage(`Successfully saved pit data for Team ${teamNumber}`);
      
      // Reset form
      setTeamNumber('');
      setDrivetrain('');
      setWeight('');
      setDimensions('');
      setAutoStart('');
      setPhotoBase64('');
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving pit data:', err);
      setError('Failed to save pit data. Please try again.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate('/')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 flex items-center justify-between">
            <h2 className="text-2xl font-black text-white tracking-tight">PIT SCOUT</h2>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {eventKey}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-900/50 border border-emerald-500 text-emerald-200 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Number */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Team Number</label>
            <input
              type="number"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="e.g. 254"
              required
            />
          </div>

          {/* Drivetrain */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Drivetrain</label>
            <div className="grid grid-cols-2 gap-2">
              {['Swerve', 'Tank/West Coast', 'Mecanum', 'Other'].map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDrivetrain(dt as any)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                    drivetrain === dt
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {dt}
                </button>
              ))}
            </div>
          </div>

          {/* Weight & Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="e.g. 55"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Dimensions</label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="L x W"
                required
              />
            </div>
          </div>

          {/* Auto Start Position */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Auto Start</label>
            <div className="grid grid-cols-2 gap-2">
              {['Left', 'Center', 'Right', 'Flexible'].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setAutoStart(pos as any)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${
                    autoStart === pos
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Fallback */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-start gap-3 text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">
                ATTENTION: Only upload a photo if the team is absent or cannot answer. Save API/Storage bandwidth.
              </p>
            </div>
            
            <div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {photoBase64 ? (
                    <Check className="w-8 h-8 text-emerald-500 mb-2" />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-400 mb-2" />
                  )}
                  <p className="text-sm font-bold text-slate-400">
                    {photoBase64 ? 'Photo Captured' : 'Tap to Take Photo'}
                  </p>
                </div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'SAVING...' : 'SAVE PIT DATA'}
            {!isSubmitting && <Upload className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
