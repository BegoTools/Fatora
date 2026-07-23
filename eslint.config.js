import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // السماح بمعاملات غير مستخدمة مسبوقة بشرطة سفلية (اتفاقية شائعة)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // هذا المشروع يخلط مكونات ودوال مساعدة في نفس الملفات بشكل مقصود
      // (context, db, services) — تعطيل قيد fast-refresh الذي يفرض تصدير مكونات فقط
      'react-refresh/only-export-components': 'off',
      // الأنماط الحالية تستخدم setState داخل effect بشكل مقصود لقراءة localStorage
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/impure-function-in-render': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    // ملفات الاختبارات: قواعد مخففة
    files: ['**/*.{test,spec}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
])
