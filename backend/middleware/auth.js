const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'flood_alert_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function authenticateToken(req, res, next) {
    
    try {

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ success: false,
                error: 'Access Denied.No token provided.'
            });
        }

        const verified = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            `SELECT id, username, email FROM admin_users WHERE id = $1`,
            [verified.id]
        );

        if(result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        req.user = {
            id: result.rows[0].id,
            username : result.rows[0].username,
            email: result.rows[0].email
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                error: 'Token Expired. Please Login again'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                error: 'Invalid Token'
            });
        }

        console.error('Auth middleware error: ', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });

    }
}

module.exports = {
    authenticateToken
};