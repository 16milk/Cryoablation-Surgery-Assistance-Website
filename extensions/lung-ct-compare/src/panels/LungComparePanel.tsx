import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Enums, metaData, StackViewport } from '@cornerstonejs/core';
import { useSystem } from '@ohif/core';
import {
  Button,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ohif/ui-next';

import {
  findNearestSliceIndexByAxis,
  normalFromImagePlane,
  stackCoordinate,
} from '../utils/spatialSync';
import { Vec3, mapBaselineToCompare, mapCompareToBaseline } from '../registration/lungRegistration';
import {
  LUNG_COMPARE_PROTOCOL_ID,
  LUNG_COMPARE_STAGE_2UP_ID,
  LUNG_COMPARE_STAGE_3D_ID,
  LUNG_VIEWPORT_LEFT,
  LUNG_VIEWPORT_RIGHT,
  LUNG_VIEWPORT_3D,
} from '../hangingProtocol/lungCtCompare';
import {
  LUNG_STRUCTURES,
  LungStructureDef,
  LungStructureId,
  getLungSegmentationProvider,
} from '../segmentation/lungSegmentation';
import { getImplementedLung3DChannels, getLung3DModelProvider } from '../model3d/lung3DModel';

const OUT_OF_RANGE_MM = 18;
const CLICK_PROMPT_ROI_MIN = 40;
const CLICK_PROMPT_ROI_MAX = 192;
const CLICK_PROMPT_ROI_STEP = 8;

const LAYOUT_PREF_STORAGE_KEY = 'ohif.lungCtCompare.layoutPreference';

function readLayoutPreference(): '3d' | '2up' | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    const v = window.localStorage.getItem(LAYOUT_PREF_STORAGE_KEY);
    return v === '2up' || v === '3d' ? v : null;
  } catch {
    return null;
  }
}

function writeLayoutPreference(value: '3d' | '2up') {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAYOUT_PREF_STORAGE_KEY, value);
    }
  } catch {
    /* quota / private mode */
  }
}

/** OHIF stack handlers set `numImageFrames`; `numImages` / `images` may be unset until hydrate. */
function ctSliceCount(ds: {
  numImages?: number;
  numImageFrames?: number;
  instances?: unknown[];
  images?: unknown[];
}) {
  return ds.numImages ?? ds.numImageFrames ?? ds.instances?.length ?? ds.images?.length ?? 0;
}

function ctDisplaySets(displaySetService) {
  return displaySetService.getActiveDisplaySets().filter(ds => {
    return (
      ds.Modality === 'CT' && !ds.isOverlayDisplaySet && !ds.unsupported && ctSliceCount(ds) > 0
    );
  });
}

