import { Dimensions, useWindowDimensions, Platform } from 'react-native';

// Base dimensions for scaling (iPhone 11 Pro - 375x812)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export function useResponsive() {
  const { width, height, scale, fontScale } = useWindowDimensions();

  // Device type detection
  const isTablet = width >= 768;
  const isLargePhone = width >= 412 && width < 768;
  const isSmallPhone = width < 360;
  const isLandscape = width > height;
  
  // Screen size categories
  const isSmallScreen = width < 360;
  const isMediumScreen = width >= 360 && width < 414;
  const isLargeScreen = width >= 414 && width < 768;
  const isExtraLargeScreen = width >= 768;

  // Responsive columns
  const columns = isTablet ? 3 : (isLargePhone ? 2 : 2);
  
  // Aspect ratio
  const aspectRatio = width / height;

  return {
    width,
    height,
    scale,
    fontScale,
    isTablet,
    isLargePhone,
    isSmallPhone,
    isLandscape,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    isExtraLargeScreen,
    columns,
    aspectRatio,
  };
}

/**
 * Get percentage of screen width
 * @param {number} percentage - Percentage of width (0-100)
 * @returns {number} Calculated width in pixels
 */
export function percentageWidth(percentage) {
  const { width } = Dimensions.get('window');
  return Math.round((percentage / 100) * width);
}

/**
 * Get percentage of screen height
 * @param {number} percentage - Percentage of height (0-100)
 * @returns {number} Calculated height in pixels
 */
export function percentageHeight(percentage) {
  const { height } = Dimensions.get('window');
  return Math.round((percentage / 100) * height);
}

/**
 * Scale size based on screen width (responsive scaling)
 * @param {number} size - Base size to scale
 * @param {number} factor - Scaling factor (default: 1)
 * @returns {number} Scaled size
 */
export function scaleSize(size, factor = 1) {
  const { width } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  return Math.round(size * scale * factor);
}

/**
 * Scale font size responsively
 * @param {number} fontSize - Base font size
 * @param {number} factor - Scaling factor (default: 1)
 * @returns {number} Scaled font size
 */
export function scaleFont(fontSize, factor = 1) {
  const { width, fontScale } = Dimensions.get('window');
  const scale = width / BASE_WIDTH;
  // Respect system font scale but limit it
  const limitedFontScale = Math.min(fontScale, 1.3);
  return Math.round(fontSize * scale * limitedFontScale * factor);
}

/**
 * Get responsive padding based on screen size
 * @param {number} basePadding - Base padding value
 * @param {object} options - Options for different screen sizes
 * @returns {number} Responsive padding
 */
export function responsivePadding(basePadding, options = {}) {
  const { width } = Dimensions.get('window');
  const { small, medium, large, tablet } = options;
  
  if (width >= 768 && tablet !== undefined) return tablet;
  if (width >= 414 && large !== undefined) return large;
  if (width >= 360 && medium !== undefined) return medium;
  if (width < 360 && small !== undefined) return small;
  
  return scaleSize(basePadding);
}

/**
 * Get responsive margin based on screen size
 * @param {number} baseMargin - Base margin value
 * @param {object} options - Options for different screen sizes
 * @returns {number} Responsive margin
 */
export function responsiveMargin(baseMargin, options = {}) {
  return responsivePadding(baseMargin, options);
}

/**
 * Get responsive font size based on screen size
 * @param {number} baseFontSize - Base font size
 * @param {object} options - Options for different screen sizes
 * @returns {number} Responsive font size
 */
export function responsiveFontSize(baseFontSize, options = {}) {
  const { width } = Dimensions.get('window');
  const { small, medium, large, tablet } = options;
  
  if (width >= 768 && tablet !== undefined) return tablet;
  if (width >= 414 && large !== undefined) return large;
  if (width >= 360 && medium !== undefined) return medium;
  if (width < 360 && small !== undefined) return small;
  
  return scaleFont(baseFontSize);
}

/**
 * Get device info
 * @returns {object} Device information
 */
export function getDeviceInfo() {
  const { width, height, scale } = Dimensions.get('window');
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  
  return {
    width,
    height,
    scale,
    isTablet,
    isLandscape,
    isIOS,
    isAndroid,
    platform: Platform.OS,
  };
}

/**
 * Get safe area insets (for notched devices)
 * Note: This requires react-native-safe-area-context
 * @returns {object} Safe area insets
 */
export function getSafeAreaInsets() {
  try {
    const { useSafeAreaInsets } = require('react-native-safe-area-context');
    return useSafeAreaInsets();
  } catch (e) {
    // Fallback if safe area context is not available
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
} 