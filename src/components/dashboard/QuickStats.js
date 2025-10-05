import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

const StatCard = ({ icon, value, label, colors }) => (
  <LinearGradient colors={colors} style={styles.statCard}>
    <Icon name={icon} size={24} color="#fff" />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </LinearGradient>
);

const QuickStats = ({ points, badges, punctualityRate }) => {
  return (
    <View style={styles.container}>
      <StatCard
        icon="star"
        value={points}
        label="Points"
        colors={['#667eea', '#764ba2']}
      />
      <StatCard
        icon="emoji-events"
        value={badges}
        label="Badges"
        colors={['#f093fb', '#f5576c']}
      />
      <StatCard
        icon="schedule"
        value={`${punctualityRate}%`}
        label="On Time"
        colors={['#4facfe', '#00f2fe']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
});

export default QuickStats;
