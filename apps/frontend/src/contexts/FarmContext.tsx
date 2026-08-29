import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type Farm = {
  id: string;
  name: string;
  location?: string | null;
};

type FarmContextType = {
  activeFarmId: string | null;
  setActiveFarmId: (id: string | null) => void;
  farms: Farm[];
  setFarms: (farms: Farm[]) => void;
};

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [activeFarmId, setActiveFarmId] = useState<string | null>(() => {
    return localStorage.getItem("activeFarmId");
  });
  const [farms, setFarms] = useState<Farm[]>([]);

  useEffect(() => {
    if (activeFarmId) {
      localStorage.setItem("activeFarmId", activeFarmId);
    } else {
      localStorage.removeItem("activeFarmId");
    }
  }, [activeFarmId]);

  return (
    <FarmContext.Provider
      value={{
        activeFarmId,
        setActiveFarmId,
        farms,
        setFarms,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (context === undefined) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return context;
}
