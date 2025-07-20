const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ReportService {
    constructor() {
        this.reportsDir = path.join(__dirname, '..', 'reports');
        this.ensureReportsDirectory();
    }

    ensureReportsDirectory() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    // Data Processing Methods
    processStatisticsData(activities, coinData, dateRange = null) {
        let filteredActivities = activities;
        
        if (dateRange) {
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            filteredActivities = activities.filter(activity => {
                const activityDate = new Date(activity.timestamp);
                return activityDate >= startDate && activityDate <= endDate;
            });
        }

        // Calculate statistics
        const stats = {
            totalTransactions: filteredActivities.length,
            loginCount: filteredActivities.filter(a => a.action === 'login').length,
            logoutCount: filteredActivities.filter(a => a.action === 'logout').length,
            withdrawalCount: filteredActivities.filter(a => a.action === 'coin_withdrawal').length,
            systemResetCount: filteredActivities.filter(a => a.action === 'system_reset').length,
            
            // User activity breakdown
            userActivity: this.getUserActivityBreakdown(filteredActivities),
            
            // Daily breakdown
            dailyBreakdown: this.getDailyBreakdown(filteredActivities),
            
            // Current coin status
            currentInventory: {
                coin1: { count: coinData.coin1 || 0, value: coinData.coin1 || 0 },
                coin2: { count: Math.floor((coinData.coin2 || 0) / 2), value: coinData.coin2 || 0 },
                coin5: { count: Math.floor((coinData.coin5 || 0) / 5), value: coinData.coin5 || 0 },
                coin10: { count: Math.floor((coinData.coin10 || 0) / 10), value: coinData.coin10 || 0 },
                total: coinData.total || 0
            },
            
            // Time period
            reportPeriod: dateRange || {
                start: filteredActivities.length > 0 ? filteredActivities[filteredActivities.length - 1].timestamp : new Date(),
                end: new Date()
            }
        };

        return stats;
    }

    getUserActivityBreakdown(activities) {
        const userStats = {};
        
        activities.forEach(activity => {
            const username = activity.username || 'Unknown';
            if (!userStats[username]) {
                userStats[username] = {
                    totalActions: 0,
                    logins: 0,
                    withdrawals: 0,
                    lastActivity: null
                };
            }
            
            userStats[username].totalActions++;
            userStats[username].lastActivity = activity.timestamp;
            
            switch (activity.action) {
                case 'login':
                    userStats[username].logins++;
                    break;
                case 'coin_withdrawal':
                    userStats[username].withdrawals++;
                    break;
            }
        });
        
        return userStats;
    }

    getDailyBreakdown(activities) {
        const dailyStats = {};
        
        activities.forEach(activity => {
            const date = new Date(activity.timestamp).toDateString();
            if (!dailyStats[date]) {
                dailyStats[date] = {
                    totalActivities: 0,
                    logins: 0,
                    withdrawals: 0,
                    users: new Set()
                };
            }
            
            dailyStats[date].totalActivities++;
            dailyStats[date].users.add(activity.username);
            
            if (activity.action === 'login') dailyStats[date].logins++;
            if (activity.action === 'coin_withdrawal') dailyStats[date].withdrawals++;
        });
        
        // Convert Set to count
        Object.keys(dailyStats).forEach(date => {
            dailyStats[date].uniqueUsers = dailyStats[date].users.size;
            delete dailyStats[date].users;
        });
        
        return dailyStats;
    }

    // Excel Report Generation
    async generateExcelReport(reportData, reportType = 'daily') {
        try {
            const workbook = XLSX.utils.book_new();
            
            // Summary Sheet
            const summaryData = [
                ['ProSorter System Report'],
                ['Report Type:', reportType.toUpperCase()],
                ['Generated Date:', new Date().toLocaleString()],
                ['Report Period:', `${new Date(reportData.reportPeriod.start).toLocaleDateString()} - ${new Date(reportData.reportPeriod.end).toLocaleDateString()}`],
                [],
                ['SUMMARY STATISTICS'],
                ['Total Transactions:', reportData.totalTransactions],
                ['Login Count:', reportData.loginCount],
                ['Withdrawal Count:', reportData.withdrawalCount],
                ['System Resets:', reportData.systemResetCount],
                [],
                ['CURRENT INVENTORY'],
                ['Coin Type', 'Count', 'Value (Rs)'],
                ['Rs. 1 Coins', reportData.currentInventory.coin1.count, reportData.currentInventory.coin1.value],
                ['Rs. 2 Coins', reportData.currentInventory.coin2.count, reportData.currentInventory.coin2.value],
                ['Rs. 5 Coins', reportData.currentInventory.coin5.count, reportData.currentInventory.coin5.value],
                ['Rs. 10 Coins', reportData.currentInventory.coin10.count, reportData.currentInventory.coin10.value],
                ['TOTAL VALUE', '', reportData.currentInventory.total]
            ];
            
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
            
            // User Activity Sheet
            const userActivityData = [
                ['USER ACTIVITY BREAKDOWN'],
                ['Username', 'Total Actions', 'Logins', 'Withdrawals', 'Last Activity']
            ];
            
            Object.entries(reportData.userActivity).forEach(([username, stats]) => {
                userActivityData.push([
                    username,
                    stats.totalActions,
                    stats.logins,
                    stats.withdrawals,
                    new Date(stats.lastActivity).toLocaleString()
                ]);
            });
            
            const userSheet = XLSX.utils.aoa_to_sheet(userActivityData);
            XLSX.utils.book_append_sheet(workbook, userSheet, 'User Activity');
            
            // Daily Breakdown Sheet
            const dailyData = [
                ['DAILY ACTIVITY BREAKDOWN'],
                ['Date', 'Total Activities', 'Logins', 'Withdrawals', 'Unique Users']
            ];
            
            Object.entries(reportData.dailyBreakdown).forEach(([date, stats]) => {
                dailyData.push([
                    date,
                    stats.totalActivities,
                    stats.logins,
                    stats.withdrawals,
                    stats.uniqueUsers
                ]);
            });
            
            const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
            XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Breakdown');
            
            // Save file
            const filename = `prosorter-${reportType}-report-${new Date().getTime()}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            XLSX.writeFile(workbook, filepath);
            
            logger.info(`Excel report generated: ${filename}`);
            return { success: true, filename, filepath };
            
        } catch (error) {
            logger.error('Excel report generation failed:', error);
            return { success: false, error: error.message };
        }
    }

    // PDF Report Generation
    async generatePDFReport(reportData, reportType = 'daily') {
        try {
            const filename = `prosorter-${reportType}-report-${new Date().getTime()}.pdf`;
            const filepath = path.join(this.reportsDir, filename);
            
            const doc = new PDFDocument();
            doc.pipe(fs.createWriteStream(filepath));
            
            // Header
            doc.fontSize(24).fillColor('#2c3e50').text('ProSorter System Report', 50, 50);
            doc.fontSize(12).fillColor('#7f8c8d')
               .text(`Report Type: ${reportType.toUpperCase()}`, 50, 80)
               .text(`Generated: ${new Date().toLocaleString()}`, 50, 95)
               .text(`Period: ${new Date(reportData.reportPeriod.start).toLocaleDateString()} - ${new Date(reportData.reportPeriod.end).toLocaleDateString()}`, 50, 110);
            
            // Summary Statistics
            doc.fontSize(16).fillColor('#2c3e50').text('Summary Statistics', 50, 150);
            doc.fontSize(12).fillColor('#2c3e50')
               .text(`Total Transactions: ${reportData.totalTransactions}`, 50, 175)
               .text(`Login Count: ${reportData.loginCount}`, 50, 190)
               .text(`Withdrawal Count: ${reportData.withdrawalCount}`, 50, 205)
               .text(`System Resets: ${reportData.systemResetCount}`, 50, 220);
            
            // Current Inventory
            doc.fontSize(16).fillColor('#2c3e50').text('Current Inventory', 50, 260);
            
            const inventoryY = 285;
            doc.fontSize(12).fillColor('#2c3e50')
               .text('Coin Type', 50, inventoryY)
               .text('Count', 150, inventoryY)
               .text('Value (Rs)', 250, inventoryY);
            
            // Draw inventory table
            const coins = [
                ['Rs. 1 Coins', reportData.currentInventory.coin1.count, reportData.currentInventory.coin1.value],
                ['Rs. 2 Coins', reportData.currentInventory.coin2.count, reportData.currentInventory.coin2.value],
                ['Rs. 5 Coins', reportData.currentInventory.coin5.count, reportData.currentInventory.coin5.value],
                ['Rs. 10 Coins', reportData.currentInventory.coin10.count, reportData.currentInventory.coin10.value]
            ];
            
            coins.forEach((coin, index) => {
                const y = inventoryY + 20 + (index * 15);
                doc.text(coin[0], 50, y)
                   .text(coin[1].toString(), 150, y)
                   .text(coin[2].toString(), 250, y);
            });
            
            // Total
            const totalY = inventoryY + 20 + (coins.length * 15) + 10;
            doc.fontSize(14).fillColor('#e74c3c')
               .text('TOTAL VALUE', 50, totalY)
               .text(reportData.currentInventory.total.toString(), 250, totalY);
            
            // User Activity (if fits on page)
            if (doc.y < 600) {
                doc.fontSize(16).fillColor('#2c3e50').text('Top User Activity', 50, doc.y + 30);
                
                const sortedUsers = Object.entries(reportData.userActivity)
                    .sort(([,a], [,b]) => b.totalActions - a.totalActions)
                    .slice(0, 5);
                
                sortedUsers.forEach(([username, stats], index) => {
                    const y = doc.y + 20 + (index * 15);
                    doc.fontSize(12).fillColor('#2c3e50')
                       .text(`${username}: ${stats.totalActions} actions`, 50, y);
                });
            }
            
            // Footer
            doc.fontSize(10).fillColor('#95a5a6')
               .text('Generated by ProSorter System', 50, doc.page.height - 50);
            
            doc.end();
            
            logger.info(`PDF report generated: ${filename}`);
            return { success: true, filename, filepath };
            
        } catch (error) {
            logger.error('PDF report generation failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Quick Report Methods
    async generateDailyReport(activities, coinData) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const reportData = this.processStatisticsData(activities, coinData, {
            start: startOfDay,
            end: endOfDay
        });
        
        return reportData;
    }

    async generateWeeklyReport(activities, coinData) {
        const today = new Date();
        const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 7);
        
        const reportData = this.processStatisticsData(activities, coinData, {
            start: startOfWeek,
            end: endOfWeek
        });
        
        return reportData;
    }

    async generateMonthlyReport(activities, coinData) {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        
        const reportData = this.processStatisticsData(activities, coinData, {
            start: startOfMonth,
            end: endOfMonth
        });
        
        return reportData;
    }

    async generateCustomReport(activities, coinData, startDate, endDate) {
        const reportData = this.processStatisticsData(activities, coinData, {
            start: new Date(startDate),
            end: new Date(endDate)
        });
        
        return reportData;
    }

    // File Management
    getReportsList() {
        try {
            const files = fs.readdirSync(this.reportsDir);
            return files.map(filename => {
                const filepath = path.join(this.reportsDir, filename);
                const stats = fs.statSync(filepath);
                return {
                    filename,
                    filepath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            }).sort((a, b) => b.created - a.created);
        } catch (error) {
            logger.error('Failed to get reports list:', error);
            return [];
        }
    }

    deleteReport(filename) {
        try {
            const filepath = path.join(this.reportsDir, filename);
            fs.unlinkSync(filepath);
            logger.info(`Report deleted: ${filename}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to delete report ${filename}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Cleanup old reports (older than 30 days)
    cleanupOldReports() {
        try {
            const files = this.getReportsList();
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            let deletedCount = 0;
            files.forEach(file => {
                if (file.created < thirtyDaysAgo) {
                    this.deleteReport(file.filename);
                    deletedCount++;
                }
            });
            
            logger.info(`Cleanup completed: ${deletedCount} old reports deleted`);
            return { success: true, deletedCount };
        } catch (error) {
            logger.error('Report cleanup failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ReportService();
