import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['*.ts', '**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
      },
    },
  },
  {
    // vite.config.ts 不在 tsconfig include 里，关闭类型感知即可，避免 project service 报错
    files: ['vite.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    rules: {
      // 路由级页面视图组件允许单词命名（Dashboard/Login/Register/Settings）
      'vue/multi-word-component-names': [
        'error',
        { ignores: ['Dashboard', 'Login', 'Register', 'Settings'] },
      ],
      // 允许 _ 前缀参数，表示"暂未使用"（如 TODO 存根）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.next/**',
      '.vite/**',
      'coverage/**',
    ],
  },
)
