import { GoogleSignin } from '@react-native-google-signin/google-signin';
import moment from 'moment';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

class GoogleCalendarService {
  constructor() {
    this.configureGoogleSignIn();
  }

  configureGoogleSignIn() {
    try {
      GoogleSignin.configure({
        // Request Calendar read access and profile/email for Firebase linking
        scopes: ['https://www.googleapis.com/auth/calendar', 'email', 'profile'],
        // Web Client ID is required for Google Sign-In to work properly
        webClientId: '574885181091-rutnfbrqmiu01gjlp7gsfvo3mc2n8ecs.apps.googleusercontent.com',
        offlineAccess: true,
        forceCodeForRefreshToken: true,
      });
      console.log('Google Sign-In configured successfully with Web Client ID');
    } catch (error) {
      console.error('Error configuring Google Sign-In:', error);
    }
  }

  async ensureSignedIn() {
    try {
      // Check if Google Play Services are available
      const hasPlayServices = await GoogleSignin.hasPlayServices({ 
        showPlayServicesUpdateDialog: true 
      });
      if (!hasPlayServices) {
        throw new Error('Google Play Services not available');
      }

      // Try to get current user first
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        return currentUser;
      }

      // Try silent sign-in
      const userInfo = await GoogleSignin.signInSilently();
      return userInfo;
    } catch (error) {
      console.log('Silent sign-in failed, prompting user:', error.message);
      
      try {
        // No cached session → ask user to pick account
        const userInfo = await GoogleSignin.signIn();
        return userInfo;
      } catch (signInError) {
        console.error('Google Sign-In failed:', signInError);
        throw new Error(`Google Sign-In failed: ${signInError.message}`);
      }
    }
  }

  async syncCalendarEvents() {
    try {
      console.log('Starting calendar sync...');
      
      // First, try to sync any pending data
      await this.syncPendingData();
      
      // Ensure the user is signed in with Calendar scope
      const userInfo = await this.ensureSignedIn();
      if (!userInfo) {
        throw new Error('User not signed in');
      }

      console.log('User signed in successfully:', userInfo.user?.email);
      console.log('Getting tokens...');
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      console.log('Access token obtained, fetching calendar events...');
      // Fetch events from Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${moment().toISOString()}&` +
        `timeMax=${moment().add(30, 'days').toISOString()}&` +
        `singleEvents=true&` +
        `orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Calendar API error:', response.status, errorData);
        throw new Error(`Calendar API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      console.log('Calendar API response received:', data);
      
      if (data.items && data.items.length > 0) {
        console.log(`Found ${data.items.length} events, saving to Firestore...`);
        await this.saveEventsToFirestore(data.items);
        console.log('Events saved to Firestore successfully');
      } else {
        console.log('No events found in the next 30 days');
      }

      return data.items || [];
    } catch (error) {
      console.error('Error syncing calendar:', error);
      throw error;
    }
  }

  async saveEventsToFirestore(googleEvents) {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      console.log('No current user, skipping Firestore save');
      return;
    }

    try {
      console.log(`Saving ${googleEvents.length} events to Firestore...`);
      
      // Check Firestore availability first
      await firestore().enableNetwork();
      console.log('Firestore network enabled');
      
      const batch = firestore().batch();
      const eventsRef = firestore().collection('events');
      let eventsToSave = 0;

      for (const googleEvent of googleEvents) {
        // Skip all-day events or events without dateTime
        if (!googleEvent.start?.dateTime) {
          console.log('Skipping all-day event:', googleEvent.summary);
          continue;
        }

        // Parse the event time properly with timezone handling
        const startDateTime = new Date(googleEvent.start.dateTime);
        const endDateTime = new Date(googleEvent.end.dateTime);
        
        console.log('Processing event:', googleEvent.summary);
        console.log('Start dateTime from Google:', googleEvent.start.dateTime);
        console.log('Start dateTime parsed:', startDateTime);
        console.log('Start timezone:', googleEvent.start.timeZone);
        
        const eventData = {
          userId: currentUser.uid,
          googleEventId: googleEvent.id,
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description || '',
          startTime: firestore.Timestamp.fromDate(startDateTime),
          endTime: firestore.Timestamp.fromDate(endDateTime),
          location: googleEvent.location || '',
          travelTime: this.estimateTravelTime(googleEvent.location),
          status: 'upcoming',
          createdAt: firestore.Timestamp.now(),
          lastSynced: firestore.Timestamp.now(),
          timezone: googleEvent.start.timeZone || 'UTC',
        };

        // Check if event already exists
        const existingEvent = await eventsRef
          .where('googleEventId', '==', googleEvent.id)
          .where('userId', '==', currentUser.uid)
          .get();

        if (existingEvent.empty) {
          // Create new event
          const newEventRef = eventsRef.doc();
          batch.set(newEventRef, eventData);
          eventsToSave++;
        } else {
          // Update existing event
          batch.update(existingEvent.docs[0].ref, eventData);
          eventsToSave++;
        }
      }

      if (eventsToSave > 0) {
        await batch.commit();
        console.log(`Successfully saved ${eventsToSave} events to Firestore`);
      } else {
        console.log('No new events to save');
      }
    } catch (error) {
      console.error('Error saving events to Firestore:', error);
      
      // If Firestore is unavailable, try to save events locally for later sync
      if (error.code === 'unavailable') {
        console.log('Firestore unavailable, storing events locally for later sync');
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const localEvents = JSON.stringify(googleEvents);
          await AsyncStorage.setItem('pendingEvents', localEvents);
          console.log('Events stored locally for later sync');
        } catch (localError) {
          console.error('Error storing events locally:', localError);
        }
      }
      // Don't throw error here to prevent sync failure
    }
  }

  estimateTravelTime(location) {
    // Simple estimation based on location
    // In production, integrate with Google Maps API for accurate travel time
    if (!location) return 15; // Default 15 minutes
    
    if (location.toLowerCase().includes('room') || 
        location.toLowerCase().includes('office')) {
      return 5; // Same building
    } else if (location.toLowerCase().includes('building')) {
      return 10; // Different building
    } else {
      return 20; // External location
    }
  }

  async updateEventStatus(eventId, status, checkInTime = null) {
    try {
      const updateData = {
        status: status,
        wasOnTime: status === 'completed',
      };

      if (checkInTime) {
        updateData.checkInTime = firestore.Timestamp.fromDate(checkInTime);
      }

      await firestore()
        .collection('events')
        .doc(eventId)
        .update(updateData);

      // Update user stats if event completed
      if (status === 'completed') {
        await this.updateUserStats(status === 'completed');
      }
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  }

  async updateUserStats(wasOnTime) {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const userRef = firestore().collection('users').doc(currentUser.uid);
    
    await firestore().runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data();

      const updates = {
        totalEvents: (userData.totalEvents || 0) + 1,
        eventsOnTime: wasOnTime ? 
          (userData.eventsOnTime || 0) + 1 : 
          userData.eventsOnTime || 0,
      };

      // Calculate new punctuality score
      updates.punctualityScore = Math.round(
        (updates.eventsOnTime / updates.totalEvents) * 100
      );

      // Update streak
      if (wasOnTime) {
        updates.currentStreak = (userData.currentStreak || 0) + 1;
        updates.longestStreak = Math.max(
          updates.currentStreak,
          userData.longestStreak || 0
        );
      } else {
        updates.currentStreak = 0;
      }

      transaction.update(userRef, updates);
    });
  }

  async syncPendingData() {
    try {
      console.log('Checking for pending data to sync...');
      
      // Check if Firestore is available
      await firestore().enableNetwork();
      
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Sync pending events
      const pendingEvents = await AsyncStorage.getItem('pendingEvents');
      if (pendingEvents) {
        console.log('Found pending events, syncing to Firestore...');
        const events = JSON.parse(pendingEvents);
        await this.saveEventsToFirestore(events);
        await AsyncStorage.removeItem('pendingEvents');
        console.log('Pending events synced successfully');
      }
      
      // Sync pending profile data
      const pendingProfile = await AsyncStorage.getItem('userProfile');
      if (pendingProfile) {
        console.log('Found pending profile data, syncing to Firestore...');
        const profileData = JSON.parse(pendingProfile);
        const currentUser = auth().currentUser;
        if (currentUser) {
          const userRef = firestore().collection('users').doc(currentUser.uid);
          await userRef.set(profileData, { merge: true });
          await AsyncStorage.removeItem('userProfile');
          console.log('Pending profile data synced successfully');
        }
      }
      
    } catch (error) {
      console.error('Error syncing pending data:', error);
    }
  }
}

export default new GoogleCalendarService();