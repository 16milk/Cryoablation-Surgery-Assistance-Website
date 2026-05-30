import { DisplaySet } from '../types';
/**
 * Hook that listens for changes in the active viewport and its display sets.
 * It returns the display sets associated with the active viewport.
 *
 * @param servicesManager - Services manager instance
 * @returns Array of display sets for the active viewport
 */
declare const useActiveViewportDisplaySets: () => DisplaySet[];
export default useActiveViewportDisplaySets;
