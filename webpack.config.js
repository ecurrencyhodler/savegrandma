const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    'content-script': './src/contentScripts/gmail/index.js',
    'popup': './src/frontend/popup/index.js',
    'service-worker': './src/serviceWorker/index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: false,
    // Ensure deterministic builds
    hashFunction: 'sha256',
    hashDigest: 'hex',
    hashDigestLength: 8
  },
  devtool: false, // Disable source maps to avoid eval() usage
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: '88'
                },
                modules: false
              }]
            ],
            plugins: [
              '@babel/plugin-syntax-import-meta'
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  optimization: {
    usedExports: false,
    minimize: false // Disable minification to avoid eval() usage
  }
};
