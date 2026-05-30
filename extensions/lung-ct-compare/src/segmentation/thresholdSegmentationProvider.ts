import { LungStructureId, setLungSegmentationProvider } from './lungSegmentation';
import { computeLungField, computeStructureMask } from './lungThresholding';
import { BaseLungSegmentationProvider, SliceContext } from './baseLungSegmentationProvider';

const SEG_ID_PREFIX = 'lungct-threshold::';

/**
 * Real, browser-side segmentation backend driven entirely by CT Hounsfield-unit
 * thresholds — no external model or mask data required. All cornerstone wiring
 * lives in BaseLungSegmentationProvider; this class only classifies a slice.
 */
class ThresholdLungSegmentationProvider extends BaseLungSegmentationProvider {
  constructor() {
    super(SEG_ID_PREFIX);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async computeMasks(
    slice: SliceContext,
    active: LungStructureId[]
  ): Promise<Map<LungStructureId, Uint8Array>> {
    const { hu, width, height } = slice;
    const field = computeLungField(hu, width, height);
    const masks = new Map<LungStructureId, Uint8Array>();
    for (const id of active) {
      masks.set(id, computeStructureMask(id, hu, field, width, height));
    }
    return masks;
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
