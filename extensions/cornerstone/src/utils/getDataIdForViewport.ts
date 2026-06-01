/**
 * Resolves the data ID (e.g. volumeId) for a viewport and display set.
 * For viewports with multiple volumes/actors, returns the id that matches the display set; otherwise undefined.
 * Use this to call viewport.getProperties(dataId) in a viewport-type-agnostic way.
 *
 * @param viewport - Viewport instance (stack, volume, or future types with optional getAllVolumeIds)
 * @param displaySetInstanceUID - Display set instance UID to match
 * @returns volumeId (or equivalent) for multi-actor viewports, undefined for single-actor
 */
export function getDataIdForViewport(
  viewport: unknown,
  displaySetInstanceUID: string
): string | undefined {
  const vp = viewport as { getAllVolumeIds?: () => string[] };
  if (typeof vp.getAllVolumeIds !== 'function') {
    return undefined;
  }
  const volumeIds = vp.getAllVolumeIds() || [];
  return volumeIds.length > 0
    ? volumeIds.find(id => id.includes(displaySetInstanceUID)) ?? undefined
    : undefined;
}

/**
 * Safely read viewport properties for stack or volume viewports. Volume viewports
 * require a volumeId; calling getProperties() without one throws. Returns undefined
 * when the viewport has no loaded volume yet.
 */
export function getPropertiesForViewport(
  viewport: unknown
): Record<string, unknown> | undefined {
  if (!viewport) {
    return undefined;
  }

  const vp = viewport as {
    getAllVolumeIds?: () => string[];
    getProperties: (volumeId?: string) => Record<string, unknown>;
  };

  if (typeof vp.getAllVolumeIds === 'function') {
    const volumeIds = vp.getAllVolumeIds?.() || [];
    const volumeId = volumeIds[0];
    if (!volumeId) {
      return undefined;
    }
    return vp.getProperties(volumeId);
  }

  return vp.getProperties();
}
