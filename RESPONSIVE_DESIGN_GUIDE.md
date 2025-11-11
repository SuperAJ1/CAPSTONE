# Responsive Design Guide

This guide explains how to ensure the RTWv2 app works perfectly on all device sizes, from small phones to large tablets.

## Overview

The app uses a comprehensive responsive design system located in `utils/responsive.js` that automatically adapts to different screen sizes, orientations, and device types.

## Key Features

### 1. Device Detection
The `useResponsive()` hook provides information about the current device:
- `isTablet` - Devices with width >= 768px
- `isLargePhone` - Devices with width >= 412px and < 768px
- `isSmallPhone` - Devices with width < 360px
- `isLandscape` - Current orientation
- `isSmallScreen`, `isMediumScreen`, `isLargeScreen`, `isExtraLargeScreen` - Screen size categories

### 2. Responsive Utilities

#### `percentageWidth(percentage)`
Get a percentage of screen width.
```javascript
const buttonWidth = percentageWidth(80); // 80% of screen width
```

#### `percentageHeight(percentage)`
Get a percentage of screen height.
```javascript
const modalHeight = percentageHeight(50); // 50% of screen height
```

#### `scaleSize(size, factor)`
Scale any size value based on screen width.
```javascript
const iconSize = scaleSize(24); // Scales based on device
const largerIcon = scaleSize(24, 1.5); // 1.5x scaling
```

#### `scaleFont(fontSize, factor)`
Scale font sizes responsively, respecting system font scale settings.
```javascript
const titleSize = scaleFont(24); // Responsive font size
```

#### `responsivePadding(basePadding, options)`
Get responsive padding based on screen size.
```javascript
const padding = responsivePadding(16, {
  small: 12,    // For screens < 360px
  medium: 14,   // For screens 360-414px
  large: 16,     // For screens 414-768px
  tablet: 20,   // For tablets >= 768px
});
```

#### `responsiveFontSize(baseFontSize, options)`
Get responsive font size based on screen size.
```javascript
const fontSize = responsiveFontSize(18, {
  small: 14,
  medium: 16,
  large: 18,
  tablet: 20,
});
```

## Usage Examples

### Basic Component with Responsive Design

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useResponsive, responsiveFontSize, responsivePadding, scaleSize } from '../utils/responsive';

export default function MyComponent() {
  const { isTablet, isSmallScreen, width } = useResponsive();
  const styles = getStyles(isTablet, isSmallScreen, width);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Responsive Title</Text>
    </View>
  );
}

const getStyles = (isTablet, isSmallScreen, width) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: responsivePadding(16, {
        small: 12,
        medium: 14,
        large: 16,
        tablet: 20,
      }),
    },
    title: {
      fontSize: responsiveFontSize(24, {
        small: 18,
        medium: 20,
        large: 22,
        tablet: 28,
      }),
      fontWeight: 'bold',
    },
  });
};
```

### Using Flexbox for Layout

```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: isTablet ? 'row' : 'column', // Horizontal on tablet, vertical on phone
  },
  leftPanel: {
    flex: isTablet ? 0.6 : 1, // 60% on tablet, full width on phone
  },
  rightPanel: {
    flex: isTablet ? 0.4 : 1, // 40% on tablet, full width on phone
  },
});
```

### Responsive Images and Icons

```javascript
import { scaleSize } from '../utils/responsive';

// Icons
<Ionicons name="home" size={scaleSize(24)} />

// Images
<Image 
  source={require('./logo.png')} 
  style={{
    width: scaleSize(200),
    height: scaleSize(200),
  }}
/>
```

## Screen Size Breakpoints

- **Small Screen**: < 360px (Small phones)
- **Medium Screen**: 360px - 414px (Standard phones)
- **Large Screen**: 414px - 768px (Large phones, small tablets)
- **Extra Large Screen**: >= 768px (Tablets)

## Best Practices

### 1. Always Use Responsive Utilities
Instead of hardcoded values:
```javascript
// ❌ Bad
fontSize: 18
padding: 16

// ✅ Good
fontSize: responsiveFontSize(18)
padding: responsivePadding(16)
```

### 2. Use Flexbox for Layouts
Flexbox automatically adapts to different screen sizes:
```javascript
// ✅ Good - Adapts automatically
<View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
```

### 3. Test on Multiple Devices
Always test your components on:
- Small phones (< 360px)
- Standard phones (360-414px)
- Large phones (414-768px)
- Tablets (>= 768px)

### 4. Handle Orientation Changes
The app is locked to landscape, but still handle different aspect ratios:
```javascript
const { isLandscape, aspectRatio } = useResponsive();
```

### 5. Use Safe Areas
For notched devices, use SafeAreaView:
```javascript
import { SafeAreaView } from 'react-native-safe-area-context';

<SafeAreaView style={styles.container}>
  {/* Your content */}
</SafeAreaView>
```

## Common Patterns

### Responsive Modal
```javascript
const modalWidth = isTablet 
  ? Math.min(600, width * 0.7) 
  : width * 0.9;
```

### Responsive Grid
```javascript
const columns = isTablet ? 3 : (isLargePhone ? 2 : 1);
```

### Responsive Text Input
```javascript
<TextInput
  style={{
    fontSize: responsiveFontSize(16),
    padding: responsivePadding(12),
  }}
/>
```

## Device Support

The app is designed to work on:
- ✅ Small Android phones (320px+)
- ✅ Standard Android/iOS phones (360-414px)
- ✅ Large phones (414-768px)
- ✅ Tablets (768px+)
- ✅ All screen densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)

## Troubleshooting

### Text is too small on small devices
Use `responsiveFontSize` with appropriate breakpoints:
```javascript
fontSize: responsiveFontSize(16, {
  small: 14,  // Larger on small screens
  medium: 15,
  large: 16,
})
```

### Layout breaks on tablets
Use conditional layouts:
```javascript
flexDirection: isTablet ? 'row' : 'column'
```

### Icons are too small/large
Use `scaleSize`:
```javascript
<Ionicons name="home" size={scaleSize(24)} />
```

## Additional Resources

- React Native Dimensions API: https://reactnative.dev/docs/dimensions
- Flexbox Guide: https://reactnative.dev/docs/flexbox
- Safe Area Context: https://github.com/th3rdwave/react-native-safe-area-context

