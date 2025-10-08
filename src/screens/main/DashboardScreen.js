import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
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
  const [stats, setStats] = useState({
    points: 0,
    badges: 0,
    punctualityRate: 0,
    currentStreak: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    loadUserData();
    loadNextEvent();
    setGreeting(getGreeting());
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const loadUserData = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        setUser(userData);
        setStats({
          points: userData.xp || 0,
          badges: userData.badgeCount || 0,
          punctualityRate: userData.punctualityScore || 0,
          currentStreak: userData.currentStreak || 0,
        });
      }
    }
  };

  const loadNextEvent = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      const now = firestore.Timestamp.now();
      const eventsSnapshot = await firestore()
        .collection('events')
        .where('userId', '==', currentUser.uid)
        .where('startTime', '>', now)
        .orderBy('startTime')
        .limit(1)
        .get();
      
      if (!eventsSnapshot.empty) {
        const eventData = eventsSnapshot.docs[0].data();
        setNextEvent({
          id: eventsSnapshot.docs[0].id,
          ...eventData,
        });
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserData(), loadNextEvent()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              {greeting}, {user?.displayName?.split(' ')[0] || 'Hero'}! 👋
            </Text>
            <Text style={styles.date}>
              {moment().format('dddd, MMMM D')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Icon name="notifications" size={28} color="#fff" />
          </TouchableOpacity>
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