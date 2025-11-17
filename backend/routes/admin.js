const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'flood_alert_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const router = express.Router();

router.post('/login', async (req,res) => {
    try {
        const { username, password } = req.body;

        if(!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        const result = await pool.query(
            'SELECT * FROM admin_users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid Username or password'});
        }

        const admin = result.rows[0];

        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            return res.status(401).json({ 
                error: 'Invalid Password'
            });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message:'Login Successful!',
            token,
            user: {
                id: admin.id,
                username: admin.username,
                email: admin.email
            }
        });

    } catch (error) {
        console.error('Login error: ',error);
        res.status(500).json({ error: 'Login failed'});
    }
});


//verify token
router.get('/verify', authenticateToken, (req,res) => {
    console.log('Token verified for user: ',req.user.username);
    res.json({
        user: req.user
    });
});




module.exports = router;