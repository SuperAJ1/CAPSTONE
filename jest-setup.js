// Mock AsyncStorage for Jest tests
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = {};
  return {
    setItem: jest.fn((key, value) => {
      return Promise.resolve((storage[key] = value));
    }),
    getItem: jest.fn((key) => {
      return Promise.resolve(storage[key] || null);
    }),
    removeItem: jest.fn((key) => {
      return Promise.resolve(delete storage[key]);
    }),
    clear: jest.fn(() => {
      return Promise.resolve((storage = {}));
    }),
    getAllKeys: jest.fn(() => {
      return Promise.resolve(Object.keys(storage));
    }),
    multiGet: jest.fn((keys) => {
      return Promise.resolve(keys.map(key => [key, storage[key] || null]));
    }),
    multiSet: jest.fn((keyValuePairs) => {
      keyValuePairs.forEach(([key, value]) => {
        storage[key] = value;
      });
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys) => {
      keys.forEach(key => delete storage[key]);
      return Promise.resolve();
    }),
  };
});

// Mock expo-camera
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ...jest.requireActual('expo-camera'),
    useCameraPermissions: jest.fn(() => [null, { request: jest.fn() }]),
    CameraView: (props) => React.createElement(View, { testID: 'camera-view', ...props }),
  };
});

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          playAsync: jest.fn(() => Promise.resolve()),
          unloadAsync: jest.fn(() => Promise.resolve()),
        },
        status: { isLoaded: true },
      })),
    },
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((x) => x),
    Directions: {},
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: View,
  };
});

// Mock expo-blur
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: View,
  };
});

// Mock expo-screen-orientation
jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn(() => Promise.resolve()),
  unlockAsync: jest.fn(() => Promise.resolve()),
}));

// Mock LanguageContext with proper translations
jest.mock('./contexts/LanguageContext', () => {
  const React = require('react');
  const { translations } = require('./utils/translations');
  
  const LanguageContext = React.createContext({
    language: 'en',
    changeLanguage: jest.fn(),
    t: translations.en,
  });
  
  return {
    LanguageContext,
    LanguageProvider: ({ children }) => {
      const [language, setLanguage] = React.useState('en');
      const changeLanguage = React.useCallback((lang) => {
        setLanguage(lang);
      }, []);
      
      const t = translations[language] || translations.en;
      
      return React.createElement(LanguageContext.Provider, {
        value: { language, changeLanguage, t },
      }, children);
    },
    useLanguage: () => {
      const context = React.useContext(LanguageContext);
      if (!context) {
        return { language: 'en', changeLanguage: jest.fn(), t: translations.en };
      }
      return context;
    },
  };
});

// Mock global fetch
global.fetch = jest.fn();

