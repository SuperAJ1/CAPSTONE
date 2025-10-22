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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://192.168.0.89/rtw_backend/get_inventory.php')
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
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tableContainer}>
          {/* Table Header */}
          <LinearGradient
            colors={['#000000', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.tableHeader}
          >
            <Text style={styles.headerCell}>ID</Text>
            <Text style={styles.headerCell}>Name</Text>
            <Text style={styles.headerCell}>Category</Text>
            <Text style={styles.headerCell}>Stock</Text>
            <Text style={styles.headerCell}>Price</Text>
            <Text style={styles.headerCell}>Added</Text>
          </LinearGradient>

          {loading ? (
            <ActivityIndicator size="large" color="#C5BAFF" style={{ marginTop: 20 }} />
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
                  <Text style={styles.cell}>{item.id}</Text>
                  <Text style={[styles.cell, styles.nameCell]} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cell}>{item.category || 'Uncategorized'}</Text>
                  <Text style={[styles.cell, item.stock <= 5 ? styles.lowStock : null]}>{item.stock}</Text>
                  <Text style={styles.cell}>₱{parseFloat(item.price).toFixed(2)}</Text>
                  <Text style={styles.cell}>{item.date_added ? new Date(item.date_added).toLocaleDateString() : 'N/A'}</Text>
                </View>
              )}
              style={styles.tableScroll}
              contentContainerStyle={styles.tableScrollContent}
              showsVerticalScrollIndicator={true}
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
    padding: PADDING,
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    padding: 10,
  },
  header: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#3A3A3A',
  },
  searchContainer: {
    backgroundColor: '#E5E7EB',
    padding: 10,
    borderRadius: 30,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    backgroundColor: '#D3DAD9',
    padding: 12,
    borderRadius: 20,
    fontSize: width * 0.035,
    color: '#3A3A3A',
    paddingLeft: 20,
  },
  tableContainer: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
    minHeight: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  headerCell: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: width * 0.035,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableScroll: {
    flex: 1,
  },
  tableScrollContent: {
    paddingBottom: 16,
  },
  rowEven: {
    backgroundColor: '#FBFBFB',
  },
  rowOdd: {
    backgroundColor: '#F5F7FA',
  },
  cell: {
    flex: 1,
    fontSize: width * 0.033,
    textAlign: 'center',
    color: '#555555',
    fontWeight: '500',
  },
  nameCell: {
    textAlign: 'left',
    paddingLeft: 8,
  },
  lowStock: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
});