const cron = require('node-cron');
const weatherService = require('./weatherService');
const pool = require('../config/database');

class Scheduler {
  start() {
    console.log('Starting scheduled jobs...');
    
    // Fetch weather every 30 minutes
    // Cron format: minute hour day month day-of-week
    // '*/30 * * * *' = every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('Running scheduled weather collection...');
      
      try {
        await weatherService.fetchWeatherForAllLocations();
        
        // Update 24h and 72h rainfall aggregates
        await this.updateRainfallAggregates();
        
        console.log('Scheduled weather collection completed');
        
      } catch (error) {
        console.error('Scheduled job error:', error);
        
        // Log error to database
        await this.logError(error);
      }
    });
    
    console.log('Scheduler started - weather will be collected every 30 minutes');
  }

  async updateRainfallAggregates() {
    console.log('Updating rainfall aggregates...');
    
    try {
      // Get all locations
      const locationsResult = await pool.query('SELECT id FROM locations');
      const locations = locationsResult.rows;
      
      for (const location of locations) {
        // Calculate 24h rainfall
        const rainfall24h = await pool.query(`
          SELECT COALESCE(SUM(rainfall_1h), 0) as total
          FROM weather_data
          WHERE location_id = $1
          AND timestamp >= NOW() - INTERVAL '24 hours'
        `, [location.id]);
        
        // Calculate 72h rainfall
        const rainfall72h = await pool.query(`
          SELECT COALESCE(SUM(rainfall_1h), 0) as total
          FROM weather_data
          WHERE location_id = $1
          AND timestamp >= NOW() - INTERVAL '72 hours'
        `, [location.id]);
        
        // Update latest weather record
        await pool.query(`
          UPDATE weather_data
          SET rainfall_24h = $1, rainfall_72h = $2
          WHERE location_id = $3
          AND id = (
            SELECT id FROM weather_data
            WHERE location_id = $3
            ORDER BY timestamp DESC
            LIMIT 1
          )
        `, [
          rainfall24h.rows[0].total,
          rainfall72h.rows[0].total,
          location.id
        ]);
      }
      
      console.log('Rainfall aggregates updated');
      
    } catch (error) {
      console.error('Error updating aggregates:', error);
      throw error;
    }
  }

  async logError(error) {
    const query = `
      INSERT INTO system_logs (log_type, message, metadata)
      VALUES ($1, $2, $3)
    `;
    
    const values = [
      'ERROR',
      error.message,
      JSON.stringify({ stack: error.stack, timestamp: new Date() })
    ];
    
    try {
      await pool.query(query, values);
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  }
}

module.exports = new Scheduler();