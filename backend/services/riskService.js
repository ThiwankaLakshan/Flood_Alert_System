const { query } = require('../config/database');
const logger = require('../config/logger');

class RiskService {

    async calculateRiskForLocation(locationId) {

        //get location data
        const locationResult = await query(
            'SELECT * FROM locations WHERE id = $1',
            [location_id]
        );

        if (locationResult.rows.length === 0) {
            throw new Error(`Location ${locationId} not found`);
        }

        const location = locationResult.rows[0];

        //get latest weather data
        const weatherResult = await query(
            `SELECT * FROM weather_data
            WHERE location_id = $1
            ORDER BY timestamp DESC LIMIT 1`,
            [locationId]
        );

        if (weatherResult.rows.length === 0) {
            logger.warn(`No weather available for location ${locationId}`);
            return null;
        }

        const weather = weatherResult.rows[0];

        //calculate 24h and 72 rainfall
        const rainfall24h = await this.getRainfall(locationId, 24);
        const rainfall72h = await this.getRainfall(locationId, 72);

        //get historical flood count
        const floodCountResult = await query(
            `SELECT COUNT(*) as count FROM historical_floods
            WHERE location_id = $1 AND flood_date > NOW() - INTERVAL '5 years'`,
            [locationId]
        );
        const historicalFloodCount = parseInt(floodCountResult.rows[0].count);

        //calculate risk score
        const riskScore = this.calculateRiskScore({
            rainfall24h,
            rainfall72h,
            elevation: location.elevation,
            historicalFloodCount,
            currentRainfall: weather.rainfall_1h
        });

        const riskLevel = this.getRiskLevel(riskScore);
    }
}