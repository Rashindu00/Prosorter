const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
require('dotenv').config();

console.log('🔧 Testing ProSorter Login System...\n');

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAldgwM_vcZxSO-Lo12tCJKOautogDUjuM",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "prosorter-c2a36.firebaseapp.com",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://prosorter-c2a36-default-rtdb.firebaseio.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "prosorter-c2a36",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "prosorter-c2a36.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "282462760135",
    appId: process.env.FIREBASE_APP_ID || "1:282462760135:web:87cc4592c37286d15c62e2"
};

async function testLogin() {
    try {
        console.log('📡 Connecting to Firebase...');
        const firebaseApp = initializeApp(firebaseConfig);
        const database = getDatabase(firebaseApp);
        
        console.log('✅ Firebase connected successfully');
        
        console.log('👥 Checking users in database...');
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
            const users = usersSnapshot.val();
            const userList = Object.keys(users);
            
            console.log('✅ Users found in database:');
            userList.forEach(username => {
                const user = users[username];
                console.log(`   - ${username} (${user.role || 'user'})`);
            });
            
            console.log('\n🔐 Login Credentials:');
            console.log('┌─────────────┬──────────────┬─────────────────┐');
            console.log('│ Username    │ Password     │ Role            │');
            console.log('├─────────────┼──────────────┼─────────────────┤');
            console.log('│ admin       │ admin123     │ Administrator   │');
            console.log('│ operator    │ operator123  │ Operator        │');
            console.log('│ user        │ user123      │ Standard User   │');
            console.log('└─────────────┴──────────────┴─────────────────┘');
            
        } else {
            console.log('❌ No users found in database');
            console.log('💡 Run: node scripts/createUsers.js to create default users');
        }
        
        console.log('\n🌐 Next Steps:');
        console.log('1. Start server: npm start');
        console.log('2. Open browser: http://localhost:3000');
        console.log('3. Login with: admin / admin123');
        
    } catch (error) {
        console.error('❌ Error testing login system:', error);
        
        if (error.code === 'auth/invalid-api-key') {
            console.log('💡 Firebase API key issue. Check .env file');
        } else if (error.code === 'NETWORK_ERROR') {
            console.log('💡 Network connectivity issue. Check internet connection');
        } else {
            console.log('💡 Unknown error. Check Firebase configuration');
        }
    }
    
    process.exit(0);
}

testLogin();
