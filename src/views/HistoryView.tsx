import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchScoutingV2 } from '../types';
import { Clock, Edit2 } from 'lucide-react';

export default function HistoryView() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<MatchScoutingV2[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const deviceId = localStorage.getItem('scout_device_id');
        if (!deviceId) {
          setIsLoading(false);
          return;
        }

        // We assume the eventKey is stored globally, or we fetch across all events?
        // Let's fetch from the current eventKey.
        const eventKey = localStorage.getItem('globalEventKey') || localStorage.getItem('setting_event') || '2024casj';
        
        const q = query(
          collection(db, 'events', eventKey, 'matchScouting'),
          where('deviceId', '==', deviceId)
        );

        const snapshot = await getDocs(q);
        const matches: MatchScoutingV2[] = [];
        const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);

        snapshot.forEach((doc) => {
          const data = doc.data() as MatchScoutingV2;
          if (data.timestamp && data.timestamp > eightHoursAgo) {
            matches.push(data);
          }
        });

        // Sort by timestamp descending
        matches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setHistory(matches);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleEdit = (match: MatchScoutingV2) => {
    // Store the match data to be edited in localStorage or state
    localStorage.setItem('edit_match_data', JSON.stringify(match));
    navigate('/scout');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-950 text-white">
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
            DEVICE HISTORY
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Recent Submissions (8 Hours)</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700"
        >
          Back
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400 font-bold">Loading History...</div>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
          <Clock className="w-16 h-16 opacity-50" />
          <p className="font-bold">No recent matches found on this device.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((match, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center shadow-lg">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl font-black text-white">{match.matchKey.toUpperCase()}</span>
                  <span className="text-sm font-bold text-slate-400">Team {match.teamNumber}</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${match.alliance === 'Red' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>
                    {match.alliance.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {new Date(match.timestamp || 0).toLocaleTimeString()} • Scout: {match.scoutName}
                </div>
              </div>
              <button 
                onClick={() => handleEdit(match)}
                className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg text-slate-300 transition-colors"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
