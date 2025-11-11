import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LandingPage from '../screens/LandingPage';

// Mock the navigation hook
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('LandingPage', () => {
  it('renders the title and subtitle', () => {
    const { getByText } = render(<LandingPage />);
    expect(getByText('SIMS: Sales and Inventory System')).toBeTruthy();
    expect(getByText('Manage your sales and stock with ease. Track products, organize inventory, and simplify operations.')).toBeTruthy();
  });

  it('renders the "Get Started" button', () => {
    const { getByText } = render(<LandingPage />);
    expect(getByText('Get Started')).toBeTruthy();
  });

  it('navigates to the Login screen when "Get Started" is pressed', () => {
    const { getByText } = render(<LandingPage />);
    const getStartedButton = getByText('Get Started');
    fireEvent.press(getStartedButton);
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('renders the illustration text', () => {
    const { getByText } = render(<LandingPage />);
    expect(getByText('Easily manage your inventory and keep track of stock levels.')).toBeTruthy();
  });
});
