// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC-tIvz9HFQlUhnirJZpmAB4O95IKYe3w0",
  authDomain: "mj-patent.firebaseapp.com",
  projectId: "mj-patent",
  storageBucket: "mj-patent.appspot.com",
  messagingSenderId: "266084211127",
  appId: "1:266084211127:web:8a87ca33147f759202b032",
  measurementId: "G-5EFWJ9C6YE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
const db = getFirestore(app);

export {db};