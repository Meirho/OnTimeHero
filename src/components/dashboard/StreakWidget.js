import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

const StreakWidget = ({ streak, xpEarned }) => {
  return (
    <LinearGradient
      colors={['#FFD700', '#FFA500']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.streakInfo}>
          <Icon name="local-fire-department" size={32} color="#fff" />
          <View style={styles.streakText}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
        </View>
        <View style={styles.xpInfo}>
          <Text style={styles.xpText}>+{xpEarned} XP</Text>
          <Text style={styles.xpLabel}>Today</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 15,
    marginVertical: 10,
    padding: 20,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    marginLeft: 10,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  streakLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  xpInfo: {
    alignItems: 'flex-end',
  },
  xpText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  xpLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
});

export default StreakWidget;
