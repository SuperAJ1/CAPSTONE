import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Login from '../screens/Login';

// Mock the useNavigation hook
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Mock the config file
jest.mock('../utils/config', () => ({
  API_URL: 'http://fake-api.com',
}));

describe('Login Screen', () => {
  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(<Login />);

    // Check if input fields are there
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();

    // Check if the login button is there
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('allows typing in username and password fields', () => {
    const { getByPlaceholderText } = render(<Login />);

    const usernameInput = getByPlaceholderText('Username');
    const passwordInput = getByPlaceholderText('Password');

    fireEvent.changeText(usernameInput, 'testuser');
    fireEvent.changeText(passwordInput, 'password123');

    expect(usernameInput.props.value).toBe('testuser');
    expect(passwordInput.props.value).toBe('password123');
  });
});
