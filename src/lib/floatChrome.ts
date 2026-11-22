// Space taken by the dashboard's floating header pill at the top of the screen.
// The header floats over the content (content scrolls behind it and shows
// through), so scrollable lists add this as top padding to start below it.
// Defaults to 0, so screens rendered outside the dashboard tabs are unaffected.
import { createContext, useContext } from 'react';

export const FloatTopContext = createContext(0);
export const useFloatTop = () => useContext(FloatTopContext);

// Space the floating footer pill takes at the bottom (Lead Match only). The chat box
// sits above it. 0 when the footer is a normal bar or hidden (keyboard open).
export const FloatBottomContext = createContext(0);
export const useFloatBottom = () => useContext(FloatBottomContext);
