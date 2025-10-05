import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';

const NextEventCard = ({ event, onLeaveNow }) => {
  const [timeToLeave, setTimeToLeave] = useState('');
  const [isTimeToGo, setIsTimeToGo] = useState(false);

  useEffect(() => {
    const updateTimer = setInterval(() => {
      const eventTime = moment(event.startTime.toDate());
      const leaveTime = eventTime.subtract(event.travelTime || 15, 'minutes');
      const now = moment();
      
      const diff = leaveTime.diff(now, 'minutes');
      
      if (diff <= 0) {
        setIsTimeToGo(true);
        setTimeToLeave('Leave now!');
      } else if (diff < 60) {
        setTimeToLeave(`Leave in ${diff} minutes`);
        if (diff <= 5) setIsTimeToGo(true);
      } else {
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        setTimeToLeave(`Leave in ${hours}h ${mins}m`);
      }
    }, 1000);

    return () => clearInterval(updateTimer);
  }, [event]);

  return (
    <LinearGradient
      colors={isTimeToGo ? ['#ff6b6b', '#ff8e53'] : ['#667eea', '#764ba2']}
      style={[styles.container, isTimeToGo && styles.urgentContainer]}
    >
      {isTimeToGo && (
        <View style={styles.urgentBadge}>
          <Icon name="warning" size={20} color="#fff" />
          <Text style={styles.urgentText}>TIME TO GO!</Text>
        </View>
      )}

      <Text style={styles.eventTime}>
        {moment(event.startTime.toDate()).format('h:mm A')}
      </Text>
      <Text style={styles.eventName}>{event.title}</Text>
      
      {event.location && (
        <View style={styles.locationContainer}>
          <Icon name="place" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.eventLocation}>{event.location}</Text>
        </View>
      )}

      <View style={styles.leaveTimeContainer}>
        <Icon name="directions-walk" size={20} color="#fff" />
        <Text style={styles.leaveTime}>{timeToLeave}</Text>
      </View>

      {isTimeToGo && (
        <TouchableOpacity style={styles.leaveButton} onPress={onLeaveNow}>
          <Text style={styles.leaveButtonText}>I'm Leaving Now! 🏃</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  urgentContainer: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 10,
  },
  urgentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  eventTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  eventName: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  eventLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 5,
  },
  leaveTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 10,
  },
  leaveTime: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  leaveButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default NextEventCard;