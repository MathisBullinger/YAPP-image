const slsw = require('serverless-webpack')
const exec = require('child_process').exec

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  devtool: 'source-map',
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
  resolve: {
    mainFields: ['main', 'module'],
    extensions: ['.ts', '.js'],
  },
  externals: {
    sharp: 'sharp',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    {
      apply: compiler => {
        compiler.hooks.done.tapAsync('Linux Binaries', (arg, callback) => {
          exec('./prep.sh', (err, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout)
            if (stderr) process.stderr.write(stderr)
            callback()
          })
        })
      },
    },
  ],
}
