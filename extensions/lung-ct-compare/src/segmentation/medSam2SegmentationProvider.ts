import { LungStructureId, setLungSegmentationProvider } from './lungSegmentation';
import { computeLungField, computeStructureMask } from './lungThresholding';
import { BaseLungSegmentationProvider, SliceContext } from './baseLungSegmentationProvider';
import { MedSam2Box, encodeHu, medsam2Health, medsam2Segment } from './medsam2Client';

/** Half-size (px) of the box hint sent alongside a click point to stabilize SAM. */
const POINT_BOX_HALF = 48;

const SEG_ID_PREFIX = 'lungct-medsam2::';

/** CT window [center, width] per structure used to normalize HU for the model. */
const STRUCTURE_WINDOW: Record<LungStructureId, [number, number]> = {
  lungParenchyma: [-500, 1400],
  vessel: [-100, 700],
  nodule: [-100, 700],
  iceBall: [-200, 800],
};

/**
 * Structures suited to a single bounding-box prompt (compact, blob-like). The
 * distributed structures — whole-lung `lungParenchyma` and the branching
 * `vessel` tree — are computed analytically instead, because a single box that
 * spans the whole lung carries no useful localization for MedSAM2.
 */
const MODEL_STRUCTURES: ReadonlySet<LungStructureId> = new Set<LungStructureId>([
  'nodule',
  'iceBall',
]);

/** Pixels added around the threshold-derived box so the prompt isn't too tight. */
const BOX_PADDING = 6;

/** Max cached slice masks (per provider) to bound memory during long sessions. */
const MAX_CACHE = 256;

function boundingBox(
  mask: Uint8Array,
  width: number,
  height: number
): MedSam2Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }
  if (maxX < 0) {
    return null;
  }
  const x0 = Math.max(0, minX - BOX_PADDING);
  const y0 = Math.max(0, minY - BOX_PADDING);
  const x1 = Math.min(width - 1, maxX + BOX_PADDING);
  const y1 = Math.min(height - 1, maxY + BOX_PADDING);
  return [x0, y0, x1, y1];
}

function intersect(mask: Uint8Array, region: Uint8Array): Uint8Array {
  const n = Math.min(mask.length, region.length);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < n; i++) {
    out[i] = mask[i] && region[i] ? 1 : 0;
  }
  return out;
}

/**
 * Segmentation backend powered by the MedSAM2 foundation model.
 *
 * For each toggled structure on the current slice we:
 *   1. derive a coarse region with the same HU thresholds used by the
 *      threshold backend (this seeds an automatic bounding-box prompt — MedSAM2
 *      is promptable, not a fixed 4-class classifier),
 *   2. send the slice + box to the MedSAM2 service for a refined mask,
 *   3. confine non-parenchyma masks to the lung field to avoid leakage.
 *
 * If the service is unreachable or has no weights loaded, we transparently fall
 * back to the pure threshold mask, so the UI keeps working with zero setup and
 * automatically upgrades once MedSAM2 is running.
 */
class MedSam2LungSegmentationProvider extends BaseLungSegmentationProvider {
  private readonly cache = new Map<string, Uint8Array>();
  private availableUntil = 0;
  private unavailableUntil = 0;
  private probing: Promise<boolean> | null = null;

  constructor() {
    super(SEG_ID_PREFIX);
  }

