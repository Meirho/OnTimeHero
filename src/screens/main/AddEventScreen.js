import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../../services/NotificationService';
import GoogleMapsService from '../../services/GoogleMapsService';
// import DatePicker from 'react-native-date-picker'; // Temporarily disabled due to linking issues

const AddEventScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
  const [time, setTime] = useState(moment().format('HH:mm'));
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [locationPredictions, setLocationPredictions] = useState([]);
  const [showLocationPredictions, setShowLocationPredictions] = useState(false);
  const [calculatedTravelTime, setCalculatedTravelTime] = useState(null);

  const handleSaveEvent = async () => {
    if (!title || !date || !time) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      // Parse time in various formats (HH:mm, h:mm A, h:mm a, etc.)
      let parsedTime;
      try {
        // Try different time formats
        const timeFormats = ['HH:mm', 'h:mm A', 'h:mm a', 'HH:mm:ss', 'h:mm:ss A', 'h:mm:ss a'];
        parsedTime = moment(time, timeFormats, true);
        
        if (!parsedTime.isValid()) {
          // If none of the formats work, try parsing as-is
          parsedTime = moment(time);
        }
        
        if (!parsedTime.isValid()) {
          Alert.alert('Invalid Time', 'Please enter time in format like "2:30 PM" or "14:30"');
          setLoading(false);
          return;
        }
      } catch (error) {
        Alert.alert('Invalid Time', 'Please enter time in format like "2:30 PM" or "14:30"');
        setLoading(false);
        return;
      }
      
      // Create event datetime in local timezone
      const eventDateTime = moment(`${date} ${parsedTime.format('HH:mm')}`, 'YYYY-MM-DD HH:mm').toDate();
      
      // Use calculated travel time or default to 15 minutes
      const travelTime = calculatedTravelTime || 15;
      
      // Always save locally first for immediate feedback
      const localEventData = {
        id: Date.now().toString(), // Simple ID for local events
        userId: currentUser.uid,
        title,
        description,
        location,
        startTime: eventDateTime.toISOString(),
        endTime: moment(eventDateTime).add(1, 'hour').toISOString(),
        travelTime: travelTime,
        status: 'upcoming',
        createdAt: new Date().toISOString(),
        isLocal: true,
      };
      
      // Save to local storage
      const existingEvents = await AsyncStorage.getItem('localEvents');
      const events = existingEvents ? JSON.parse(existingEvents) : [];
      events.push(localEventData);
      await AsyncStorage.setItem('localEvents', JSON.stringify(events));
      
      // Schedule notifications for the event
      await NotificationService.scheduleEventNotifications(localEventData);
      console.log('✅ Notifications scheduled for event');
      
      // Show success immediately
      Alert.alert('Success', 'Event created successfully!', [
        { 
          text: 'OK', 
          onPress: () => {
            // Navigate back and trigger refresh
            navigation.goBack();
            // Force refresh of calendar/dashboard by navigating to them briefly
            setTimeout(() => {
              navigation.navigate('Calendar');
              setTimeout(() => navigation.navigate('MainTabs'), 100);
            }, 100);
          }
        }
      ]);
      
      // Try to sync to Firestore in background (don't wait for it)
      syncToFirestore(localEventData).catch(err => {
        console.log('Background sync failed, will retry later:', err);
      });
      
      // Also try to create in Google Calendar immediately
      createGoogleCalendarEvent(localEventData).catch(err => {
        console.log('Google Calendar sync failed:', err);
      });
      
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to save event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const syncToFirestore = async (eventData) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const firestoreEventData = {
        userId: currentUser.uid,
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        startTime: firestore.Timestamp.fromDate(new Date(eventData.startTime)),
        endTime: firestore.Timestamp.fromDate(new Date(eventData.endTime)),
        travelTime: eventData.travelTime,
        status: eventData.status,
        createdAt: firestore.Timestamp.now(),
        lastSynced: firestore.Timestamp.now(),
      };

      await firestore().collection('events').add(firestoreEventData);
      console.log('Event synced to Firestore successfully');
      
      // Also try to create in Google Calendar (don't wait for it)
      createGoogleCalendarEvent(eventData).catch(err => {
        console.log('Google Calendar sync failed, will retry later:', err);
      });
      
      // Remove from local storage after successful sync
      const existingEvents = await AsyncStorage.getItem('localEvents');
      if (existingEvents) {
        const events = JSON.parse(existingEvents);
        const filteredEvents = events.filter(e => e.id !== eventData.id);
        await AsyncStorage.setItem('localEvents', JSON.stringify(filteredEvents));
      }
      
    } catch (error) {
      console.log('Firestore sync failed:', error);
      // Keep in local storage for retry later
    }
  };

  const createGoogleCalendarEvent = async (eventData) => {
    try {
      console.log('Starting Google Calendar event creation...');
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      
      // Check if user is signed in to Google
      let isSignedIn = await GoogleSignin.isSignedIn();
      console.log('Google Sign-In status:', isSignedIn);
      
      if (!isSignedIn) {
        console.log('User not signed in to Google, attempting to sign in...');
        try {
          await GoogleSignin.hasPlayServices();
          const { idToken } = await GoogleSignin.signIn();
          const googleCredential = auth.GoogleAuthProvider.credential(idToken);
          await auth().signInWithCredential(googleCredential);
          isSignedIn = true;
          console.log('Successfully signed in to Google');
        } catch (signInError) {
          console.log('Failed to sign in to Google:', signInError);
          return;
        }
      }

      // Get access token
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;
      console.log('Google access token available:', !!accessToken);

      if (!accessToken) {
        console.log('No Google access token available');
        return;
      }

      // Create event in Google Calendar
      const startDateTime = new Date(eventData.startTime);
      const endDateTime = new Date(eventData.endTime);

      const googleEvent = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use device timezone
        },
        end: {
          dateTime: endDateTime.toISOString(),
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

      console.log('Sending request to Google Calendar API...');
      console.log('Event data:', JSON.stringify(googleEvent, null, 2));
      
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

      console.log('Google Calendar API response status:', response.status);
      
      if (response.ok) {
        const createdEvent = await response.json();
        console.log('✅ Event created in Google Calendar:', createdEvent.id);
        console.log('✅ Event summary:', createdEvent.summary);
        
        // Update local event with Google Calendar ID
        const existingEvents = await AsyncStorage.getItem('localEvents');
        if (existingEvents) {
          const events = JSON.parse(existingEvents);
          const updatedEvents = events.map(e => 
            e.id === eventData.id 
              ? { ...e, googleEventId: createdEvent.id, syncedToGoogle: true }
              : e
          );
          await AsyncStorage.setItem('localEvents', JSON.stringify(updatedEvents));
          console.log('✅ Local event updated with Google Calendar ID');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create Google Calendar event:', response.status, errorText);
      }

    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
    }
  };

  const handleDatePress = () => {
    setSelectedDate(moment(date, 'YYYY-MM-DD').toDate());
    setShowDatePicker(true);
  };

  const handleTimePress = () => {
    setSelectedTime(moment(time, 'HH:mm').toDate());
    setShowTimePicker(true);
  };

  const handleLocationChange = async (text) => {
    setLocation(text);
    
    if (text.length > 2) {
      // Get autocomplete predictions
      const predictions = await GoogleMapsService.getPlacePredictions(text);
      setLocationPredictions(predictions);
      setShowLocationPredictions(predictions.length > 0);
    } else {
      setLocationPredictions([]);
      setShowLocationPredictions(false);
    }
  };

  const handleSelectLocation = async (prediction) => {
    setLocation(prediction.description);
    setShowLocationPredictions(false);
    
    // Calculate travel time from home to this location
    const eventDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm').toDate();
    const travelInfo = await GoogleMapsService.calculateTravelTimeFromHome(
      prediction.description,
      eventDateTime
    );
    
    if (travelInfo && !travelInfo.error) {
      setCalculatedTravelTime(travelInfo.duration);
      Alert.alert(
        'Travel Time Calculated',
        `Estimated travel time: ${travelInfo.duration} minutes (${travelInfo.distance} km)\n\nThis will be used for your notifications.`,
        [{ text: 'OK' }]
      );
    } else {
      setCalculatedTravelTime(15); // Default fallback
    }
  };

  // Date and time confirmation functions are now handled inline in the modal components

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Event</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title"
              placeholderTextColor="rgba(255,255,255,0.6)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter event description"
              placeholderTextColor="rgba(255,255,255,0.6)"
              multiline
              numberOfLines={3}
            />
          </View>

               <View style={styles.inputGroup}>
                 <Text style={styles.label}>Location</Text>
                 <TextInput
                   style={styles.input}
                   value={location}
                   onChangeText={handleLocationChange}
                   placeholder="Enter event location"
                   placeholderTextColor="rgba(255,255,255,0.6)"
                 />
                 {showLocationPredictions && locationPredictions.length > 0 && (
                   <View style={styles.predictionsContainer}>
                     {locationPredictions.map((prediction, index) => (
                       <TouchableOpacity
                         key={prediction.placeId}
                         style={styles.predictionItem}
                         onPress={() => handleSelectLocation(prediction)}
                       >
                         <Icon name="location-on" size={20} color="rgba(255,255,255,0.8)" />
                         <View style={styles.predictionTextContainer}>
                           <Text style={styles.predictionMainText}>
                             {prediction.mainText}
                           </Text>
                           <Text style={styles.predictionSecondaryText}>
                             {prediction.secondaryText}
                           </Text>
                         </View>
                       </TouchableOpacity>
                     ))}
                   </View>
                 )}
                 {calculatedTravelTime && (
                   <View style={styles.travelTimeInfo}>
                     <Icon name="directions-car" size={16} color="rgba(255,255,255,0.8)" />
                     <Text style={styles.travelTimeText}>
                       Estimated travel time: {calculatedTravelTime} min
                     </Text>
                   </View>
                 )}
               </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity style={[styles.input, styles.clickableInput]} onPress={handleDatePress}>
                <Text style={styles.inputText}>{date || moment().format('YYYY-MM-DD')}</Text>
                <Icon name="calendar-today" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

                 <View style={[styles.inputGroup, styles.halfWidth]}>
                   <Text style={styles.label}>Time *</Text>
                   <View style={styles.timeInputContainer}>
                     <TextInput
                       style={[styles.input, styles.timeInput]}
                       value={time}
                       onChangeText={setTime}
                       placeholder="2:30 PM or 14:30"
                       placeholderTextColor="rgba(255,255,255,0.6)"
                       keyboardType="default"
                     />
                     <TouchableOpacity style={styles.timePickerButton} onPress={handleTimePress}>
                       <Icon name="access-time" size={20} color="rgba(255,255,255,0.6)" />
                     </TouchableOpacity>
                   </View>
                   <Text style={styles.timeFormatHint}>
                     Type time like "2:30 PM" or "14:30", or tap clock to pick
                   </Text>
                 </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabledButton]}
            onPress={handleSaveEvent}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4facfe', '#00f2fe']}
              style={styles.buttonGradient}
            >
              <Icon name="save" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : 'Save Event'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Custom Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <View style={styles.dateOptions}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(days => {
                const optionDate = moment().add(days, 'days');
                const isSelected = moment(date, 'YYYY-MM-DD').format('YYYY-MM-DD') === optionDate.format('YYYY-MM-DD');
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.dateOption, isSelected && styles.selectedDateOption]}
                    onPress={() => {
                      setDate(optionDate.format('YYYY-MM-DD'));
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.dateOptionText, isSelected && styles.selectedDateOptionText]}>
                      {optionDate.format('MMM D')}
                    </Text>
                    <Text style={[styles.dateOptionSubText, isSelected && styles.selectedDateOptionText]}>
                      {optionDate.format('dddd')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <View style={styles.timeOptions}>
              {Array.from({ length: 24 }, (_, hour) => {
                const timeString = `${hour.toString().padStart(2, '0')}:00`;
                const isSelected = time === timeString;
                return (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.timeOption, isSelected && styles.selectedTimeOption]}
                    onPress={() => {
                      setTime(timeString);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={[styles.timeOptionText, isSelected && styles.selectedTimeOptionText]}>
                      {moment(timeString, 'HH:mm').format('h:mm A')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  inputText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  clickableInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
    marginRight: 10,
  },
  timePickerButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeFormatHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    fontStyle: 'italic',
  },
  predictionsContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    marginTop: 10,
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  predictionTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  predictionMainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  predictionSecondaryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  travelTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  travelTimeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  saveButton: {
    marginTop: 30,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
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
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateOption: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    width: '48%',
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedDateOption: {
    backgroundColor: '#667eea',
  },
  dateOptionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedDateOptionText: {
    color: '#fff',
  },
  dateOptionSubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    maxHeight: 300,
  },
  timeOption: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    width: '23%',
    marginBottom: 8,
    alignItems: 'center',
  },
  selectedTimeOption: {
    backgroundColor: '#667eea',
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedTimeOptionText: {
    color: '#fff',
  },
  modalCloseButton: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddEventScreen;
