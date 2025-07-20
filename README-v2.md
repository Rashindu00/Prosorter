# ProSorter Web Application v2.0 🚀

An advanced coin sorting system with a modern web dashboard, real-time monitoring, and comprehensive analytics.

## 🌟 New Features & Improvements

### 🔐 Security Enhancements
- **Password Hashing**: Secure bcrypt password hashing
- **Rate Limiting**: Protection against brute force attacks
- **Session Management**: Secure session handling with configurable timeouts
- **Input Validation**: Comprehensive server-side validation
- **CSRF Protection**: Built-in security headers with Helmet.js
- **Environment Variables**: Secure configuration management

### 📊 Advanced Dashboard
- **Real-time Updates**: Live coin count updates via WebSocket
- **Interactive Charts**: Beautiful Chart.js visualizations
- **Activity Logging**: Comprehensive user activity tracking
- **Statistics Panel**: 30-day analytics and trends
- **Responsive Design**: Mobile-first responsive layout
- **Modern UI**: Enhanced with modern CSS and animations

### 👥 User Management
- **Role-based Access**: Admin, Operator, and User roles
- **Permission System**: Granular permission controls
- **User Profiles**: Detailed user information and session tracking
- **Activity Monitoring**: Real-time user activity logs

### 📈 Analytics & Reporting
- **Daily Statistics**: Automatic daily stat collection
- **Transaction History**: Complete transaction logging
- **Export Functionality**: CSV export for reports
- **Trend Analysis**: Visual trend analysis with charts
- **Data Backup**: Automated daily backups

### 🔄 Real-time Features
- **Live Updates**: Socket.io for real-time data sync
- **Push Notifications**: System notifications and alerts
- **Connection Status**: Live connection monitoring
- **Auto-refresh**: Optional automatic data refresh

### 🛠️ Technical Improvements
- **Error Handling**: Comprehensive error handling and logging
- **Logging System**: Winston-based structured logging
- **Health Checks**: System health monitoring endpoints
- **Cron Jobs**: Automated maintenance tasks
- **API Endpoints**: RESTful API for external integrations

## 📁 Project Structure

```
ProSorter-v2/
├── public/
│   ├── css/
│   │   ├── style.css (original)
│   │   └── enhanced-style.css (new modern styles)
│   └── images/
├── views/
│   ├── login.ejs
│   ├── dashboard.ejs (enhanced)
│   ├── statistics.ejs (new)
│   ├── 404.ejs (new)
│   └── error.ejs (new)
├── scripts/
│   └── createUsers.js (user seeder)
├── logs/ (auto-generated)
├── server.js (enhanced backend)
├── index.js (original - kept for compatibility)
├── package.json (updated dependencies)
├── .env (environment configuration)
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file with your configuration:
```env
PORT=3002
NODE_ENV=development
SESSION_SECRET=your_super_secret_session_key
JWT_SECRET=your_jwt_secret_key
FIREBASE_API_KEY=your_firebase_api_key
# ... other Firebase config
```

### 3. Initialize Users
```bash
node scripts/createUsers.js
```

### 4. Start the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 👤 Default Login Credentials

| Username | Password   | Role          | Permissions                    |
|----------|------------|---------------|--------------------------------|
| admin    | admin123   | Administrator | Full system access             |
| operator | operator123| Operator      | Operations + Statistics        |
| user     | user123    | Standard User | Basic coin withdrawal only     |

> ⚠️ **Security Warning**: Change these default passwords immediately in production!

## 🎯 Features Overview

### 🔹 For Administrators
- Full system control and configuration
- User management and role assignment
- System reset and fingerprint enrollment
- Complete analytics and reporting
- System health monitoring

### 🔹 For Operators
- Coin operations and monitoring
- Statistics viewing and reporting
- Fingerprint enrollment
- Activity monitoring

### 🔹 For Standard Users
- Basic coin withdrawal operations
- Personal activity history
- Real-time coin status

## 🌐 API Endpoints

### Authentication
- `POST /login` - User authentication
- `POST /logout` - User logout

### Dashboard
- `GET /dashboard` - Main dashboard
- `GET /statistics` - Statistics page
- `GET /api/coins` - Current coin status
- `GET /api/activities` - Recent activities

### Operations
- `POST /updateCoins` - Withdraw coins
- `POST /resetCoins` - Reset system (admin only)
- `POST /enroll` - Fingerprint enrollment

### System
- `GET /health` - Health check
- `GET /api/system/status` - System status

## 🔧 Configuration

### Environment Variables
```env
# Server Configuration
PORT=3002
NODE_ENV=production

# Security
SESSION_SECRET=your_super_secret_session_key
JWT_SECRET=your_jwt_secret_key

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### Firebase Database Structure
```json
{
  "users": {
    "username": {
      "password": "hashed_password",
      "role": "admin|operator|user",
      "permissions": { ... }
    }
  },
  "Coins": {
    "Coin1": 0,
    "Coin2": 0,
    "Coin5": 0,
    "Coin10": 0,
    "Amount": 0
  },
  "activities": { ... },
  "dailyStats": { ... },
  "transactions": { ... },
  "backups": { ... }
}
```

## 📱 Responsive Design

The application is fully responsive and works seamlessly across:
- 🖥️ Desktop computers
- 💻 Laptops
- 📱 Tablets
- 📲 Mobile phones

## 🔒 Security Features

- **HTTPS Ready**: SSL/TLS support for production
- **Rate Limiting**: Prevents abuse and attacks
- **Input Sanitization**: XSS protection
- **CSRF Protection**: Cross-site request forgery protection
- **Secure Headers**: Security headers via Helmet.js
- **Session Security**: HttpOnly cookies and secure sessions

## 📊 Monitoring & Logging

- **Winston Logging**: Structured logging to files and console
- **Activity Tracking**: All user actions are logged
- **Error Tracking**: Comprehensive error logging
- **Performance Monitoring**: Response time tracking
- **Health Checks**: Automated system health monitoring

## 🔄 Real-time Features

- **WebSocket Connection**: Real-time data synchronization
- **Live Updates**: Instant coin count updates
- **Push Notifications**: System alerts and notifications
- **Connection Status**: Live connection monitoring
- **Auto-refresh**: Optional automatic data refresh

## 🛠️ Development

### Available Scripts
```bash
npm start       # Start production server
npm run dev     # Start development server with nodemon
npm test        # Run tests
npm run lint    # Run ESLint
npm run format  # Format code with Prettier
```

### Development Tools
- **Nodemon**: Auto-restart on file changes
- **ESLint**: Code linting and style checking
- **Prettier**: Code formatting
- **Jest**: Testing framework

## 🚀 Deployment

### Production Checklist
- [ ] Change all default passwords
- [ ] Set secure environment variables
- [ ] Enable HTTPS/SSL
- [ ] Configure Firebase security rules
- [ ] Set up monitoring and logging
- [ ] Configure backup strategies
- [ ] Test all functionality

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@prosorter.com or create an issue in the repository.

## 🙏 Acknowledgments

- Express.js community
- Firebase team
- Chart.js developers
- Font Awesome icons
- Socket.io team

---

**ProSorter v2.0** - Built with ❤️ for modern coin management systems.
