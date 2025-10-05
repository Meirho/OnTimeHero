const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Function to check and award badges
exports.checkAchievements = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    // Check streak achievements
    if (after.currentStreak > before.currentStreak) {
      await checkStreakBadges(userId, after.currentStreak);
    }

    // Check punctuality achievements
    if (after.punctualityScore > before.punctualityScore) {
      await checkPunctualityBadges(userId, after.punctualityScore);
    }

    // Check total events achievements
    if (after.totalEvents > before.totalEvents) {
      await checkEventBadges(userId, after.totalEvents);
    }
  });

async function checkEventBadges(userId, totalEvents) {
  const badges = [
    { events: 1, badgeId: 'event_1', name: 'First Mission', xp: 25 },
    { events: 10, badgeId: 'event_10', name: 'Seasoned Hero', xp: 150 },
    { events: 50, badgeId: 'event_50', name: 'OnTime Legend', xp: 500 },
  ];

  for (const badge of badges) {
    if (totalEvents >= badge.events) {
      await awardBadge(userId, badge);
    }
  }
}

async function checkStreakBadges(userId, streak) {
  const badges = [
    { streak: 3, badgeId: 'streak_3', name: '3 Day Streak', xp: 50 },
    { streak: 7, badgeId: 'streak_7', name: 'Week Warrior', xp: 100 },
    { streak: 14, badgeId: 'streak_14', name: 'Fortnight Fighter', xp: 200 },
    { streak: 30, badgeId: 'streak_30', name: 'Monthly Master', xp: 500 },
  ];

  for (const badge of badges) {
    if (streak >= badge.streak) {
      await awardBadge(userId, badge);
    }
  }
}

async function checkPunctualityBadges(userId, score) {
  const badges = [
    { score: 80, badgeId: 'punctual_80', name: 'Reliable', xp: 100 },
    { score: 90, badgeId: 'punctual_90', name: 'Time Champion', xp: 200 },
    { score: 95, badgeId: 'punctual_95', name: 'Chronometer', xp: 300 },
    { score: 100, badgeId: 'punctual_100', name: 'Perfect Timer', xp: 500 },
  ];

  for (const badge of badges) {
    if (score >= badge.score) {
      await awardBadge(userId, badge);
    }
  }
}

async function awardBadge(userId, badge) {
  // Check if badge already awarded
  const existing = await db.collection('achievements')
    .where('userId', '==', userId)
    .where('badgeId', '==', badge.badgeId)
    .get();

  if (existing.empty) {
    // Award badge
    await db.collection('achievements').add({
      userId,
      badgeId: badge.badgeId,
      name: badge.name,
      unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
      xpEarned: badge.xp,
    });

    // Update user XP
    await db.collection('users').doc(userId).update({
      xp: admin.firestore.FieldValue.increment(badge.xp),
      totalXP: admin.firestore.FieldValue.increment(badge.xp),
      badgeCount: admin.firestore.FieldValue.increment(1),
    });

    // Send achievement notification
    await sendAchievementNotification(userId, badge);
  }
}

async function sendAchievementNotification(userId, badge) {
  const userDoc = await db.collection('users').doc(userId).get();
  const fcmToken = userDoc.data()?.fcmToken;

  if (fcmToken) {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '🏆 Achievement Unlocked!',
        body: `You earned the "${badge.name}" badge! +${badge.xp} XP`,
      },
      data: {
        type: 'achievement',
        badgeId: badge.badgeId,
      },
    });
  }
}

// Scheduled function to send reminders
exports.sendEventReminders = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const in30Minutes = new admin.firestore.Timestamp(
      now.seconds + 1800,
      now.nanoseconds
    );

    // Find events starting in the next 30 minutes
    const eventsSnapshot = await db.collection('events')
      .where('startTime', '>', now)
      .where('startTime', '<', in30Minutes)
      .where('reminderSent', '==', false)
      .get();

    const batch = db.batch();
    const notifications = [];

    eventsSnapshot.forEach(doc => {
      const event = doc.data();
      
      // Mark reminder as sent
      batch.update(doc.ref, { reminderSent: true });

      // Prepare notification
      notifications.push(sendEventReminder(event));
    });

    await batch.commit();
    await Promise.all(notifications);
  });

async function sendEventReminder(event) {
  const userDoc = await db.collection('users').doc(event.userId).get();
  const fcmToken = userDoc.data()?.fcmToken;

  if (fcmToken) {
    const travelTime = event.travelTime || 15;
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '⏰ Time to Leave Soon!',
        body: `Leave in ${travelTime} minutes for ${event.title}`,
      },
      data: {
        type: 'time-to-leave',
        eventId: event.id,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'alarm',
          priority: 'max',
          vibrateTimingsMillis: [0, 500, 200, 500],
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'alarm.caf',
            badge: 1,
          },
        },
      },
    });
  }
}
