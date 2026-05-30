import { cache, Enums as csCoreEnums, metaData, Types as csTypes } from '@cornerstonejs/core';
import { Enums as csToolsEnums, segmentation as cstSegmentation } from '@cornerstonejs/tools';
import type { ServicesManager } from '@ohif/core';

import {
  LUNG_STRUCTURES,
  LungSegmentationProvider,
  LungSegmentationToggleContext,
  LungStructureId,
  setLungSegmentationProvider,
} from './lungSegmentation';
import { SEGMENT_INDEX, computeLungField, computeStructureMask } from './lungThresholding';

const { Labelmap } = csToolsEnums.SegmentationRepresentations;
const { getCurrentLabelmapImageIdsForViewport, triggerSegmentationEvents } = cstSegmentation;

const SEG_ID_PREFIX = 'lungct-threshold::';

function segmentationIdFor(displaySetInstanceUID: string): string {
  return `${SEG_ID_PREFIX}${displaySetInstanceUID}`;
}

function firstNumber(...values: Array<number | undefined | null>): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

/**
 * Real, browser-side segmentation backend driven entirely by CT Hounsfield-unit
 * thresholds — no external model or mask data required.
 *
 * Design notes:
 * - One labelmap segmentation per display set (baseline / compare), with one
 *   segment per structure (see SEGMENT_INDEX). Both CT viewports get a
 *   representation, so overlays appear on the left and the right.
 * - Segmentation is computed lazily, per visible slice: the current slice is
 *   thresholded when a structure is toggled, and recomputed whenever the user
 *   scrolls (STACK_NEW_IMAGE). This keeps toggling instant and avoids loading
 *   the whole volume up front.
 */
class ThresholdLungSegmentationProvider implements LungSegmentationProvider {
  private readonly active = new Set<LungStructureId>();
  private readonly detachers = new Map<string, () => void>();
  private readonly pendingViewports = new Set<string>();
  private servicesManager: ServicesManager | null = null;
  private rafId: number | null = null;

  isAvailable(): boolean {
    return true;
  }

  async onToggle(context: LungSegmentationToggleContext): Promise<void> {
    const { structure, visible, viewportIds, servicesManager } = context;
    this.servicesManager = servicesManager;

    if (visible) {
      this.active.add(structure.id);
    } else {
      this.active.delete(structure.id);
    }

    for (const viewportId of viewportIds) {
      // eslint-disable-next-line no-await-in-loop
      await this.ensureRepresentation(viewportId);
      this.applySegmentStyles(viewportId);
    }

    if (this.active.size > 0) {
      this.attachListeners(viewportIds);
    } else {
      this.detachAllListeners();
    }

    for (const viewportId of viewportIds) {
      this.recompute(viewportId);
    }
  }

