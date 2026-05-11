import { Types } from '@ohif/core';
import { id } from './id';
import lungCtCompare from './hangingProtocol/lungCtCompare';
import getPanelModule from './getPanelModule';

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
