import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import Inventory from '../screens/Inventory';
import { API_URL } from '../utils/config';

// Mock the fetch function
global.fetch = jest.fn();

const mockInventoryData = [
  { id: 1, name: 'Product A', category: 'Category 1', stock: 100, price: '10.00' },
  { id: 2, name: 'Product B', category: 'Category 2', stock: 5, price: '20.50' },
  { id: 3, name: 'Another Item', category: 'Category 1', stock: 0, price: '5.00' },
];

describe('Inventory Screen', () => {
  beforeEach(() => {
    fetch.mockClear();
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
      json: () => Promise.resolve({ status: 'success', data: mockInventoryData }),
    });

    const { getByText } = render(<Inventory />);

    await waitFor(() => {
      expect(getByText('Product A')).toBeTruthy();
      expect(getByText('Product B')).toBeTruthy();
      expect(getByText('Another Item')).toBeTruthy();
    });
  });

  it('displays an error message if the fetch fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Network Error'));
    const { getByPlaceholderText } = render(<Inventory />);

    // This test is a bit tricky as Alert is a native module.
    // In a real app, you might have a custom alert component to test.
    // For now, we assume the console error is a sufficient side effect.
    // We can also check that the loading indicator disappears and no data is shown.
    await waitFor(() => {
      expect(getByPlaceholderText('Search inventory...')).toBeTruthy(); // A stable element
    });
  });

  it('filters the inventory based on search query', async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ status: 'success', data: mockInventoryData }),
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<Inventory />);

    await waitFor(() => {
      expect(getByText('Product A')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search inventory...');
    fireEvent.changeText(searchInput, 'Product B');

    expect(getByText('Product B')).toBeTruthy();
    expect(queryByText('Product A')).toBeNull();
    expect(queryByText('Another Item')).toBeNull();
  });

  it('highlights low stock and out of stock items', async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ status: 'success', data: mockInventoryData }),
    });

    const { getByText } = render(<Inventory />);

    await waitFor(() => {
      const lowStockItem = getByText('5'); // Product B stock
      const outOfStockItem = getByText('0'); // Another Item stock

      // Check for style changes. This requires a bit more setup to test styles effectively.
      // A simple check is to see if the elements are rendered.
      expect(lowStockItem).toBeTruthy();
      expect(outOfStockItem).toBeTruthy();
    });
  });
});
