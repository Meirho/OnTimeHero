import { NativeModules, DeviceEventEmitter, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';

class LockService {
  constructor() {
    this.isLocked = false;
    this.lockTimer = null;
    this.currentEvent = null;
    this.appStateSubscription = null;
  }

  startLockMode(event, onUnlock) {
    this.isLocked = true;
    this.currentEvent = event;
    this.onUnlockCallback = onUnlock;

    // Store lock state
    AsyncStorage.setItem('lockMode', JSON.stringify({
      isLocked: true,
      eventId: event.id,
      startTime: new Date().toISOString(),
    }));

    // Start location tracking
    this.startLocationTracking();

    // Monitor app state
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    // Set timer for auto-unlock at event start time
    const eventTime = new Date(event.startTime.toDate());
    const now = new Date();
    const timeUntilEvent = eventTime - now;

    if (timeUntilEvent > 0) {
      this.lockTimer = setTimeout(() => {
        this.unlock('Event started');
      }, timeUntilEvent);
    }

    // Block app switching (platform specific implementation needed)
    this.blockAppSwitching();
  }

  handleAppStateChange = (nextAppState) => {
    if (this.isLocked && nextAppState === 'background') {
      // Force app to foreground (platform specific)
      // This requires native module implementation
      this.forceToForeground();
    }
  };

  startLocationTracking() {
    // Track location to detect arrival
    this.locationWatchId = Geolocation.watchPosition(
      (position) => {
        this.checkArrival(position);
      },
      (error) => {
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 2000,
      }
    );
  }

  checkArrival(position) {
    if (!this.currentEvent?.location) return;

    // In production, use Google Maps API to get actual coordinates
    // For demo, use simple distance check
    const eventLocation = this.getEventCoordinates(this.currentEvent.location);
    
    if (eventLocation) {
      const distance = this.calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        eventLocation.lat,
        eventLocation.lng
      );

      // If within 50 meters of event location
      if (distance < 50) {
        this.unlock('Arrived at location');
      }
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  getEventCoordinates(location) {
    // Mock coordinates - in production, use Geocoding API
    const mockLocations = {
      'Conference Room B': { lat: 37.7749, lng: -122.4194 },
      'Office': { lat: 37.7751, lng: -122.4196 },
      // Add more locations
    };

    return mockLocations[location] || null;
  }

  blockAppSwitching() {
    // Platform specific implementation
    // On Android: Use accessibility service or device admin
    // On iOS: Use guided access mode or screen time API
    
    // For demo purposes, we'll use a simple approach
    // that shows a persistent notification
    this.showLockNotification();
  }

  showLockNotification() {
    // Show persistent notification that returns to app when tapped
    // Implementation depends on notification service
  }

  forceToForeground() {
    // Native module implementation needed
    // This is platform specific and requires special permissions
  }

  unlock(reason) {
    this.isLocked = false;
    
    // Clear lock state
    AsyncStorage.removeItem('lockMode');
    
    // Stop location tracking
    if (this.locationWatchId) {
      Geolocation.clearWatch(this.locationWatchId);
    }

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    // Clear timers
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
    }

    // Call unlock callback
    if (this.onUnlockCallback) {
      this.onUnlockCallback(reason);
    }

    // Update event status
    if (this.currentEvent) {
      this.updateEventCompletion(reason === 'Arrived at location');
    }
  }

  async updateEventCompletion(arrivedOnTime) {
    // Update event in Firestore
    // Implementation in GoogleCalendarService
  }

  emergencyUnlock(pin) {
    // Verify emergency PIN
    const correctPin = '1234'; // In production, store securely
    
    if (pin === correctPin) {
      this.unlock('Emergency unlock');
      return true;
    }
    return false;
  }
}

export default new LockService();