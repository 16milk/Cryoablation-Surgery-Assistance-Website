import {
  cache,
  Enums as csCoreEnums,
  geometryLoader,
  imageLoader,
  metaData,
  Types as csTypes,
  volumeLoader,
} from '@cornerstonejs/core';
import { Enums as csToolsEnums, segmentation as cstSegmentation } from '@cornerstonejs/tools';
import type { ServicesManager } from '@ohif/core';

import { buildBlockSurfaceFromSegment, chooseSurfaceStep } from './blockSurfaceMesh';

/** Must match `extensions/cornerstone/src/constants`. */
const VOLUME_LOADER_SCHEME = 'cornerstoneStreamingImageVolume';
const { Labelmap: LABELMAP, Surface: SURFACE } = csToolsEnums.SegmentationRepresentations;
const { addRepresentationData } = cstSegmentation;

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

const { triggerSegmentationEvents } = cstSegmentation;

function ctVolumeIdForDisplaySet(displaySetInstanceUID: string, volumeLoaderSchema?: string): string {
  return `${volumeLoaderSchema ?? VOLUME_LOADER_SCHEME}:${displaySetInstanceUID}`;
}

/** Ensure the baseline CT volume exists in cache (required for derived labelmaps). */
async function ensureCtVolumeLoaded(
  displaySet: { displaySetInstanceUID: string; imageIds?: string[]; volumeLoaderSchema?: string },
  referenceImageIds: string[]
): Promise<string> {
  const volumeId = ctVolumeIdForDisplaySet(displaySet.displaySetInstanceUID, displaySet.volumeLoaderSchema);
  if (!cache.getVolume(volumeId)) {
    await volumeLoader.createAndCacheVolume(volumeId, { imageIds: referenceImageIds });
  }
  return volumeId;
}

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

function surfaceGeometryId(segmentationId: string, segmentIndex: number): string {
  return `${segmentationId}::surface::${segmentIndex}`;
}

/**
 * Build Cornerstone surface geometries in-process so the 3D viewport never needs
 * polySeg WASM (which throws "Failed to convert labelmap to surface").
 */
async function precomputeBlockSurfaces(
  segmentationId: string,
  labelmapVolume: {
    dimensions: number[];
    spacing: number[];
    origin: number[];
    direction: number[];
    metadata?: { FrameOfReferenceUID?: string };
    voxelManager: { getCompleteScalarDataArray: () => ArrayLike<number> };
  },
  ctVolume: { metadata?: { FrameOfReferenceUID?: string } } | undefined,
  builtChannels: LungStructureId[]
): Promise<Map<number, string>> {
  const [width, height, depth] = labelmapVolume.dimensions;
  const scalar = labelmapVolume.voxelManager.getCompleteScalarDataArray();
  const spacing = labelmapVolume.spacing as [number, number, number];
  const origin = labelmapVolume.origin as [number, number, number];
  const direction = [...labelmapVolume.direction];
  const frameOfReferenceUID =
    ctVolume?.metadata?.FrameOfReferenceUID ??
    labelmapVolume.metadata?.FrameOfReferenceUID ??
    '';
  const step = chooseSurfaceStep(width * height * depth);
  const geometryIds = new Map<number, string>();

  for (const channelId of builtChannels) {
    const segmentIndex = SEGMENT_INDEX[channelId];
    const structure = LUNG_STRUCTURES.find(s => s.id === channelId);
    const mesh = buildBlockSurfaceFromSegment(
      scalar,
      width,
      height,
      depth,
      segmentIndex,
      spacing,
      origin,
      direction,
      step
    );
    if (!mesh || !structure) {
      continue;
    }

    const geometryId = surfaceGeometryId(segmentationId, segmentIndex);
    const [r, g, b] = structure.colorRgb;
    // eslint-disable-next-line no-await-in-loop
    await geometryLoader.createAndCacheGeometry(geometryId, {
      type: csCoreEnums.GeometryType.SURFACE,
      geometryData: {
        id: geometryId,
        color: [r, g, b],
        frameOfReferenceUID,
        points: mesh.points,
        polys: mesh.polys,
        segmentIndex,
        visible: true,
      },
    });
    geometryIds.set(segmentIndex, geometryId);
  }

  return geometryIds;
}

