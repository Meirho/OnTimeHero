import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import moment from 'moment';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const [userStats, setUserStats] = useState({
    xp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    totalEvents: 0,
    eventsOnTime: 0,
    punctualityScore: 0,
    badges: [],
    achievements: [],
  });
  const [recentAchievements, setRecentAchievements] = useState([]);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        setUserStats({
          xp: userData.xp || 0,
          level: userData.level || 1,
          currentStreak: userData.currentStreak || 0,
          longestStreak: userData.longestStreak || 0,
          totalEvents: userData.totalEvents || 0,
          eventsOnTime: userData.eventsOnTime || 0,
          punctualityScore: userData.punctualityScore || 0,
          badges: userData.badges || [],
          achievements: userData.achievements || [],
        });

        // Load recent achievements
        const recentAchievementsData = await firestore()
          .collection('achievements')
          .where('userId', '==', currentUser.uid)
          .orderBy('earnedAt', 'desc')
          .limit(5)
          .get();

        setRecentAchievements(recentAchievementsData.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })));
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const getLevelProgress = () => {
    const currentLevelXP = (userStats.level - 1) * 100;
    const nextLevelXP = userStats.level * 100;
    const progress = ((userStats.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.min(progress, 100);
  };

  const getLevelColor = () => {
    if (userStats.level >= 20) return ['#ffd700', '#ffed4e'];
    if (userStats.level >= 15) return ['#ff6b6b', '#ff8e8e'];
    if (userStats.level >= 10) return ['#4CAF50', '#66bb6a'];
    if (userStats.level >= 5) return ['#2196F3', '#42a5f5'];
    return ['#9C27B0', '#ba68c8'];
  };

  const getPunctualityColor = () => {
    if (userStats.punctualityScore >= 90) return '#4CAF50';
    if (userStats.punctualityScore >= 70) return '#ff9800';
    return '#f44336';
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth().signOut();
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderBadge = (badge, index) => {
    const badgeColors = [
      ['#ff6b6b', '#ff8e8e'],
      ['#4CAF50', '#66bb6a'],
      ['#2196F3', '#42a5f5'],
      ['#ff9800', '#ffb74d'],
      ['#9C27B0', '#ba68c8'],
    ];

    const colors = badgeColors[index % badgeColors.length];

    return (
      <View key={badge.id} style={styles.badgeContainer}>
        <LinearGradient colors={colors} style={styles.badge}>
          <Icon name={badge.icon} size={30} color="#fff" />
        </LinearGradient>
        <Text style={styles.badgeName}>{badge.name}</Text>
        <Text style={styles.badgeDescription}>{badge.description}</Text>
      </View>
    );
  };

  const renderAchievement = (achievement) => (
    <View key={achievement.id} style={styles.achievementContainer}>
      <View style={styles.achievementIcon}>
        <Icon name={achievement.icon} size={24} color="#4CAF50" />
      </View>
      <View style={styles.achievementContent}>
        <Text style={styles.achievementTitle}>{achievement.title}</Text>
        <Text style={styles.achievementDescription}>{achievement.description}</Text>
        <Text style={styles.achievementDate}>
          Earned {moment(achievement.earnedAt.toDate()).fromNow()}
        </Text>
      </View>
      <View style={styles.achievementXP}>
        <Text style={styles.achievementXPText}>+{achievement.xpReward} XP</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <LinearGradient colors={getLevelColor()} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userStats.level}
                </Text>
              </LinearGradient>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>OnTime Hero</Text>
              <Text style={styles.userLevel}>Level {userStats.level}</Text>
              <Text style={styles.userXP}>{userStats.xp} XP</Text>
            </View>
          </View>
        </View>

        {/* Level Progress */}
        <View style={styles.levelProgressContainer}>
          <View style={styles.levelProgressHeader}>
            <Text style={styles.levelProgressTitle}>Level Progress</Text>
            <Text style={styles.levelProgressXP}>
              {userStats.xp} / {userStats.level * 100} XP
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressBarFill,
                  { width: `${getLevelProgress()}%` }
                ]}
              />
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <LinearGradient colors={['#4CAF50', '#66bb6a']} style={styles.statGradient}>
              <Icon name="local-fire-department" size={30} color="#fff" />
              <Text style={styles.statValue}>{userStats.currentStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient colors={['#2196F3', '#42a5f5']} style={styles.statGradient}>
              <Icon name="check-circle" size={30} color="#fff" />
              <Text style={styles.statValue}>{userStats.punctualityScore}%</Text>
              <Text style={styles.statLabel}>On Time</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient colors={['#ff9800', '#ffb74d']} style={styles.statGradient}>
              <Icon name="event" size={30} color="#fff" />
              <Text style={styles.statValue}>{userStats.totalEvents}</Text>
              <Text style={styles.statLabel}>Total Events</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient colors={['#9C27B0', '#ba68c8']} style={styles.statGradient}>
              <Icon name="emoji-events" size={30} color="#fff" />
              <Text style={styles.statValue}>{userStats.badges.length}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Recent Achievements */}
        {recentAchievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>🏆 Recent Achievements</Text>
            {recentAchievements.map(renderAchievement)}
          </View>
        )}

        {/* Badges */}
        {userStats.badges.length > 0 && (
          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>🎖️ Badges</Text>
            <View style={styles.badgesGrid}>
              {userStats.badges.map(renderBadge)}
            </View>
          </View>
        )}

        {/* Streak History */}
        <View style={styles.streakSection}>
          <Text style={styles.sectionTitle}>🔥 Streak History</Text>
          <View style={styles.streakStats}>
            <View style={styles.streakStat}>
              <Text style={styles.streakStatValue}>{userStats.currentStreak}</Text>
              <Text style={styles.streakStatLabel}>Current</Text>
            </View>
            <View style={styles.streakStat}>
              <Text style={styles.streakStatValue}>{userStats.longestStreak}</Text>
              <Text style={styles.streakStatLabel}>Longest</Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsSection}>
          <TouchableOpacity style={styles.settingItem}>
            <Icon name="notifications" size={24} color="#fff" />
            <Text style={styles.settingText}>Notifications</Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Icon name="calendar-today" size={24} color="#fff" />
            <Text style={styles.settingText}>Calendar Sync</Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Icon name="help" size={24} color="#fff" />
            <Text style={styles.settingText}>Help & Support</Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingItem, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Icon name="logout" size={24} color="#ff6b6b" />
            <Text style={[styles.settingText, styles.logoutText]}>Logout</Text>
            <Icon name="chevron-right" size={24} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userLevel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  userXP: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  levelProgressContainer: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 20,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelProgressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  levelProgressXP: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  progressBarContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 60) / 2,
    marginBottom: 15,
    marginHorizontal: 5,
    borderRadius: 15,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  achievementsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  achievementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  achievementDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  achievementXP: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  achievementXPText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  badgesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeContainer: {
    width: (width - 60) / 2,
    alignItems: 'center',
    marginBottom: 15,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeDescription: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  streakSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 20,
  },
  streakStat: {
    alignItems: 'center',
  },
  streakStatValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 5,
  },
  streakStatLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 15,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.5)',
    marginTop: 10,
  },
  logoutText: {
    color: '#ff6b6b',
  },
});

export default ProfileScreen;

