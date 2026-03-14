import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LocalFileContextType {
  fileHandle: any | null;
  setFileHandle: (handle: any) => void;
}

const LocalFileContext = createContext<LocalFileContextType | undefined>(undefined);

export function LocalFileProvider({ children }: { children: ReactNode }) {
  const [fileHandle, setFileHandle] = useState<any | null>(null);

  return (
    <LocalFileContext.Provider value={{ fileHandle, setFileHandle }}>
      {children}
    </LocalFileContext.Provider>
  );
}

export function useLocalFile() {
  const context = useContext(LocalFileContext);
  if (context === undefined) {
    throw new Error('useLocalFile must be used within a LocalFileProvider');
  }
  return context;
}
