/**
 * Chronos - Firebase Cloud Messaging (FCM) Background Service Worker
 */

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDNDQ08A1y_s2EDp8iLn4KxRmkDGOj8aLo",
  authDomain: "chronos-reminders.firebaseapp.com",
  projectId: "chronos-reminders",
  storageBucket: "chronos-reminders.firebasestorage.app",
  messagingSenderId: "603713705774",
  appId: "1:603713705774:web:ffc844abdf97587318ccbf",
  measurementId: "G-HRT3XNHEC5"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle Background Push Notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Received background message:', payload);
  
  const notificationTitle = payload.notification ? payload.notification.title : (payload.data ? payload.data.title : 'Chronos Deadline Alert');
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : (payload.data ? payload.data.body : 'You have an upcoming task deadline!'),
    icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
