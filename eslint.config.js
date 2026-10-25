// ESLint flat config for MorphLens.
// `eslint-config-expo/flat` carries the Expo/React Native rules; the local rules
// below enforce two SKILL.md anti-patterns so they cannot creep back in.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.expo/**', 'video/**'],
  },
  {
    rules: {
      // SKILL §1 rule 5 / §9: only Reanimated may animate.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Animated'],
              message: 'Use react-native-reanimated instead (SKILL §1 rule 5).',
            },
          ],
        },
      ],
      // SKILL §1 rule 6: removed from Reanimated 4.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='useAnimatedGestureHandler']",
          message: 'Removed in Reanimated 4; use the Gesture API (SKILL §1 rule 6).',
        },
      ],
    },
  },
]);
