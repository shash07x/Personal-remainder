/**
 * Chronos - Firebase Cloud Messaging (FCM) Integration Module
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNDQ08A1y_s2EDp8iLn4KxRmkDGOj8aLo",
  authDomain: "chronos-reminders.firebaseapp.com",
  projectId: "chronos-reminders",
  storageBucket: "chronos-reminders.firebasestorage.app",
  messagingSenderId: "603713705774",
  appId: "1:603713705774:web:ffc844abdf97587318ccbf",
  measurementId: "G-HRT3XNHEC5"
};

let app = null;
let messaging = null;
let fcmToken = null;

export function initFirebaseMessaging(onMessageCallback) {
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);

    // Register FCM Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('[FCM] Service Worker registered with scope:', registration.scope);
        })
        .catch((err) => {
          console.warn('[FCM] SW registration failed:', err);
        });
    }

    // Listen for foreground push messages
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground push message received:', payload);
      if (onMessageCallback) {
        onMessageCallback(payload);
      }
    });

    console.log('[FCM] Firebase Messaging initialized successfully!');
  } catch (err) {
    console.error('[FCM] Initialization error:', err);
  }
}

export async function requestFcmToken() {
  if (!messaging) {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        serviceWorkerRegistration: await navigator.serviceWorker.ready
      });

      if (token) {
        fcmToken = token;
        console.log('[FCM Token Generated]:', token);
        localStorage.setItem('chronos_fcm_token', token);
        return token;
      } else {
        console.warn('[FCM] No registration token available.');
      }
    }
  } catch (err) {
    console.error('[FCM Token Error]:', err);
  }
  return null;
}
