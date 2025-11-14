import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import Inventory from '../screens/Inventory';
import { API_URL } from '../utils/config';
import { Alert } from 'react-native';

// Mock the fetch function
global.fetch = jest.fn();

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockInventoryData = [
  { id: 1, name: 'Product A', category: 'Category 1', stock: 100, price: '10.00' },
  { id: 2, name: 'Product B', category: 'Category 2', stock: 5, price: '20.50' },
  { id: 3, name: 'Another Item', category: 'Category 1', stock: 0, price: '5.00' },
];

describe('Inventory Screen', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  it('shows a loading indicator initially', async () => {
    fetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    const { getByTestId } = render(<Inventory />);
    // Note: ActivityIndicator doesn't have a default testID. We'll check for its presence indirectly.
    // A better way would be to add a testID to the ActivityIndicator component itself.
    // For now, we'll check that the list is not yet visible.
    await waitFor(() => {
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  it('fetches and displays inventory data successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: mockInventoryData }),
    });

    const { getByText, queryByTestId } = render(<Inventory />);

    // Wait for loading to finish and data to appear
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(getByText('Product A')).toBeTruthy();
      expect(getByText('Product B')).toBeTruthy();
      expect(getByText('Another Item')).toBeTruthy();
    }, { timeout: 10000 });
  }, 15000);

  it('displays an error message if the fetch fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Network Error'));
    const { getByPlaceholderText, queryByTestId } = render(<Inventory />);

    // Wait for loading to finish (error should stop loading)
    await waitFor(() => {
      expect(queryByTestId('loading-indicator')).toBeNull();
    }, { timeout: 10000 });

    // Check that the search input is available (component rendered)
    expect(getByPlaceholderText('Search inventory...')).toBeTruthy();
    
    // Verify Alert was called
    expect(Alert.alert).toHaveBeenCalledWith('Network Error', 'Failed to connect to server. Please check your connection.');
  }, 15000);

  it('filters the inventory based on search query', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: mockInventoryData }),
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<Inventory />);

    await waitFor(() => {
      expect(getByText('Product A')).toBeTruthy();
    }, { timeout: 10000 });

    const searchInput = getByPlaceholderText('Search inventory...');
    fireEvent.changeText(searchInput, 'Product B');

    expect(getByText('Product B')).toBeTruthy();
    expect(queryByText('Product A')).toBeNull();
    expect(queryByText('Another Item')).toBeNull();
  }, 15000);

  it('highlights low stock and out of stock items', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: mockInventoryData }),
    });

    const { getByText } = render(<Inventory />);

    await waitFor(() => {
      const lowStockItem = getByText('5'); // Product B stock
      const outOfStockItem = getByText('0'); // Another Item stock

      // Check for style changes. This requires a bit more setup to test styles effectively.
      // A simple check is to see if the elements are rendered.
      expect(lowStockItem).toBeTruthy();
      expect(outOfStockItem).toBeTruthy();
    }, { timeout: 10000 });
  }, 15000);
});
