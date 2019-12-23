import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

const config = Config['localhost'];
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
const flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const oracles = [];
(async () => {
    try {
        const accounts = await web3.eth.getAccounts();
        for (let i = 10; i < 30; i++) {
            const gas = await flightSuretyApp.methods.registerOracle().estimateGas({ from: accounts[i], value: web3.utils.toWei('1', 'ether') });
            await flightSuretyApp.methods.registerOracle().send({ from: accounts[i], value: web3.utils.toWei('1', 'ether'), gas });
            const indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: accounts[i] });
            oracles.push({ address: accounts[i], indexes: indexes.map(index => Number(index)) })
        }
        console.log('\nRegister all oracels and save indexes in memory');
        console.log(oracles);
    } catch(e) {
        console.error(e);
    }
})()

function getStatusCode(airline, flight, timestamp) {
    const statusCodes = [0, 10, 20, 30, 40, 50];
    return statusCodes[Math.floor(Math.random() * 11 % 6)]
}

async function updateFlightStatus({ returnValues: { index, airline, flight, timestamp } }) {
    console.log(`\nUpdating flight status\n index: ${index}, airline: ${airline}, flight: ${flight}, timestamp: ${timestamp}`);
    
    try {
        await Promise.all(oracles
            .filter(oracle => oracle.indexes.includes(Number(index)))
            .map(async ({ address }) => {
                const statusCode = getStatusCode(airline, flight, timestamp);
                const gas = 150000;
                console.log(`Oracle Address: ${address}, Status Code: ${statusCode}, Gas: ${gas}`);
                flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode).send({ from: address, gas })
            })
        )
        console.log('Flight status is updated');
    }catch(e) {
        console.error(e);
    }
}

flightSuretyApp.events.OracleRequest({ fromBlock: 0 })
    .on('data', updateFlightStatus)
    .on('changed', () => console.log('Oracle requerset event is removed. Check contract'))
    .on('error', console.error)

const app = express();
app.get('/api', (req, res) => {
    res.send({
        message: 'API for use with your Dapp!'
    })
})

export default app;