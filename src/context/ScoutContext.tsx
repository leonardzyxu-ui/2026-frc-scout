import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MatchData, initialMatchData } from '../types';

interface ScoutContextType {
  matchData: MatchData;
  setMatchData: React.Dispatch<React.SetStateAction<MatchData>>;
  updateMatchData: (updates: Partial<MatchData>) => void;
  resetMatchData: () => void;
}

const ScoutContext = createContext<ScoutContextType | undefined>(undefined);

export function ScoutProvider({ children }: { children: ReactNode }) {
  const [matchData, setMatchData] = useState<MatchData>(() => {
    // Generate or retrieve a persistent Device ID for tracking submissions
    let deviceId = localStorage.getItem('scout_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem('scout_device_id', deviceId);
    }
    
    return {
      ...initialMatchData,
      deviceId,
      userAgent: navigator.userAgent
    };
  });

  const updateMatchData = (updates: Partial<MatchData>) => {
    setMatchData((prev) => ({ ...prev, ...updates }));
  };

  const resetMatchData = () => {
    setMatchData((prev) => ({
      ...initialMatchData,
      scout: prev.scout, // Keep scout name
      match: prev.match + 1, // Auto-increment match
      eventKey: prev.eventKey, // Keep event key
      deviceId: prev.deviceId, // Keep device ID
      userAgent: prev.userAgent, // Keep user agent
    }));
  };

  return (
    <ScoutContext.Provider value={{ matchData, setMatchData, updateMatchData, resetMatchData }}>
      {children}
    </ScoutContext.Provider>
  );
}

export function useScout() {
  const context = useContext(ScoutContext);
  if (context === undefined) {
    throw new Error('useScout must be used within a ScoutProvider');
  }
  return context;
}
