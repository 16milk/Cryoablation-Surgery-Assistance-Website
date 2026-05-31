import {
  cache,
  imageLoader,
  metaData,
  Types as csTypes,
} from '@cornerstonejs/core';
import { segmentation as cstSegmentation } from '@cornerstonejs/tools';
import type { ServicesManager } from '@ohif/core';

import {
  LUNG_STRUCTURES,
  LungStructureId,
} from '../segmentation/lungSegmentation';
import { firstNumber } from '../segmentation/baseLungSegmentationProvider';
import type { SliceContext } from '../segmentation/baseLungSegmentationProvider';
import {
  SEGMENT_INDEX,
  computeLungField,
  computeVesselMask,
  computeNoduleMask,
  computeIceBallMask,
} from '../segmentation/lungThresholding';
import {
  Lung3DBuildContext,
  Lung3DBuildResult,
  Lung3DChannelMaskGenerator,
  Lung3DClearContext,
  Lung3DModelProvider,
  getLung3DChannel,
  registerLung3DChannel,
  setLung3DModelProvider,
} from './lung3DModel';

const { getLabelmapImageIds, triggerSegmentationEvents } = cstSegmentation;

/** Process this many slices between event-loop yields to keep the UI responsive. */
const YIELD_EVERY = 6;

/** Read a cached/loaded cornerstone image as Hounsfield-unit values. */
function imageToHu(imageId: string): SliceContext | null {
  const image = cache.getImage(imageId);
  if (!image) {
    return null;
  }
  const pixelData = image.getPixelData?.();
  if (!pixelData) {
    return null;
  }
  const width = firstNumber(image.columns, (image as { width?: number }).width);
  const height = firstNumber(image.rows, (image as { height?: number }).height);
  if (!width || !height) {
    return null;
  }

  const modalityLut = (metaData.get('modalityLutModule', imageId) || {}) as {
    rescaleSlope?: number;
    rescaleIntercept?: number;
  };
  const slope = firstNumber(image.slope, modalityLut.rescaleSlope) ?? 1;
  const intercept = firstNumber(image.intercept, modalityLut.rescaleIntercept) ?? 0;

  const n = width * height;
  const hu = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    hu[i] = pixelData[i] * slope + intercept;
  }
  return { imageId, hu, width, height };
}

/**
 * Builds a labelmap from the segmented CT slices and lets Cornerstone
 * surface-render it in the bottom 3D viewport (polySeg labelmap→surface). One
 * labelmap segmentation per display set, one segment index per channel.
 */
class LungSurfaceModelProvider implements Lung3DModelProvider {
  private readonly segIdPrefix = 'lung-3d-model::';
  private servicesManager: ServicesManager | null = null;

  supportsChannel(structureId: LungStructureId): boolean {
    return getLung3DChannel(structureId)?.implemented ?? false;
  }

  private segmentationIdFor(displaySetInstanceUID: string): string {
    return `${this.segIdPrefix}${displaySetInstanceUID}`;
  }

  private services(context: { servicesManager: ServicesManager }): Record<string, any> {
    this.servicesManager = context.servicesManager;
    return context.servicesManager.services as Record<string, any>;
  }

