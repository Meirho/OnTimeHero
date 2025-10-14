import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  AppState,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import moment from 'moment-timezone';
import GoogleCalendarService from '../../services/GoogleCalendarService';
import LockService from '../../services/LockService';
import NotificationService from '../../services/NotificationService';

const { width } = Dimensions.get('window');

const CalendarScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [nextEvent, setNextEvent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const refreshIntervalRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeCalendar();
    
    // Set up automatic refresh every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      console.log('Auto-refreshing calendar...');
      loadEvents();
    }, 30000); // 30 seconds

    // Listen for app state changes
    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, refreshing calendar...');
        loadEvents();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Listen for navigation focus to refresh when user comes to this screen
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('Calendar screen focused, refreshing events...');
      loadEvents();
    });

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      subscription?.remove();
      unsubscribeFocus();
    };
  }, []);

  const initializeCalendar = async () => {
    await loadEvents();
    // Auto-sync calendar on startup
    await syncCalendarData();
  };

  const syncCalendarData = async () => {
    try {
      console.log('Starting calendar sync on calendar screen load...');
      await GoogleCalendarService.syncCalendarEvents();
      console.log('Calendar sync completed, reloading events...');
      // Reload events after sync
      await loadEvents();
    } catch (error) {
      console.error('Error syncing calendar on calendar screen load:', error);
    }
  };

  const loadEvents = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      // Load local events first (faster)
      let localEvents = [];
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const localEventsData = await AsyncStorage.getItem('localEvents');
        if (localEventsData) {
          const parsedLocalEvents = JSON.parse(localEventsData);
          localEvents = parsedLocalEvents.map(event => ({
            ...event,
            startTime: { toDate: () => new Date(event.startTime) },
            endTime: { toDate: () => new Date(event.endTime) },
            isLocal: true,
          }));
        }
      } catch (localError) {
        console.log('Local events unavailable:', localError);
      }

      // Set local events immediately for fast display
      setEvents(localEvents);
      
      // Find today's events from local data
      const today = moment().startOf('day');
      const tomorrow = moment().add(1, 'day').startOf('day');
      
      const todayEventsData = localEvents.filter(event => {
        const eventDate = moment(event.startTime.toDate());
        return eventDate.isBetween(today, tomorrow, null, '[)');
      });
      
      setTodayEvents(todayEventsData);
      
      // Find next event from local data
      const nextEventData = localEvents.find(event => 
        moment(event.startTime.toDate()).isAfter(moment())
      );
      setNextEvent(nextEventData);

      // Load Firestore events in background (slower)
      setTimeout(async () => {
        try {
          const eventsSnapshot = await firestore()
            .collection('events')
            .where('userId', '==', currentUser.uid)
            .where('startTime', '>=', firestore.Timestamp.now())
            .orderBy('startTime')
            .limit(20)
            .get();

          const firestoreEvents = eventsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isLocal: false,
          }));

          // Combine with local events
          const allEvents = [...localEvents, ...firestoreEvents].sort((a, b) => 
            new Date(a.startTime.toDate()) - new Date(b.startTime.toDate())
          );

          // Update with combined data
          setEvents(allEvents);
          
          // Update today's events
          const todayEventsData = allEvents.filter(event => {
            const eventDate = moment(event.startTime.toDate());
            return eventDate.isBetween(today, tomorrow, null, '[)');
          });
          setTodayEvents(todayEventsData);
          
          // Update next event
          const nextEventData = allEvents.find(event => 
            moment(event.startTime.toDate()).isAfter(moment())
          );
          setNextEvent(nextEventData);

        } catch (firestoreError) {
          console.log('Firestore events unavailable:', firestoreError);
        }
      }, 100); // Small delay to show local events first
      
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    try {
      // First, ensure user has proper permissions by re-authenticating
      await reAuthenticateGoogle();
      
      // First sync from Google Calendar to app
      await GoogleCalendarService.syncCalendarEvents();
      
      // Then sync local events to Google Calendar
      await syncLocalEventsToGoogle();
      
      await loadEvents();
      Alert.alert('Success', 'Calendar synced successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Failed', 'Please check your Google Calendar connection');
    } finally {
      setIsSyncing(false);
    }
  };

  const reAuthenticateGoogle = async () => {
    try {
      Alert.alert(
        'Re-authenticate Google',
        'This will sign you out and back in with new calendar permissions to enable event creation.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                const { GoogleSignin } = require('@react-native-google-signin/google-signin');
                
                // Sign out first to clear old permissions
                await GoogleSignin.signOut();
                console.log('Signed out from Google');
                
                // Sign back in with new permissions
                await GoogleSignin.hasPlayServices();
                const { idToken } = await GoogleSignin.signIn();
                const googleCredential = auth.GoogleAuthProvider.credential(idToken);
                await auth().signInWithCredential(googleCredential);
                
                console.log('Re-authenticated with Google Calendar write permissions');
                Alert.alert('Success', 'Re-authentication completed! You can now create events in Google Calendar.');
              } catch (error) {
                console.error('Re-authentication failed:', error);
                Alert.alert('Error', 'Re-authentication failed. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Re-authentication failed:', error);
      Alert.alert('Error', 'Re-authentication failed. Please try again.');
    }
  };

  const syncLocalEventsToGoogle = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const localEventsData = await AsyncStorage.getItem('localEvents');
      
      if (!localEventsData) return;
      
      const localEvents = JSON.parse(localEventsData);
      const unsyncedEvents = localEvents.filter(event => !event.syncedToGoogle);
      
      if (unsyncedEvents.length === 0) {
        console.log('No unsynced local events to sync');
        return;
      }

      console.log(`Syncing ${unsyncedEvents.length} local events to Google Calendar...`);
      
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      
      // Check if user is signed in to Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        console.log('User not signed in to Google, skipping sync');
        return;
      }

      // Get access token
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) {
        console.log('No Google access token available');
        return;
      }

      // Sync each unsynced event
      for (const event of unsyncedEvents) {
        try {
          const startDateTime = new Date(event.startTime);
          const endDateTime = new Date(event.endTime);

          const googleEvent = {
            summary: event.title,
            description: event.description,
            location: event.location,
            start: {
              dateTime: moment(startDateTime).format('YYYY-MM-DDTHH:mm:ss'),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
              dateTime: moment(endDateTime).format('YYYY-MM-DDTHH:mm:ss'),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: 30 },
                { method: 'popup', minutes: 10 },
              ],
            },
          };

          const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(googleEvent),
            }
          );

          if (response.ok) {
            const createdEvent = await response.json();
            console.log('Event synced to Google Calendar:', createdEvent.id);
            
            // Update local event with Google Calendar ID
            const updatedEvents = localEvents.map(e => 
              e.id === event.id 
                ? { ...e, googleEventId: createdEvent.id, syncedToGoogle: true }
                : e
            );
            await AsyncStorage.setItem('localEvents', JSON.stringify(updatedEvents));
          } else {
            const errorText = await response.text();
            console.error('Failed to sync event to Google Calendar:', response.status, errorText);
          }
        } catch (error) {
          console.error('Error syncing individual event:', error);
        }
      }
      
      console.log('Finished syncing local events to Google Calendar');
      
    } catch (error) {
      console.error('Error syncing local events to Google Calendar:', error);
    }
  };

  const handleStartLockMode = (event) => {
    const now = moment();
    // Handle timezone properly
    let eventTime;
    if (event.timezone) {
      eventTime = moment(event.startTime.toDate()).tz(event.timezone);
    } else {
      eventTime = moment(event.startTime.toDate());
    }
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

  const handleDeleteEvent = (event) => {
    setEventToDelete(event);
    setShowDeleteModal(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      // Cancel all notifications for this event
      console.log('Canceling notifications for event:', eventToDelete.id);
      NotificationService.cancelEventNotifications(eventToDelete.id);
      
      if (eventToDelete.isLocal) {
        // Delete local event
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const localEventsData = await AsyncStorage.getItem('localEvents');
        if (localEventsData) {
          const events = JSON.parse(localEventsData);
          const filteredEvents = events.filter(e => e.id !== eventToDelete.id);
          await AsyncStorage.setItem('localEvents', JSON.stringify(filteredEvents));
        }

        // If it has a Google Calendar ID, delete from Google Calendar too
        if (eventToDelete.googleEventId) {
          await deleteFromGoogleCalendar(eventToDelete.googleEventId);
        }
      } else {
        // Delete Firestore event
        await firestore().collection('events').doc(eventToDelete.id).delete();
        
        // If it has a Google Calendar ID, delete from Google Calendar too
        if (eventToDelete.googleEventId) {
          await deleteFromGoogleCalendar(eventToDelete.googleEventId);
        }
      }

      // Refresh events
      await loadEvents();
      
      Alert.alert('Success', 'Event deleted successfully!');
    } catch (error) {
      console.error('Error deleting event:', error);
      Alert.alert('Error', 'Failed to delete event');
    } finally {
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  const deleteFromGoogleCalendar = async (googleEventId) => {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) return;

      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) return;

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        console.log('Event deleted from Google Calendar');
      } else {
        console.error('Failed to delete from Google Calendar:', response.status);
      }
    } catch (error) {
      console.error('Error deleting from Google Calendar:', error);
    }
  };

  const getEventStatus = (event) => {
    const now = moment();
    // Handle timezone properly
    let eventTime;
    if (event.timezone) {
      eventTime = moment(event.startTime.toDate()).tz(event.timezone);
    } else {
      eventTime = moment(event.startTime.toDate());
    }
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
    await Promise.all([
      loadEvents(),
      syncCalendarData()
    ]);
    setRefreshing(false);
  };

  const renderEventCard = (event, isToday = false) => {
    const eventStatus = getEventStatus(event);
    // Handle timezone properly - use the event's timezone if available
    let eventTime;
    try {
      if (event.timezone) {
        eventTime = moment(event.startTime.toDate()).tz(event.timezone);
      } else {
        eventTime = moment(event.startTime.toDate()).local();
      }
      console.log('🕐 Event time display:', event.title, eventTime.format('YYYY-MM-DD HH:mm'), 'Timezone:', event.timezone || 'local');
    } catch (error) {
      console.error('❌ Error parsing event time:', error, event);
      eventTime = moment(event.startTime.toDate()).local();
    }
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
              <Icon name="event" size={16} color="#fff" />
              <Text style={styles.eventTime}>
                {eventTime.format('MMM D, h:mm A')}
              </Text>
              {event.isLocal && (
                <View style={styles.localBadge}>
                  <Text style={styles.localBadgeText}>
                    {event.syncedToGoogle ? 'Synced' : 'Local'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.eventStatusContainer}>
              <Icon name={eventStatus.icon} size={16} color="#fff" />
              <Text style={styles.eventStatus}>
                {eventStatus.status === 'departure' ? 'Leave Now!' : 
                 eventStatus.status === 'upcoming' ? 'Upcoming' : 'Past'}
              </Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteEvent(event)}
              >
                <Icon name="delete" size={16} color="#fff" />
              </TouchableOpacity>
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
                Departure: {departureTime.format('MMM D, h:mm A')}
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
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.reAuthButton}
              onPress={reAuthenticateGoogle}
            >
              <Icon name="account-circle" size={20} color="#fff" />
              <Text style={styles.reAuthButtonText}>Re-Auth Google</Text>
            </TouchableOpacity>
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

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Event</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalCancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteEvent}
              >
                <Text style={[styles.modalButtonText, styles.modalDeleteButtonText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    paddingTop: 60,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  reAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  reAuthButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 12,
    fontWeight: 'bold',
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
  localBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  localBadgeText: {
    color: '#fff',
    fontSize: 10,
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
  deleteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  modalDeleteButton: {
    backgroundColor: '#ff6b6b',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCancelButtonText: {
    color: '#333',
  },
  modalDeleteButtonText: {
    color: '#fff',
  },
});

export default CalendarScreen;

