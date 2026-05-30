/** @type {AppTypes.Config} */
window.config = {
  name: 'config/local_sqlite.js',
  routerBasename: null,
  extensions: [],
  modes: [],
  showStudyList: true,
  maxNumberOfWebWorkers: 3,
  showLoadingIndicator: true,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: true,
  strictZSpacingForVolumeViewport: true,
  defaultDataSourceName: 'localdb',
  whiteLabeling: {
    createLogoComponentFn: function (React) {
      return React.createElement(
        'div',
        {
          className: 'flex items-center gap-2 select-none',
        },
        React.createElement(
          'div',
          {
            className:
              'flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 text-lg font-bold text-white shadow-md',
          },
          'M'
        ),
        React.createElement(
          'span',
          {
            className: 'text-lg font-semibold tracking-wide text-teal-100',
          },
          'MedView'
        )
      );
    },
  },
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'localdb',
      configuration: {
        friendlyName: '本地数据库',
        name: 'localdb',
        wadoUriRoot: '/dicomweb',
        qidoRoot: '/dicomweb',
        wadoRoot: '/dicomweb',
        qidoSupportsIncludeField: true,
        supportsReject: false,
        dicomUploadEnabled: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: false,
        omitQuotationForMultipartRequest: true,
        bulkDataURI: {
          enabled: false,
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: '本地文件',
      },
    },
  ],
  httpErrorHandler: error => {
    console.warn('HTTP Error:', error.status);
  },
};
