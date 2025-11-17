const express = require('express');
const cors = require('cors');
const scheduler = require('./services/scheduler');
const { timeStamp } = require('console');
const adminRoutes = require('./routes/admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Flood Alert System API',
    status: 'running',
    timestamp: new Date()
   });
});

//health check route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.use('/api/admin', adminRoutes);

//start scheduler
scheduler.start();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Weather data collection active`);
});