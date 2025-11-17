const axios = require('axios');

const API_URL = 'http://localhost:5000';

async function testAuth() {
    try {
        console.log('Testing Admin Authentication...\n');

        //test 1: login
        console.log('Testing login');
        const loginResponse = await axios.post(`${API_URL}/api/admin/login`, {
            username: 'admin',
            password: 'Admin@123'
        });

        console.log('Login Successful!');
        console.log('Token: ', loginResponse.data.token.substring(0, 30) + '...');
        console.log('User: ',loginResponse.data.user.username);

        const token = loginResponse.data.token;

        //test 2: verify token
        console.log('\n Testing token verification...');
        const verifyResponse = await axios.get(`${API_URL}/api/admin/verify`, {
            headers: {Authorization: `Bearer ${token}`}
        });
    } catch (error) {
        console.error('Test failed: ',error.response?.data || error.message);
    }
}

testAuth();