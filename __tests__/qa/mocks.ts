/**
 * qa/mocks.ts — the environment a QA sweep runs in.
 *
 * The app is built on native modules (Skia, Reanimated, the file system, the
 * image picker). A QA sweep must still be able to *run* every screen, so the
 * native pieces are replaced by light stubs that keep the same shapes. The
 * engine is NOT stubbed: the real algorithms run, which is what makes this a
 * functional check and not a snapshot of empty views.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// Reanimated's web build asks the browser whether the user asked for less
// motion. Jest has no window, so the answer is provided here.
if (typeof globalThis.window !== 'undefined' && !globalThis.window.matchMedia) {
  globalThis.window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Reanimated's web build touches the DOM when it configures its layout
// animations. Jest has no document, so a tiny stub is provided.
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({
      id: '',
      onload: null,
      sheet: null,
      style: {},
      setAttribute: noop,
      appendChild: noop,
    }),
    head: { appendChild: noop },
    body: { appendChild: noop },
    addEventListener: noop,
    removeEventListener: noop,
  } as unknown as Document;
}

jest.mock('@shopify/react-native-skia', () => {
  const makeImage = () => ({
    width: () => 8,
    height: () => 8,
    dispose: () => {},
    readPixels: () => null,
  });
  return {
    Canvas: ({ children }: any) => children ?? null,
    Image: () => null,
    Circle: () => null,
    Path: () => null,
    Rect: () => null,
    RoundedRect: () => null,
    Paint: ({ children }: any) => children ?? null,
    ColorMatrix: () => null,
    Blur: () => null,
    Group: ({ children }: any) => children ?? null,
    FilterMode: { Nearest: 'nearest', Linear: 'linear' },
    PaintStyle: { Fill: 'fill', Stroke: 'stroke' },
    TileMode: { Clamp: 'clamp', Repeat: 'repeat', Mirror: 'mirror' },
    StretchMode: { Fill: 'fill' },
    useImage: () => null,
    useFont: () => null,
    AlphaType: { Unpremul: 'unpremul' },
    ColorType: { RGBA_8888: 'rgba-8888' },
    Skia: {
      Data: { fromBytes: () => ({}) },
      Image: { MakeImage: makeImage },
      PathBuilder: {
        Make: () => ({
          moveTo: () => {},
          lineTo: () => {},
          close: () => {},
          build: () => ({}),
        }),
      },
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: any) => React.createElement(View, null, children),
    SafeAreaConsumer: ({ children }: any) => children(insets),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

jest.mock('react-native-gesture-handler', () => {
  // The gesture handler's web build wants the Worklets UI runtime, which does
  // not exist under Jest. A chainable stub keeps the screens mountable.
  const React = require('react');
  const { View } = require('react-native');
  const chainable = () => {
    const gesture: any = {};
    const methods = [
      'activeOffsetX',
      'activeOffsetY',
      'failOffsetX',
      'failOffsetY',
      'onBegin',
      'onStart',
      'onUpdate',
      'onChange',
      'onEnd',
      'onFinalize',
      'onTouchesDown',
      'minDistance',
      'runOnJS',
      'enabled',
      'hitSlop',
      'shouldCancelWhenUnmounted',
      'simultaneousWithExternalGesture',
      'requireExternalGestureToFail',
      'withSpring',
      'blocksExternalGesture',
    ];
    methods.forEach((method) => {
      gesture[method] = () => gesture;
    });
    return gesture;
  };
  return {
    GestureDetector: ({ children }: any) => React.createElement(View, null, children),
    Gesture: {
      Pan: chainable,
      Tap: chainable,
      LongPress: chainable,
      Simultaneous: chainable,
      Exclusive: chainable,
      Race: chainable,
    },
    Directions: {},
    State: {},
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: () => {},
    push: () => {},
    replace: () => {},
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({ id: 'qa-photo' }),
  Link: () => null,
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: async () => {},
  notificationAsync: async () => {},
  selectionAsync: async () => {},
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: () => ({ resize: () => ({ renderAsync: async () => ({}) }) }) },
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system', () => {
  class FakeFile {
    exists = false;
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {}
    async copy() {}
  }
  class FakeDirectory {
    exists = false;
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    create() {}
  }
  return {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: { document: { uri: 'file:///documents/' } },
  };
});

jest.mock('lucide-react-native', () => {
  // The icon library is ESM-only, which Jest cannot load; a stub keeps the
  // screens importable. Every icon becomes an empty, accessible text node.
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props: any) =>
    React.createElement(Text, { accessibilityLabel: 'icon', ...props }, '');
  return new Proxy(
    {},
    {
      get: () => Icon,
    },
  );
});

jest.mock('react-native-reanimated', () => {
  // The native Reanimated runtime does not exist in Jest; the shipped mock
  // gives the same API surface with plain React state.
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

export {};
