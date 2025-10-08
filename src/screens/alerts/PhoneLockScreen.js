import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Vibration,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
// import BackgroundTimer from 'react-native-background-timer';
import LockService from '../../services/LockService';
import HapticFeedback from 'react-native-haptic-feedback';

const PhoneLockScreen = ({ route, navigation }) => {
  const { event } = route.params;
  const [countdown, setCountdown] = useState('');
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyPin, setEmergencyPin] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Start lock service
    LockService.startLockMode(event, handleUnlock);
    
    // Vibrate to indicate lock mode
    Vibration.vibrate([500, 200, 500]);
    
    // Start countdown timer
    startCountdown();

    return () => {
      clearInterval(countdownInterval);
    };
  }, []);

  const startCountdown = () => {
    countdownInterval = setInterval(() => {
      const eventTime = new Date(event.startTime.toDate());
      const now = new Date();
      const diff = eventTime - now;

      if (diff <= 0) {
        setCountdown('00:00');
        clearInterval(countdownInterval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
  };

  const handleUnlock = (reason) => {
    HapticFeedback.trigger('notificationSuccess');
    
    // Navigate based on unlock reason
    if (reason === 'Arrived at location') {
      // Show success and award points
      Alert.alert(
        '🎉 Great Job!',
        'You arrived on time! +50 XP earned!',
        [
          {
            text: 'Awesome!',
            onPress: () => navigation.replace('Dashboard'),
          },
        ]
      );
    } else {
      navigation.replace('Dashboard');
    }
  };

  const handleArrived = () => {
    HapticFeedback.trigger('impactLight');
    LockService.unlock('Manual arrival confirmation');
  };

  const handleEmergencyUnlock = () => {
    if (emergencyPin.length !== 4) {
      Alert.alert('Error', 'Please enter a 4-digit PIN');
      return;
    }

    if (LockService.emergencyUnlock(emergencyPin)) {
      setShowEmergencyModal(false);
      // Penalty for emergency unlock
      Alert.alert(
        'Phone Unlocked',
        'Emergency unlock used. -10 XP penalty.',
        [{ text: 'OK', onPress: () => navigation.replace('Dashboard') }]
      );
    } else {
      setAttempts(attempts + 1);
      if (attempts >= 2) {
        Alert.alert('Too Many Attempts', 'Please wait for the event to start.');
        setShowEmergencyModal(false);
      } else {
        Alert.alert('Incorrect PIN', `${2 - attempts} attempts remaining`);
      }
      setEmergencyPin('');
    }
  };

  return (
    <LinearGradient
      colors={['#232526', '#414345']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.lockIconContainer}>
          <Icon name="lock" size={100} color="#fff" />
        </View>

        <Text style={styles.title}>Phone Locked!</Text>
        <Text style={styles.subtitle}>
          No distractions allowed!{'\n'}
          Your phone will unlock when you arrive{'\n'}
          or when your event starts.
        </Text>

        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Event starts in</Text>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>

        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{event.title}</Text>
          {event.location && (
            <Text style={styles.eventLocation}>📍 {event.location}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.arrivedButton}
          onPress={handleArrived}
        >
          <Text style={styles.arrivedButtonText}>I've Arrived ✓</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => setShowEmergencyModal(true)}
        >
          <Text style={styles.emergencyButtonText}>Emergency Unlock</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showEmergencyModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Emergency Unlock</Text>
            <Text style={styles.modalText}>
              Enter your 4-digit PIN to unlock.{'\n'}
              This will result in a -10 XP penalty.
            </Text>
            
            <TextInput
              style={styles.pinInput}
              value={emergencyPin}
              onChangeText={setEmergencyPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              placeholder="Enter PIN"
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowEmergencyModal(false);
                  setEmergencyPin('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.unlockButton]}
                onPress={handleEmergencyUnlock}
              >
                <Text style={styles.unlockButtonText}>Unlock</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  lockIconContainer: {
    marginBottom: 30,
    opacity: 0.9,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  countdownContainer: {
    marginBottom: 30,
  },
  countdownLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 5,
  },
  countdown: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'monospace',
  },
  eventInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 30,
    alignItems: 'center',
  },
  eventName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  eventLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  arrivedButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginBottom: 15,
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emergencyButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  emergencyButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonText: {
    color: '#666',
    fontSize: 16,
  },
  unlockButton: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PhoneLockScreen;