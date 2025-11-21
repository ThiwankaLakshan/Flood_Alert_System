const riskCalculator = require('./services/riskCalculator');
const RiskCalculator = require('./services/riskCalculator');

async function testRiskCalculator() {
    try {
        console.log('Testing risk calculator...\n');

        //calculate for location 1( wellampitiya - low elevation)
        console.log('Testing Locaction 1(wellampitiya)');
        const risk1 = await RiskCalculator.calculateRisk(1);

        if(risk1) {
            console.log(`Risk Level: ${risk1.riskLevel}`);
            console.log(`Risk Score: ${risk1.riskScore}`);
            console.log(`Action: ${risk1.recommendedAction}`);
            console.log(`Factors: ${JSON.stringify(risk1.factors, null, 2)}`);
        }

        console.log('Risk Calculator test successful!');
        process.exit(0);

    } catch (error) {
        console.error('Test Failed: ',error);
        process.exit(1);
    }
}

testRiskCalculator();