  async build(context: Lung3DBuildContext): Promise<Lung3DBuildResult> {
    const { displaySetInstanceUID, viewportId, channels, signal, onProgress } = context;
    const services = this.services(context);
    const { segmentationService, displaySetService } = services;

    const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
    if (!displaySet) {
      throw new Error('lung-ct-compare 3D: display set not found');
    }
    const referenceImageIds: string[] = displaySet.imageIds ?? [];
    if (referenceImageIds.length === 0) {
      throw new Error('lung-ct-compare 3D: display set has no images');
    }

    // Only build channels that are requested AND have a working generator.
    const generators: Lung3DChannelMaskGenerator[] = [];
    const builtChannels: LungStructureId[] = [];
    const skippedChannels: LungStructureId[] = [];
    for (const id of channels) {
      const generator = getLung3DChannel(id);
      if (generator?.implemented) {
        generators.push(generator);
        builtChannels.push(id);
      } else {
        skippedChannels.push(id);
      }
    }
    if (generators.length === 0) {
      throw new Error('lung-ct-compare 3D: no implemented channels selected');
    }

    const segmentationId = this.segmentationIdFor(displaySetInstanceUID);

    // Rebuild from scratch so stale surfaces/labels never linger.
    if (segmentationService.getSegmentation(segmentationId)) {
      try {
        segmentationService.removeRepresentationsFromViewport(viewportId, { segmentationId });
      } catch {
        /* representation may not exist yet */
      }
      segmentationService.remove(segmentationId);
    }

    const segments: Record<number, { label: string; active?: boolean }> = {};
    for (const structure of LUNG_STRUCTURES) {
      const index = SEGMENT_INDEX[structure.id];
      segments[index] = { label: structure.id, active: index === 1 };
    }
    await segmentationService.createLabelmapForDisplaySet(displaySet, {
      segmentationId,
      label: 'Lung 3D model',
      segments,
    });

    const labelmapImageIds = getLabelmapImageIds(segmentationId) as unknown as string[];
    if (!labelmapImageIds?.length) {
      throw new Error('lung-ct-compare 3D: labelmap images missing');
    }

    const total = referenceImageIds.length;
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const srcImageId = referenceImageIds[i];
      const segImageId = labelmapImageIds[i];
      if (!srcImageId || !segImageId) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      let slice = imageToHu(srcImageId);
      if (!slice) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await imageLoader.loadAndCacheImage(srcImageId);
        } catch {
          /* skip unreadable slice */
        }
        slice = imageToHu(srcImageId);
      }

      const segImage = cache.getImage(segImageId);
      const voxel = segImage?.voxelManager as
        | {
            getScalarData: () => { length: number; fill: (v: number) => void; [i: number]: number };
            setScalarData: (data: { length: number }) => void;
          }
        | undefined;

      if (slice && voxel) {
        const scalar = voxel.getScalarData();
        const n = Math.min(scalar.length, slice.width * slice.height);
        scalar.fill(0);
        const field = computeLungField(slice.hu, slice.width, slice.height);
        for (const generator of generators) {
          const mask = generator.computeSliceMask(slice, field);
          if (!mask) {
            continue;
          }
          const index = SEGMENT_INDEX[generator.id];
          const limit = Math.min(n, mask.length);
          for (let p = 0; p < limit; p++) {
            if (mask[p]) {
              scalar[p] = index;
            }
          }
        }
        voxel.setScalarData(scalar);
      }

      onProgress?.(i + 1, total);
      if (i % YIELD_EVERY === YIELD_EVERY - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);

    // Surface-render in the 3D viewport (VOLUME_3D defaults to SURFACE, which
    // polySeg computes from the labelmap we just filled).
    await segmentationService.addSegmentationRepresentation(viewportId, { segmentationId });

    for (const structure of LUNG_STRUCTURES) {
      const index = SEGMENT_INDEX[structure.id];
      const visible = builtChannels.includes(structure.id);
      const [r, g, b] = structure.colorRgb;
      try {
        segmentationService.setSegmentColor(viewportId, segmentationId, index, [
          r,
          g,
          b,
          255,
        ] as csTypes.Color);
        segmentationService.setSegmentVisibility(viewportId, segmentationId, index, visible);
      } catch {
        /* color/visibility best-effort */
      }
    }

    return { segmentationId, builtChannels, skippedChannels, sliceCount: total };
  }

  clear(context: Lung3DClearContext): void {
    const { viewportId, displaySetInstanceUID } = context;
    const services = this.services(context);
    const { segmentationService } = services;
    const segmentationId = this.segmentationIdFor(displaySetInstanceUID);
    if (!segmentationService.getSegmentation(segmentationId)) {
      return;
    }
    try {
      segmentationService.removeRepresentationsFromViewport(viewportId, { segmentationId });
    } catch {
      /* representation may already be gone */
    }
    segmentationService.remove(segmentationId);
  }

  dispose(): void {
    this.servicesManager = null;
  }
}

/**
 * Lung parenchyma: the interior air space of the lungs. This is the most
 * reliable 2D segmentation, so it is the only channel enabled in 3D for now.
 */
const parenchymaChannel: Lung3DChannelMaskGenerator = {
  id: 'lungParenchyma',
  implemented: true,
  computeSliceMask: (_slice, field) => field.interiorAir,
};

/**
 * Reserved channels. Wired to their existing 2D mask functions but flagged
 * `implemented: false` until their quality is good enough for 3D — flip the
 * flag to enable them with no further plumbing.
 */
const vesselChannel: Lung3DChannelMaskGenerator = {
  id: 'vessel',
  implemented: false,
  computeSliceMask: (slice, field) =>
    computeVesselMask(slice.hu, field.lungRegion, slice.width, slice.height),
};

const noduleChannel: Lung3DChannelMaskGenerator = {
  id: 'nodule',
  implemented: false,
  computeSliceMask: (slice, field) =>
    computeNoduleMask(slice.hu, field.lungRegion, slice.width, slice.height),
};

const iceBallChannel: Lung3DChannelMaskGenerator = {
  id: 'iceBall',
  implemented: false,
  computeSliceMask: (slice, field) =>
    computeIceBallMask(slice.hu, field.lungRegion, slice.width, slice.height),
};

// Register all four channels at module load so the panel can list them.
registerLung3DChannel(parenchymaChannel);
registerLung3DChannel(vesselChannel);
registerLung3DChannel(noduleChannel);
registerLung3DChannel(iceBallChannel);

let singleton: LungSurfaceModelProvider | null = null;

/** Activate the surface-based 3D-model backend (idempotent). */
export function registerLungSurface3DModel(): void {
  if (!singleton) {
    singleton = new LungSurfaceModelProvider();
  }
  setLung3DModelProvider(singleton);
}

/** Deactivate the 3D-model backend and reset to the no-op stub. */
export function unregisterLungSurface3DModel(): void {
  if (singleton) {
    singleton.dispose();
    singleton = null;
  }
  setLung3DModelProvider(null);
}
