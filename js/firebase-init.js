/**
 * Firebase configuration and initialization.
 * This file initializes the Firebase app once and exposes commonly
 * referenced helpers such as the database instance. The configuration
 * values must match the provided credentials exactly. Firebase modules
 * are loaded via CDN scripts in the HTML files.
 */

// Firebase project configuration. Do not modify these values.
const firebaseConfig = {
  apiKey: "AIzaSyCDo-NafGl7rxoMJU4mC6jrr43gRnak-Hs",
  authDomain: "tournament-2026.firebaseapp.com",
  databaseURL: "https://tournament-2026-default-rtdb.firebaseio.com",
  projectId: "tournament-2026",
  storageBucket: "tournament-2026.firebasestorage.app",
  messagingSenderId: "207533955325",
  appId: "1:207533955325:web:07bd9a8c52c41b9e474694"
};

// Initialize Firebase if it hasn't been initialized already.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Realtime Database reference for convenience. Use db.ref() to access paths.
const db = firebase.database();

/**
 * Listen to connection status changes. Useful for updating the UI when
 * the client goes offline or comes back online. The callback receives
 * a boolean: true when connected, false otherwise.
 *
 * @param {(connected: boolean) => void} callback
 */
function listenConnectionStatus(callback) {
  const connectedRef = firebase.database().ref(".info/connected");
  connectedRef.on("value", (snap) => {
    callback(!!snap.val());
  });
}