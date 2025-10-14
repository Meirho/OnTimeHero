// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDo0VLL27mwlpRh4EFXP3e6KZd1g8Xf2VI",
  authDomain: "ontimehero-new.firebaseapp.com",
  projectId: "ontimehero-new",
  storageBucket: "ontimehero-new.firebasestorage.app",
  messagingSenderId: "574885181091",
  appId: "1:574885181091:android:418390775e2ba4382ff116",
  measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export default app;
