import {
  cache,
  Enums as csCoreEnums,
  metaData,
  Types as csTypes,
  utilities as csUtils,
} from '@cornerstonejs/core';
import { Enums as csToolsEnums, segmentation as cstSegmentation } from '@cornerstonejs/tools';
import type { ServicesManager } from '@ohif/core';

import {
  LUNG_STRUCTURES,
  LungSegmentationProvider,
  LungSegmentationToggleContext,
  LungStructureId,
} from './lungSegmentation';
import { SEGMENT_INDEX, computeLungField } from './lungThresholding';
import { regionGrow } from './morphology';

const { Labelmap } = csToolsEnums.SegmentationRepresentations;
const { getCurrentLabelmapImageIdsForViewport, triggerSegmentationEvents } = cstSegmentation;

export function firstNumber(...values: Array<number | undefined | null>): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

/** A single CT slice's data, ready to be classified into structure masks. */
export interface SliceContext {
  /** Cornerstone image id of the source slice. */
  imageId: string;
  /** Hounsfield-unit values, row-major (`hu[y * width + x]`). */
  hu: Float32Array;
  width: number;
  height: number;
}

/**
 * Shared cornerstone wiring for the lung structure overlays: one labelmap
 * segmentation per display set, one segment per structure, recomputed per
 * visible slice and on scroll. Subclasses only implement `computeMasks` to turn
 * a slice's HU values into per-structure 0/1 masks — the threshold backend does
 * this synchronously in-browser, while the MedSAM2 backend calls a model
 * service (and may be async).
 */
export abstract class BaseLungSegmentationProvider implements LungSegmentationProvider {
  protected readonly active = new Set<LungStructureId>();
  protected servicesManager: ServicesManager | null = null;

  private readonly segIdPrefix: string;
  private readonly detachers = new Map<string, () => void>();
  private readonly pendingViewports = new Set<string>();
  // Per-viewport monotonic token so an async recompute that finishes after the
  // user has scrolled (or toggled) is discarded instead of writing stale masks.
  private readonly generation = new Map<string, number>();
  private rafId: number | null = null;

  // Click-to-prompt state: manually segmented masks keyed by
  // `${segmentationId}::${imageId}::${structureId}`. A structure with any manual
  // mask switches to "manual only" (auto-detection suppressed) until cleared.
  private readonly manualMasks = new Map<string, Uint8Array>();
  private readonly manualStructures = new Set<LungStructureId>();
  private clickTarget: LungStructureId | null = null;
  private readonly clickDetachers = new Map<string, () => void>();

  constructor(segIdPrefix: string) {
    this.segIdPrefix = segIdPrefix;
  }

  isAvailable(): boolean {
    return true;
  }

