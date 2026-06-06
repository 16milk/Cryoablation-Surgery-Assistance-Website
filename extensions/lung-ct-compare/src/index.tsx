import { Types } from '@ohif/core';
import { id } from './id';
import lungCtCompare from './hangingProtocol/lungCtCompare';
import getPanelModule from './getPanelModule';

export {
  LUNG_STRUCTURES,
  getLungSegmentationProvider,
  setLungSegmentationProvider,
} from './segmentation/lungSegmentation';
export type {
  LungStructureId,
  LungStructureDef,
  LungSegmentationProvider,
  LungSegmentationToggleContext,
} from './segmentation/lungSegmentation';

export {
  registerThresholdLungSegmentation,
  unregisterThresholdLungSegmentation,
} from './segmentation/thresholdSegmentationProvider';

export {
  registerMedSam2LungSegmentation,
  unregisterMedSam2LungSegmentation,
} from './segmentation/medSam2SegmentationProvider';

export {
  getLung3DModelProvider,
  setLung3DModelProvider,
  registerLung3DChannel,
  unregisterLung3DChannel,
  getLung3DChannel,
  getImplementedLung3DChannels,
} from './model3d/lung3DModel';
export type {
  Lung3DModelProvider,
  Lung3DChannelMaskGenerator,
  Lung3DBuildContext,
  Lung3DBuildResult,
  Lung3DClearContext,
} from './model3d/lung3DModel';
export {
  registerLungSurface3DModel,
  unregisterLungSurface3DModel,
} from './model3d/lungSurfaceModelProvider';

export {
  mockIdentityDeformationField,
  createConstantDeformationField,
  getLungDeformationField,
  setLungDeformationField,
  mapBaselineToCompare,
  mapCompareToBaseline,
} from './registration/lungRegistration';
export {
  registerVxmLungRegistration,
  unregisterVxmLungRegistration,
} from './registration/vxmDeformationField';
export type {
  Vec3,
  LungDeformationField,
  LungRegistrationContext,
} from './registration/lungRegistration';

const lungCtCompareExtension: Types.Extensions.Extension = {
  id,
  getHangingProtocolModule: () => {
    return [
      {
        name: lungCtCompare.id,
        protocol: lungCtCompare,
      },
    ];
  },
  getPanelModule,
};

export default lungCtCompareExtension;
