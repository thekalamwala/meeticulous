import { createContext, useContext } from 'react';

/* Shared state for the Overview chrome (sidebar + toolbar + profile panel).
 * Kept in its own module so OverviewLayout only exports components and stays
 * eligible for React Fast Refresh. */
export const OverviewChromeContext = createContext({
  openNewMeeting: () => {},
});

export const useOverviewChrome = () => useContext(OverviewChromeContext);
