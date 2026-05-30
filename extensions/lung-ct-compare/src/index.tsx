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
  mockIdentityDeformationField,
  createConstantDeformationField,
  getLungDeformationField,
  setLungDeformationField,
  mapBaselineToCompare,
  mapCompareToBaseline,
} from './registration/lungRegistration';
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
