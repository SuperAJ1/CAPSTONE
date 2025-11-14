import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const statusColors = {
  Completed: '#4CAF50',
  Pending: '#FBBF24',
  Cancelled: '#EF4444',
};

const iconMap = {
  'shopping-bag': <MaterialCommunityIcons name="shopping" size={28} color="#C5BAFF" />,
  'receipt': <Ionicons name="receipt-outline" size={28} color="#C5BAFF" />,
  'cash-refund': <MaterialCommunityIcons name="cash-refund" size={28} color="#C5BAFF" />,
};

const TransactionsScreen = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        // Example: const response = await fetch('https://your-api.com/transactions');
        // const data = await response.json();
        // setTransactions(data.transactions);
        // --- Demo: Simulate API delay and use static data ---
        await new Promise(res => setTimeout(res, 800));
        setTransactions([
          {
            id: '1',
            type: 'Purchase',
            date: '2025-11-06 14:32',
            amount: 1299.99,
            status: 'Completed',
            icon: 'shopping-bag',
          },
          {
            id: '2',
            type: 'Refund',
            date: '2025-11-05 10:12',
            amount: -299.99,
            status: 'Pending',
            icon: 'cash-refund',
          },
          {
            id: '3',
            type: 'Purchase',
            date: '2025-11-04 18:45',
            amount: 499.5,
            status: 'Cancelled',
            icon: 'shopping-bag',
          },
          {
            id: '4',
            type: 'Receipt',
            date: '2025-11-03 09:20',
            amount: 199.0,
            status: 'Completed',
            icon: 'receipt',
          },
        ]);
      } catch (e) {
        setError('Failed to load transactions.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const renderItem = ({ item }) => (
    <Animated.View style={[styles.card, {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    }]}
    >
      <View style={styles.iconContainer}>
        {iconMap[item.icon] || <Ionicons name="document-text-outline" size={28} color="#C5BAFF" />}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.type}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || '#64748b' }] }>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{item.date}</Text>
        <Text style={styles.cardAmount}>
          ₱{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#37353E" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Previous Transactions</Text>
        {/* Optional: Add a search/filter button here */}
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#37353E', fontSize: 16 }}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#EF4444', fontSize: 16 }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  header: {
    backgroundColor: '#37353E',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#C5BAFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#37353E',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  cardDate: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 2,
  },
  cardAmount: {
    color: '#7C3AED',
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 2,
  },
});

export default TransactionsScreen;
