# Working on the mobile app

This app targets **Expo SDK 57** (New Architecture enabled).

Before writing code, read the versioned reference for the exact SDK:
https://docs.expo.dev/versions/v57.0.0/

Rules for this package:

- Never install native modules with plain `npm install`. Always use
  `npx expo install <package>` so the version matches the SDK.
- The app lives in an npm workspaces monorepo. `metro.config.js` is configured
  for it; do not remove `watchFolders` or `nodeModulesPaths`.
- Layout maths, aspect ratios and templates come from `@collage/core`. Keep all
  geometry there so web and mobile stay pixel identical.
- `react-native-view-shot` is a native module, so the app needs a development
  build (`eas build --profile development`); it does not run in Expo Go.
