// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAV_L0BOnBtzSo4qmOr1R3tavEtn02ELnQ",
  authDomain: "ontimehero-419c0.firebaseapp.com",
  projectId: "ontimehero-419c0",
  storageBucket: "ontimehero-419c0.firebasestorage.app",
  messagingSenderId: "103336096230",
  appId: "1:103336096230:web:df986129980bad75c02627",
  measurementId: "G-KNVPSCKDSC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export default app;
