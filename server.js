require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const morgan = require('morgan');
const winston = require('winston');
const cron = require('node-cron');
const moment = require('moment');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Firebase imports
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, child, update, push, remove, query, orderByChild, limitToLast } = require('firebase/database');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'prosorter-web' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ],
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Strict rate limiting for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true
});

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const port = process.env.PORT || 3002;

// Firebase configuration using environment variables
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

// Advanced Services
const notificationService = require('./services/notificationService');
const reportService = require('./services/reportService');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');

// Initialize i18next for internationalization
i18next
    .use(Backend)
    .init({
        lng: 'en', // default language
        fallbackLng: 'en',
        debug: false,
        backend: {
            loadPath: path.join(__dirname, 'locales', '{{lng}}', 'translation.json')
        },
        interpolation: {
            escapeValue: false
        }
    });

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.redirect('/');
    }
};

// Helper function to log activities
const logActivity = async (username, action, details = {}) => {
    try {
        const activityData = {
            username,
            action,
            details,
            timestamp: moment().format(),
            ip: details.ip || 'unknown'
        };
        await push(ref(database, 'activities'), activityData);
        logger.info(`Activity logged: ${username} - ${action}`, activityData);
    } catch (error) {
        logger.error('Error logging activity:', error);
    }
};

// Helper function to get current coin data
const getCurrentCoinData = async () => {
    try {
        const [coin1, coin2, coin5, coin10, totalAmount] = await Promise.all([
            get(ref(database, 'Coins/Coin1')),
            get(ref(database, 'Coins/Coin2')),
            get(ref(database, 'Coins/Coin5')),
            get(ref(database, 'Coins/Coin10')),
            get(ref(database, 'Coins/Amount'))
        ]);

        return {
            coin1: coin1.val() || 0,
            coin2: coin2.val() || 0,
            coin5: coin5.val() || 0,
            coin10: coin10.val() || 0,
            totalAmount: totalAmount.val() || 0
        };
    } catch (error) {
        logger.error('Error fetching coin data:', error);
        throw error;
    }
};

// Routes

// Home route - Login page
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// Login route with validation and rate limiting
app.post('/login', 
    loginLimiter,
    async (req, res) => {
        try {
            console.log('🔐 Login attempt:', req.body);
            const { username, password } = req.body;
            
            if (!username || !password) {
                console.log('❌ Missing username or password');
                return res.render('login', { error: 'Please enter both username and password' });
            }
            
            console.log('📡 Checking user in database:', username);
            const userRef = ref(database, `users/${username}`);
            
            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();
            
            console.log('👤 User data found:', !!userData);
            
            if (userData && await bcrypt.compare(password, userData.password)) {
                console.log('✅ Login successful for:', username);
                req.session.user = {
                    username: username,
                    role: userData.role || 'user',
                    loginTime: new Date()
                };
                
                await logActivity(username, 'login', { ip: req.ip });
                
                console.log('🚀 Redirecting to dashboard');
                return res.redirect('/dashboard');
            } else {
                console.log('❌ Invalid credentials for:', username);
                await logActivity(username || 'unknown', 'failed_login', { ip: req.ip });
                return res.render('login', { error: 'Invalid username or password' });
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            logger.error('Login error:', error);
            return res.render('login', { error: 'Login failed. Please try again.' });
        }
    }
);

// Dashboard route
app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const coinData = await getCurrentCoinData();
        
        // Get recent activities (simplified query to avoid indexing requirement)
        const activitiesRef = ref(database, 'activities');
        const activitiesSnapshot = await get(activitiesRef);
        const activities = [];
        
        if (activitiesSnapshot.exists()) {
            const allActivities = [];
            activitiesSnapshot.forEach((child) => {
                allActivities.push({ id: child.key, ...child.val() });
            });
            
            // Sort by timestamp and get last 10
            allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            activities.push(...allActivities.slice(0, 10));
        }

        // Get daily statistics
        const today = moment().format('YYYY-MM-DD');
        const dailyStatsRef = ref(database, `dailyStats/${today}`);
        const dailyStatsSnapshot = await get(dailyStatsRef);
        const dailyStats = dailyStatsSnapshot.val() || {
            totalTransactions: 0,
            totalAmount: 0,
            coinCounts: { coin1: 0, coin2: 0, coin5: 0, coin10: 0 }
        };

        res.render('dashboard', {
            user: req.session.user,
            total1: coinData.coin1,
            total2: coinData.coin2 * 2,
            total5: coinData.coin5 * 5,
            total10: coinData.coin10 * 10,
            total: coinData.totalAmount,
            activities: activities,
            dailyStats: dailyStats,
            currentDate: moment().format('MMMM Do YYYY')
        });
    } catch (error) {
        logger.error('Dashboard error:', error);
        res.render('dashboard', {
            user: req.session.user,
            total1: 'Error',
            total2: 'Error',
            total5: 'Error',
            total10: 'Error',
            total: 'Error',
            activities: [],
            dailyStats: {},
            currentDate: moment().format('MMMM Do YYYY'),
            error: 'Failed to load dashboard data'
        });
    }
});

