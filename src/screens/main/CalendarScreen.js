import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import moment from 'moment';
import GoogleCalendarService from '../../services/GoogleCalendarService';
import LockService from '../../services/LockService';

const { width } = Dimensions.get('window');

const CalendarScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [nextEvent, setNextEvent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      const eventsSnapshot = await firestore()
        .collection('events')
        .where('userId', '==', currentUser.uid)
        .where('startTime', '>=', firestore.Timestamp.now())
        .orderBy('startTime')
        .limit(20)
        .get();

      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setEvents(eventsData);
      
      // Find today's events
      const today = moment().startOf('day');
      const tomorrow = moment().add(1, 'day').startOf('day');
      
      const todayEventsData = eventsData.filter(event => {
        const eventDate = moment(event.startTime.toDate());
        return eventDate.isBetween(today, tomorrow, null, '[)');
      });
      
      setTodayEvents(todayEventsData);
      
      // Find next event
      const nextEventData = eventsData.find(event => 
        moment(event.startTime.toDate()).isAfter(moment())
      );
      setNextEvent(nextEventData);
      
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'Failed to load events');
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    try {
      await GoogleCalendarService.syncCalendarEvents();
      await loadEvents();
      Alert.alert('Success', 'Calendar synced successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Failed', 'Please check your Google Calendar connection');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartLockMode = (event) => {
    const now = moment();
    const eventTime = moment(event.startTime.toDate());
    const travelTime = event.travelTime || 15; // Default 15 minutes
    const departureTime = eventTime.subtract(travelTime, 'minutes');
    
    if (now.isAfter(departureTime)) {
      Alert.alert(
        'Time to Leave!',
        `It's time to go to "${event.title}"! Starting lock mode to help you stay focused.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Lock Phone',
            onPress: () => {
              navigation.navigate('PhoneLock', { event });
            },
          },
        ]
      );
    } else {
      const timeUntilDeparture = moment.duration(departureTime.diff(now));
      Alert.alert(
        'Departure Reminder Set',
        `You'll be reminded to leave in ${timeUntilDeparture.hours()}h ${timeUntilDeparture.minutes()}m for "${event.title}"`,
        [{ text: 'OK' }]
      );
    }
  };

  const getEventStatus = (event) => {
    const now = moment();
    const eventTime = moment(event.startTime.toDate());
    const travelTime = event.travelTime || 15;
    const departureTime = eventTime.subtract(travelTime, 'minutes');
    
    if (now.isAfter(eventTime)) {
      return { status: 'past', color: '#666', icon: 'check-circle' };
    } else if (now.isAfter(departureTime)) {
      return { status: 'departure', color: '#ff6b6b', icon: 'directions-walk' };
    } else {
      return { status: 'upcoming', color: '#4CAF50', icon: 'schedule' };
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const renderEventCard = (event, isToday = false) => {
    const eventStatus = getEventStatus(event);
    const eventTime = moment(event.startTime.toDate());
    const travelTime = event.travelTime || 15;
    const departureTime = eventTime.subtract(travelTime, 'minutes');
    
    return (
      <TouchableOpacity
        key={event.id}
        style={[styles.eventCard, isToday && styles.todayEventCard]}
        onPress={() => handleStartLockMode(event)}
      >
        <LinearGradient
          colors={eventStatus.color === '#ff6b6b' ? ['#ff6b6b', '#ff8e8e'] : 
                  eventStatus.color === '#4CAF50' ? ['#4CAF50', '#66bb6a'] : 
                  ['#666', '#888']}
          style={styles.eventGradient}
        >
          <View style={styles.eventHeader}>
            <View style={styles.eventTimeContainer}>
              <Icon name="access-time" size={16} color="#fff" />
              <Text style={styles.eventTime}>
                {eventTime.format('h:mm A')}
              </Text>
            </View>
            <View style={styles.eventStatusContainer}>
              <Icon name={eventStatus.icon} size={16} color="#fff" />
              <Text style={styles.eventStatus}>
                {eventStatus.status === 'departure' ? 'Leave Now!' : 
                 eventStatus.status === 'upcoming' ? 'Upcoming' : 'Past'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.eventTitle}>{event.title}</Text>
          
          {event.location && (
            <View style={styles.eventLocationContainer}>
              <Icon name="location-on" size={14} color="#fff" />
              <Text style={styles.eventLocation}>{event.location}</Text>
            </View>
          )}
          
          {eventStatus.status !== 'past' && (
            <View style={styles.departureInfo}>
              <Text style={styles.departureText}>
                Departure time: {departureTime.format('h:mm A')}
              </Text>
              <Text style={styles.travelTimeText}>
                Travel time: {travelTime} minutes
              </Text>
            </View>
          )}
          
          {eventStatus.status === 'departure' && (
            <View style={styles.lockButtonContainer}>
              <Icon name="lock" size={20} color="#fff" />
              <Text style={styles.lockButtonText}>Tap to Start Lock Mode</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📅 Your Calendar</Text>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncCalendar}
            disabled={isSyncing}
          >
            <Icon 
              name="sync" 
              size={20} 
              color="#fff" 
              style={isSyncing && styles.spinning}
            />
            <Text style={styles.syncButtonText}>
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Text>
          </TouchableOpacity>
        </View>

        {nextEvent && (
          <View style={styles.nextEventSection}>
            <Text style={styles.sectionTitle}>🎯 Next Event</Text>
            {renderEventCard(nextEvent, true)}
          </View>
        )}

        {todayEvents.length > 0 && (
          <View style={styles.todaySection}>
            <Text style={styles.sectionTitle}>📋 Today's Events</Text>
            {todayEvents.map(event => renderEventCard(event, true))}
          </View>
        )}

        {events.length > 0 && (
          <View style={styles.upcomingSection}>
            <Text style={styles.sectionTitle}>🔮 Upcoming Events</Text>
            {events.slice(0, 5).map(event => renderEventCard(event))}
          </View>
        )}

        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="event-busy" size={60} color="rgba(255,255,255,0.6)" />
            <Text style={styles.emptyStateTitle}>No Events Found</Text>
            <Text style={styles.emptyStateText}>
              Sync your Google Calendar to see your upcoming events
            </Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSyncCalendar}
            >
              <Icon name="sync" size={20} color="#fff" />
              <Text style={styles.syncButtonText}>Sync Calendar</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  syncButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  nextEventSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  todaySection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  upcomingSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  eventCard: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  todayEventCard: {
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  eventGradient: {
    padding: 20,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  eventStatus: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  eventLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventLocation: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    opacity: 0.9,
  },
  departureInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  departureText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  travelTimeText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  lockButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
  lockButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});

export default CalendarScreen;

