import type { CommandsManager, ServicesManager } from '@ohif/core';

/**
 * Segmentable lung structures shown as colored overlays on the compared CT
 * viewports. Each one maps to a toggle button in the LungComparePanel.
 */
export type LungStructureId = 'lungParenchyma' | 'nodule' | 'vessel' | 'iceBall';

export interface LungStructureDef {
  id: LungStructureId;
  /** i18n key (LungCtCompare namespace) for the button label. */
  labelKey: string;
  /** Swatch color for the button (hex). */
  colorHex: string;
  /** Overlay color for cornerstone segmentation (0-255 RGB). */
  colorRgb: [number, number, number];
}

/**
 * The four structures and their display colors. Order here drives button order.
 * Colors are intentionally distinct so overlays remain readable when several
 * are shown at once.
 */
export const LUNG_STRUCTURES: LungStructureDef[] = [
  {
    id: 'lungParenchyma',
    labelKey: 'segLungParenchyma',
    colorHex: '#4FC3F7',
    colorRgb: [79, 195, 247],
  },
  {
    id: 'nodule',
    labelKey: 'segNodule',
    colorHex: '#EF5350',
    colorRgb: [239, 83, 80],
  },
  {
    id: 'vessel',
    labelKey: 'segVessel',
    colorHex: '#FFCA28',
    colorRgb: [255, 202, 40],
  },
  {
    id: 'iceBall',
    labelKey: 'segIceBall',
    colorHex: '#B388FF',
    colorRgb: [179, 136, 255],
  },
];

/**
 * Everything a provider needs to show/hide a structure overlay. Passed on every
 * toggle so the implementation stays stateless from the panel's point of view.
 */
export interface LungSegmentationToggleContext {
  /** The structure being toggled (includes its color). */
  structure: LungStructureDef;
  /** Desired state after the toggle: true = show overlay, false = hide it. */
  visible: boolean;
  /** Cornerstone viewport ids the overlay should appear in (left + right CT). */
  viewportIds: string[];
  /** Display set currently shown in the baseline (left) viewport, if any. */
  baselineDisplaySetInstanceUID: string | null;
  /** Display set currently shown in the compare (right) viewport, if any. */
  compareDisplaySetInstanceUID: string | null;
  servicesManager: ServicesManager;
  commandsManager: CommandsManager;
}

/**
 * Pluggable segmentation backend.
 *
 * The panel owns the toggle UI/state and calls `onToggle` whenever a structure
 * is switched on or off. The actual segmentation (running a model, building a
 * labelmap, coloring it and toggling its visibility on the viewports) lives
 * behind this interface so it can be inserted later without touching the panel.
 *
 * To wire up the real implementation, call `setLungSegmentationProvider` with
 * an object implementing this interface (e.g. from the mode's `onModeEnter`,
 * or the extension's `preRegistration`).
 */
export interface LungSegmentationProvider {
  /**
   * Invoked when a structure overlay is toggled. Should create/show the overlay
   * when `visible` is true, and hide it when false. May be async.
   */
  onToggle(context: LungSegmentationToggleContext): void | Promise<void>;
  /**
   * Optional. Return false to signal that no segmentation data is available for
   * a structure yet (the panel may surface this to the user). Defaults to true.
   */
  isAvailable?(structureId: LungStructureId): boolean;

  /**
   * Optional click-to-prompt support. When a target structure is enabled,
   * clicking a viewport runs a point-prompted segmentation (e.g. MedSAM2) for
   * that lesion at the clicked location and adds it to the overlay.
   */
  enableClickPrompt?(
    structureId: LungStructureId,
    viewportIds: string[],
    servicesManager: ServicesManager,
    commandsManager?: CommandsManager
  ): void;
  /** Disable click-to-prompt and detach listeners. */
  disableClickPrompt?(): void;
  /** Clear the click-prompted masks for a structure (reverts to auto-detection). */
  clearClickPrompt?(structureId: LungStructureId): void;
  /** Whether click-to-prompt is meaningful for a structure (compact lesions). */
  supportsClickPrompt?(structureId: LungStructureId): boolean;
}

/**
 * Default placeholder provider. Does nothing except log in development, so the
 * toggle buttons are fully interactive before the segmentation feature lands.
 *
 * >>> INSERT SEGMENTATION IMPLEMENTATION HERE <<<
 * Replace this (via `setLungSegmentationProvider`) with a real provider that:
 *   1. Ensures a labelmap exists for `context.structure.id` on the relevant
 *      display set(s) (run/lookup the segmentation as needed).
 *   2. Applies `context.structure.colorRgb` as the segment color.
 *   3. Shows or hides the segmentation representation on `context.viewportIds`
 *      according to `context.visible`.
 */
const noopProvider: LungSegmentationProvider = {
  onToggle: context => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(
        `[lung-ct-compare] segmentation toggle (stub): ${context.structure.id} -> ` +
          `${context.visible ? 'on' : 'off'}`,
        context.viewportIds
      );
    }
  },
  isAvailable: () => false,
};

let activeProvider: LungSegmentationProvider = noopProvider;

/**
 * Register the segmentation backend. Pass `null` to reset to the no-op stub.
 * Call this once the real segmentation feature is available.
 */
export function setLungSegmentationProvider(provider: LungSegmentationProvider | null): void {
  activeProvider = provider ?? noopProvider;
}

/** Get the currently registered segmentation provider (stub by default). */
export function getLungSegmentationProvider(): LungSegmentationProvider {
  return activeProvider;
}
