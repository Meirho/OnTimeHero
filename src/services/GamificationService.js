import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

class GamificationService {
  constructor() {
    this.achievements = [
      {
        id: 'first_event',
        title: 'First Steps',
        description: 'Complete your first event on time',
        icon: 'emoji-events',
        xpReward: 50,
        badgeReward: 'rookie',
        condition: { type: 'events_on_time', count: 1 },
      },
      {
        id: 'streak_3',
        title: 'Getting Started',
        description: 'Maintain a 3-day streak',
        icon: 'local-fire-department',
        xpReward: 100,
        badgeReward: 'consistent',
        condition: { type: 'streak', count: 3 },
      },
      {
        id: 'streak_7',
        title: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        icon: 'local-fire-department',
        xpReward: 250,
        badgeReward: 'dedicated',
        condition: { type: 'streak', count: 7 },
      },
      {
        id: 'streak_30',
        title: 'Month Master',
        description: 'Maintain a 30-day streak',
        icon: 'local-fire-department',
        xpReward: 1000,
        badgeReward: 'legendary',
        condition: { type: 'streak', count: 30 },
      },
      {
        id: 'perfect_week',
        title: 'Perfect Week',
        description: 'Be on time for all events in a week',
        icon: 'check-circle',
        xpReward: 200,
        badgeReward: 'perfectionist',
        condition: { type: 'perfect_week', count: 1 },
      },
      {
        id: 'early_bird',
        title: 'Early Bird',
        description: 'Arrive 10 minutes early to 5 events',
        icon: 'schedule',
        xpReward: 150,
        badgeReward: 'punctual',
        condition: { type: 'early_arrivals', count: 5 },
      },
      {
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Complete 10 evening events on time',
        icon: 'nightlight-round',
        xpReward: 200,
        badgeReward: 'nocturnal',
        condition: { type: 'evening_events', count: 10 },
      },
      {
        id: 'social_butterfly',
        title: 'Social Butterfly',
        description: 'Attend 20 social events on time',
        icon: 'people',
        xpReward: 300,
        badgeReward: 'social',
        condition: { type: 'social_events', count: 20 },
      },
      {
        id: 'level_10',
        title: 'Rising Star',
        description: 'Reach level 10',
        icon: 'star',
        xpReward: 500,
        badgeReward: 'rising_star',
        condition: { type: 'level', count: 10 },
      },
      {
        id: 'level_20',
        title: 'OnTime Legend',
        description: 'Reach level 20',
        icon: 'military-tech',
        xpReward: 1000,
        badgeReward: 'legend',
        condition: { type: 'level', count: 20 },
      },
    ];

    this.badges = {
      rookie: { name: 'Rookie', description: 'Just getting started', icon: 'emoji-events', color: '#9C27B0' },
      consistent: { name: 'Consistent', description: 'Building good habits', icon: 'trending-up', color: '#2196F3' },
      dedicated: { name: 'Dedicated', description: 'Week-long commitment', icon: 'fitness-center', color: '#4CAF50' },
      legendary: { name: 'Legendary', description: 'Month-long mastery', icon: 'auto-awesome', color: '#ffd700' },
      perfectionist: { name: 'Perfectionist', description: 'Perfect week achieved', icon: 'check-circle', color: '#ff6b6b' },
      punctual: { name: 'Punctual', description: 'Always early', icon: 'schedule', color: '#ff9800' },
      nocturnal: { name: 'Nocturnal', description: 'Night event specialist', icon: 'nightlight-round', color: '#673AB7' },
      social: { name: 'Social', description: 'Social event champion', icon: 'people', color: '#E91E63' },
      rising_star: { name: 'Rising Star', description: 'Level 10 achiever', icon: 'star', color: '#00BCD4' },
      legend: { name: 'Legend', description: 'Level 20 master', icon: 'military-tech', color: '#FF5722' },
    };
  }

