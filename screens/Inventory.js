import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL } from '../utils/config';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetch(`${API_URL}/get_inventory.php`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          setInventory(data.data);
        } else {
          console.error('Backend error:', data.error, data.message);
          Alert.alert('Error', data.message || 'Failed to load inventory');
        }
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        Alert.alert('Network Error', 'Failed to connect to server. Please check your connection.');
      })
      .finally(() => {
        setLoading(false);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
  }, [fadeAnim]);

  const filteredInventory = inventory.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, { flex: 3 }]}>Name</Text>
      <Text style={[styles.headerCell, { flex: 2 }]}>Category</Text>
      <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Stock</Text>
      <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>Price</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
       {/* <Text style={styles.header}>Inventory</Text> */}
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={24} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator testID="loading-indicator" size="large" color="#007BFF" style={{ flex: 1 }} />
      ) : (
        <Animated.View style={[styles.tableContainer, { opacity: fadeAnim }]}>
          {renderHeader()}
          <FlatList
            data={filteredInventory}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => (
              <View
                style={[
                  styles.tableRow,
                  index % 2 === 0 ? styles.rowEven : styles.rowOdd,
                ]}
              >
                <Text style={[styles.cell, styles.nameCell, { flex: 3 }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{item.category || 'N/A'}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: 'center' }, item.stock <= 10 && styles.lowStock, item.stock === 0 && styles.outOfStock]}>{item.stock}</Text>
                <Text style={[styles.cell, { flex: 1.5, textAlign: 'right' }]}>₱{parseFloat(item.price).toFixed(2)}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const PADDING = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FC',
    paddingHorizontal: PADDING,
  },
  headerContainer: {
    paddingVertical: PADDING,
  },
  header: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    color: '#3A3A3A',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2C3E50',
    padding: PADDING,
    borderBottomWidth: 1,
    borderBottomColor: '#394A5D',
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 23,
    color: '#FFFFFF',
    textAlign: 'left',
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PADDING,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  rowEven: {
    backgroundColor: '#FFFFFF',
  },
  rowOdd: {
    backgroundColor: '#F8F9FA',
  },
  cell: {
    fontSize: 20,
    color: '#34495E',
    textAlign: 'left',
    paddingHorizontal: 6,
  },
  nameCell: {
    fontWeight: '600',
    color: '#2C3E50',
  },
  lowStock: {
    color: '#D9480F',
    fontWeight: 'bold',
  },
  outOfStock: {
    color: '#D9480F',
    fontWeight: 'bold',
  },
});