// Original routes maintained for compatibility
app.post('/updateCoins', isAuthenticated, async (req, res) => {
    try {
        const coinData = await getCurrentCoinData();
        
        const newOneCount = parseInt(req.body.oneCount, 10) || 0;
        const newTwoCount = parseInt(req.body.twoCount, 10) || 0;
        const newFiveCount = parseInt(req.body.fiveCount, 10) || 0;
        const newTenCount = parseInt(req.body.tenCount, 10) || 0;

        const updatedOneCount = Math.max(coinData.coin1 - newOneCount, 0);
        const updatedTwoCount = Math.max(coinData.coin2 - newTwoCount, 0);
        const updatedFiveCount = Math.max(coinData.coin5 - newFiveCount, 0);
        const updatedTenCount = Math.max(coinData.coin10 - newTenCount, 0);

        const withdrawnAmount = (newOneCount * 1) + (newTwoCount * 2) + (newFiveCount * 5) + (newTenCount * 10);
        const newTotal = Math.max(coinData.totalAmount - withdrawnAmount, 0);

        const updates = {
            'Coins/Coin1': updatedOneCount,
            'Coins/Coin2': updatedTwoCount,
            'Coins/Coin5': updatedFiveCount,
            'Coins/Coin10': updatedTenCount,
            'Coins/Amount': newTotal,
        };

        await update(ref(database), updates);

        await logActivity(req.session.user.username, 'coin_withdrawal', {
            amount: withdrawnAmount,
            coins: { coin1: newOneCount, coin2: newTwoCount, coin5: newFiveCount, coin10: newTenCount },
            ip: req.ip
        });

        try {
            const snapshotIp = await get(ref(database, 'Ip/IPAddress'));
            const IP = snapshotIp.val();
            if (IP) {
                const url = `http://${IP}/updateData`;
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                }).catch(err => logger.error('Error sending request to ESP:', err));
            }
        } catch (espError) {
            logger.error('ESP communication error:', espError);
        }

        io.emit('coinUpdate', {
            coin1: updatedOneCount,
            coin2: updatedTwoCount,
            coin5: updatedFiveCount,
            coin10: updatedTenCount,
            total: newTotal
        });

        // Check for low coin levels and send alerts
        try {
            const currentCoinData = {
                coin1: updatedOneCount,
                coin2: updatedTwoCount,
                coin5: updatedFiveCount,
                coin10: updatedTenCount,
                total: newTotal
            };
            
            await notificationService.checkCoinLevels(currentCoinData, req.session.user.username);
        } catch (notificationError) {
            logger.error('Notification check error:', notificationError);
        }

        res.render('dashboard', { 
            user: req.session.user,
            total1: updatedOneCount, 
            total2: updatedTwoCount * 2, 
            total5: updatedFiveCount * 5, 
            total10: updatedTenCount * 10, 
            total: newTotal,
            activities: [],
            dailyStats: {},
            currentDate: moment().format('MMMM Do YYYY')
        });
    } catch (error) {
        logger.error('Error updating coin counts:', error);
        res.status(500).json({ error: 'Something went wrong, try again' });
    }
});

