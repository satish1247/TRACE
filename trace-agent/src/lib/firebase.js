import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAC_YSGog9VIOMe1fXB0y-dHkVfoEuzE_A",
  authDomain: "trace-180.firebaseapp.com",
  projectId: "trace-180",
  storageBucket: "trace-180.firebasestorage.app",
  messagingSenderId: "713326451610",
  appId: "1:713326451610:web:e038eceb8661e6b11ef823",
  measurementId: "G-RPYH0GXMKZ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
