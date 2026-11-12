// Firebase web config for the Shipmas leaderboards.
// These values are meant to be public; who can read/write is controlled by firestore.rules.
// If apiKey is empty, leaderboards switch off and games still work.
export const firebaseConfig = {
  apiKey: 'AIzaSyDvvm5VPSzlE7sbc_adZ9sPb8ouG0pXIww',
  authDomain: 'shipmas.firebaseapp.com',
  projectId: 'shipmas',
  appId: '1:851305769437:web:f5f9a89abfe427fadfee34',
  // Realtime Database: live positions for multiplayer rooms (rules in database.rules.json)
  databaseURL: 'https://shipmas-default-rtdb.europe-west1.firebasedatabase.app',
};
