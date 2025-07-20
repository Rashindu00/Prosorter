require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, update } = require('firebase/database');

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

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

async function createUsers() {
    try {
        console.log('🔧 Creating initial users...');

        // Hash passwords
        const adminPassword = await bcrypt.hash('admin123', 12);
        const userPassword = await bcrypt.hash('user123', 12);
        const operatorPassword = await bcrypt.hash('operator123', 12);

        // Define users
        const users = {
            'admin': {
                password: adminPassword,
                role: 'admin',
                email: 'admin@prosorter.com',
                fullName: 'System Administrator',
                createdAt: new Date().toISOString(),
                permissions: {
                    canReset: true,
                    canEnroll: true,
                    canViewStats: true,
                    canManageUsers: true
                }
            },
            'operator': {
                password: operatorPassword,
                role: 'operator',
                email: 'operator@prosorter.com',
                fullName: 'System Operator',
                createdAt: new Date().toISOString(),
                permissions: {
                    canReset: false,
                    canEnroll: true,
                    canViewStats: true,
                    canManageUsers: false
                }
            },
            'user': {
                password: userPassword,
                role: 'user',
                email: 'user@prosorter.com',
                fullName: 'Standard User',
                createdAt: new Date().toISOString(),
                permissions: {
                    canReset: false,
                    canEnroll: false,
                    canViewStats: false,
                    canManageUsers: false
                }
            }
        };

        // Save users to Firebase
        await update(ref(database, 'users'), users);

        console.log('✅ Users created successfully!');
        console.log('\n📋 Login Credentials:');
        console.log('┌─────────────┬──────────────┬─────────────────┐');
        console.log('│ Username    │ Password     │ Role            │');
        console.log('├─────────────┼──────────────┼─────────────────┤');
        console.log('│ admin       │ admin123     │ Administrator   │');
        console.log('│ operator    │ operator123  │ Operator        │');
        console.log('│ user        │ user123      │ Standard User   │');
        console.log('└─────────────┴──────────────┴─────────────────┘');
        console.log('\n🔒 Security Note: Please change these default passwords in production!');

        // Initialize system settings
        const systemSettings = {
            initialized: true,
            version: '2.0.0',
            setupDate: new Date().toISOString(),
            features: {
                autoBackup: true,
                realTimeUpdates: true,
                activityLogging: true,
                fingerprinting: true
            },
            limits: {
                maxCoinCapacity: 1000,
                maxDailyTransactions: 100,
                sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
            }
        };

        await update(ref(database, 'systemSettings'), systemSettings);
        console.log('⚙️ System settings initialized successfully!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating users:', error);
        process.exit(1);
    }
}

// Run the seeder
createUsers();
