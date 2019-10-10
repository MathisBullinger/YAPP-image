const path = require('path')

const config = {
  extends: ['eslint:recommended', 'prettier/react', 'plugin:jest/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['prettier', '@typescript-eslint', 'jest'],
  env: {
    node: true,

    es6: true,
    'jest/globals': true,
  },
  parserOptions: {
    parser: 'babel-eslint',
    project: path.resolve(__dirname, './tsconfig.json'),
    tsconfigRootDir: __dirname,
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  globals: {
    module: true,
    process: true,
    require: true,
    __dirname: 'readonly',
  },
  rules: {
    semi: ['error', 'never'],
    '@typescript-eslint/no-unused-vars': 'error',
  },
}

module.exports = config
