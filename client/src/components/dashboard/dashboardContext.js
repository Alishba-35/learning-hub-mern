import { createContext, useContext } from 'react';

export const DashboardContext = createContext({ askBuddy: () => {} });
export const useDashboard = () => useContext(DashboardContext);