export default function LungComparePanel() {
  const { t } = useTranslation('LungCtCompare');
  const { commandsManager, servicesManager } = useSystem();
  const {
    displaySetService,
    cornerstoneViewportService,
    viewportGridService,
    hangingProtocolService,
    uiNotificationService,
  } = servicesManager.services;
  const [searchParams] = useSearchParams();

  const [baselineUid, setBaselineUid] = useState<string | null>(null);
  const [compareUid, setCompareUid] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [reconstructHint, setReconstructHint] = useState<string | null>(null);

  const applyingRemoteRef = useRef(false);
  const urlSeriesAppliedRef = useRef(false);
  const compareLayoutUrlAppliedRef = useRef(false);
  const layoutPreferenceAppliedRef = useRef(false);

  /** UI value for layout Select (`3d` = stage with volume; `2up` = side‑by‑side only). */
  const [layoutChoice, setLayoutChoice] = useState<'3d' | '2up'>('3d');

  /** Which structure overlays are currently toggled on (lung parenchyma / nodule / vessel / ice ball). */
  const [activeStructures, setActiveStructures] = useState<Record<LungStructureId, boolean>>({
    lungParenchyma: false,
    nodule: false,
    vessel: false,
    iceBall: false,
  });

  /** Structure currently armed for click-to-prompt segmentation (null = off). */
  const [clickTarget, setClickTarget] = useState<LungStructureId | null>(null);
  /** Circular ROI diameter (px) used to constrain segmentation around each click. */
  const [clickPromptRoiSize, setClickPromptRoiSize] = useState(80);

  /** Channels selectable for the bottom 3D model (only implemented ones). */
  const model3dChannels = useRef(getImplementedLung3DChannels());
  /** Which 3D channels the user has selected to build. */
  const [model3dSelection, setModel3dSelection] = useState<Record<LungStructureId, boolean>>({
    lungParenchyma: true,
    nodule: false,
    vessel: false,
    iceBall: false,
  });
  /** Build progress (null = idle), and a short status line. */
  const [model3dProgress, setModel3dProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [model3dStatus, setModel3dStatus] = useState<string | null>(null);
  const model3dAbortRef = useRef<AbortController | null>(null);

  /** Re-render when display sets load or metadata updates so CT filters see numImageFrames etc. */
  const [, setDisplaySetsRev] = useState(0);
  useEffect(() => {
    const sub = displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_CHANGED, () =>
      setDisplaySetsRev(n => n + 1)
    );
    const subAdded = displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_ADDED, () =>
      setDisplaySetsRev(n => n + 1)
    );
    return () => {
      sub.unsubscribe();
      subAdded.unsubscribe();
    };
  }, [displaySetService]);

  const options = ctDisplaySets(displaySetService);

  useEffect(() => {
    const syncLayoutFromHp = () => {
      /** HP service returns undefined until a protocol is active (`getState` early-exit). */
      const hpState = hangingProtocolService.getState();
      if (!hpState?.protocolId || hpState.protocolId !== LUNG_COMPARE_PROTOCOL_ID) {
        return;
      }
      setLayoutChoice(hpState.stageId === LUNG_COMPARE_STAGE_2UP_ID ? '2up' : '3d');
    };

    syncLayoutFromHp();

    const sub = hangingProtocolService.subscribe(
      hangingProtocolService.EVENTS.PROTOCOL_CHANGED,
      () => {
        syncLayoutFromHp();

        const hpReady = () => {
          const s = hangingProtocolService.getState();
          return s?.protocolId === LUNG_COMPARE_PROTOCOL_ID;
        };

        if (!compareLayoutUrlAppliedRef.current) {
          const cl = searchParams.get('compareLayout');
          if (cl === '2up' || cl === '3d') {
            if (!hpReady()) {
              return;
            }
            compareLayoutUrlAppliedRef.current = true;
            layoutPreferenceAppliedRef.current = true;
            const stageId = cl === '2up' ? LUNG_COMPARE_STAGE_2UP_ID : LUNG_COMPARE_STAGE_3D_ID;
            commandsManager.run({
              commandName: 'setHangingProtocol',
              commandOptions: {
                protocolId: LUNG_COMPARE_PROTOCOL_ID,
                stageId,
              },
            });
            return;
          }
        }

        if (!layoutPreferenceAppliedRef.current && hpReady()) {
          layoutPreferenceAppliedRef.current = true;
          const saved = readLayoutPreference();
          if (saved) {
            commandsManager.run({
              commandName: 'setHangingProtocol',
              commandOptions: {
                protocolId: LUNG_COMPARE_PROTOCOL_ID,
                stageId: saved === '2up' ? LUNG_COMPARE_STAGE_2UP_ID : LUNG_COMPARE_STAGE_3D_ID,
              },
            });
          }
        }
      }
    );

    return () => sub.unsubscribe();
  }, [commandsManager, hangingProtocolService, searchParams]);

  const applySeriesSelection = useCallback(
    (nextBaseline: string | null, nextCompare: string | null) => {
      if (!nextBaseline || !nextCompare) {
        return;
      }
      if (nextBaseline === nextCompare) {
        setWarning(t('errorSameSeries'));
        return;
      }
      setWarning(null);

      const viewportsToUpdate = [
        { viewportId: LUNG_VIEWPORT_LEFT, displaySetInstanceUIDs: [nextBaseline] },
        { viewportId: LUNG_VIEWPORT_RIGHT, displaySetInstanceUIDs: [nextCompare] },
      ];

      const grid = viewportGridService.getState?.();
      if (grid?.viewports?.has?.(LUNG_VIEWPORT_3D)) {
        viewportsToUpdate.push({
          viewportId: LUNG_VIEWPORT_3D,
          displaySetInstanceUIDs: [nextBaseline],
        });
      }

      commandsManager.run({
        commandName: 'setDisplaySetsForViewports',
        commandOptions: {
          viewportsToUpdate,
        },
        context: 'CORNERSTONE',
      });
    },
    [commandsManager, viewportGridService, t]
  );

  /** Optional deep-link: ?baselineSeriesUID=&compareSeriesUID= (SeriesInstanceUID) */
  useEffect(() => {
    if (urlSeriesAppliedRef.current) {
      return;
    }
    const bSeries = searchParams.get('baselineSeriesUID');
    const cSeries = searchParams.get('compareSeriesUID');
    if (!bSeries || !cSeries) {
      return;
    }

    const list = ctDisplaySets(displaySetService);
    if (list.length < 2) {
      return;
    }

    const db = list.find(ds => ds.SeriesInstanceUID === bSeries);
    const dc = list.find(ds => ds.SeriesInstanceUID === cSeries);
    if (
      db?.displaySetInstanceUID &&
      dc?.displaySetInstanceUID &&
      db.displaySetInstanceUID !== dc.displaySetInstanceUID
    ) {
      urlSeriesAppliedRef.current = true;
      setBaselineUid(db.displaySetInstanceUID);
      setCompareUid(dc.displaySetInstanceUID);
      applySeriesSelection(db.displaySetInstanceUID, dc.displaySetInstanceUID);
    }
  }, [searchParams, displaySetService, applySeriesSelection, options.length]);

  useEffect(() => {
    const left = cornerstoneViewportService.getViewportDisplaySets(LUNG_VIEWPORT_LEFT)[0];
    const right = cornerstoneViewportService.getViewportDisplaySets(LUNG_VIEWPORT_RIGHT)[0];
    if (left?.displaySetInstanceUID && !baselineUid) {
      setBaselineUid(left.displaySetInstanceUID);
    }
    if (right?.displaySetInstanceUID && !compareUid) {
      setCompareUid(right.displaySetInstanceUID);
    }
  }, [cornerstoneViewportService, baselineUid, compareUid]);

  useEffect(() => {
    const refreshHint = () => {
      if (!baselineUid) {
        setReconstructHint(null);
        return;
      }
      const ds = displaySetService.getDisplaySetByUID(baselineUid);
      const grid = viewportGridService.getState?.();
      const has3d = grid?.viewports?.has?.(LUNG_VIEWPORT_3D);
      if (ds?.isReconstructable === false) {
        setReconstructHint(has3d ? t('reconstructHint3d') : t('reconstructHint2d'));
      } else {
        setReconstructHint(null);
      }
    };

    refreshHint();
    const sub = viewportGridService.subscribe(
      viewportGridService.EVENTS.GRID_STATE_CHANGED,
      refreshHint
    );
    return () => sub.unsubscribe();
  }, [baselineUid, displaySetService, viewportGridService, t]);

  useEffect(() => {
    if (!syncEnabled) {
      setWarning(null);
      return undefined;
    }

    /** `forward` = left (baseline) drives right (compare); else compare drives baseline. */
    function setup(
      sourceId: string,
      targetId: string,
      updateBannerOnForward: boolean,
      forward: boolean
    ) {
      let element: HTMLElement | null = null;
      let timer: number | undefined;

      const handler = () => {
        if (applyingRemoteRef.current) {
          return;
        }

        const sourceVp = cornerstoneViewportService.getCornerstoneViewport(sourceId);
        const targetVp = cornerstoneViewportService.getCornerstoneViewport(targetId);

        if (
          !sourceVp ||
          !targetVp ||
          !(sourceVp instanceof StackViewport) ||
          !(targetVp instanceof StackViewport)
        ) {
          return;
        }

        const srcIds = sourceVp.getImageIds();
        const tgtIds = targetVp.getImageIds();
        if (!srcIds?.length || !tgtIds?.length) {
          return;
        }

        const idx = sourceVp.getCurrentImageIdIndex?.() ?? 0;
        const imageId = srcIds[idx];
        if (!imageId) {
          return;
        }

        const axisNormal = normalFromImagePlane(imageId);
        const plane = metaData.get('imagePlaneModule', imageId) as {
          imagePositionPatient?: number[];
        } | null;
        if (!axisNormal || !plane?.imagePositionPatient) {
          return;
        }

        /**
         * Carry the current source slice's patient-space position through the
         * registration's deformation/offset field into the target volume, then
         * project onto the target stacking axis to find the matching slice. With
         * the identity mock this reduces to plain anatomical alignment; a trained
         * field makes the right side follow the registered location.
         */
        const ipp = plane.imagePositionPatient;
        const sourcePoint: Vec3 = [ipp[0], ipp[1], ipp[2]];
        const regContext = {
          baselineDisplaySetInstanceUID:
            cornerstoneViewportService.getViewportDisplaySets(LUNG_VIEWPORT_LEFT)[0]
              ?.displaySetInstanceUID ?? null,
          compareDisplaySetInstanceUID:
            cornerstoneViewportService.getViewportDisplaySets(LUNG_VIEWPORT_RIGHT)[0]
              ?.displaySetInstanceUID ?? null,
          servicesManager,
        };
        const mappedPoint = forward
          ? mapBaselineToCompare(sourcePoint, regContext)
          : mapCompareToBaseline(sourcePoint, regContext);

        /** Use the target's own stacking axis so displaced points project correctly. */
        const targetNormal = normalFromImagePlane(tgtIds[0]) ?? axisNormal;
        const targetCoord = stackCoordinate(mappedPoint, targetNormal);
        const { index: nearestIndex, deltaMm } = findNearestSliceIndexByAxis(
          tgtIds,
          targetNormal,
          targetCoord
        );

        const curTargetIdx = targetVp.getCurrentImageIdIndex?.() ?? 0;
        if (nearestIndex === curTargetIdx) {
          if (updateBannerOnForward) {
            setWarning(
              deltaMm > OUT_OF_RANGE_MM
                ? t('syncWarningOutOfRange', { mm: deltaMm.toFixed(1) })
                : null
            );
          }
          return;
        }

        applyingRemoteRef.current = true;
        try {
          commandsManager.run({
            commandName: 'jumpToImage',
            commandOptions: {
              imageIndex: nearestIndex,
              viewport: { id: targetId },
            },
            context: 'CORNERSTONE',
          });
          if (updateBannerOnForward) {
            setWarning(
              deltaMm > OUT_OF_RANGE_MM
                ? t('syncWarningOutOfRange', { mm: deltaMm.toFixed(1) })
                : null
            );
          }
        } catch (e) {
          console.warn('lung-ct-compare: jumpToImage failed', e);
        } finally {
          requestAnimationFrame(() => {
            applyingRemoteRef.current = false;
          });
        }
      };

      const attach = () => {
        const info = cornerstoneViewportService.getViewportInfo(sourceId);
        const el = info?.getElement?.() ?? null;
        if (!el || el === element) {
          return;
        }
        if (element) {
          element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, handler);
        }
        element = el;
        element.addEventListener(Enums.Events.STACK_NEW_IMAGE, handler);
      };

      timer = window.setInterval(attach, 250);
      attach();

      return () => {
        if (timer) {
          clearInterval(timer);
        }
        if (element) {
          element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, handler);
        }
      };
    }

    const unLeft = setup(LUNG_VIEWPORT_LEFT, LUNG_VIEWPORT_RIGHT, true, true);
    const unRight = setup(LUNG_VIEWPORT_RIGHT, LUNG_VIEWPORT_LEFT, false, false);

    return () => {
      unLeft();
      unRight();
    };
  }, [commandsManager, cornerstoneViewportService, servicesManager, syncEnabled, t]);

  const describe = ds =>
    `${ds.SeriesDescription || 'CT'} (#${ds.SeriesNumber ?? '?'}) · ${ctSliceCount(ds) || '?'} img`;

  /**
   * Toggle a structure overlay on/off. The actual segmentation (labelmap
   * creation, coloring, viewport visibility) is delegated to the registered
   * provider — a no-op stub until the real feature is inserted. The button
   * state here flips regardless so the UI stays responsive.
   */
  const toggleStructure = useCallback(
    (structure: LungStructureDef) => {
      setActiveStructures(prev => {
        const visible = !prev[structure.id];
        try {
          Promise.resolve(
            getLungSegmentationProvider().onToggle({
              structure,
              visible,
              viewportIds: [LUNG_VIEWPORT_LEFT, LUNG_VIEWPORT_RIGHT],
              baselineDisplaySetInstanceUID: baselineUid,
              compareDisplaySetInstanceUID: compareUid,
              servicesManager,
              commandsManager,
            })
          ).catch(e => console.warn('lung-ct-compare: segmentation toggle failed', e));
        } catch (e) {
          console.warn('lung-ct-compare: segmentation toggle failed', e);
        }
        return { ...prev, [structure.id]: visible };
      });
    },
    [baselineUid, compareUid, servicesManager, commandsManager]
  );

  /**
   * Arm/disarm click-to-prompt for a structure. While armed, clicking a CT
   * runs a point-prompted segmentation (MedSAM2, or a local fallback) for that
   * lesion. Selecting a target forces its overlay visible.
   */
  const toggleClickTarget = useCallback(
    (structureId: LungStructureId) => {
      const provider = getLungSegmentationProvider();
      provider.setClickPromptRoiSize?.(clickPromptRoiSize);
      setClickTarget(prev => {
        if (prev === structureId) {
          provider.disableClickPrompt?.();
          return null;
        }
        setActiveStructures(s => ({ ...s, [structureId]: true }));
        try {
          provider.enableClickPrompt?.(
            structureId,
            [LUNG_VIEWPORT_LEFT, LUNG_VIEWPORT_RIGHT],
            servicesManager,
            commandsManager
          );
        } catch (e) {
          console.warn('lung-ct-compare: enable click prompt failed', e);
        }
        return structureId;
      });
    },
    [clickPromptRoiSize, commandsManager, servicesManager]
  );

  useEffect(() => {
    getLungSegmentationProvider().setClickPromptRoiSize?.(clickPromptRoiSize);
  }, [clickPromptRoiSize]);

  const clearClicks = useCallback(() => {
    if (!clickTarget) {
      return;
    }
    try {
      getLungSegmentationProvider().clearClickPrompt?.(clickTarget);
    } catch (e) {
      console.warn('lung-ct-compare: clear click prompt failed', e);
    }
  }, [clickTarget]);

  /** Detach click listeners when the panel unmounts (e.g. leaving the mode). */
  useEffect(() => {
    return () => {
      try {
        getLungSegmentationProvider().disableClickPrompt?.();
      } catch {
        /* provider already torn down */
      }
    };
  }, []);

  /** Abort an in-flight 3D build if the panel unmounts. */
  useEffect(() => {
    return () => {
      model3dAbortRef.current?.abort();
    };
  }, []);

  /** Display set rendered in the 3D viewport (baseline series, with fallback). */
  const resolve3dDisplaySetUid = useCallback((): string | null => {
    if (baselineUid) {
      return baselineUid;
    }
    const ds = cornerstoneViewportService.getViewportDisplaySets(LUNG_VIEWPORT_3D)?.[0];
    return ds?.displaySetInstanceUID ?? null;
  }, [baselineUid, cornerstoneViewportService]);

  const buildModel3d = useCallback(async () => {
    const grid = viewportGridService.getState?.();
    if (!grid?.viewports?.has?.(LUNG_VIEWPORT_3D)) {
      uiNotificationService.show({
        title: t('model3dFailed'),
        message: t('model3dNeed3dLayout'),
        type: 'warning',
        duration: 4000,
      });
      return;
    }
    const displaySetInstanceUID = resolve3dDisplaySetUid();
    if (!displaySetInstanceUID) {
      uiNotificationService.show({
        title: t('model3dFailed'),
        message: t('model3dNoSeries'),
        type: 'warning',
        duration: 4000,
      });
      return;
    }

    const channels = model3dChannels.current.filter(id => model3dSelection[id]);
    if (channels.length === 0) {
      uiNotificationService.show({
        title: t('model3dFailed'),
        message: t('model3dNoChannel'),
        type: 'warning',
        duration: 4000,
      });
      return;
    }

    model3dAbortRef.current?.abort();
    const controller = new AbortController();
    model3dAbortRef.current = controller;
    setModel3dProgress({ done: 0, total: 0 });
    setModel3dStatus(null);

    try {
      const result = await getLung3DModelProvider().build({
        displaySetInstanceUID,
        viewportId: LUNG_VIEWPORT_3D,
        channels,
        servicesManager,
        commandsManager,
        signal: controller.signal,
        onProgress: (done, total) => setModel3dProgress({ done, total }),
      });
      if (controller.signal.aborted) {
        return;
      }
      setModel3dStatus(t('model3dDone', { count: result.builtChannels.length }));
      uiNotificationService.show({
        title: t('model3dDoneTitle'),
        message: t('model3dDone', { count: result.builtChannels.length }),
        type: 'success',
        duration: 2500,
      });
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') {
        return;
      }
      console.warn('lung-ct-compare: 3D model build failed', e);
      setModel3dStatus(t('model3dFailed'));
      uiNotificationService.show({
        title: t('model3dFailed'),
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
        duration: 5000,
      });
    } finally {
      if (model3dAbortRef.current === controller) {
        model3dAbortRef.current = null;
      }
      setModel3dProgress(null);
    }
  }, [
    commandsManager,
    cornerstoneViewportService,
    model3dSelection,
    resolve3dDisplaySetUid,
    servicesManager,
    t,
    uiNotificationService,
    viewportGridService,
  ]);

  const clearModel3d = useCallback(() => {
    model3dAbortRef.current?.abort();
    model3dAbortRef.current = null;
    setModel3dProgress(null);
    setModel3dStatus(null);
    const displaySetInstanceUID = resolve3dDisplaySetUid();
    if (!displaySetInstanceUID) {
      return;
    }
    try {
      void getLung3DModelProvider().clear({
        displaySetInstanceUID,
        viewportId: LUNG_VIEWPORT_3D,
        servicesManager,
      });
    } catch (e) {
      console.warn('lung-ct-compare: 3D model clear failed', e);
    }
  }, [resolve3dDisplaySetUid, servicesManager]);

  const swapSides = useCallback(() => {
    if (!baselineUid || !compareUid || baselineUid === compareUid) {
      return;
    }
    const nextBaseline = compareUid;
    const nextCompare = baselineUid;
    setBaselineUid(nextBaseline);
    setCompareUid(nextCompare);
    applySeriesSelection(nextBaseline, nextCompare);
  }, [baselineUid, compareUid, applySeriesSelection]);

  const copyShareLink = useCallback(async () => {
    const study = searchParams.get('StudyInstanceUIDs');
    if (!study) {
      uiNotificationService.show({
        title: t('copyLinkFailed'),
        message: t('copyLinkNoStudy'),
        type: 'warning',
        duration: 4000,
      });
      return;
    }
    if (!baselineUid || !compareUid) {
      uiNotificationService.show({
        title: t('copyLinkFailed'),
        message: t('copyLinkNoSeries'),
        type: 'warning',
        duration: 4000,
      });
      return;
    }
    const db = displaySetService.getDisplaySetByUID(baselineUid);
    const dc = displaySetService.getDisplaySetByUID(compareUid);
    if (!db?.SeriesInstanceUID || !dc?.SeriesInstanceUID) {
      uiNotificationService.show({
        title: t('copyLinkFailed'),
        message: t('copyLinkNoSeries'),
        type: 'warning',
        duration: 4000,
      });
      return;
    }
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('StudyInstanceUIDs', study);
      u.searchParams.set('baselineSeriesUID', db.SeriesInstanceUID);
      u.searchParams.set('compareSeriesUID', dc.SeriesInstanceUID);
      u.searchParams.set('compareLayout', layoutChoice);
      const text = u.toString();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      uiNotificationService.show({
        title: t('copyLinkSuccess'),
        type: 'success',
        duration: 2200,
      });
    } catch (e) {
      uiNotificationService.show({
        title: t('copyLinkFailed'),
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
        duration: 5000,
      });
    }
  }, [
    baselineUid,
    compareUid,
    displaySetService,
    layoutChoice,
    searchParams,
    t,
    uiNotificationService,
  ]);

  const clearLayoutMemory = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LAYOUT_PREF_STORAGE_KEY);
      }
      uiNotificationService.show({
        title: t('layoutMemoryClearedTitle'),
        message: t('layoutMemoryClearedBody'),
        type: 'success',
        duration: 3200,
      });
    } catch (e) {
      console.warn('lung-ct-compare: clear layout memory', e);
    }
  }, [t, uiNotificationService]);

  return (
    <div
      className="flex flex-col gap-3 p-2 text-sm"
      data-cy="lung-compare-panel"
    >
      <div className="text-muted-foreground font-semibold">{t('panelTitle')}</div>

      {warning && (
        <div className="bg-amber-950/40 rounded border border-amber-600/60 px-2 py-1.5 text-amber-100">
          {warning}
        </div>
      )}

      {reconstructHint && (
        <div className="rounded border border-slate-600/60 bg-slate-900/50 px-2 py-1.5 text-slate-200">
          {reconstructHint}
        </div>
      )}

      {options.length < 2 && (
        <div
          className="bg-amber-950/35 rounded border border-amber-700/50 px-2 py-1.5 text-amber-100"
          data-cy="lung-compare-insufficient-ct"
        >
          {t('needTwoCtSeries')}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-xs">{t('baselineLabel')}</Label>
        <Select
          value={baselineUid || ''}
          onValueChange={uid => {
            setBaselineUid(uid);
            if (compareUid) {
              applySeriesSelection(uid, compareUid);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('selectSeriesPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map(ds => (
              <SelectItem
                key={ds.displaySetInstanceUID}
                value={ds.displaySetInstanceUID}
              >
                {describe(ds)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-muted-foreground text-xs">{t('compareLabel')}</Label>
        <Select
          value={compareUid || ''}
          onValueChange={uid => {
            setCompareUid(uid);
            if (baselineUid) {
              applySeriesSelection(baselineUid, uid);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('selectSeriesPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map(ds => (
              <SelectItem
                key={ds.displaySetInstanceUID}
                value={ds.displaySetInstanceUID}
              >
                {describe(ds)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          dataCY="lung-compare-swap-sides"
          disabled={!baselineUid || !compareUid || baselineUid === compareUid}
          onClick={swapSides}
        >
          {t('swapSides')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          dataCY="lung-compare-copy-link"
          disabled={!baselineUid || !compareUid}
          onClick={() => void copyShareLink()}
        >
          {t('copyShareLink')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          dataCY="lung-compare-clear-layout-memory"
          onClick={clearLayoutMemory}
        >
          {t('clearLayoutMemory')}
        </Button>
      </div>

      <div
        className="border-secondary-light flex flex-col gap-2 border-t pt-2"
        data-cy="lung-compare-segmentation"
      >
        <Label className="text-muted-foreground text-xs">{t('segmentationLabel')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {LUNG_STRUCTURES.map(structure => {
            const active = activeStructures[structure.id];
            return (
              <Button
                key={structure.id}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                dataCY={`lung-seg-${structure.id}`}
                aria-pressed={active}
                className="justify-start gap-2"
                onClick={() => toggleStructure(structure)}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/30"
                  style={{ backgroundColor: structure.colorHex }}
                  aria-hidden="true"
                />
                {t(structure.labelKey)}
              </Button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs leading-snug">{t('segmentationHelp')}</p>
      </div>

      <div
        className="border-secondary-light flex flex-col gap-2 border-t pt-2"
        data-cy="lung-compare-click-prompt"
      >
        <Label className="text-muted-foreground text-xs">{t('clickPromptLabel')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {LUNG_STRUCTURES.filter(s => s.id === 'nodule' || s.id === 'iceBall').map(structure => {
            const active = clickTarget === structure.id;
            return (
              <Button
                key={structure.id}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                dataCY={`lung-click-${structure.id}`}
                aria-pressed={active}
                className="justify-start gap-2"
                onClick={() => toggleClickTarget(structure.id)}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/30"
                  style={{ backgroundColor: structure.colorHex }}
                  aria-hidden="true"
                />
                {t(structure.labelKey)}
              </Button>
            );
          })}
        </div>
        {clickTarget && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            dataCY="lung-click-clear"
            onClick={clearClicks}
          >
            {t('clickPromptClear')}
          </Button>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-muted-foreground text-xs">{t('clickPromptRoiSize')}</Label>
            <span
              className="text-muted-foreground text-xs tabular-nums"
              data-cy="lung-click-roi-size-value"
            >
              {t('clickPromptRoiSizePx', { size: clickPromptRoiSize })}
            </span>
          </div>
          <input
            type="range"
            min={CLICK_PROMPT_ROI_MIN}
            max={CLICK_PROMPT_ROI_MAX}
            step={CLICK_PROMPT_ROI_STEP}
            value={clickPromptRoiSize}
            className="accent-primary w-full"
            data-cy="lung-click-roi-size"
            onChange={event => setClickPromptRoiSize(Number(event.currentTarget.value))}
          />
        </div>
        <p className="text-muted-foreground text-xs leading-snug">{t('clickPromptHelp')}</p>
      </div>

      <div
        className="border-secondary-light flex flex-col gap-2 border-t pt-2"
        data-cy="lung-compare-3d-model"
      >
        <Label className="text-muted-foreground text-xs">{t('model3dLabel')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {LUNG_STRUCTURES.map(structure => {
            const implemented = model3dChannels.current.includes(structure.id);
            const selected = implemented && model3dSelection[structure.id];
            return (
              <Button
                key={structure.id}
                type="button"
                variant={selected ? 'default' : 'outline'}
                size="sm"
                dataCY={`lung-3d-${structure.id}`}
                aria-pressed={selected}
                disabled={!implemented || model3dProgress !== null}
                className="justify-start gap-2"
                onClick={() =>
                  setModel3dSelection(prev => ({ ...prev, [structure.id]: !prev[structure.id] }))
                }
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/30"
                  style={{ backgroundColor: structure.colorHex }}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {t(structure.labelKey)}
                  {!implemented && (
                    <span className="text-muted-foreground"> {t('model3dReserved')}</span>
                  )}
                </span>
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            dataCY="lung-3d-build"
            disabled={model3dProgress !== null}
            onClick={() => void buildModel3d()}
          >
            {model3dProgress
              ? t('model3dBuilding', {
                  done: model3dProgress.done,
                  total: model3dProgress.total || '…',
                })
              : t('model3dBuild')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            dataCY="lung-3d-clear"
            disabled={model3dProgress !== null}
            onClick={clearModel3d}
          >
            {t('model3dClear')}
          </Button>
        </div>
        {model3dStatus && <p className="text-muted-foreground text-xs">{model3dStatus}</p>}
        <p className="text-muted-foreground text-xs leading-snug">{t('model3dHelp')}</p>
      </div>

      <div className="border-secondary-light flex flex-col gap-1 border-t pt-2">
        <Label className="text-muted-foreground text-xs">{t('layoutLabel')}</Label>
        <Select
          value={layoutChoice}
          onValueChange={(value: '3d' | '2up') => {
            setLayoutChoice(value);
            writeLayoutPreference(value);
            commandsManager.run({
              commandName: 'setHangingProtocol',
              commandOptions: {
                protocolId: LUNG_COMPARE_PROTOCOL_ID,
                stageId: value === '2up' ? LUNG_COMPARE_STAGE_2UP_ID : LUNG_COMPARE_STAGE_3D_ID,
              },
            });
          }}
        >
          <SelectTrigger
            className="w-full"
            data-cy="lung-compare-layout-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3d">{t('layoutOption3d')}</SelectItem>
            <SelectItem value="2up">{t('layoutOption2up')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border-secondary-light flex items-center justify-between gap-2 border-t pt-2">
        <Label
          htmlFor="lung-sync"
          className="text-xs"
        >
          {t('syncToggle')}
        </Label>
        <Switch
          id="lung-sync"
          checked={syncEnabled}
          onCheckedChange={setSyncEnabled}
        />
      </div>

      <p className="text-muted-foreground text-xs leading-snug">{t('footerHelp')}</p>
    </div>
  );
}
