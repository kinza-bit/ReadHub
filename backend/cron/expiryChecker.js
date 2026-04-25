/**
 * cron/expiryChecker.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Background jobs for managing Ebook rentals:
 * 1. Notification sender (48 hours before expiry)
 * 2. Revoke expired rentals (cleanup/stats)
 */

const cron = require('node-cron');
const { poolPromise } = require('../db');

function startCronJobs() {
    console.log('⏰ Starting Cron Jobs for Ebook Rentals...');

    // Run every hour to check for rentals expiring in the next 48 hours
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('Running rental expiry notification check...');
            const pool = await poolPromise;
            
            // Get rentals that expire in <= 48 hours and haven't been notified yet
            const result = await pool.request().execute('sp_GetRentalsForNotification');
            const rentalsToNotify = result.recordset;

            for (const rental of rentalsToNotify) {
                // Here we would typically send an email. For now, we simulate it.
                console.log(`[NOTIFICATION] Sending email to ${rental.Email}: Your rental for "${rental.Title}" expires on ${new Date(rental.DueDate).toLocaleString()}.`);
                
                // Mark as notified in the database
                await pool.request()
                    .input('RentalID', require('mssql').INT, rental.RentalID)
                    .execute('sp_MarkRentalNotified');
            }
        } catch (err) {
            console.error('Error in notification cron job:', err);
        }
    });

    // Run daily at midnight to log expired rentals (Access is auto-revoked via the SP logic dynamically)
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('Running expired rentals cleanup/stats...');
            const pool = await poolPromise;
            const result = await pool.request().execute('sp_RevokeExpiredRentals');
            
            console.log(`[RENTALS] Total expired rentals in system: ${result.recordset[0]?.ExpiredCount || 0}`);
        } catch (err) {
            console.error('Error in expiry cron job:', err);
        }
    });
}

module.exports = { startCronJobs };
