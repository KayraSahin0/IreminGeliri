// Bu dosya .gitignore sayesinde GitHub'a yüklenmeyecek!
const firebaseConfig = {
    apiKey: "AIzaSyBIHq9X13107mzlwHMCn3si4CYsFwiAKmo",
    authDomain: "iremingeliri.firebaseapp.com",
    projectId: "iremingeliri",
    storageBucket: "iremingeliri.firebasestorage.app",
    messagingSenderId: "246926287218",
    appId: "1:246926287218:web:f634168bbdddfc1fac3deb",
    measurementId: "G-JCZ4KQ0EKH"
};

// Firebase'i başlat ve Firestore'u ayarla
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();