app.post('/resetCoins', isAuthenticated, async (req, res) => {
    try {
        const updates = {
            'Coins/Coin1': 0,
            'Coins/Coin2': 0,
            'Coins/Coin5': 0,
            'Coins/Coin10': 0,
            'Coins/Amount': 0
        };

        await update(ref(database), updates);
        await logActivity(req.session.user.username, 'system_reset', { ip: req.ip });

        try {
            const snapshotIp = await get(ref(database, 'Ip/IPAddress'));
            const IP = snapshotIp.val();
            if (IP) {
                const url = `http://${IP}/updateData`;
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                }).catch(err => logger.error('Error sending request to ESP:', err));
            }
        } catch (espError) {
            logger.error('ESP communication error:', espError);
        }

        io.emit('coinUpdate', { coin1: 0, coin2: 0, coin5: 0, coin10: 0, total: 0 });

        res.render('dashboard', { 
            user: req.session.user,
            total1: 0, 
            total2: 0, 
            total5: 0, 
            total10: 0, 
            total: 0,
            activities: [],
            dailyStats: {},
            currentDate: moment().format('MMMM Do YYYY')
        });
    } catch (error) {
        logger.error('Error resetting coin counts:', error);
        res.render('dashboard', { error: 'Failed to reset coin counts. Please try again.' });
    }
});

app.post('/enroll', isAuthenticated, async (req, res) => {
    try {
        const fingerIdRef = ref(database, 'fingerId/id');
        const snapshot = await get(fingerIdRef);
        let currentFingerId = (snapshot.val()?.id) || 0;
        currentFingerId++;

        await update(ref(database, 'fingerId'), { id: { id: currentFingerId } });

        const data = new URLSearchParams();
        data.append('fingerID', currentFingerId);

        const snapshotIp = await get(ref(database, 'Ip/IPAddress'));
        const IP = snapshotIp.val();
        if (!IP) {
            throw new Error('ESP device IP not found');
        }

        const url = `http://${IP}/enroll`;
        const espResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data.toString()
        });

        if (!espResponse.ok) {
            throw new Error('Failed to enroll finger on ESP device');
        }

        await logActivity(req.session.user.username, 'fingerprint_enrollment', {
            fingerId: currentFingerId,
            ip: req.ip
        });

        res.send('Finger enrolled successfully');
    } catch (error) {
        logger.error('Error enrolling finger:', error);
        res.render('login', { error: 'Failed to enroll finger. Please try again.' });
    }
});

// Statistics route
app.get('/statistics', isAuthenticated, async (req, res) => {
    try {
        const stats = [];
        for (let i = 29; i >= 0; i--) {
            const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
            const statsRef = ref(database, `dailyStats/${date}`);
            const statsSnapshot = await get(statsRef);
            const dayStats = statsSnapshot.val() || {
                totalTransactions: 0,
                totalAmount: 0,
                coinCounts: { coin1: 0, coin2: 0, coin5: 0, coin10: 0 }
            };
            stats.push({ date, ...dayStats });
        }

        res.render('statistics', { user: req.session.user, stats });
    } catch (error) {
        logger.error('Statistics error:', error);
        res.render('statistics', { user: req.session.user, stats: [], error: 'Failed to load statistics' });
    }
});

// API Routes
app.get('/api/coins', isAuthenticated, async (req, res) => {
    try {
        const coinData = await getCurrentCoinData();
        res.json(coinData);
    } catch (error) {
        logger.error('API coins error:', error);
        res.status(500).json({ error: 'Failed to fetch coin data' });
    }
});

