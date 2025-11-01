import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL } from '../utils/config';

const { width } = Dimensions.get('window');

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        Alert.alert('Network Error', 'Failed to connect to server. Please check your connection.');
        setLoading(false);
      });
  }, []);

  const filteredInventory = inventory.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <LinearGradient
      colors={['#FBFBFB', '#E8F9FF', '#FBFBFB']}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>📦 INVENTORY</Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, category, or description..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tableContainer}>
          <LinearGradient
            colors={['#000000', '#333333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tableHeader}
          >
            <Text style={[styles.headerCell, { flex: 2, textAlign: 'left' }]}>Name</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>Category</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>Stock</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>Price</Text>
          </LinearGradient>

          {loading ? (
            <ActivityIndicator size="large" color="#007BFF" style={{ marginTop: 20 }} />
          ) : (
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
                  <Text style={[styles.cell, styles.nameCell, { flex: 2 }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.cell, { flex: 1.5 }]}>{item.category || 'N/A'}</Text>
                  <Text style={[styles.cell, { flex: 1 }, item.stock <= 10 && styles.lowStock, item.stock === 0 && styles.outOfStock]}>{item.stock}</Text>
                  <Text style={[styles.cell, { flex: 1 }]}>₱{parseFloat(item.price).toFixed(2)}</Text>
                </View>
              )}
              style={styles.tableScroll}
              contentContainerStyle={styles.tableScrollContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const PADDING = width * 0.04;

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: PADDING,
    paddingTop: PADDING,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: width * 0.07,
    fontWeight: '900',
    color: '#2C3E50',
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: width * 0.04,
    color: '#3A3A3A',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 15,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: width * 0.038,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tableScroll: {
    flex: 1,
  },
  tableScrollContent: {
    paddingBottom: 20,
  },
  rowEven: {
    backgroundColor: '#FFFFFF',
  },
  rowOdd: {
    backgroundColor: '#F8F9FA',
  },
  cell: {
    fontSize: width * 0.035,
    textAlign: 'center',
    color: '#34495E',
  },
  nameCell: {
    textAlign: 'left',
    fontWeight: '600',
    color: '#2C3E50',
  },
  lowStock: {
    color: '#E67E22',
    fontWeight: 'bold',
  },
  outOfStock: {
    color: '#E74C3C',
    fontWeight: 'bold',
  },
});