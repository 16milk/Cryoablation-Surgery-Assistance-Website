import type { CommandsManager, ServicesManager } from '@ohif/core';

import type { LungStructureId } from '../segmentation/lungSegmentation';
import type { SliceContext } from '../segmentation/baseLungSegmentationProvider';
import type { LungField } from '../segmentation/lungThresholding';

/**
 * Pluggable 3D-model architecture for the bottom volume viewport.
 *
 * The bottom panel reconstructs a 3D model from the segmented CT slices. Each
 * segmentable structure (lung parenchyma / vessel / nodule / ice ball) is an
 * independent *channel*: a generator that turns a single CT slice into a 0/1
 * mask. The model builder stacks every slice's masks into a labelmap and lets
 * Cornerstone surface-render it in the 3D viewport, one colored surface per
 * channel.
 *
 * Only the lung-parenchyma channel is implemented today (its 2D segmentation is
 * the most reliable). The other three channels are registered as reserved
 * interfaces — wired to their existing 2D mask functions but flagged
 * `implemented: false` so the UI offers them as "coming soon". Enabling one is a
 * single flag flip once its quality is good enough.
 */
export interface Lung3DChannelMaskGenerator {
  /** Which structure this channel reconstructs. */
  readonly id: LungStructureId;
  /**
   * Whether this channel is production-ready. The builder only fills channels
   * that are both requested by the UI and `implemented`. Reserved channels keep
   * their generator wired so turning them on later needs no plumbing changes.
   */
  readonly implemented: boolean;
  /**
   * Classify one CT slice into a 0/1 mask (length `width * height`, row-major).
   * `field` is the precomputed lung field for the slice so channels can confine
   * themselves to the lungs without recomputing the flood fill. Return `null`
   * for an empty slice.
   */
  computeSliceMask(slice: SliceContext, field: LungField): Uint8Array | null;
}

const channelGenerators = new Map<LungStructureId, Lung3DChannelMaskGenerator>();

/** Register (or replace) the mask generator for a 3D channel. */
export function registerLung3DChannel(generator: Lung3DChannelMaskGenerator): void {
  channelGenerators.set(generator.id, generator);
}

/** Remove a previously registered 3D channel generator. */
export function unregisterLung3DChannel(id: LungStructureId): void {
  channelGenerators.delete(id);
}

/** Look up a channel's generator, if registered. */
export function getLung3DChannel(id: LungStructureId): Lung3DChannelMaskGenerator | undefined {
  return channelGenerators.get(id);
}

/** Ids of channels that have a production-ready generator (UI selectable). */
export function getImplementedLung3DChannels(): LungStructureId[] {
  return [...channelGenerators.values()].filter(g => g.implemented).map(g => g.id);
}

/** Inputs for building the 3D model on the bottom viewport. */
export interface Lung3DBuildContext {
  /** Display set rendered in the 3D viewport (normally the baseline series). */
  displaySetInstanceUID: string;
  /** Cornerstone viewport id of the 3D volume viewport. */
  viewportId: string;
  /** Channels requested by the UI; only implemented ones are actually built. */
  channels: LungStructureId[];
  servicesManager: ServicesManager;
  commandsManager: CommandsManager;
  /** Cancels a long build (e.g. the user navigated away or rebuilt). */
  signal?: AbortSignal;
  /** Slice-by-slice progress for a UI indicator. */
  onProgress?: (completed: number, total: number) => void;
}

export interface Lung3DBuildResult {
  segmentationId: string;
  /** Channels that were reconstructed into the surface. */
  builtChannels: LungStructureId[];
  /** Requested channels skipped because they are not implemented yet. */
  skippedChannels: LungStructureId[];
  /** Number of CT slices processed. */
  sliceCount: number;
}

export interface Lung3DClearContext {
  viewportId: string;
  displaySetInstanceUID: string;
  servicesManager: ServicesManager;
}

/**
 * Backend that reconstructs and renders the 3D model. Swappable via
 * `setLung3DModelProvider` so the surface implementation can be replaced (e.g.
 * a server-side mesher) without touching the panel.
 */
export interface Lung3DModelProvider {
  /** Build the labelmap from the requested channels and surface-render it. */
  build(context: Lung3DBuildContext): Promise<Lung3DBuildResult>;
  /** Remove the 3D model from the viewport and release its segmentation. */
  clear(context: Lung3DClearContext): void | Promise<void>;
  /** Whether a channel can currently be reconstructed in 3D. */
  supportsChannel(structureId: LungStructureId): boolean;
  /** Release any resources held by the provider. */
  dispose(): void;
}

const noopProvider: Lung3DModelProvider = {
  build: async context => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info('[lung-ct-compare] 3D model build (stub):', context.channels);
    }
    return {
      segmentationId: '',
      builtChannels: [],
      skippedChannels: [...context.channels],
      sliceCount: 0,
    };
  },
  clear: () => {
    /* no-op */
  },
  supportsChannel: () => false,
  dispose: () => {
    /* no-op */
  },
};

let activeProvider: Lung3DModelProvider = noopProvider;

/** Register the 3D-model backend. Pass `null` to reset to the no-op stub. */
export function setLung3DModelProvider(provider: Lung3DModelProvider | null): void {
  activeProvider = provider ?? noopProvider;
}

/** Get the currently registered 3D-model backend (stub by default). */
export function getLung3DModelProvider(): Lung3DModelProvider {
  return activeProvider;
}
