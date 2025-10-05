declare module './services/NotificationService' {
  class NotificationService {
    static initialize(): NotificationService;
    configure(): void;
    createChannels(): void;
    showNotification(remoteMessage: any): void;
    scheduleTimeToLeaveNotification(event: any): void;
    cancelNotification(notificationId: string): void;
    showAchievementNotification(badge: any): void;
    showStreakNotification(streakCount: number): void;
  }
  export default NotificationService;
}