app.get('/api/activities', isAuthenticated, async (req, res) => {
    try {
        const { limit = 20, filter, search } = req.query;
        const activitiesRef = ref(database, 'activities');
        const activitiesSnapshot = await get(activitiesRef);
        const activities = [];
        
        if (activitiesSnapshot.exists()) {
            const allActivities = [];
            activitiesSnapshot.forEach((child) => {
                allActivities.push({ id: child.key, ...child.val() });
            });
            
            // Sort by timestamp
            allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Apply filters
            let filteredActivities = allActivities;
            
            if (filter && filter !== 'all') {
                filteredActivities = filteredActivities.filter(activity => activity.action === filter);
            }
            
            if (search) {
                const searchLower = search.toLowerCase();
                filteredActivities = filteredActivities.filter(activity => 
                    activity.username.toLowerCase().includes(searchLower) ||
                    activity.action.toLowerCase().includes(searchLower)
                );
            }
            
            activities.push(...filteredActivities.slice(0, parseInt(limit)));
        }
        
        res.json(activities);
    } catch (error) {
        logger.error('API activities error:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// Logout route
app.post('/logout', isAuthenticated, async (req, res) => {
    const username = req.session.user.username;
    await logActivity(username, 'logout', { ip: req.ip });
    
    req.session.destroy((err) => {
        if (err) {
            logger.error('Session destruction error:', err);
        }
        res.redirect('/');
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: moment().format(),
        uptime: process.uptime()
    });
});

// ===== ADVANCED FEATURES API ENDPOINTS =====

// Theme and Language Settings
app.post('/api/settings/theme', isAuthenticated, async (req, res) => {
    try {
        const { theme } = req.body;
        const username = req.session.user.username;
        
        // Validate theme
        if (!['light', 'dark'].includes(theme)) {
            return res.status(400).json({ success: false, message: 'Invalid theme' });
        }
        
        // Update user settings in Firebase
        await update(ref(database, `users/${username}/settings`), { theme });
        
        await logActivity(username, 'theme_change', { theme, ip: req.ip });
        
        res.json({ success: true, message: 'Theme updated successfully' });
    } catch (error) {
        logger.error('Theme update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update theme' });
    }
});

app.post('/api/settings/language', isAuthenticated, async (req, res) => {
    try {
        const { language } = req.body;
        const username = req.session.user.username;
        
        // Validate language
        if (!['en', 'si'].includes(language)) {
            return res.status(400).json({ success: false, message: 'Invalid language' });
        }
        
        // Update user settings in Firebase
        await update(ref(database, `users/${username}/settings`), { language });
        
        // Update i18next language
        await i18next.changeLanguage(language);
        
        await logActivity(username, 'language_change', { language, ip: req.ip });
        
        res.json({ success: true, message: 'Language updated successfully' });
    } catch (error) {
        logger.error('Language update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update language' });
    }
});

app.get('/api/settings', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.user.username;
        const snapshot = await get(ref(database, `users/${username}/settings`));
        
        const settings = snapshot.exists() ? snapshot.val() : {
            theme: 'light',
            language: 'en',
            notifications: true
        };
        
        res.json({ success: true, settings });
    } catch (error) {
        logger.error('Settings fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
});

// Notification Settings
app.post('/api/notifications/settings', isAuthenticated, async (req, res) => {
    try {
        const { smsEnabled, emailEnabled, lowCoinThreshold } = req.body;
        const username = req.session.user.username;
        
        const notificationSettings = {
            smsEnabled: Boolean(smsEnabled),
            emailEnabled: Boolean(emailEnabled),
            lowCoinThreshold: Math.max(0, parseInt(lowCoinThreshold) || 10)
        };
        
        await update(ref(database, `users/${username}/notificationSettings`), notificationSettings);
        
        await logActivity(username, 'notification_settings_update', { 
            settings: notificationSettings, 
            ip: req.ip 
        });
        
        res.json({ success: true, message: 'Notification settings updated successfully' });
    } catch (error) {
        logger.error('Notification settings update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update notification settings' });
    }
});

app.post('/api/notifications/test', isAuthenticated, async (req, res) => {
    try {
        const { type } = req.body; // 'sms' or 'email'
        const username = req.session.user.username;
        
        if (type === 'sms') {
            const phoneNumber = process.env.ADMIN_PHONE_NUMBER || '+1234567890';
            const result = await notificationService.testSMSService(phoneNumber);
            res.json(result);
        } else if (type === 'email') {
            const emailAddress = process.env.ADMIN_EMAIL || 'admin@prosorter.com';
            const result = await notificationService.testEmailService(emailAddress);
            res.json(result);
        } else {
            res.status(400).json({ success: false, message: 'Invalid notification type' });
        }
    } catch (error) {
        logger.error('Test notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to send test notification' });
    }
});

// Advanced Reporting Endpoints
app.get('/api/reports/daily', isAuthenticated, async (req, res) => {
    try {
        const activitiesSnapshot = await get(ref(database, 'activities'));
        const coinSnapshot = await get(ref(database, 'coins'));
        
        const activities = activitiesSnapshot.exists() ? Object.values(activitiesSnapshot.val()) : [];
        const coinData = coinSnapshot.exists() ? coinSnapshot.val() : {};
        
        const reportData = await reportService.generateDailyReport(activities, coinData);
        
        res.json({ success: true, data: reportData });
    } catch (error) {
        logger.error('Daily report generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate daily report' });
    }
});

