import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import Scanner from '../screens/Scanner';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { View } from 'react-native';

// Mock dependencies
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ...jest.requireActual('expo-camera'),
    useCameraPermissions: jest.fn(),
    CameraView: (props) => React.createElement(View, props),
  };
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({
        sound: {
          playAsync: jest.fn(),
          unloadAsync: jest.fn(),
        },
        status: { isLoaded: true },
      })),
    },
  },
}));

describe('Scanner Screen', () => {
  beforeEach(() => {
    // Reset mocks before each test
    useCameraPermissions.mockClear();
    jest.clearAllMocks();
  });

  it('renders a message asking for camera permission when not granted', async () => {
    // Mock the permission hook to return a non-granted status
    const mockRequestPermission = jest.fn(() => Promise.resolve({ granted: false }));
    useCameraPermissions.mockReturnValue([
      { granted: false, canAskAgain: true },
      mockRequestPermission,
    ]);

    const { findByText, getByText } = render(<Scanner />);

    // The component should show a message and a button to grant permission
    expect(await findByText('We need your permission to access the camera for scanning.')).toBeTruthy();
    
    const permissionButton = getByText('Grant Permission');
    expect(permissionButton).toBeTruthy();

    // Simulate pressing the grant permission button
    await act(async () => {
      fireEvent.press(permissionButton);
    });

    // Check if the requestPermission function was called
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('renders the camera view when permission is granted and camera is turned on', async () => {
    // Mock the permission hook to return a granted status
    useCameraPermissions.mockReturnValue([
      { granted: true },
      jest.fn(() => Promise.resolve({ granted: true })),
    ]);

    const { getByRole, findByTestId } = render(<Scanner />);

    // Find the camera toggle switch and turn it on
    const cameraSwitch = getByRole('switch');
    fireEvent(cameraSwitch, 'valueChange', true);

    // Wait for the camera view to appear
    const cameraView = await findByTestId('camera-view');
    expect(cameraView).toBeTruthy();
  });
});