  /** Detach listeners and drop state. Call on mode exit. */
  dispose(): void {
    this.detachAllListeners();
    this.active.clear();
    if (this.rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.pendingViewports.clear();
    this.servicesManager = null;
  }

  private services(): Record<string, any> | null {
    return (this.servicesManager?.services as Record<string, any>) ?? null;
  }

  private displaySetForViewport(viewportId: string): string | null {
    const services = this.services();
    const ds = services?.cornerstoneViewportService?.getViewportDisplaySets(viewportId)?.[0];
    return ds?.displaySetInstanceUID ?? null;
  }

  private async ensureRepresentation(viewportId: string): Promise<void> {
    const services = this.services();
    if (!services) {
      return;
    }
    const { segmentationService, displaySetService } = services;
    const displaySetInstanceUID = this.displaySetForViewport(viewportId);
    if (!displaySetInstanceUID) {
      return;
    }

    const segmentationId = segmentationIdFor(displaySetInstanceUID);

    if (!segmentationService.getSegmentation(segmentationId)) {
      const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
      if (!displaySet) {
        return;
      }
      const segments: Record<number, { label: string; active?: boolean }> = {};
      for (const structure of LUNG_STRUCTURES) {
        const index = SEGMENT_INDEX[structure.id];
        segments[index] = { label: structure.id, active: index === 1 };
      }
      await segmentationService.createLabelmapForDisplaySet(displaySet, {
        segmentationId,
        label: 'Lung structures',
        segments,
      });
    }

    const reps = segmentationService.getSegmentationRepresentations(viewportId, {
      segmentationId,
    });
    if (!reps?.length) {
      await segmentationService.addSegmentationRepresentation(viewportId, {
        segmentationId,
        type: Labelmap,
      });
    }
  }

  private applySegmentStyles(viewportId: string): void {
    const services = this.services();
    const displaySetInstanceUID = this.displaySetForViewport(viewportId);
    if (!services || !displaySetInstanceUID) {
      return;
    }
    const { segmentationService } = services;
    const segmentationId = segmentationIdFor(displaySetInstanceUID);
    const reps = segmentationService.getSegmentationRepresentations(viewportId, {
      segmentationId,
    });
    if (!reps?.length) {
      return;
    }

    for (const structure of LUNG_STRUCTURES) {
      const index = SEGMENT_INDEX[structure.id];
      const [r, g, b] = structure.colorRgb;
      segmentationService.setSegmentColor(viewportId, segmentationId, index, [
        r,
        g,
        b,
        255,
      ] as csTypes.Color);
      segmentationService.setSegmentVisibility(
        viewportId,
        segmentationId,
        index,
        this.active.has(structure.id)
      );
    }
  }

  /** Threshold the currently displayed slice of `viewportId` for active structures. */
  private recompute(viewportId: string): void {
    const services = this.services();
    if (!services) {
      return;
    }
    const { cornerstoneViewportService } = services;
    const displaySetInstanceUID = this.displaySetForViewport(viewportId);
    if (!displaySetInstanceUID) {
      return;
    }
    const segmentationId = segmentationIdFor(displaySetInstanceUID);

    const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId) as unknown as {
      getCurrentImageId?: () => string;
    } | null;
    const currentImageId = viewport?.getCurrentImageId?.();
    if (!currentImageId) {
      return;
    }

    const labelmapImageIds = getCurrentLabelmapImageIdsForViewport(viewportId, segmentationId);
    const labelmapImageId = labelmapImageIds?.[0];
    if (!labelmapImageId) {
      return;
    }

    const segImage = cache.getImage(labelmapImageId);
    const srcImage = cache.getImage(currentImageId);
    if (!segImage?.voxelManager || !srcImage) {
      return;
    }

    const pixelData = srcImage.getPixelData?.();
    if (!pixelData) {
      return;
    }

    const width = firstNumber(srcImage.columns, (srcImage as { width?: number }).width);
    const height = firstNumber(srcImage.rows, (srcImage as { height?: number }).height);
    if (!width || !height) {
      return;
    }

    const segVoxel = segImage.voxelManager as {
      getScalarDataLength: () => number;
      setAtIndex: (index: number, value: number) => boolean;
    };
    const n = width * height;
    if (segVoxel.getScalarDataLength() !== n || pixelData.length < n) {
      return;
    }

    const modalityLut = (metaData.get('modalityLutModule', currentImageId) || {}) as {
      rescaleSlope?: number;
      rescaleIntercept?: number;
    };
    const slope = firstNumber(srcImage.slope, modalityLut.rescaleSlope) ?? 1;
    const intercept = firstNumber(srcImage.intercept, modalityLut.rescaleIntercept) ?? 0;

    const hu = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      hu[i] = pixelData[i] * slope + intercept;
    }

    for (let i = 0; i < n; i++) {
      segVoxel.setAtIndex(i, 0);
    }

    if (this.active.size > 0) {
      const field = computeLungField(hu, width, height);
      for (const structure of LUNG_STRUCTURES) {
        if (!this.active.has(structure.id)) {
          continue;
        }
        const index = SEGMENT_INDEX[structure.id];
        const mask = computeStructureMask(structure.id, hu, field, width, height);
        for (let i = 0; i < n; i++) {
          if (mask[i]) {
            segVoxel.setAtIndex(i, index);
          }
        }
      }
    }

    triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);
  }

  private attachListeners(viewportIds: string[]): void {
    const services = this.services();
    if (!services) {
      return;
    }
    const { cornerstoneViewportService } = services;

    for (const viewportId of viewportIds) {
      if (this.detachers.has(viewportId)) {
        continue;
      }
      const element = cornerstoneViewportService.getViewportInfo(viewportId)?.getElement?.();
      if (!element) {
        continue;
      }
      const handler = () => this.schedule(viewportId);
      element.addEventListener(csCoreEnums.Events.STACK_NEW_IMAGE, handler);
      this.detachers.set(viewportId, () => {
        element.removeEventListener(csCoreEnums.Events.STACK_NEW_IMAGE, handler);
      });
    }
  }

  private detachAllListeners(): void {
    this.detachers.forEach(detach => detach());
    this.detachers.clear();
  }

  /** Coalesce rapid scroll events into a single recompute per animation frame. */
  private schedule(viewportId: string): void {
    this.pendingViewports.add(viewportId);
    if (this.rafId != null || typeof requestAnimationFrame === 'undefined') {
      if (typeof requestAnimationFrame === 'undefined') {
        this.recompute(viewportId);
        this.pendingViewports.delete(viewportId);
      }
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const viewports = [...this.pendingViewports];
      this.pendingViewports.clear();
      viewports.forEach(id => this.recompute(id));
    });
  }
}

let instance: ThresholdLungSegmentationProvider | null = null;

/**
 * Register the threshold-based segmentation backend as the active provider.
 * Call once when the lung-ct-compare mode is entered.
 */
export function registerThresholdLungSegmentation(): ThresholdLungSegmentationProvider {
  if (!instance) {
    instance = new ThresholdLungSegmentationProvider();
  }
  setLungSegmentationProvider(instance);
  return instance;
}

/** Tear down listeners and restore the no-op provider. Call on mode exit. */
export function unregisterThresholdLungSegmentation(): void {
  instance?.dispose();
  instance = null;
  setLungSegmentationProvider(null);
}

export { ThresholdLungSegmentationProvider };
