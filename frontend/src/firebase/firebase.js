  // src/firebase/firebase.js
  import { initializeApp } from "firebase/app";
  import { getAnalytics } from "firebase/analytics";
  import { getAuth } from "firebase/auth";
  import { getFirestore } from "firebase/firestore";
  import { getDatabase } from "firebase/database";
  import { getStorage } from "firebase/storage";

  const firebaseConfig = {
    apiKey: "AIzaSyAyFZmLFUjNgVUoV4-WfGKHO4jXecbkFL4",
    authDomain: "clinicmanagementsoftware-a6f78.firebaseapp.com",
    databaseURL: "https://clinicmanagementsoftware-a6f78-default-rtdb.firebaseio.com",
    projectId: "clinicmanagementsoftware-a6f78",
    storageBucket: "clinicmanagementsoftware-a6f78.firebasestorage.app",
    messagingSenderId: "528340716469",
    appId: "1:528340716469:web:5894f26e0162a0d47627fc",
    measurementId: "G-W6EZQVKJTF"
  };

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

  export const auth = getAuth(app);
  export const db = getFirestore(app);
  export const rtdb = getDatabase(app); // if using Realtime Database
  export const storage = getStorage(app);
  export default app;
