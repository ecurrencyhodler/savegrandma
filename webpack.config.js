const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    savegrandma: './src/savegrandma.js'
  },
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'savegrandma.bundle.js',
    clean: false
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
