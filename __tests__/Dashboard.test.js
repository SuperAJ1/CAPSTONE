import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import Dashboard from '../screens/Dashboard';

// Mock the necessary modules
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useFocusEffect: jest.fn().mockImplementation(callback => {
      // In test environment, we can treat useFocusEffect like useEffect
      const { useEffect } = require('react');
      useEffect(callback, []);
    }),
  };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: (props) => <View {...props} />,
  };
});

jest.mock('react-native-gifted-charts', () => ({
  PieChart: (props) => {
    const { View } = require('react-native');
    return <View testID="mock-pie-chart" {...props} />;
  },
}));

// Jest will automatically use __mocks__/moti.js

const mockInventoryItems = [
  { id: 1, name: 'T-Shirt', category: 'Clothing', stock: 10, price: '500.00', date_added: '2025-11-04' },
  { id: 2, name: 'Jeans', category: 'Clothing', stock: 4, price: '1200.00', date_added: '2025-11-03' },
  { id: 3, name: 'Hat', category: 'Accessories', stock: 20, price: '300.00', date_added: '2025-11-02' },
  { id: 4, name: 'Sneakers', category: 'Footwear', stock: 0, price: '2500.00', date_added: '2025-11-01' },
];

describe('Dashboard Screen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {})); // Never resolves
    const { getByText } = render(<Dashboard />);
    expect(getByText('Loading Dashboard...')).toBeTruthy();
  });

  it('displays summary cards and data after fetching', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success', data: mockInventoryItems }),
    });

    const { getByText, getAllByText } = render(<Dashboard />);

    await waitFor(() => {
      // From mockInventoryItems:
      // Total Products = 4
      // Total Value = (10*500) + (4*1200) + (20*300) + (0*2500) = 5000 + 4800 + 6000 = 15800
      // Low Stock (<=5) = Jeans (4), Sneakers (0) = 2
      // Out of Stock (==0) = Sneakers (0) = 1
      expect(getByText('Total Products')).toBeTruthy();
      expect(getByText('4')).toBeTruthy();
      expect(getByText('Total Value')).toBeTruthy();
      expect(getByText('₱15800.00')).toBeTruthy();
      expect(getByText('Low Stock')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
      expect(getByText('Out of Stock')).toBeTruthy();
      expect(getByText('1')).toBeTruthy();
      expect(getByText('Category Distribution')).toBeTruthy();
      expect(getByText('Recently Added')).toBeTruthy();
      expect(getAllByText('T-Shirt').length).toBeGreaterThan(0);
      expect(getByText('Top Value Items')).toBeTruthy();
      expect(getAllByText('Hat').length).toBeGreaterThan(0);
    });
  });

  it('displays an error message if the fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('API Error'));

    const { getByText } = render(<Dashboard />);

    await waitFor(() => {
      expect(getByText('Failed to load data. Please try again.')).toBeTruthy();
    });
  });
});
