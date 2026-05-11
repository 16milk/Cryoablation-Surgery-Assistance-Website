import React from 'react';

import LungComparePanel from './panels/LungComparePanel';

export default function getPanelModule() {
  return [
    {
      name: 'lungCompareControl',
      iconName: 'layers',
      iconLabel: 'Lung CT compare',
      label: '肺结节对比',
      component: LungComparePanel,
    },
  ];
}
