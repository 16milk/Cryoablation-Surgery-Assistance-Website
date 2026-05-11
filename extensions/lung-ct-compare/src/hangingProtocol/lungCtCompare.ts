import { Types } from '@ohif/core';

/** Stable IDs so panels/sync logic can target viewports (see LungComparePanel). */
export const LUNG_VIEWPORT_LEFT = 'lung-compare-left';
export const LUNG_VIEWPORT_RIGHT = 'lung-compare-right';
export const LUNG_VIEWPORT_3D = 'lung-compare-3d';

/** Protocol id (mode `hangingProtocol`, `setHangingProtocol.protocolId`). */
export const LUNG_COMPARE_PROTOCOL_ID = 'lungCtCompare';

/** Hanging-protocol stage ids (for `setHangingProtocol`, URL `stageid`, or layout picker). */
export const LUNG_COMPARE_STAGE_3D_ID = 'lungCtCompare3d';
export const LUNG_COMPARE_STAGE_2UP_ID = 'lungCtCompare2Up';

const stackViewport = (matchedDisplaySetsIndex: number, viewportId: string) => ({
  viewportOptions: {
    viewportId,
    viewportType: 'stack',
    toolGroupId: 'default',
    allowUnmatchedView: true,
  },
  displaySets: [
    {
      id: 'ctStack',
      matchedDisplaySetsIndex,
    },
  ],
});

/**
 * Two CT stacks (left = first matching series, right = second) + optional bottom 3D on the first series.
 * Same Study, multiple CT series. Stage 0 (3 panes) applies when all three viewports match; stage 1 (side‑by‑side only) when the 3D slot cannot be filled (e.g. not reconstructable).
 */
const lungCtCompare: Types.HangingProtocol.Protocol = {
  id: LUNG_COMPARE_PROTOCOL_ID,
  name: 'Lung CT compare',
  description: 'Two CT viewports with optional 3D (reference series)',
  numberOfPriorsReferenced: 0,
  protocolMatchingRules: [],
  imageLoadStrategy: 'interleaveCenter',
  toolGroupIds: ['default', 'volume3d'],
  displaySetSelectors: {
    ctStack: {
      seriesMatchingRules: [
        {
          weight: 2,
          attribute: 'Modality',
          constraint: { equals: { value: 'CT' } },
          required: true,
        },
        {
          weight: 1,
          attribute: 'numImageFrames',
          constraint: { greaterThan: { value: 0 } },
        },
      ],
    },
  },
  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
      allowUnmatchedView: true,
    },
    displaySets: [
      {
        id: 'ctStack',
        matchedDisplaySetsIndex: 0,
      },
    ],
  },
  stages: [
    {
      id: LUNG_COMPARE_STAGE_3D_ID,
      name: 'lungCtCompare3d',
      stageActivation: {
        enabled: {
          minViewportsMatched: 3,
        },
      },
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 2,
          columns: 2,
          layoutOptions: [
            { x: 0, y: 0, width: 0.5, height: 0.58 },
            { x: 0.5, y: 0, width: 0.5, height: 0.58 },
            { x: 0, y: 0.58, width: 1, height: 0.42 },
          ],
        },
      },
      viewports: [
        stackViewport(0, LUNG_VIEWPORT_LEFT),
        stackViewport(1, LUNG_VIEWPORT_RIGHT),
        {
          viewportOptions: {
            viewportId: LUNG_VIEWPORT_3D,
            toolGroupId: 'volume3d',
            viewportType: 'volume3d',
            orientation: 'coronal',
            allowUnmatchedView: true,
            customViewportProps: {
              hideOverlays: true,
            },
          },
          displaySets: [
            {
              id: 'ctStack',
              matchedDisplaySetsIndex: 0,
              options: {
                displayPreset: {
                  CT: 'CT-Bone',
                  default: 'CT-Bone',
                },
              },
            },
          ],
        },
      ],
    },
    {
      id: LUNG_COMPARE_STAGE_2UP_ID,
      name: 'lungCtCompare2Up',
      stageActivation: {
        enabled: {
          minViewportsMatched: 2,
        },
      },
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 2,
        },
      },
      viewports: [stackViewport(0, LUNG_VIEWPORT_LEFT), stackViewport(1, LUNG_VIEWPORT_RIGHT)],
    },
  ],
};

export default lungCtCompare;
