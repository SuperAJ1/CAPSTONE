export function useResponsive() {
  const { width, height, scale, fontScale } = require('react-native').useWindowDimensions();

  const isTablet = width >= 768;
  const isLargePhone = width >= 412 && width < 768;
  const isLandscape = width > height;

  const columns = isTablet ? 3 : 2;

  return {
    width,
    height,
    scale,
    fontScale,
    isTablet,
    isLargePhone,
    isLandscape,
    columns,
  };
}

export function percentageWidth(percentage) {
  const { width } = require('react-native').Dimensions.get('window');
  return Math.round((percentage / 100) * width);
} 