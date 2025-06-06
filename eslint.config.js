// eslint.config.js
import eslintPluginTs from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import pluginUnusedImports from 'eslint-plugin-unused-imports';
import pluginNext from '@next/eslint-plugin-next';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      'eslint.config.js',
      'tailwind.config.js',
      'public/service-worker.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly'
      },
      parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: {
      '@typescript-eslint': eslintPluginTs,
      'unused-imports': pluginUnusedImports,
      next: pluginNext
    },
    rules: {
      // Genel
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Unused Imports
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ],

      // Next.js Spesifik
      'next/no-html-link-for-pages': 'warn',
      'next/no-img-element': 'warn',
      'next/no-document-import-in-page': 'error'
    }
  }
];