function removeSurfaceGeometries(segmentationId: string): void {
  for (const structure of LUNG_STRUCTURES) {
    const geometryId = surfaceGeometryId(segmentationId, SEGMENT_INDEX[structure.id]);
    if (cache.getGeometry(geometryId)) {
      try {
        cache.removeGeometryLoadObject(geometryId);
      } catch {
        /* already removed */
      }
    }
  }
}

/**
 * Builds a labelmap from the segmented CT slices and renders it as block
 * surfaces in the bottom 3D viewport (no polySeg WASM). One labelmap
 * segmentation per display set, one segment per channel.
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
    removeSurfaceGeometries(segmentationId);
    if (cache.getVolume(segmentationId)) {
      try {
        cache.removeVolumeLoadObject(segmentationId);
      } catch {
        /* volume may already be gone */
      }
    }

    const ctVolumeId = await ensureCtVolumeLoaded(displaySet, referenceImageIds);
    await volumeLoader.createAndCacheDerivedLabelmapVolume(ctVolumeId, { volumeId: segmentationId });

    const labelmapVolume = cache.getVolume(segmentationId);
    if (!labelmapVolume?.voxelManager) {
      throw new Error('lung-ct-compare 3D: failed to create labelmap volume');
    }

    const segments: Record<number, { label: string; active?: boolean }> = {};
    for (const id of builtChannels) {
      const index = SEGMENT_INDEX[id];
      segments[index] = { label: id, active: index === SEGMENT_INDEX[builtChannels[0]] };
    }

    segmentationService.addOrUpdateSegmentation({
      segmentationId,
      representation: {
        type: LABELMAP,
        data: { volumeId: segmentationId },
      },
      config: {
        label: 'Lung 3D model',
        segments,
      },
    });

    const [width, height, depth] = labelmapVolume.dimensions;
    if (!width || !height || !depth) {
      throw new Error(
        'lung-ct-compare 3D: CT volume not ready — wait for the bottom 3D view to finish loading'
      );
    }
    const sliceSize = width * height;
    const scalar = labelmapVolume.voxelManager.getCompleteScalarDataArray();
    scalar.fill(0);

    const total = Math.min(referenceImageIds.length, depth);
    for (let z = 0; z < total; z++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const srcImageId = referenceImageIds[z];
      if (!srcImageId) {
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

      if (slice) {
        const field = computeLungField(slice.hu, slice.width, slice.height);
        const plane = Math.min(sliceSize, slice.width * slice.height);
        const base = z * sliceSize;
        for (const generator of generators) {
          const mask = generator.computeSliceMask(slice, field);
          if (!mask) {
            continue;
          }
          const index = SEGMENT_INDEX[generator.id];
          const limit = Math.min(plane, mask.length);
          for (let p = 0; p < limit; p++) {
            if (mask[p]) {
              scalar[base + p] = index;
            }
          }
        }
      }

      onProgress?.(z + 1, total);
      if (z % YIELD_EVERY === YIELD_EVERY - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    labelmapVolume.voxelManager.setCompleteScalarDataArray(scalar);
    triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);

    const ctVolume = cache.getVolume(ctVolumeId);
    const geometryIds = await precomputeBlockSurfaces(
      segmentationId,
      labelmapVolume,
      ctVolume,
      builtChannels
    );
    if (geometryIds.size === 0) {
      throw new Error('lung-ct-compare 3D: no surface geometry generated from labelmap');
    }

    // Pre-register Surface data so the 3D viewport skips polySeg conversion.
    addRepresentationData({
      segmentationId,
      type: SURFACE,
      data: { geometryIds },
    });

    await segmentationService.addSegmentationRepresentation(viewportId, {
      segmentationId,
      type: SURFACE,
    });

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
    removeSurfaceGeometries(segmentationId);
    if (cache.getVolume(segmentationId)) {
      try {
        cache.removeVolumeLoadObject(segmentationId);
      } catch {
        /* already removed */
      }
    }
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