  async checkAchievements(userStats) {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();

      const userData = userDoc.data();
      const earnedAchievements = userData.achievements || [];

      for (const achievement of this.achievements) {
        // Skip if already earned
        if (earnedAchievements.includes(achievement.id)) continue;

        // Check if condition is met
        if (await this.checkAchievementCondition(achievement, userStats, userData)) {
          await this.awardAchievement(achievement, userStats);
        }
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }

  async checkAchievementCondition(achievement, userStats, userData) {
    switch (achievement.condition.type) {
      case 'events_on_time':
        return userStats.eventsOnTime >= achievement.condition.count;
      
      case 'streak':
        return userStats.currentStreak >= achievement.condition.count;
      
      case 'perfect_week':
        return await this.checkPerfectWeek(userData);
      
      case 'early_arrivals':
        return await this.checkEarlyArrivals(achievement.condition.count);
      
      case 'evening_events':
        return await this.checkEveningEvents(achievement.condition.count);
      
      case 'social_events':
        return await this.checkSocialEvents(achievement.condition.count);
      
      case 'level':
        return userStats.level >= achievement.condition.count;
      
      default:
        return false;
    }
  }

  async checkPerfectWeek(userData) {
    // Check if user was on time for all events in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const eventsSnapshot = await firestore()
      .collection('events')
      .where('userId', '==', userData.uid)
      .where('startTime', '>=', firestore.Timestamp.fromDate(sevenDaysAgo))
      .where('status', '==', 'completed')
      .get();

    const events = eventsSnapshot.docs.map(doc => doc.data());
    return events.length > 0 && events.every(event => event.wasOnTime);
  }

  async checkEarlyArrivals(count) {
    const currentUser = auth().currentUser;
    const eventsSnapshot = await firestore()
      .collection('events')
      .where('userId', '==', currentUser.uid)
      .where('status', '==', 'completed')
      .where('wasEarly', '==', true)
      .get();

    return eventsSnapshot.size >= count;
  }

  async checkEveningEvents(count) {
    const currentUser = auth().currentUser;
    const eveningStart = new Date();
    eveningStart.setHours(18, 0, 0, 0);

    const eventsSnapshot = await firestore()
      .collection('events')
      .where('userId', '==', currentUser.uid)
      .where('startTime', '>=', firestore.Timestamp.fromDate(eveningStart))
      .where('status', '==', 'completed')
      .where('wasOnTime', '==', true)
      .get();

    return eventsSnapshot.size >= count;
  }

  async checkSocialEvents(count) {
    const currentUser = auth().currentUser;
    const socialKeywords = ['meeting', 'party', 'gathering', 'social', 'team', 'group'];

    const eventsSnapshot = await firestore()
      .collection('events')
      .where('userId', '==', currentUser.uid)
      .where('status', '==', 'completed')
      .where('wasOnTime', '==', true)
      .get();

    let socialEventCount = 0;
    eventsSnapshot.docs.forEach(doc => {
      const event = doc.data();
      const title = event.title.toLowerCase();
      const description = (event.description || '').toLowerCase();
      
      if (socialKeywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword)
      )) {
        socialEventCount++;
      }
    });

    return socialEventCount >= count;
  }

  async awardAchievement(achievement, userStats) {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      // Add achievement to user's achievements
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          achievements: firestore.FieldValue.arrayUnion(achievement.id),
          xp: firestore.FieldValue.increment(achievement.xpReward),
        });

      // Add badge if specified
      if (achievement.badgeReward) {
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .update({
            badges: firestore.FieldValue.arrayUnion(achievement.badgeReward),
          });
      }

      // Create achievement record
      await firestore()
        .collection('achievements')
        .add({
          userId: currentUser.uid,
          achievementId: achievement.id,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          xpReward: achievement.xpReward,
          badgeReward: achievement.badgeReward,
          earnedAt: firestore.Timestamp.now(),
        });

      // Check for level up
      await this.checkLevelUp(userStats.xp + achievement.xpReward);

      // Store achievement notification
      await AsyncStorage.setItem(
        'latestAchievement',
        JSON.stringify({
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          xpReward: achievement.xpReward,
          timestamp: Date.now(),
        })
      );

      return true;
    } catch (error) {
      console.error('Error awarding achievement:', error);
      return false;
    }
  }

  async checkLevelUp(newXP) {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const newLevel = Math.floor(newXP / 100) + 1;
    
    const userDoc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    const currentLevel = userDoc.data().level || 1;

    if (newLevel > currentLevel) {
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({ level: newLevel });

      // Store level up notification
      await AsyncStorage.setItem(
        'levelUp',
        JSON.stringify({
          newLevel,
          timestamp: Date.now(),
        })
      );

      return newLevel;
    }

    return null;
  }

  async addXP(amount, reason = '') {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .update({
          xp: firestore.FieldValue.increment(amount),
        });

      // Log XP gain
      await firestore()
        .collection('xp_logs')
        .add({
          userId: currentUser.uid,
          amount,
          reason,
          timestamp: firestore.Timestamp.now(),
        });

      return true;
    } catch (error) {
      console.error('Error adding XP:', error);
      return false;
    }
  }

  async getLeaderboard(limit = 10) {
    try {
      const usersSnapshot = await firestore()
        .collection('users')
        .orderBy('xp', 'desc')
        .limit(limit)
        .get();

      return usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  async getRecentActivity(userId, limit = 10) {
    try {
      const activitySnapshot = await firestore()
        .collection('achievements')
        .where('userId', '==', userId)
        .orderBy('earnedAt', 'desc')
        .limit(limit)
        .get();

      return activitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  async getBadgeInfo(badgeId) {
    return this.badges[badgeId] || null;
  }

  async getAllBadges() {
    return this.badges;
  }

  async getAchievementInfo(achievementId) {
    return this.achievements.find(a => a.id === achievementId) || null;
  }

  async getAllAchievements() {
    return this.achievements;
  }
}

export default new GamificationService();

