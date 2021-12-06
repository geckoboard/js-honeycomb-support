module.exports = {
  plugins: ['node', 'prettier'],
  env: {
    commonjs: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 13,
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
