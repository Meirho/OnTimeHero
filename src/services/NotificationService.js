import PushNotification from 'react-native-push-notification';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

class NotificationService {
  constructor() {
    this.configure();
    this.createChannels();
  }

  static initialize() {
    return new NotificationService();
  }

  configure() {
    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },

      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          NotificationService.handleNotificationTap(notification);
        }
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: true,
    });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Message handled in the background!', remoteMessage);
      this.showNotification(remoteMessage);
    });

    // Handle foreground messages
    messaging().onMessage(async remoteMessage => {
      console.log('Message handled in the foreground!', remoteMessage);
      this.showNotification(remoteMessage);
    });
  }

  createChannels() {
    PushNotification.createChannel(
      {
        channelId: 'time-to-leave',
        channelName: 'Time to Leave',
        channelDescription: 'Notifications when it\'s time to leave for events',
        playSound: true,
        soundName: 'default',
        importance: 5,
        vibrate: true,
      },
      (created) => console.log(`createChannel 'time-to-leave' returned '${created}'`)
    );

    PushNotification.createChannel(
      {
        channelId: 'reminders',
        channelName: 'Event Reminders',
        channelDescription: 'Upcoming event reminders',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`createChannel 'reminders' returned '${created}'`)
    );

    PushNotification.createChannel(
      {
        channelId: 'achievements',
        channelName: 'Achievements',
        channelDescription: 'Badge and streak notifications',
        playSound: true,
        soundName: 'default',
        importance: 3,
        vibrate: false,
      },
      (created) => console.log(`createChannel 'achievements' returned '${created}'`)
    );
  }

  showNotification(remoteMessage) {
    const { title, body, data } = remoteMessage.notification || remoteMessage.data;
    
    PushNotification.localNotification({
      channelId: data?.channelId || 'reminders',
      title: title,
      message: body,
      playSound: true,
      soundName: 'default',
      vibrate: true,
      data: data,
      largeIcon: 'ic_launcher',
      smallIcon: 'ic_notification',
      bigText: body,
      color: '#667eea',
    });
  }

  scheduleTimeToLeaveNotification(event) {
    const eventTime = moment(event.startTime.toDate());
    const travelTime = event.travelTime || 15;
    const notifyTime = eventTime.subtract(travelTime, 'minutes').toDate();

    PushNotification.localNotificationSchedule({
      channelId: 'time-to-leave',
      title: '⏰ Time to Leave!',
      message: `Leave now for ${event.title} at ${event.location}`,
      date: notifyTime,
      allowWhileIdle: true,
      repeatType: null,
      playSound: true,
      soundName: 'alarm.mp3',
      vibrate: true,
      vibration: 1000,
      data: {
        eventId: event.id,
        type: 'time-to-leave',
      },
      actions: ['Leave Now', 'Snooze 5 min'],
    });

    // Schedule a reminder 30 minutes before
    const reminderTime = eventTime.subtract(30, 'minutes').toDate();
    PushNotification.localNotificationSchedule({
      channelId: 'reminders',
      title: 'Upcoming Event',
      message: `${event.title} starts in 30 minutes`,
      date: reminderTime,
      allowWhileIdle: true,
      data: {
        eventId: event.id,
        type: 'reminder',
      },
    });
  }

  cancelNotification(notificationId) {
    PushNotification.cancelLocalNotification(notificationId);
  }

  static handleNotificationTap(notification) {
    const { type, eventId } = notification.data;
    
    switch (type) {
      case 'time-to-leave':
        // Navigate to lock screen
        NavigationService.navigate('PhoneLock', { eventId });
        break;
      case 'reminder':
        // Navigate to event details
        NavigationService.navigate('EventDetails', { eventId });
        break;
      case 'achievement':
        // Navigate to rewards
        NavigationService.navigate('Rewards');
        break;
      default:
        break;
    }
  }

  showAchievementNotification(badge) {
    PushNotification.localNotification({
      channelId: 'achievements',
      title: '🏆 Achievement Unlocked!',
      message: `You earned the "${badge.name}" badge!`,
      playSound: true,
      soundName: 'achievement.mp3',
      data: {
        type: 'achievement',
        badgeId: badge.id,
      },
    });
  }

  showStreakNotification(streakCount) {
    const messages = [
      `You're on a ${streakCount}-day streak! Keep it up! 🔥`,
      `Amazing! ${streakCount} days in a row! 🎉`,
      `Your ${streakCount}-day streak is impressive! 💪`,
      `Don't break the chain! ${streakCount} days strong! ⛓️`,
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    PushNotification.localNotification({
      channelId: 'achievements',
      title: '🔥 Streak Update!',
      message: randomMessage,
      playSound: true,
      vibrate: true,
      data: {
        type: 'streak',
        streakCount,
      },
    });
  }

  showLevelUpNotification(newLevel) {
    PushNotification.localNotification({
      channelId: 'achievements',
      title: '⭐ Level Up!',
      message: `Congratulations! You've reached level ${newLevel}!`,
      playSound: true,
      vibrate: true,
      data: {
        type: 'level_up',
        newLevel,
      },
    });
  }

  showArrivalNotification(event, wasOnTime) {
    const title = wasOnTime ? '🎉 Great Job!' : '⚠️ Running Late';
    const message = wasOnTime 
      ? `You arrived on time for "${event.title}"! +50 XP`
      : `You're running late for "${event.title}". Try to leave earlier next time.`;

    PushNotification.localNotification({
      channelId: 'achievements',
      title,
      message,
      playSound: true,
      vibrate: true,
      data: {
        type: 'arrival',
        eventId: event.id,
        wasOnTime,
      },
    });
  }

  showMotivationalMessage() {
    const messages = [
      "You've got this! Time to be your most punctual self! 💪",
      "Every journey starts with leaving on time! 🚀",
      "Punctuality is the politeness of kings! 👑",
      "Success is where preparation meets opportunity! ✨",
      "The early bird catches the worm! 🐦",
      "Be the hero of your own time story! 🦸‍♀️",
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    PushNotification.localNotification({
      channelId: 'reminders',
      title: '💡 Daily Motivation',
      message: randomMessage,
      playSound: false,
      vibrate: false,
      data: {
        type: 'motivation',
      },
    });
  }

  scheduleDailyMotivation() {
    // Schedule daily motivation at 8 AM
    const tomorrow = moment().add(1, 'day').hour(8).minute(0).second(0).toDate();

    PushNotification.localNotificationSchedule({
      id: 'daily_motivation',
      channelId: 'reminders',
      title: '💡 Daily Motivation',
      message: 'Start your day with punctuality!',
      date: tomorrow,
      playSound: false,
      vibrate: false,
      repeatType: 'day',
      data: {
        type: 'daily_motivation',
      },
    });
  }

  scheduleWeeklyReport() {
    // Schedule weekly report on Sundays at 9 AM
    const nextSunday = moment().day(7).hour(9).minute(0).second(0).toDate();

    PushNotification.localNotificationSchedule({
      id: 'weekly_report',
      channelId: 'achievements',
      title: '📊 Weekly Report',
      message: 'Check out your punctuality stats for this week!',
      date: nextSunday,
      playSound: true,
      soundName: 'default',
      repeatType: 'week',
      data: {
        type: 'weekly_report',
      },
    });
  }

  cancelEventNotifications(eventId) {
    const notifications = this.getScheduledNotifications();
    notifications.then(scheduledNotifications => {
      scheduledNotifications.forEach(notification => {
        if (notification.userInfo?.eventId === eventId) {
          this.cancelNotification(notification.id);
        }
      });
    });
  }

  getScheduledNotifications() {
    return new Promise((resolve) => {
      PushNotification.getScheduledLocalNotifications((notifications) => {
        resolve(notifications);
      });
    });
  }
}

export default new NotificationService();