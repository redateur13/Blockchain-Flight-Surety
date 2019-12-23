const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');
const BigNumber = require('bignumber.js');

module.exports = async (deployer, network, accounts) => {
    if (network === 'development') {
        const firstAirline = accounts[0];
        const fundingAmount = (new BigNumber(10)).pow(19);
        const flights = [
            {
                number: 'N707',
                timestamp: Math.floor(Date.now() / 1000)
            },
            {
                number: 'N714',
                timestamp: Math.floor(Date.now() / 1000) + (60 * 60 * 1000)
            }
        ]

        await deployer.deploy(FlightSuretyData, firstAirline)
        await deployer.deploy(FlightSuretyApp, FlightSuretyData.address)

        const config = {
            localhost: {
                url: 'http://localhost:8545',
                dataAddress: FlightSuretyData.address,
                appAddress: FlightSuretyApp.address
            },
            flights
        }
        fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
        fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');

        const dataContract = await FlightSuretyData.deployed();
        const appContract = await FlightSuretyApp.deployed();

        await dataContract.authorizeCaller(appContract.address);
        await appContract.provideFunding({ from: firstAirline, value: fundingAmount });
        await appContract.registerFlight(flights[0].number, flights[0].timestamp, { from: firstAirline });
        await appContract.registerFlight(flights[1].number, flights[1].timestamp, { from: firstAirline });
    } else {
        console.log('Set network more');
    }
}