  /**
   * Classify the active structures on a single slice. Returns a map of
   * structureId -> 0/1 mask (length width*height). Implementations may omit a
   * structure (treated as empty) and may be async.
   */
  abstract computeMasks(
    slice: SliceContext,
    active: LungStructureId[]
  ): Promise<Map<LungStructureId, Uint8Array>>;

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
      // Fire-and-forget: keep toggling responsive even if computeMasks is async.
      void this.recompute(viewportId);
    }
  }

  /** Detach listeners and drop state. Call on mode exit. */
  dispose(): void {
    this.detachAllListeners();
    this.detachClickListeners();
    this.clickTarget = null;
    this.manualMasks.clear();
    this.manualStructures.clear();
    this.active.clear();
    if (this.rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.pendingViewports.clear();
    this.generation.clear();
    this.servicesManager = null;
    this.onDispose();
  }

  /** Hook for subclasses to release their own resources (caches, etc.). */
  protected onDispose(): void {
    /* no-op by default */
  }

  protected services(): Record<string, any> | null {
    return (this.servicesManager?.services as Record<string, any>) ?? null;
  }

  private displaySetForViewport(viewportId: string): string | null {
    const services = this.services();
    const ds = services?.cornerstoneViewportService?.getViewportDisplaySets(viewportId)?.[0];
    return ds?.displaySetInstanceUID ?? null;
  }

  private segmentationIdFor(displaySetInstanceUID: string): string {
    return `${this.segIdPrefix}${displaySetInstanceUID}`;
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

    const segmentationId = this.segmentationIdFor(displaySetInstanceUID);

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
    const segmentationId = this.segmentationIdFor(displaySetInstanceUID);
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

  /** Read the currently displayed slice of `viewportId` as HU values. */
  private readSlice(viewportId: string): {
    slice: SliceContext;
    segVoxel: {
      getScalarDataLength: () => number;
      setAtIndex: (index: number, value: number) => boolean;
    };
    segmentationId: string;
  } | null {
    const services = this.services();
    if (!services) {
      return null;
    }
    const { cornerstoneViewportService } = services;
    const displaySetInstanceUID = this.displaySetForViewport(viewportId);
    if (!displaySetInstanceUID) {
      return null;
    }
    const segmentationId = this.segmentationIdFor(displaySetInstanceUID);

    const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId) as unknown as {
      getCurrentImageId?: () => string;
    } | null;
    const currentImageId = viewport?.getCurrentImageId?.();
    if (!currentImageId) {
      return null;
    }

    const labelmapImageIds = getCurrentLabelmapImageIdsForViewport(viewportId, segmentationId);
    const labelmapImageId = labelmapImageIds?.[0];
    if (!labelmapImageId) {
      return null;
    }

    const segImage = cache.getImage(labelmapImageId);
    const srcImage = cache.getImage(currentImageId);
    if (!segImage?.voxelManager || !srcImage) {
      return null;
    }

    const pixelData = srcImage.getPixelData?.();
    if (!pixelData) {
      return null;
    }

    const width = firstNumber(srcImage.columns, (srcImage as { width?: number }).width);
    const height = firstNumber(srcImage.rows, (srcImage as { height?: number }).height);
    if (!width || !height) {
      return null;
    }

    const segVoxel = segImage.voxelManager as {
      getScalarDataLength: () => number;
      setAtIndex: (index: number, value: number) => boolean;
    };
    const n = width * height;
    if (segVoxel.getScalarDataLength() !== n || pixelData.length < n) {
      return null;
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

    return {
      slice: { imageId: currentImageId, hu, width, height },
      segVoxel,
      segmentationId,
    };
  }

  /** Recompute the overlay for the currently displayed slice of `viewportId`. */
  protected async recompute(viewportId: string): Promise<void> {
    const read = this.readSlice(viewportId);
    if (!read) {
      return;
    }
    const { slice, segVoxel, segmentationId } = read;
    const n = slice.width * slice.height;

    const token = (this.generation.get(viewportId) ?? 0) + 1;
    this.generation.set(viewportId, token);

    const active = [...this.active];
    // Manual (click-prompted) structures are rendered from stored masks; only
    // the remaining structures are auto-computed.
    const autoStructures = active.filter(id => !this.manualStructures.has(id));
    let masks: Map<LungStructureId, Uint8Array> = new Map();
    if (autoStructures.length > 0) {
      try {
        masks = await this.computeMasks(slice, autoStructures);
      } catch {
        masks = new Map();
      }
      // A newer recompute started while we were computing — discard this result.
      if (this.generation.get(viewportId) !== token) {
        return;
      }
    }

    for (let i = 0; i < n; i++) {
      segVoxel.setAtIndex(i, 0);
    }
    for (const structure of LUNG_STRUCTURES) {
      if (!this.active.has(structure.id)) {
        continue;
      }
      const mask = this.manualStructures.has(structure.id)
        ? this.manualMasks.get(this.manualKey(segmentationId, slice.imageId, structure.id))
        : masks.get(structure.id);
      if (!mask) {
        continue;
      }
      const index = SEGMENT_INDEX[structure.id];
      const limit = Math.min(n, mask.length);
      for (let i = 0; i < limit; i++) {
        if (mask[i]) {
          segVoxel.setAtIndex(i, index);
        }
      }
    }

    triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);
  }

  private manualKey(segmentationId: string, imageId: string, structureId: LungStructureId): string {
    return `${segmentationId}::${imageId}::${structureId}`;
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
    if (typeof requestAnimationFrame === 'undefined') {
      void this.recompute(viewportId);
      this.pendingViewports.delete(viewportId);
      return;
    }
    if (this.rafId != null) {
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const viewports = [...this.pendingViewports];
      this.pendingViewports.clear();
      viewports.forEach(id => void this.recompute(id));
    });
  }

  // ---------------------------------------------------------------------------
  // Click-to-prompt
  // ---------------------------------------------------------------------------

  /** Click-to-prompt is meaningful for compact lesions (nodule, ice ball). */
  supportsClickPrompt(structureId: LungStructureId): boolean {
    return structureId === 'nodule' || structureId === 'iceBall';
  }

  /**
   * Enable click-to-prompt for `structureId`: a primary click on a viewport runs
   * a point-prompted segmentation at that location and adds it to the overlay.
   * The structure is forced visible and switches to "manual only".
   */
  enableClickPrompt(
    structureId: LungStructureId,
    viewportIds: string[],
    servicesManager: ServicesManager
  ): void {
    this.servicesManager = servicesManager;
    this.clickTarget = structureId;
    this.active.add(structureId);
    // Switch this structure to manual-only so auto false-positives don't mix in.
    this.manualStructures.add(structureId);

    const services = this.services();
    const cornerstoneViewportService = services?.cornerstoneViewportService;
    if (!cornerstoneViewportService) {
      return;
    }

    for (const viewportId of viewportIds) {
      this.ensureRepresentation(viewportId).then(() => this.applySegmentStyles(viewportId));

      if (this.clickDetachers.has(viewportId)) {
        continue;
      }
      const element = cornerstoneViewportService.getViewportInfo(viewportId)?.getElement?.();
      if (!element) {
        continue;
      }
      const handler = (event: Event) => {
        const mouseEvent = event as MouseEvent;
        if (this.clickTarget == null || mouseEvent.button !== 0) {
          return;
        }
        // Take over the click so cornerstone tools don't pan/window-level.
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        mouseEvent.stopImmediatePropagation();
        void this.segmentAtPoint(viewportId, this.clickTarget, mouseEvent);
      };
      // Capture phase so we run before cornerstone's own handlers.
      element.addEventListener('mousedown', handler, true);
      this.clickDetachers.set(viewportId, () => {
        element.removeEventListener('mousedown', handler, true);
      });
    }

    // Re-render so the target shows manual-only immediately.
    viewportIds.forEach(id => void this.recompute(id));
  }

  /** Disable click-to-prompt and detach click listeners (masks are kept). */
  disableClickPrompt(): void {
    this.clickTarget = null;
    this.detachClickListeners();
  }

  /** Clear click-prompted masks for a structure and revert it to auto-detection. */
  clearClickPrompt(structureId: LungStructureId): void {
    for (const key of [...this.manualMasks.keys()]) {
      if (key.endsWith(`::${structureId}`)) {
        this.manualMasks.delete(key);
      }
    }
    this.manualStructures.delete(structureId);
    [...this.clickDetachers.keys()].forEach(id => void this.recompute(id));
  }

  private detachClickListeners(): void {
    this.clickDetachers.forEach(detach => detach());
    this.clickDetachers.clear();
  }

  /**
   * Point-prompt segmentation for a single click. Default implementation is a
   * model-free region grow around the click; the MedSAM2 provider overrides this
   * to call the model (and falls back to region grow on failure).
   */
  protected async segmentPointMask(
    slice: SliceContext,
    structureId: LungStructureId,
    point: [number, number]
  ): Promise<Uint8Array | null> {
    const { hu, width, height } = slice;
    const field = computeLungField(hu, width, height);
    const seed = point[1] * width + point[0];
    const tolerance = structureId === 'iceBall' ? 140 : 90;
    const maxArea = structureId === 'iceBall' ? 30000 : 3000;
    return regionGrow(hu, width, height, seed, tolerance, field.lungRegion, maxArea);
  }

  /** Convert a click into an image (col,row) point and segment around it. */
  private async segmentAtPoint(
    viewportId: string,
    structureId: LungStructureId,
    event: MouseEvent
  ): Promise<void> {
    const read = this.readSlice(viewportId);
    if (!read) {
      return;
    }
    const { slice, segmentationId } = read;

    const services = this.services();
    const viewport = services?.cornerstoneViewportService?.getCornerstoneViewport(
      viewportId
    ) as unknown as {
      canvasToWorld?: (p: [number, number]) => number[];
      getCanvas?: () => HTMLCanvasElement;
    } | null;
    if (!viewport?.canvasToWorld) {
      return;
    }

    const canvas = viewport.getCanvas?.();
    const rect = (canvas ?? (event.currentTarget as HTMLElement))?.getBoundingClientRect?.();
    if (!rect) {
      return;
    }
    const world = viewport.canvasToWorld([event.clientX - rect.left, event.clientY - rect.top]);
    if (!world) {
      return;
    }
    const ij = csUtils.worldToImageCoords(slice.imageId, world as csTypes.Point3);
    if (!ij) {
      return;
    }
    const col = Math.round(ij[0]);
    const row = Math.round(ij[1]);
    if (col < 0 || col >= slice.width || row < 0 || row >= slice.height) {
      return;
    }

    const mask = await this.segmentPointMask(slice, structureId, [col, row]);
    if (!mask) {
      return;
    }

    // Accumulate clicks: union with any existing manual mask for this slice.
    const key = this.manualKey(segmentationId, slice.imageId, structureId);
    const existing = this.manualMasks.get(key);
    if (existing) {
      const merged = existing.slice();
      const limit = Math.min(merged.length, mask.length);
      for (let i = 0; i < limit; i++) {
        if (mask[i]) {
          merged[i] = 1;
        }
      }
      this.manualMasks.set(key, merged);
    } else {
      this.manualMasks.set(key, mask);
    }
    this.manualStructures.add(structureId);
    this.active.add(structureId);

    await this.recompute(viewportId);
  }
}
