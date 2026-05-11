import update from 'immutability-helper';
import i18n from 'i18next';
import { ToolbarService, utils } from '@ohif/core';
import { id } from './id';
import initToolGroups from '../../basic/src/initToolGroups';
import toolbarButtons from '../../basic/src/toolbarButtons';

const { TOOLBAR_SECTIONS } = ToolbarService;
const { structuredCloneWithFunctions } = utils;

export const NON_IMAGE_MODALITIES = ['SEG', 'RTSTRUCT', 'RTPLAN', 'PR', 'SR', 'ECG'];

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  thumbnailList: '@ohif/extension-default.panelModule.seriesList',
  hangingProtocol: '@ohif/extension-default.hangingProtocolModule.default',
};

const lungCompare = {
  panel: '@ohif/extension-lung-ct-compare.panelModule.lungCompareControl',
};

const cornerstone = {
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

const dicomvideo = {
  sopClassHandler: '@ohif/extension-dicom-video.sopClassHandlerModule.dicom-video',
};

const extensionDependencies = {
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  /** Registers `evaluate.cornerstone.hasSegmentation` etc. required by basic toolbarButtons (Segment Label). */
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-lung-ct-compare': '^3.0.0',
  '@ohif/extension-dicom-video': '^3.0.1',
};

export function isValidMode({ modalities }) {
  const modalities_list = modalities.split('\\');
  const hasCT = modalities_list.some(m => m === 'CT');
  return {
    valid: hasCT,
    description: hasCT
      ? i18n.t('LungCtCompare:modeValidationOk')
      : i18n.t('LungCtCompare:modeValidationFail'),
  };
}

export function onModeEnter({ servicesManager, extensionManager, commandsManager }: withAppTypes) {
  const { measurementService, toolbarService, toolGroupService } = servicesManager.services;

  measurementService.clearMeasurements();
  initToolGroups(extensionManager, toolGroupService, commandsManager);

  toolbarService.register(toolbarButtons);

  toolbarService.updateSection(TOOLBAR_SECTIONS.primary, [
    'MeasurementTools',
    'Zoom',
    'Pan',
    'WindowLevel',
    'Capture',
    'Layout',
    'Crosshairs',
    'MoreTools',
  ]);

  toolbarService.updateSection(TOOLBAR_SECTIONS.viewportActionMenu.topLeft, [
    'orientationMenu',
    'dataOverlayMenu',
  ]);

  toolbarService.updateSection(TOOLBAR_SECTIONS.viewportActionMenu.bottomMiddle, [
    'AdvancedRenderingControls',
  ]);

  toolbarService.updateSection('AdvancedRenderingControls', [
    'windowLevelMenuEmbedded',
    'voiManualControlMenu',
    'Colorbar',
    'opacityMenu',
    'thresholdMenu',
  ]);

  toolbarService.updateSection(TOOLBAR_SECTIONS.viewportActionMenu.topRight, [
    'modalityLoadBadge',
    'trackingStatus',
    'navigationComponent',
  ]);

  toolbarService.updateSection(TOOLBAR_SECTIONS.viewportActionMenu.bottomLeft, ['windowLevelMenu']);
}

export function onModeExit({ servicesManager }: withAppTypes) {
  const {
    toolGroupService,
    syncGroupService,
    segmentationService,
    cornerstoneViewportService,
    uiDialogService,
    uiModalService,
  } = servicesManager.services;

  uiDialogService.hideAll();
  uiModalService.hide();
  toolGroupService.destroy();
  syncGroupService.destroy();
  segmentationService.destroy();
  cornerstoneViewportService.destroy();
}

const lungLayout = {
  id: ohif.layout,
  props: {
    leftPanels: [lungCompare.panel, ohif.thumbnailList],
    leftPanelResizable: true,
    rightPanels: [],
    rightPanelClosed: true,
    rightPanelResizable: false,
    viewports: [
      {
        namespace: cornerstone.viewport,
        displaySetsToDisplay: [ohif.sopClassHandler, dicomvideo.sopClassHandler],
      },
      {
        namespace: cornerstone.viewport,
        displaySetsToDisplay: [ohif.sopClassHandler, dicomvideo.sopClassHandler],
      },
      {
        namespace: cornerstone.viewport,
        displaySetsToDisplay: [ohif.sopClassHandler, dicomvideo.sopClassHandler],
      },
    ],
  },
};

export function layoutTemplate() {
  return structuredCloneWithFunctions(this.layoutInstance);
}

export const lungRoute = {
  path: 'lung-ct-compare',
  layoutTemplate,
  layoutInstance: lungLayout,
};

export const sopClassHandlers = [dicomvideo.sopClassHandler, ohif.sopClassHandler];

export const modeInstance = {
  id,
  routeName: 'lung-ct-compare',
  hide: false,
  displayName: i18n.t('Modes:Lung Nodule CT Compare'),
  _activatePanelTriggersSubscriptions: [],

  onModeEnter,
  onModeExit,
  validationTags: {
    study: [],
    series: [],
  },

  isValidMode,
  routes: [lungRoute],
  extensions: extensionDependencies,
  hangingProtocol: 'lungCtCompare',
  sopClassHandlers,
  toolbarButtons,
  enableSegmentationEdit: false,
  nonModeModalities: NON_IMAGE_MODALITIES,
};

export function modeFactory({ modeConfiguration }) {
  let inst = this.modeInstance;
  if (modeConfiguration) {
    inst = update(this.modeInstance, modeConfiguration);
  }
  return inst;
}

export const mode = {
  id,
  modeFactory,
  modeInstance,
  extensionDependencies,
};

export default mode;
