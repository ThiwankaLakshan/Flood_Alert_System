const axios = require('axios');
const pool = require('../config/database');
const logger = require('../config/logger');
const { log } = require('winston');
require('dotenv').config();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

class WeatherService {
  // Function 1: Single location
  async fetchWeatherForLocation(latitude, longitude, locationId) {
        try {
            if (!OPENWEATHER_API_KEY)
            {
                throw new Error('OPENWEATHER_API_KEY not configured in .env');
            }

            logger.debug(`Fetching weather for location ${locationId} (${latitude}, ${longitude})`);

            const response = await axios.get(OPENWEATHER_BASE_URL, {
                params: {
                    lat: latitude,
                    lon: longitude,
                    appid: OPENWEATHER_API_KEY,
                    units: 'metric'
                }
            });

            const data = response.data;

            //extract relevant data
            const weatherData = {
                locationId,
                timestamp : new Date(),
                temperature: data.main.temp,
                humidity: data.main.humidity,
                rainfall_1h: data.rain ? data.rain['1h'] || 0 : 0,
                windSpeed: data.wind.speed,
                pressure : data.main.pressure,
                weatherCondition: data.weather[0].description 
            };

            //save to database
            await this.saveWeatherData(weatherData);

            logger.info(`weather data fetched for location ${locationId}: ${weatherData.temperature}°C, ${weatherData.rainfall_1h}mm rain`);

            return weatherData;

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                logger.error(`Timeout fetching weather for location ${locationId}`);
                throw new Error('Weather API timeout');
            } else if (error.response) {
                //API returned an error
                logger.error(`API error for location ${locationId}:`, {
                    status: error.response.status,
                    message: error.response.data?.message
                });

                if (error.response.status === 401) {
                    throw new Error('Invalid operWeather API key');
                } else if (error.response.status === 429) {
                    throw new Error('Weather API rate limit exceeded');
                }

                throw new Error(`weather API error: ${error.response.status}`);
            } else if (error.request) {
                logger.error(`No response from weather API for location ${locationId}`);
                throw new Error('Weather API not responding');
            } else {
                logger.error(`Error fetching weather for location ${locationId}:`, error.message);
                throw error;
            }
        }
    }

  // Function 2: ALL locations
  async fetchWeatherForAllLocations() {
    logger.info('Starting weather data collection for all locations');
        try {
            //get all locations
            const locationsResult = await pool.query('SELECT id, latitude, longitude, name FROM locations');
            const locations = locationsResult.rows;

            logger.info(`Fetching weather for ${locations.length} locations...`);

            let successCount = 0;
            let failureCount = 0;

            //fetch weather for each location
            for (const loc of locations) {
                try {
                    await this.fetchWeatherForLocation(loc.latitude, loc.longitude, loc.id);
                    successCount++;

                    await this.sleep(1000);
                } catch (error) {
                    failureCount++;
                    logger.info(`Failed to fetch weather for ${loc.name} (ID: ${loc.id}):`, error.message);
                }
            }

            logger.info(`Weather collection complete: ${successCount} suceeded, ${failureCount} failed`);

            return { success: successCount, failed: failureCount};

        } catch (error) {
            logger.error('fatal error in weather collection: ' , error);
            throw error;
        }
    }

  // Function 3: Save data
  async saveWeatherData(data) {
        const query = `
        INSERT INTO weather_data
        (location_id, timestamp, temperature, humidity, rainfall_1h, wind_speed, pressure, weather_condition)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        `;

        const values = [
            data.locationId,
            data.timestamp,
            data.temperature,
            data.humidity,
            data.rainfall_1h,
            data.windSpeed,
            data.pressure,
            data.weatherCondition
        ];

        try {
            const result = await pool.query(query, values);
            logger.debug(`Weather data saved to database, ID: ${result.rows[0].id}`);
            return result.rows[0].id;
        } catch (error) {
            logger.error('Error saving weather data:', error)
            throw error;
        }
    }

  // Function 4: Helper
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new WeatherService();