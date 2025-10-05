import { GoogleSignin } from '@react-native-google-signin/google-signin';
import moment from 'moment';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

class GoogleCalendarService {
  constructor() {
    this.configureGoogleSignIn();
  }

  configureGoogleSignIn() {
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      webClientId: 'YOUR_WEB_CLIENT_ID',
    });
  }

  async syncCalendarEvents() {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

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
          },
        }
      );

      const data = await response.json();
      
      if (data.items) {
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