app.get('/api/reports/weekly', isAuthenticated, async (req, res) => {
    try {
        const activitiesSnapshot = await get(ref(database, 'activities'));
        const coinSnapshot = await get(ref(database, 'coins'));
        
        const activities = activitiesSnapshot.exists() ? Object.values(activitiesSnapshot.val()) : [];
        const coinData = coinSnapshot.exists() ? coinSnapshot.val() : {};
        
        const reportData = await reportService.generateWeeklyReport(activities, coinData);
        
        res.json({ success: true, data: reportData });
    } catch (error) {
        logger.error('Weekly report generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate weekly report' });
    }
});

app.get('/api/reports/monthly', isAuthenticated, async (req, res) => {
    try {
        const activitiesSnapshot = await get(ref(database, 'activities'));
        const coinSnapshot = await get(ref(database, 'coins'));
        
        const activities = activitiesSnapshot.exists() ? Object.values(activitiesSnapshot.val()) : [];
        const coinData = coinSnapshot.exists() ? coinSnapshot.val() : {};
        
        const reportData = await reportService.generateMonthlyReport(activities, coinData);
        
        res.json({ success: true, data: reportData });
    } catch (error) {
        logger.error('Monthly report generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate monthly report' });
    }
});

app.post('/api/reports/custom', isAuthenticated, async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Start date and end date are required' });
        }
        
        const activitiesSnapshot = await get(ref(database, 'activities'));
        const coinSnapshot = await get(ref(database, 'coins'));
        
        const activities = activitiesSnapshot.exists() ? Object.values(activitiesSnapshot.val()) : [];
        const coinData = coinSnapshot.exists() ? coinSnapshot.val() : {};
        
        const reportData = await reportService.generateCustomReport(activities, coinData, startDate, endDate);
        
        res.json({ success: true, data: reportData });
    } catch (error) {
        logger.error('Custom report generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate custom report' });
    }
});

app.post('/api/reports/export', isAuthenticated, async (req, res) => {
    try {
        const { type, format, startDate, endDate } = req.body; // type: daily/weekly/monthly/custom, format: excel/pdf
        const username = req.session.user.username;
        
        const activitiesSnapshot = await get(ref(database, 'activities'));
        const coinSnapshot = await get(ref(database, 'coins'));
        
        const activities = activitiesSnapshot.exists() ? Object.values(activitiesSnapshot.val()) : [];
        const coinData = coinSnapshot.exists() ? coinSnapshot.val() : {};
        
        let reportData;
        switch (type) {
            case 'daily':
                reportData = await reportService.generateDailyReport(activities, coinData);
                break;
            case 'weekly':
                reportData = await reportService.generateWeeklyReport(activities, coinData);
                break;
            case 'monthly':
                reportData = await reportService.generateMonthlyReport(activities, coinData);
                break;
            case 'custom':
                if (!startDate || !endDate) {
                    return res.status(400).json({ success: false, message: 'Start date and end date required for custom reports' });
                }
                reportData = await reportService.generateCustomReport(activities, coinData, startDate, endDate);
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid report type' });
        }
        
        let result;
        if (format === 'excel') {
            result = await reportService.generateExcelReport(reportData, type);
        } else if (format === 'pdf') {
            result = await reportService.generatePDFReport(reportData, type);
        } else {
            return res.status(400).json({ success: false, message: 'Invalid export format' });
        }
        
        if (result.success) {
            await logActivity(username, 'report_export', { 
                type, 
                format, 
                filename: result.filename, 
                ip: req.ip 
            });
            
            // Send file for download
            res.download(result.filepath, result.filename, (err) => {
                if (err) {
                    logger.error('File download error:', err);
                    res.status(500).json({ success: false, message: 'Failed to download report' });
                }
            });
        } else {
            res.status(500).json({ success: false, message: result.error || 'Failed to generate report' });
        }
    } catch (error) {
        logger.error('Report export error:', error);
        res.status(500).json({ success: false, message: 'Failed to export report' });
    }
});

app.get('/api/reports/list', isAuthenticated, async (req, res) => {
    try {
        const reports = reportService.getReportsList();
        res.json({ success: true, reports });
    } catch (error) {
        logger.error('Reports list error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reports list' });
    }
});

app.delete('/api/reports/:filename', isAuthenticated, async (req, res) => {
    try {
        const { filename } = req.params;
        const username = req.session.user.username;
        
        const result = reportService.deleteReport(filename);
        
        if (result.success) {
            await logActivity(username, 'report_delete', { filename, ip: req.ip });
        }
        
        res.json(result);
    } catch (error) {
        logger.error('Report deletion error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete report' });
    }
});

