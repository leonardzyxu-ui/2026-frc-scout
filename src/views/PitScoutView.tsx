import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Camera, Save, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PitScoutView() {
  const navigate = useNavigate();
  const [teamNumber, setTeamNumber] = useState('');
  const [drivetrain, setDrivetrain] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [autoStart, setAutoStart] = useState('');
  const [image, setImage] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Default event key for now, could be passed as prop or from context
  const eventKey = '2024casj';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamNumber) {
      setError('Team Number is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      let photoUrl = '';

      if (image) {
        const imageRef = ref(storage, `events/${eventKey}/pitScouting/${teamNumber}_${Date.now()}`);
        await uploadBytes(imageRef, image);
        photoUrl = await getDownloadURL(imageRef);
      }

      const pitData = {
        teamNumber,
        drivetrain,
        weight,
        dimensions,
        autoStart,
        photoUrl,
        timestamp: Date.now()
      };

      await setDoc(doc(db, `events/${eventKey}/pitScouting`, teamNumber), pitData);

      setSuccess(true);
      // Reset form
      setTeamNumber('');
      setDrivetrain('');
      setWeight('');
      setDimensions('');
      setAutoStart('');
      setImage(null);
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error submitting pit scout data:', err);
      setError(err.message || 'Failed to submit data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Pit Scouting</h1>
            <p className="text-slate-400 mt-1">Collect robot hardware details.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-900/20 border border-emerald-500/50 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>Data submitted successfully!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Team Number */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
            <label className="block text-lg font-bold text-white">Team Number *</label>
            <input
              type="number"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-2xl font-black text-center text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="e.g. 254"
              required
            />
          </div>

          {/* Drivetrain */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
            <label className="block text-lg font-bold text-white">Drivetrain</label>
            <div className="grid grid-cols-2 gap-3">
              {['Swerve', 'Tank/West Coast', 'Mecanum', 'Other'].map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDrivetrain(dt)}
                  className={`p-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    drivetrain === dt 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 border border-blue-500' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {dt}
                </button>
              ))}
            </div>
          </div>

          {/* Weight & Dimensions */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="space-y-4">
              <label className="block text-lg font-bold text-white">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xl font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. 50.5"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-lg font-bold text-white">Dimensions (inches)</label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xl font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="e.g. 28x28"
              />
            </div>
          </div>

          {/* Auto Start Position */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
            <label className="block text-lg font-bold text-white">Preferred Auto Start Position</label>
            <div className="grid grid-cols-2 gap-3">
              {['Left', 'Center', 'Right', 'Flexible'].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setAutoStart(pos)}
                  className={`p-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    autoStart === pos 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50 border border-purple-500' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Photo Fallback */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="bg-amber-900/20 border border-amber-500/50 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-amber-400/90 text-sm font-medium leading-relaxed">
                <strong className="text-amber-400 block mb-1">ATTENTION:</strong>
                Only upload a photo if the team is absent or cannot answer the questions above. Save API/Storage bandwidth.
              </p>
            </div>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors bg-slate-950">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Camera className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-400 font-medium">
                  {image ? image.name : 'Tap to capture or upload photo'}
                </p>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={handleImageChange}
              />
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-black text-xl tracking-wide shadow-xl shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <span className="animate-pulse">SAVING...</span>
            ) : (
              <>
                <Save className="w-6 h-6" />
                SUBMIT PIT DATA
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
