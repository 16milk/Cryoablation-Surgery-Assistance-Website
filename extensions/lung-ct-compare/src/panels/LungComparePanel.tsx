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
import {
  LUNG_COMPARE_PROTOCOL_ID,
  LUNG_COMPARE_STAGE_2UP_ID,
  LUNG_COMPARE_STAGE_3D_ID,
  LUNG_VIEWPORT_LEFT,
  LUNG_VIEWPORT_RIGHT,
  LUNG_VIEWPORT_3D,
} from '../hangingProtocol/lungCtCompare';

const OUT_OF_RANGE_MM = 18;

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
      ds.Modality === 'CT' &&
      !ds.isOverlayDisplaySet &&
      !ds.unsupported &&
      ctSliceCount(ds) > 0
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

  /** Re-render when display sets load or metadata updates so CT filters see numImageFrames etc. */
  const [, setDisplaySetsRev] = useState(0);
  useEffect(() => {
    const sub = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      () => setDisplaySetsRev(n => n + 1)
    );
    const subAdded = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      () => setDisplaySetsRev(n => n + 1)
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
                stageId:
                  saved === '2up' ? LUNG_COMPARE_STAGE_2UP_ID : LUNG_COMPARE_STAGE_3D_ID,
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

    function setup(sourceId: string, targetId: string, updateBannerOnForward: boolean) {
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

        const targetCoord = stackCoordinate(plane.imagePositionPatient, axisNormal);
        const { index: nearestIndex, deltaMm } = findNearestSliceIndexByAxis(
          tgtIds,
          axisNormal,
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

    const unLeft = setup(LUNG_VIEWPORT_LEFT, LUNG_VIEWPORT_RIGHT, true);
    const unRight = setup(LUNG_VIEWPORT_RIGHT, LUNG_VIEWPORT_LEFT, false);

    return () => {
      unLeft();
      unRight();
    };
  }, [commandsManager, cornerstoneViewportService, syncEnabled, t]);

  const describe = ds =>
    `${ds.SeriesDescription || 'CT'} (#${ds.SeriesNumber ?? '?'}) · ${ctSliceCount(ds) || '?'} img`;

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
    <div className="flex flex-col gap-3 p-2 text-sm" data-cy="lung-compare-panel">
      <div className="font-semibold text-muted-foreground">{t('panelTitle')}</div>

      {warning && (
        <div className="rounded border border-amber-600/60 bg-amber-950/40 px-2 py-1.5 text-amber-100">
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
          className="rounded border border-amber-700/50 bg-amber-950/35 px-2 py-1.5 text-amber-100"
          data-cy="lung-compare-insufficient-ct"
        >
          {t('needTwoCtSeries')}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t('baselineLabel')}</Label>
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
              <SelectItem key={ds.displaySetInstanceUID} value={ds.displaySetInstanceUID}>
                {describe(ds)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t('compareLabel')}</Label>
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
              <SelectItem key={ds.displaySetInstanceUID} value={ds.displaySetInstanceUID}>
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

      <div className="flex flex-col gap-1 border-t border-secondary-light pt-2">
        <Label className="text-xs text-muted-foreground">{t('layoutLabel')}</Label>
        <Select
          value={layoutChoice}
          onValueChange={(value: '3d' | '2up') => {
            setLayoutChoice(value);
            writeLayoutPreference(value);
            commandsManager.run({
              commandName: 'setHangingProtocol',
              commandOptions: {
                protocolId: LUNG_COMPARE_PROTOCOL_ID,
                stageId:
                  value === '2up' ? LUNG_COMPARE_STAGE_2UP_ID : LUNG_COMPARE_STAGE_3D_ID,
              },
            });
          }}
        >
          <SelectTrigger className="w-full" data-cy="lung-compare-layout-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3d">{t('layoutOption3d')}</SelectItem>
            <SelectItem value="2up">{t('layoutOption2up')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-secondary-light pt-2">
        <Label htmlFor="lung-sync" className="text-xs">
          {t('syncToggle')}
        </Label>
        <Switch id="lung-sync" checked={syncEnabled} onCheckedChange={setSyncEnabled} />
      </div>

      <p className="text-muted-foreground text-xs leading-snug">{t('footerHelp')}</p>
    </div>
  );
}
