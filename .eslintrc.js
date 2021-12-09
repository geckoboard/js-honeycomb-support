module.exports = {
  plugins: ['node', 'prettier'],
  env: {
    commonjs: true,
    node: true,
    es2017: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 2019,
  },
  rules: {
    'no-unused-vars': [
      2,
      {
        vars: 'local',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    'prettier/prettier': ['error'],
  },
};
