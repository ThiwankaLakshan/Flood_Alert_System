const { Pool } = require('pg');
const logger = require('./logger');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});


pool.on('connect', () => {
    console.log('Database connected successfully!');
});

pool.on('error', (err) => {
    console.log('Database connection error: ', err)
});

//handle pool errors
pool.on('error', (err) => {
    logger.error('Unexpected database error:', err);
});

//wrapper function for safe queries
async function query(text, params) {
    const start = Date.now();

    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        logger.debug('Executed query', {
            text,
            duration,
            rows: result.rowCount
        });

        return result;

    } catch (error) {
        logger.error('Database query error: ', {
            query: text,
            params,
            error: error.message,
            stack: error.stack
        });

        throw error;
    }
}

module.exports = {
    query,
    pool
};