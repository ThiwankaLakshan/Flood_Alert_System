const riskRules = require('../config/riskRules');
const pool = require('../config/database');
const { level } = require('winston');

class RiskCalculator {

    //calculate risk for a location
    async calculateRisk(locationId) {
        try {
            //get location details
            const locationResult = await pool.query(
                'SELECT * FROM locations WHERE id = $1',
                [locationId]
            );

            if (locationResult.rows.length === 0) {
                throw new Error(`Location ${locationId} not found`);
            }

            const location = locationResult.rows[0];

            //get latest weather data
            const weatherResult = await pool.query(
                `SELECT * FROM weather_data
                WHERE location_id = $1
                ORDER BY timestamp DESC
                LIMIT 1`,
                [locationId]
            );

            if (weatherResult.rows.length === 0) {
                return null;
            }

            const weather = weatherResult.rows[0];

            //get historical floods for this location
            const floodResult = await pool.query(
                `SELECT * FROM historical_floods
                WHERE location_id = $1
                AND flood_date >= CURRENT_DATE - INTERVAL '5 years'`,
                [locationId]
            );

            const historicalFloods = floodResult.rows;

            //calculate risk score
            const riskAssessment = this.computeRiskScore(location, weather, historicalFloods);

            //save to database
            await this.saveRiskAssessment(locationId, riskAssessment, weather);

            return riskAssessment;

        } catch (error) {
            console.error(`Error calculating risk for location ${locationId}:`, error);
            throw error;
        }
    }

    //conpute risk based on all factors

    computeRiskScore(locaction, weather, historicalFloods) {
        let totalScore = 0;
        const factors = [];

        //factor 1: 24h rainfall
        const rainfall24hScore = this.scoreRainfall(
            weather.rainfall_24h,
            riskRules.rainfall.rainfall24h
        );
        if (rainfall24hScore.score > 0) {
            totalScore += rainfall24hScore.score;
            factors.push({ ...rainfall24hScore, factor: 'rainfall_24h' });
        }

        //factor 2: 72h rainfall
        const rainfall72hScore = this.scoreRainfall(
            weather.rainfall_72h,
            riskRules.rainfall.rainfall72h
        );
        if (rainfall72hScore.score > 0) {
            totalScore += rainfall72hScore.score;
            factors.push({ ...rainfall72hScore,factor: 'rainfall_72h'});
        }

        //factor 3: elevation
        const elevationScore = this.scoreElevation(locaction.elevation);
        if (elevationScore.score > 0) {
            totalScore += elevationScore.score;
            factors.push({ ...elevationScore, factor: 'elevation'});
        }

        //factor 4: season
        const seasonScore = this.scoreSeason();
        if (seasonScore.score > 0){
            totalScore += seasonScore.score;
            factors.push({ ...seasonScore, factor: 'season'});
        }

        //factor 5: historical floods
        const historicalScore = this.scoreHistoricalFloods(historicalFloods);
        if (historicalScore.score > 0){
            totalScore += historicalScore.score;
            factors.push({ ...historicalScore, factor: 'historical'});
        }

        //determine risk level
        const riskLevel = this.getRiskLevel(totalScore);

        return {
            riskScore: totalScore,
            riskLevel: riskLevel.level,
            riskColor: riskLevel.color,
            recommendedAction: riskLevel.action,
            factors: factors,
            timestamp: new Date()
        };
    }

    //Score rainfall amount

    scoreRainfall(rainfall, rules) {
        if(!rainfall) return { score: 0};

        for (const rule of rules) {
            if (rainfall >= rule.min){
                return {
                    score: rule.score,
                    value: rainfall,
                    label: rule.label
                };
            }
        }
        return { score: 0 };
    }

    //score elevation
    scoreElevation(elevation) {
        if(!elevation) return { score: 0 };

        for (const rule of riskRules.elevation) {
            if (elevation <= rule.max) {
                return {
                    score: rule.score,
                    value: elevation,
                    label: rule.label
                };
            }
        }
        return { score: 0 };
    }

    //score current season
    scoreSeason() {
        const currentMonth = new Date().getMonth() + 1;

        for (const rule of riskRules.season) {
            if (rule.months.includes(currentMonth)) {
                return {
                    score: rule.score,
                    label: rule.label,
                    month: currentMonth
                };
            }
        }
        return { score: 0 };
    }

    //score historical flood frequency

    scoreHistoricalFloods(floods) {
        const floodCount = floods.length;

        for(const rule of riskRules.historicalFlood){
            if (floodCount >= rule.floodsLast5Years) {
                return {
                    score: rule.score,
                    value: floodCount,
                    label: rule.label
                };
            }
        }
        return { score: 0 };
    }

    //get risk level from score
    getRiskLevel(score) {
        for (const level of riskRules.riskLevels){
            if(score >= level.minScore) {
                return level;
            }
        }
        return riskRules.riskLevels[riskRules.riskLevels.length - 1];
    }

    // save risk assessment to database

    async saveRiskAssessment(locationId, assessment, weather){
        const query =  `
        INSERT INTO risk_assessments
        (location_id, timestamp, risk_level, risk_score, factors,
        rainfall_24h,rainfall_72h) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id `;

        const values = [
            locationId,
            assessment.timestamp,
            assessment.riskLevel,
            assessment.riskScore,
            JSON.stringify(assessment.factors),
            weather.rainfall_24h,
            weather.rainfall_72h
        ];

        const result = await pool.query(query, values);
        return result.rows[0].id;
    }

    //calculate risk for all locations
    async calculateRiskForAllLocations() {
        try {
            const locationsResult = await pool.query('SELECT id FROM locations');
            const locations = locationsResult.rows;

            console.log(`Calculating risk for ${locations.length} locations`);

            for (const locaction of locations) {
                try {
                    const risk = await this.calculateRisk(location.id);
                    if (risk) {
                        console.log(`Location ${location.id}: ${risk.riskLevel} (score: ${risk.riskScore})`);
                    }
                } catch (error) {
                    console.error(`Error calculating risk for location ${location.id}: `,error);
                }
            }

            console.log('Risk calculation completed!');
        } catch (error) {
            console.error('Error in calculateRiskForAllLocations: ',error);
        }
    }
}

module.exports = new RiskCalculator();