  async computeMasks(
    slice: SliceContext,
    active: LungStructureId[]
  ): Promise<Map<LungStructureId, Uint8Array>> {
    const { hu, width, height, imageId } = slice;
    const field = computeLungField(hu, width, height);
    const out = new Map<LungStructureId, Uint8Array>();

    // Distributed structures (lung parenchyma, vessel tree) are computed
    // analytically — they don't benefit from a single box prompt.
    const modelActive = active.filter(id => MODEL_STRUCTURES.has(id));
    for (const id of active) {
      if (!MODEL_STRUCTURES.has(id)) {
        out.set(id, computeStructureMask(id, hu, field, width, height));
      }
    }

    const available = modelActive.length > 0 && (await this.ensureAvailable());
    const huBase64 = available ? encodeHu(hu) : '';

    for (const id of modelActive) {
      const cacheKey = `${imageId}::${id}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.touch(cacheKey, cached);
        out.set(id, cached);
        continue;
      }

      const thresholdMask = computeStructureMask(id, hu, field, width, height);

      if (!available) {
        out.set(id, thresholdMask);
        continue;
      }

      const box = boundingBox(thresholdMask, width, height);
      if (!box) {
        // Nothing of this structure on this slice — empty mask, no model call.
        out.set(id, new Uint8Array(width * height));
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const raw = await medsam2Segment({
          width,
          height,
          huBase64,
          structure: id,
          box,
          window: STRUCTURE_WINDOW[id],
        });
        // Model structures (nodule / ice ball) live inside the lung field.
        const refined = intersect(raw, field.lungRegion);
        this.put(cacheKey, refined);
        out.set(id, refined);
      } catch {
        this.markUnavailable();
        out.set(id, thresholdMask);
      }
    }

    return out;
  }

  /**
   * Click-to-prompt: send the clicked point (plus a small box hint) to MedSAM2
   * for a precise mask of that single lesion. Falls back to the model-free
   * region grow (base implementation) when the service is unavailable.
   */
  protected async segmentPointMask(
    slice: SliceContext,
    structureId: LungStructureId,
    point: [number, number]
  ): Promise<Uint8Array | null> {
    const { hu, width, height } = slice;
    if (await this.ensureAvailable()) {
      const [col, row] = point;
      const box: MedSam2Box = [
        Math.max(0, col - POINT_BOX_HALF),
        Math.max(0, row - POINT_BOX_HALF),
        Math.min(width - 1, col + POINT_BOX_HALF),
        Math.min(height - 1, row + POINT_BOX_HALF),
      ];
      try {
        const raw = await medsam2Segment({
          width,
          height,
          huBase64: encodeHu(hu),
          structure: structureId,
          points: [[col, row, 1]],
          box,
          window: STRUCTURE_WINDOW[structureId],
        });
        const field = computeLungField(hu, width, height);
        return intersect(raw, field.lungRegion);
      } catch {
        this.markUnavailable();
      }
    }
    return super.segmentPointMask(slice, structureId, point);
  }

  protected onDispose(): void {
    this.cache.clear();
    this.availableUntil = 0;
    this.unavailableUntil = 0;
    this.probing = null;
  }

  /** Health-gate model calls so a down service doesn't get hit on every scroll. */
  private async ensureAvailable(): Promise<boolean> {
    const now = Date.now();
    if (now < this.unavailableUntil) {
      return false;
    }
    if (now < this.availableUntil) {
      return true;
    }
    if (!this.probing) {
      this.probing = medsam2Health()
        .then(health => {
          const ok = health.ok && health.modelLoaded;
          if (ok) {
            this.availableUntil = Date.now() + 30000;
          } else {
            this.unavailableUntil = Date.now() + 15000;
          }
          return ok;
        })
        .catch(() => {
          this.unavailableUntil = Date.now() + 15000;
          return false;
        })
        .finally(() => {
          this.probing = null;
        });
    }
    return this.probing;
  }

  private markUnavailable(): void {
    this.unavailableUntil = Date.now() + 15000;
    this.availableUntil = 0;
  }

  private touch(key: string, value: Uint8Array): void {
    this.cache.delete(key);
    this.cache.set(key, value);
  }

  private put(key: string, value: Uint8Array): void {
    this.cache.set(key, value);
    while (this.cache.size > MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.cache.delete(oldest);
    }
  }
}

let instance: MedSam2LungSegmentationProvider | null = null;

/**
 * Register the MedSAM2-backed segmentation provider as active. Falls back to HU
 * thresholds automatically when the MedSAM2 service is unavailable.
 */
export function registerMedSam2LungSegmentation(): MedSam2LungSegmentationProvider {
  if (!instance) {
    instance = new MedSam2LungSegmentationProvider();
  }
  setLungSegmentationProvider(instance);
  return instance;
}

/** Tear down listeners/cache and restore the no-op provider. Call on mode exit. */
export function unregisterMedSam2LungSegmentation(): void {
  instance?.dispose();
  instance = null;
  setLungSegmentationProvider(null);
}

export { MedSam2LungSegmentationProvider };
