/**
 * RemindPulse - Firebase & FCM Integration Module
 * Handles Firebase initialisation, Firestore sync, and Median.co FCM Push Notifications
 */

// Global Firebase configuration storage key
const FIREBASE_CONFIG_STORAGE_KEY = 'remindpulse_firebase_config';

export function getStoredFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Failed to parse saved Firebase config', e);
    return null;
  }
}

export function saveFirebaseConfig(config) {
  try {
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save Firebase config', e);
    return false;
  }
}

/**
 * Firebase Cloud Function Node.js Backend Code
 * Users can copy this code directly into their Firebase Cloud Functions project!
 */
export const FIREBASE_CLOUD_FUNCTION_SNIPPET = `
// index.js - Firebase Cloud Functions (Node.js) for FCM Deadline Reminders
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Scheduled Cron Function (runs every 1 minute)
 * Checks Firestore for ToDos reaching deadline and sends FCM Push Notifications
 */
exports.checkDeadlineReminders = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const now = new Date();
  const nextMinute = new Date(now.getTime() + 60 * 1000);

  // Query ToDos with deadline in the next 1 minute that have not been notified yet
  const snapshot = await admin.firestore().collection('todos')
    .where('completed', '==', false)
    .where('notified', '==', false)
    .where('deadlineIso', '<=', nextMinute.toISOString())
    .get();

  if (snapshot.empty) {
    console.log('No pending deadline reminders for this minute.');
    return null;
  }

  const batch = admin.firestore().batch();

  for (const doc of snapshot.docs) {
    const todo = doc.data();
    const fcmToken = todo.fcmToken;

    if (fcmToken) {
      const payload = {
        notification: {
          title: '⏰ Deadline Reminder: ' + todo.title,
          body: todo.notes || ('Your ToDo deadline is now! Category: ' + todo.category),
          sound: 'default',
          badge: '1'
        },
        data: {
          todoId: doc.id,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        token: fcmToken
      };

      try {
        await admin.messaging().send(payload);
        console.log('Successfully sent FCM notification for ToDo:', todo.title);
      } catch (err) {
        console.error('FCM Send Error:', err);
      }
    }

    // Mark as notified in Firestore
    batch.update(doc.ref, { notified: true });
  }

  await batch.commit();
  return null;
});
`;

/**
 * Median JS Bridge FCM Helper
 * Listens for FCM tokens registered by the Median native wrapper app.
 */
export function initMedianFcmListener(onTokenReceived) {
  // Check if running inside Median / GoNative
  const isMedian = window.gonative || window.median || navigator.userAgent.includes('gonative') || navigator.userAgent.includes('median');
  
  if (window.gonative_fcm_token) {
    onTokenReceived(window.gonative_fcm_token);
  } else if (window.median_fcm_token) {
    onTokenReceived(window.median_fcm_token);
  }

  // Median JS Bridge Event Listeners
  window.gonative_fcm_token_ready = function(token) {
    console.log('[Median Bridge] Received FCM Device Token:', token);
    window.gonative_fcm_token = token;
    onTokenReceived(token);
  };

  window.median_fcm_token_ready = function(token) {
    console.log('[Median Bridge] Received FCM Device Token:', token);
    window.median_fcm_token = token;
    onTokenReceived(token);
  };

  return isMedian;
}
