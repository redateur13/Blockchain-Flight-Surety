import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    isOperational(callback) {
        const self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner }, callback);
    }

    purchaseInsurance(flight, timestamp, amount) {
        const self = this;
        const payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: timestamp,
            amount
        } 
        let gas;
        return self.flightSuretyApp.methods.purchaseInsurance(payload.airline, payload.flight, payload.timestamp).estimateGas({ from: self.owner, value: this.web3.utils.toWei(payload.amount, 'ether') })
            .then(ret => { 
                gas = ret;
                return self.flightSuretyApp.methods.purchaseInsurance(payload.airline, payload.flight, payload.timestamp)
                    .send({ from: self.owner, value: this.web3.utils.toWei(payload.amount, 'ether'), gas })
            })
            .then(() => payload);
    }

    fetchFlightStatus(flight, timestamp, callback) {
        const self = this;
        const payload = {
            airline: self.airlines[0],
            flight,
            timestamp
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner }, (error) => {
                callback(error, payload);
            });
    }

    chargeInsurance() {
        const self = this;
        return self.flightSuretyApp.methods
            .chargeInsurance()
            .send({ from: self.owner })
    }
}