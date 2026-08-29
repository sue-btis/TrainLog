import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/** Keep persistence and UI imports out of the pure domain; src/db owns IndexedDB. */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'src/domain must not depend on persistence. Move this to src/db.' },
            { name: 'dexie-react-hooks', message: 'src/domain must not depend on persistence. Move this to src/db.' },
            { name: 'react', message: 'src/domain must not depend on the UI layer.' },
            { name: 'react-dom', message: 'src/domain must not depend on the UI layer.' },
          ],
          patterns: [
            { group: ['@/db/*', '**/db/*'], message: 'src/domain must not depend on persistence.' },
            { group: ['@/features/*', '**/features/*'], message: 'src/domain must not depend on the UI layer.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/db must not depend on the UI layer.' },
            { name: 'react-dom', message: 'src/db must not depend on the UI layer.' },
          ],
          patterns: [
            { group: ['@/features/*', '**/features/*'], message: 'src/db must not depend on the UI layer.' },
          ],
        },
      ],
    },
  },
);
