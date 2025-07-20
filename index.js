const express = require('express');
const path = require('path');

const app = express();

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, child, update } = require('firebase/database');

app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

const port = process.env.PORT || 3002;

const firebaseConfig = {
  apiKey: "AIzaSyAldgwM_vcZxSO-Lo12tCJKOautogDUjuM",
  authDomain: "prosorter-c2a36.firebaseapp.com",
  databaseURL: "https://prosorter-c2a36-default-rtdb.firebaseio.com",
  projectId: "prosorter-c2a36",
  storageBucket: "prosorter-c2a36.firebasestorage.app",
  messagingSenderId: "282462760135",
  appId: "1:282462760135:web:87cc4592c37286d15c62e2"
};
// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

app.set('views', path.join(__dirname, 'views')); 
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, '/public')));

app.get('/', (req, res) => {
    res.render('login');
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const userRef = ref(database, `users/${username}`);
    
    try {
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        
        if (userData && userData.password === password) {
            try {
                const snapshot1 = await get(ref(database, 'Coins/Coin1'));
                const total_1 = snapshot1.val();

                const snapshot2 = await get(ref(database, 'Coins/Coin2'));
                const total_2 = snapshot2.val();

                const snapshot5 = await get(ref(database, 'Coins/Coin5'));
                const total_5 = snapshot5.val();

                const snapshot10 = await get(ref(database, 'Coins/Coin10'));
                const total_10 = snapshot10.val();

                const snapshotTotal = await get(ref(database, 'Coins/Amount'));
                const total_amount = snapshotTotal.val();


                res.render('index', { total1: total_1, total2: total_2 * 2, total5: total_5*5, total10: total_10*10, total: total_amount });
            } catch (error) {
                console.error('Error fetching data from Firebase:', error);
                res.render('index', { total1: 'Error retrieving data', total2: 'Error retrieving data', total5: 'Error retrieving data', total10: 'Error retrieving data', total: 'Error retrieving data' });
            }
        } else {
            res.render('login', { error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error fetching user data from Firebase:', error);
        res.render('login', { error: 'Invalid username or password' });
    }
});

app.post('/updateCoins', async (req, res) => {
    try {
        const snapshot1 = await get(ref(database, 'Coins/Coin1'));
        const total_1 = snapshot1.val();

        const snapshot2 = await get(ref(database, 'Coins/Coin2'));
        const total_2 = snapshot2.val();

        const snapshot5 = await get(ref(database, 'Coins/Coin5'));
        const total_5 = snapshot5.val();

        const snapshot10 = await get(ref(database, 'Coins/Coin10'));
        const total_10 = snapshot10.val();

        const snapshotTotal = await get(ref(database, 'Coins/Amount'));
        const total_amount = snapshotTotal.val();

        const newOneCount = parseInt(req.body.oneCount, 10) || 0;
        const newTwoCount = parseInt(req.body.twoCount, 10) || 0;
        const newFiveCount = parseInt(req.body.fiveCount, 10) || 0;
        const newTenCount = parseInt(req.body.tenCount, 10) || 0;

        const updatedOneCount = Math.max(total_1 - newOneCount, 0);
        const updatedTwoCount = Math.max(total_2 - newTwoCount , 0);
        const updatedFiveCount = Math.max(total_5 - newFiveCount , 0);
        const updatedTenCount = Math.max(total_10 - newTenCount, 0);

        const newTotal = Math.max(total_amount - ((total_1 - updatedOneCount) * 1) - ((total_2 - updatedTwoCount) * 2) - ((total_5 - updatedFiveCount) * 5) - ((total_10 - updatedTenCount) * 10),0);

        const updates = {
            'Coins/Coin1': updatedOneCount,
            'Coins/Coin2': updatedTwoCount,
            'Coins/Coin5': updatedFiveCount,
            'Coins/Coin10': updatedTenCount,
            'Coins/Amount': newTotal,
        };

        await update(ref(database), updates);
        const snapshotIp = await get(ref(database, 'Ip/IPAddress'));
        const IP = snapshotIp.val();
        const url = 'http://'+IP + '/updateData';
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).catch(err => console.error('Error sending request to ESP:', err));
        res.render('index', { total1: updatedOneCount, total2: updatedTwoCount, total5: updatedFiveCount, total10: updatedTenCount, total: newTotal });
    } catch (error) {
        console.error('Error updating coin counts:', error);
        res.status(500).json({ error: 'Something went wrong, try again' });
    }
});

app.post('/resetCoins', async (req, res) => {
    try {
        const updates = {
            'Coins/Coin1': 0,
            'Coins/Coin2': 0,
            'Coins/Coin5': 0,
            'Coins/Coin10': 0,
            'Coins/Amount': 0
        };

        await update(ref(database), updates);
        const snapshotIp = await get(ref(database, 'Ip/IPAddress'));
        const IP = snapshotIp.val();
        const url = 'http://'+IP + '/updateData';
        console.log(url);
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).catch(err => console.error('Error sending request to ESP:', err));
        res.render('index', { total1: 0, total2: 0, total5: 0, total10: 0, total: 0 });
    } catch (error) {
        console.error('Error resetting coin counts:', error);
        res.render('index', { error: 'Failed to reset coin counts. Please try again.' });
    }
});

app.post('/enroll', async (req, res) => {
    try {
        const database = getDatabase();
        const fingerIdRef = ref(database, 'fingerId/id');
        const snapshot = await get(fingerIdRef);
        let currentFingerId = snapshot.val().id || 0;
        currentFingerId++;

        // Correctly updating the nested fingerId structure
        await update(ref(database, 'fingerId'), { id: { id: currentFingerId } });

        const data = new URLSearchParams();
        data.append('fingerID', currentFingerId);

        const snapshotIp = await get(ref(database, 'Ip/IPAddress'));
        const IP = snapshotIp.val();
        const url = 'http://' + IP + '/enroll';

        const espResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data.toString() // Convert URLSearchParams object to string
        });

        if (!espResponse.ok) {
            throw new Error('Failed to enroll finger on ESP device');
        }

        res.send('Finger enrolled successfully');
    } catch (error) {
        console.error('Error enrolling finger:', error);
        res.render('login', { error: 'Failed to enroll finger. Please try again.' });
    }
});

app.listen(port, () => {
    console.log('Server started at http://localhost:' + port);
});
