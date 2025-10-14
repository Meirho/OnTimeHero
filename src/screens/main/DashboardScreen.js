import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  AppState,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import moment from 'moment';
import NextEventCard from '../../components/dashboard/NextEventCard';
import StreakWidget from '../../components/dashboard/StreakWidget';
import QuickStats from '../../components/dashboard/QuickStats';
import GoogleCalendarService from '../../services/GoogleCalendarService';
import GamificationService from '../../services/GamificationService';
import NotificationService from '../../services/NotificationService';
import LocationService from '../../services/LocationService';

const DashboardScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [nextEvent, setNextEvent] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]); // Add recent events state
  const [stats, setStats] = useState({
    points: 0,
    badges: 0,
    punctualityRate: 0,
    currentStreak: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [settingsClickCount, setSettingsClickCount] = useState(0);
  const [firestoreStatus, setFirestoreStatus] = useState('connected'); // Track Firestore status
  const refreshIntervalRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // Utility function to retry Firestore operations
  const retryFirestoreOperation = async (operation, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
          if (i < maxRetries - 1) {
            console.log(`🔄 Retrying Firestore operation (attempt ${i + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
          } else {
            console.log('❌ Firestore operation failed after all retries');
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
  };

  useEffect(() => {
    initializeDashboard();
    
    // Set up automatic refresh every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      console.log('Auto-refreshing dashboard...');
      loadNextEvent();
    }, 30000); // 30 seconds

    // Listen for app state changes
    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, refreshing dashboard...');
        loadNextEvent();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Listen for navigation focus to refresh when user comes to this screen
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('Dashboard screen focused, refreshing events...');
      loadNextEvent();
      loadRecentEvents(); // Also refresh recent events
    });

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      subscription?.remove();
      unsubscribeFocus();
    };
  }, []);

  const initializeDashboard = async () => {
    setGreeting(getGreeting());
    await loadUserData();
    await loadNextEvent();
    await loadRecentEvents();
    // Trigger calendar sync on startup
    await syncCalendarData();
  };

  const syncCalendarData = async () => {
    try {
      console.log('Starting calendar sync on dashboard load...');
      const calendarService = GoogleCalendarService;
      await calendarService.syncCalendarEvents();
      console.log('Calendar sync completed, reloading events...');
      // Reload events after sync
      await loadNextEvent();
    } catch (error) {
      console.error('Error syncing calendar on dashboard load:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const loadUserData = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    // First, set basic user data from Firebase Auth
    const basicUserData = {
      displayName: currentUser.displayName,
      email: currentUser.email,
      photoURL: currentUser.photoURL,
      uid: currentUser.uid,
    };
    setUser(basicUserData);

    try {
      // Check if Firestore is available with retry logic
      const userDoc = await retryFirestoreOperation(async () => {
        await firestore().enableNetwork();
        return await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .get();
      });
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        // Merge Firestore data with basic user data
        const mergedUserData = {
          ...basicUserData,
          ...userData,
        };
        setUser(mergedUserData);
        setStats({
          points: userData.xp || 0,
          badges: userData.badgeCount || 0,
          punctualityRate: userData.punctualityScore || 0,
          currentStreak: userData.currentStreak || 0,
        });
        setFirestoreStatus('connected');
        console.log('✅ User data loaded successfully from Firestore');
      }
    } catch (error) {
      console.error('❌ Error loading user stats:', error);
      
      // If Firestore is unavailable, try to load from local storage
      if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
        console.log('⚠️ Firestore temporarily unavailable, loading user data from local storage');
        setFirestoreStatus('unavailable');
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const localProfile = await AsyncStorage.getItem('userProfile');
          if (localProfile) {
            const profileData = JSON.parse(localProfile);
            // Merge local data with basic user data
            const mergedUserData = {
              ...basicUserData,
              ...profileData,
            };
            setUser(mergedUserData);
            setStats({
              points: profileData.xp || 0,
              badges: profileData.badgeCount || 0,
              punctualityRate: profileData.punctualityScore || 0,
              currentStreak: profileData.currentStreak || 0,
            });
          }
        } catch (localError) {
          console.error('Error loading local user data:', localError);
        }
      }
    }
  };

  const loadNextEvent = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      // Load Firestore events
      let firestoreEvents = [];
      try {
        await firestore().enableNetwork();
        const now = firestore.Timestamp.now();
        const eventsSnapshot = await firestore()
          .collection('events')
          .where('userId', '==', currentUser.uid)
          .where('startTime', '>', now)
          .orderBy('startTime')
          .limit(5)
          .get();
        
        firestoreEvents = eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isLocal: false,
        }));
      } catch (firestoreError) {
        if (firestoreError.code === 'unavailable' || firestoreError.code === 'deadline-exceeded') {
          console.log('⚠️ Firestore temporarily unavailable for events:', firestoreError.message);
        } else {
          console.log('❌ Firestore events unavailable:', firestoreError);
        }
      }

      // Load local events
      let localEvents = [];
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const localEventsData = await AsyncStorage.getItem('localEvents');
        if (localEventsData) {
          const parsedLocalEvents = JSON.parse(localEventsData);
          const now = new Date();
          localEvents = parsedLocalEvents
            .filter(event => new Date(event.startTime) > now)
            .map(event => ({
              ...event,
              startTime: { toDate: () => new Date(event.startTime) },
              endTime: { toDate: () => new Date(event.endTime) },
              isLocal: true,
            }));
        }
      } catch (localError) {
        console.log('Local events unavailable:', localError);
      }

      // Combine and find next event
      const allEvents = [...firestoreEvents, ...localEvents].sort((a, b) => 
        new Date(a.startTime.toDate()) - new Date(b.startTime.toDate())
      );

          if (allEvents.length > 0) {
            setNextEvent(allEvents[0]);
            
            // Schedule notifications for upcoming events that don't have them yet
            allEvents.forEach(event => {
              if (event.status === 'upcoming') {
                NotificationService.scheduleEventNotifications(event).catch(err => {
                  console.log('Failed to schedule notifications for event:', event.title, err);
                });
              }
            });
          } else {
            setNextEvent(null);
          }

    } catch (error) {
      console.error('Error loading next event:', error);
      setNextEvent(null);
    }
  };

  const loadRecentEvents = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      // Load recent completed events from Firestore
      let completedEvents = [];
      try {
        await firestore().enableNetwork();
        const eventsSnapshot = await firestore()
          .collection('events')
          .where('userId', '==', currentUser.uid)
          .where('status', '==', 'completed')
          .orderBy('completedAt', 'desc')
          .limit(5)
          .get();
        
        completedEvents = eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isLocal: false,
        }));
        console.log('📊 Loaded', completedEvents.length, 'completed events from Firestore');
      } catch (firestoreError) {
        if (firestoreError.code === 'unavailable' || firestoreError.code === 'deadline-exceeded') {
          console.log('⚠️ Firestore temporarily unavailable for recent events:', firestoreError.message);
        } else {
          console.log('❌ Firestore completed events unavailable:', firestoreError);
        }
      }

      // Load recent completed events from local storage
      let localCompletedEvents = [];
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const localEventsData = await AsyncStorage.getItem('localEvents');
        if (localEventsData) {
          const parsedLocalEvents = JSON.parse(localEventsData);
          console.log('📊 Total local events:', parsedLocalEvents.length);
          const completedLocalEvents = parsedLocalEvents.filter(event => event.status === 'completed');
          console.log('📊 Completed local events:', completedLocalEvents.length);
          
          localCompletedEvents = completedLocalEvents
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .slice(0, 5)
            .map(event => ({
              ...event,
              startTime: { toDate: () => new Date(event.startTime) },
              endTime: { toDate: () => new Date(event.endTime) },
              isLocal: true,
            }));
          console.log('📊 Processed', localCompletedEvents.length, 'local completed events');
        }
      } catch (localError) {
        console.log('Local completed events unavailable:', localError);
      }

      // Combine and set recent events
      const allRecentEvents = [...completedEvents, ...localCompletedEvents]
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 5);
      
      setRecentEvents(allRecentEvents);
      console.log('Loaded recent events:', allRecentEvents.length);

    } catch (error) {
      console.error('Error loading recent events:', error);
      setRecentEvents([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUserData(), 
      loadNextEvent(),
      loadRecentEvents(),
      syncCalendarData()
    ]);
    setRefreshing(false);
  };

  const handleSettingsClick = async () => {
    const newCount = settingsClickCount + 1;
    setSettingsClickCount(newCount);
    
    if (newCount === 50) {
      // Reset counter
      setSettingsClickCount(0);
      
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('phoneLockEnabled', 'false');
        Alert.alert(
          'Screen Lock Disabled', 
          'Phone lock feature has been disabled. You can re-enable it in Settings.',
          [{ text: 'OK', onPress: () => navigation.navigate('Settings') }]
        );
      } catch (error) {
        console.error('Error disabling phone lock:', error);
      }
      return; // Don't navigate immediately after 50 clicks
    } else if (newCount > 50) {
      setSettingsClickCount(0);
    }
    
    // Only navigate on single click (not during rapid clicking)
    if (newCount === 1) {
      setTimeout(() => {
        // Check if still at 1 click after delay (means single click, not rapid)
        if (settingsClickCount === 0) { // Will be 0 if no more clicks happened
          navigation.navigate('Settings');
        }
      }, 300);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Icon name="person" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
                {greeting}, {user?.displayName?.split(' ')[0] || 'Hero'}! 👋
              </Text>
              <Text style={styles.date}>
                {moment().format('dddd, MMMM D')}
              </Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={handleSettingsClick} 
              style={styles.headerButton}
            >
              <Icon name="settings" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Profile')} 
              style={styles.headerButton}
            >
              <Icon name="notifications" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
          />
        }
      >
        {nextEvent && (
          <NextEventCard
            event={nextEvent}
            onLeaveNow={() => navigation.navigate('PhoneLock', { event: nextEvent })}
          />
        )}

        <StreakWidget
          streak={stats.currentStreak}
          xpEarned={50}
        />

        <QuickStats
          points={stats.points}
          badges={stats.badges}
          punctualityRate={stats.punctualityRate}
        />

        {/* Connection Status */}
        {firestoreStatus === 'unavailable' && (
          <View style={styles.connectionStatus}>
            <Icon name="cloud-off" size={16} color="#ff6b6b" />
            <Text style={styles.connectionStatusText}>
              Working offline - some features may be limited
            </Text>
          </View>
        )}

        {/* Recent Activity Section */}
        {recentEvents.length > 0 && (
          <View style={styles.recentActivity}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentEvents.map((event, index) => (
              <View key={event.id || index} style={[
                styles.recentEventCard,
                { backgroundColor: event.arrivedOnTime ? '#e8f5e8' : '#fff3cd' }
              ]}>
                <View style={styles.recentEventHeader}>
                  <Text style={styles.recentEventTitle}>{event.title}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: event.arrivedOnTime ? '#28a745' : '#ffc107' }
                  ]}>
                    <Text style={styles.statusText}>
                      {event.arrivedOnTime ? '✅ On Time' : '⚠️ Late'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.recentEventTime}>
                  {moment(event.startTime.toDate ? event.startTime.toDate() : event.startTime).format('MMM DD, HH:mm')}
                </Text>
                {event.arrivedOnTime && (
                  <Text style={styles.pointsEarned}>+50 XP earned!</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Calendar')}
            >
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.actionGradient}
              >
                <Icon name="event" size={24} color="#fff" />
                <Text style={styles.actionText}>View Calendar</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddEvent')}
            >
              <LinearGradient
                colors={['#4facfe', '#00f2fe']}
                style={styles.actionGradient}
              >
                <Icon name="add-circle" size={24} color="#fff" />
                <Text style={styles.actionText}>Add Event</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.recentActivity}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.activityText}>
              Arrived on time for Team Meeting
            </Text>
            <Text style={styles.activityTime}>2h ago</Text>
          </View>
          <View style={styles.activityItem}>
            <Icon name="emoji-events" size={20} color="#FFD700" />
            <Text style={styles.activityText}>
              Earned "Perfect Week" badge!
            </Text>
            <Text style={styles.activityTime}>Yesterday</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 20,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  greetingContainer: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerButton: {
    padding: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: -10,
  },
  quickActions: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  actionGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
  },
  recentActivity: {
    marginTop: 30,
    marginBottom: 20,
  },
  recentEventCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  recentEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  recentEventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recentEventTime: {
    color: '#666',
    fontSize: 14,
    marginBottom: 5,
  },
  pointsEarned: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: 'bold',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  connectionStatusText: {
    marginLeft: 8,
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  activityText: {
    flex: 1,
    marginLeft: 10,
    color: '#333',
    fontSize: 14,
  },
  activityTime: {
    color: '#999',
    fontSize: 12,
  },
});

export default DashboardScreen;