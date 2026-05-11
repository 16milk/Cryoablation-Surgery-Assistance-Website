module.exports = {
  plugins: ['@babel/plugin-transform-class-properties'],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: 'commonjs',
            debug: false,
          },
          '@babel/preset-typescript',
        ],
        '@babel/preset-react',
      ],
      plugins: [
        '@babel/plugin-transform-object-rest-spread',
        '@babel/plugin-syntax-dynamic-import',
        '@babel/plugin-transform-regenerator',
        '@babel/plugin-transform-runtime',
      ],
    },
    production: {
      presets: [
        ['@babel/preset-env', { modules: false }],
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
      ignore: ['**/*.test.jsx', '**/*.test.js', '__snapshots__', '__tests__'],
    },
    development: {
      presets: [
        ['@babel/preset-env', { modules: false }],
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
      ignore: ['**/*.test.jsx', '**/*.test.js', '__snapshots__', '__tests__'],
    },
  },
};
