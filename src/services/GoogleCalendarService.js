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
        scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'email', 'profile'],
        webClientId: '103336096230-8lm4urgu3a703cb0cj3lsdfj3uo6b36r.apps.googleusercontent.com',
        offlineAccess: true,
        forceCodeForRefreshToken: true,
        // Mobile app configuration - NO client secret needed
        hostedDomain: '',
        loginHint: '',
        accountName: '',
        // Disable auto sign-in to avoid NativeEventEmitter issues
        autoSignIn: false,
        // Explicitly disable client secret usage for mobile apps
        clientSecret: undefined,
      });
      console.log('Google Sign-In configured successfully for mobile app');
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
      
      // Ensure the user is signed in with Calendar scope
      const userInfo = await this.ensureSignedIn();
      if (!userInfo) {
        throw new Error('User not signed in');
      }

      console.log('User signed in, getting tokens...');
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      console.log('Fetching calendar events...');
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
      console.log('Calendar API response:', data);
      
      if (data.items) {
        console.log(`Found ${data.items.length} events, saving to Firestore...`);
        await this.saveEventsToFirestore(data.items);
      }

      return data.items || [];
    } catch (error) {
      console.error('Error syncing calendar:', error);
      throw error;
    }
  }

  async saveEventsToFirestore(googleEvents) {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const batch = firestore().batch();
    const eventsRef = firestore().collection('events');

    for (const googleEvent of googleEvents) {
      // Skip all-day events or events without dateTime
      if (!googleEvent.start?.dateTime) continue;

      const eventData = {
        userId: currentUser.uid,
        googleEventId: googleEvent.id,
        title: googleEvent.summary || 'Untitled Event',
        description: googleEvent.description || '',
        startTime: firestore.Timestamp.fromDate(
          new Date(googleEvent.start.dateTime)
        ),
        endTime: firestore.Timestamp.fromDate(
          new Date(googleEvent.end.dateTime)
        ),
        location: googleEvent.location || '',
        travelTime: this.estimateTravelTime(googleEvent.location),
        status: 'upcoming',
        createdAt: firestore.Timestamp.now(),
        lastSynced: firestore.Timestamp.now(),
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
      } else {
        // Update existing event
        batch.update(existingEvent.docs[0].ref, eventData);
      }
    }

    await batch.commit();
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
}

export default new GoogleCalendarService();