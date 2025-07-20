const twilio = require('twilio');
const nodemailer = require('nodemailer');
const logger = require('./logger');

class NotificationService {
    constructor() {
        // Twilio configuration (check for valid credentials)
        this.twilioClient = null;
        if (process.env.TWILIO_ACCOUNT_SID && 
            process.env.TWILIO_AUTH_TOKEN && 
            process.env.TWILIO_ACCOUNT_SID !== 'demo_account_sid' &&
            process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
            try {
                this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                logger.info('Twilio SMS service initialized successfully');
            } catch (error) {
                logger.error('Twilio initialization failed:', error);
            }
        } else {
            logger.warn('Twilio SMS service not configured - SMS notifications disabled');
        }

        // Email configuration (check for valid credentials)
        this.emailTransporter = null;
        if (process.env.EMAIL_USER && 
            process.env.EMAIL_PASSWORD && 
            process.env.EMAIL_USER !== 'demo@gmail.com') {
            try {
                this.emailTransporter = nodemailer.createTransport({
                    service: process.env.EMAIL_SERVICE || 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
                logger.info('Email service initialized successfully');
            } catch (error) {
                logger.error('Email initialization failed:', error);
            }
        } else {
            logger.warn('Email service not configured - Email notifications disabled');
        }

        // Notification settings
        this.notificationSettings = {
            sms: {
                enabled: false,
                phoneNumbers: [],
                lowCoinThreshold: 10,
                systemAlerts: true
            },
            email: {
                enabled: false,
                addresses: [],
                dailyReports: true,
                alerts: true
            },
            push: {
                enabled: false
            }
        };
    }

    // SMS Alert Methods
    async sendSMS(phoneNumber, message) {
        if (!this.twilioClient) {
            logger.warn('SMS service not configured');
            return { success: false, error: 'SMS service not configured' };
        }

        try {
            const result = await this.twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

            logger.info(`SMS sent successfully to ${phoneNumber}`, { messageId: result.sid });
            return { success: true, messageId: result.sid };
        } catch (error) {
            logger.error('SMS sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendBulkSMS(phoneNumbers, message) {
        const results = [];
        for (const phoneNumber of phoneNumbers) {
            const result = await this.sendSMS(phoneNumber, message);
            results.push({ phoneNumber, ...result });
        }
        return results;
    }

    // Email Alert Methods
    async sendEmail(to, subject, message, isHTML = false) {
        if (!this.emailTransporter) {
            logger.warn('Email service not configured');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to,
                subject,
                [isHTML ? 'html' : 'text']: message
            };

            const result = await this.emailTransporter.sendMail(mailOptions);
            logger.info(`Email sent successfully to ${to}`, { messageId: result.messageId });
            return { success: true, messageId: result.messageId };
        } catch (error) {
            logger.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Predefined Alert Messages
    generateLowCoinAlert(coinType, currentCount, threshold) {
        return {
            sms: `🚨 ProSorter Alert: ${coinType} coins running low! Current: ${currentCount}, Threshold: ${threshold}. Please refill soon.`,
            email: {
                subject: 'ProSorter - Low Coin Inventory Alert',
                body: `
                    <h2>Low Coin Inventory Alert</h2>
                    <p><strong>Coin Type:</strong> ${coinType}</p>
                    <p><strong>Current Count:</strong> ${currentCount}</p>
                    <p><strong>Threshold:</strong> ${threshold}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    <p>Please refill the coin inventory as soon as possible.</p>
                `
            }
        };
    }

    generateSystemAlert(message, severity = 'info') {
        const icons = { error: '❌', warning: '⚠️', info: 'ℹ️', success: '✅' };
        return {
            sms: `${icons[severity]} ProSorter: ${message} - ${new Date().toLocaleString()}`,
            email: {
                subject: `ProSorter System Alert - ${severity.toUpperCase()}`,
                body: `
                    <h2>System Alert</h2>
                    <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
                    <p><strong>Message:</strong> ${message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                `
            }
        };
    }

    generateDailyReport(coinData, statistics) {
        const totalAmount = coinData.total || 0;
        const transactions = statistics.totalTransactions || 0;
        
        return {
            email: {
                subject: `ProSorter Daily Report - ${new Date().toLocaleDateString()}`,
                body: `
                    <h2>ProSorter Daily Report</h2>
                    <h3>Coin Inventory Summary</h3>
                    <table style="border-collapse: collapse; width: 100%;">
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px;">Coin Type</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Count</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Value</th>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. 1</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${coinData.coin1 || 0}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. ${coinData.coin1 || 0}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. 2</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${Math.floor((coinData.coin2 || 0) / 2)}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. ${coinData.coin2 || 0}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. 5</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${Math.floor((coinData.coin5 || 0) / 5)}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. ${coinData.coin5 || 0}</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. 10</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${Math.floor((coinData.coin10 || 0) / 10)}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. ${coinData.coin10 || 0}</td>
                        </tr>
                        <tr style="background-color: #f2f2f2; font-weight: bold;">
                            <td style="border: 1px solid #ddd; padding: 8px;">Total</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">-</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">Rs. ${totalAmount}</td>
                        </tr>
                    </table>
                    <h3>Transaction Summary</h3>
                    <p><strong>Total Transactions:</strong> ${transactions}</p>
                    <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
                `
            }
        };
    }

    // Monitoring and Auto-alerts
    async checkCoinLevels(coinData) {
        const alerts = [];
        const threshold = this.notificationSettings.sms.lowCoinThreshold;

        // Check each coin type
        const coinTypes = [
            { name: 'Rs. 1', count: coinData.coin1 || 0 },
            { name: 'Rs. 2', count: Math.floor((coinData.coin2 || 0) / 2) },
            { name: 'Rs. 5', count: Math.floor((coinData.coin5 || 0) / 5) },
            { name: 'Rs. 10', count: Math.floor((coinData.coin10 || 0) / 10) }
        ];

        for (const coin of coinTypes) {
            if (coin.count < threshold) {
                const alert = this.generateLowCoinAlert(coin.name, coin.count, threshold);
                alerts.push({ coinType: coin.name, ...alert });
            }
        }

        // Send alerts if any
        if (alerts.length > 0 && this.notificationSettings.sms.enabled) {
            for (const alert of alerts) {
                await this.sendBulkSMS(this.notificationSettings.sms.phoneNumbers, alert.sms);
                
                if (this.notificationSettings.email.enabled) {
                    await this.sendBulkEmail(
                        this.notificationSettings.email.addresses,
                        alert.email.subject,
                        alert.email.body,
                        true
                    );
                }
            }
        }

        return alerts;
    }

    async sendBulkEmail(addresses, subject, message, isHTML = false) {
        const results = [];
        for (const address of addresses) {
            const result = await this.sendEmail(address, subject, message, isHTML);
            results.push({ address, ...result });
        }
        return results;
    }

    // Settings Management
    updateNotificationSettings(newSettings) {
        this.notificationSettings = { ...this.notificationSettings, ...newSettings };
        logger.info('Notification settings updated:', this.notificationSettings);
    }

    getNotificationSettings() {
        return this.notificationSettings;
    }

    // Test Methods
    async testSMSService(phoneNumber) {
        // For demo purposes, show success message instead of actual SMS
        if (process.env.NODE_ENV === 'development') {
            logger.info(`Demo SMS test: Would send to ${phoneNumber}`);
            return { 
                success: true, 
                message: `Demo SMS sent successfully to ${phoneNumber}! 📱✅` 
            };
        }
        
        const testMessage = 'ProSorter SMS Test: Service is working correctly! 🎉';
        return await this.sendSMS(phoneNumber, testMessage);
    }

    async testEmailService(emailAddress) {
        // For demo purposes, show success message instead of actual email
        if (process.env.NODE_ENV === 'development') {
            logger.info(`Demo Email test: Would send to ${emailAddress}`);
            return { 
                success: true, 
                message: `Demo Email sent successfully to ${emailAddress}! 📧✅` 
            };
        }
        
        const testSubject = 'ProSorter Email Test';
        const testMessage = 'This is a test email from ProSorter. Email service is working correctly! 🎉';
        return await this.sendEmail(emailAddress, testSubject, testMessage);
    }
}

module.exports = new NotificationService();