// Translation endpoint
app.get('/api/translations/:lang', async (req, res) => {
    try {
        const { lang } = req.params;
        
        if (!['en', 'si'].includes(lang)) {
            return res.status(400).json({ success: false, message: 'Invalid language' });
        }
        
        const translations = i18next.getResourceBundle(lang, 'translation');
        res.json({ success: true, translations });
    } catch (error) {
        logger.error('Translation fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch translations' });
    }
});

// ===== USER STATS & ACTIVITIES API ENDPOINTS =====

// Get user statistics
app.get('/api/user/stats', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.user.username;
        const activitiesRef = ref(database, 'activities');
        const activitiesSnapshot = await get(activitiesRef);
        
        let loginCount = 0;
        let withdrawalCount = 0;
        let totalActions = 0;
        
        if (activitiesSnapshot.exists()) {
            activitiesSnapshot.forEach((child) => {
                const activity = child.val();
                if (activity.username === username) {
                    totalActions++;
                    if (activity.action === 'login') loginCount++;
                    if (activity.action === 'coin_withdrawal') withdrawalCount++;
                }
            });
        }
        
        res.json({
            success: true,
            stats: {
                loginCount,
                withdrawalCount,
                totalActions
            }
        });
    } catch (error) {
        logger.error('Error fetching user stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch user statistics' });
    }
});

// Export activities
app.post('/api/activities/export', isAuthenticated, async (req, res) => {
    try {
        const activitiesRef = ref(database, 'activities');
        const activitiesSnapshot = await get(activitiesRef);
        
        if (!activitiesSnapshot.exists()) {
            return res.status(404).json({ error: 'No activities found' });
        }
        
        const activities = [];
        activitiesSnapshot.forEach((child) => {
            activities.push(child.val());
        });
        
        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Create CSV content
        const headers = ['Username', 'Action', 'Timestamp', 'Details'];
        const csvContent = [
            headers.join(','),
            ...activities.map(activity => [
                activity.username,
                activity.action,
                activity.timestamp,
                JSON.stringify(activity.details || {})
            ].join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=activities_${moment().format('YYYY-MM-DD')}.csv`);
        res.send(csvContent);
        
        logger.info(`Activities exported by ${req.session.user.username}`);
    } catch (error) {
        logger.error('Error exporting activities:', error);
        res.status(500).json({ error: 'Failed to export activities' });
    }
});

// Clear activities (admin only)
app.delete('/api/activities/clear', isAuthenticated, async (req, res) => {
    try {
        // Check if user is admin
        if (req.session.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const activitiesRef = ref(database, 'activities');
        await remove(activitiesRef);
        
        await logActivity(req.session.user.username, 'activities_cleared', { ip: req.ip });
        
        res.json({ success: true, message: 'All activities cleared successfully' });
        logger.info(`Activities cleared by ${req.session.user.username}`);
    } catch (error) {
        logger.error('Error clearing activities:', error);
        res.status(500).json({ success: false, error: 'Failed to clear activities' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    logger.info('User connected:', socket.id);
    
    socket.on('disconnect', () => {
        logger.info('User disconnected:', socket.id);
    });
});

// Daily backup cron job
cron.schedule('0 0 * * *', async () => {
    try {
        logger.info('Running daily backup...');
        const today = moment().format('YYYY-MM-DD');
        const coinData = await getCurrentCoinData();
        
        const backupData = {
            date: today,
            coinData,
            timestamp: moment().format()
        };
        
        await push(ref(database, 'backups'), backupData);
        logger.info('Daily backup completed successfully');
    } catch (error) {
        logger.error('Daily backup failed:', error);
    }
});

server.listen(port, () => {
    logger.info(`ProSorter server started at http://localhost:${port}`);
    console.log('\n🚀 ProSorter Server Started Successfully!');
    console.log('========================================');
    console.log(`🌐 URL: http://localhost:${port}`);
    console.log('📱 Status: Ready for connections');
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('🎯 Quick Start:');
    console.log('   1. Open browser to http://localhost:' + port);
    console.log('   2. Enter admin/admin123');
    console.log('   3. Click Sign In');
    console.log('   4. Access dashboard');
    console.log('========================================\n');
});

module.exports = app;
