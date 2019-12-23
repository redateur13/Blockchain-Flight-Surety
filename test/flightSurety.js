const Test = require('../config/testConfig.js');

contract('Flight Surety Tests', async (accounts) => {

    let flightSuretyData, flightSuretyApp, testAddresses, firstAirline, weiMultiple
    before('setup contract', async () => {
        ({ flightSuretyData, flightSuretyApp, firstAirline, weiMultiple } = await Test.Config(accounts));
        await flightSuretyData.authorizeCaller(flightSuretyApp.address);
    });

    const [, , secondAirline, thirdAirline, fourthAirline, fifthAirline] = accounts;

    const STATUS_CODE_UNKNOWN = 0;

    it(`(multiparty) has correct initial isOperational() value`, async function () {
        const status = await flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");
    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
        let accessDenied = false;
        try {
            await flightSuretyData.setOperatingStatus(false, { from: testAddresses[2] });
        } catch(e) {
            accessDenied = true;
        }

        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
        let accessDenied = false;
        try {
            await flightSuretyData.setOperatingStatus(false);
        } catch(e) {
            accessDenied = true;
        }

        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
        await flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await flightSuretyData.authorizeCaller(flightSuretyApp.address);
        } catch(e) {
            reverted = true;
        }

        assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

        await flightSuretyData.setOperatingStatus(true);
    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
        try {
            await flightSuretyApp.registerAirline(secondAirline, { from: firstAirline });
        } catch(e) {
            if (!e.message.includes('Only funding completed airline can proceed.')) throw e;
        }
        const { 0: isRegistered } = await flightSuretyData.getAirline.call(secondAirline);

        assert.equal(isRegistered, false, "Airline should not be able to register another airline if it hasn't provided funding");
    });

    it('(airline) should subimit funding of 10 ether before using registerAirline()', async () => {
        await flightSuretyApp.provideFunding({ from: firstAirline, value: weiMultiple * 10 });

        await flightSuretyApp.registerAirline(secondAirline, { from: firstAirline });
        const { 0: isRegistered } = await flightSuretyData.getAirline.call(secondAirline);

        assert.equal(isRegistered, true, "New airline should be registerd");
    });
 
    it('(airline) can provide funding immediately until there are 4 airlines', async () => {
        let isRegistered, neededVotingCount, fundingAmount;
        await flightSuretyApp.provideFunding({ from: secondAirline, value: weiMultiple * 10 });
        await flightSuretyApp.registerAirline(thirdAirline, { from: secondAirline });
        ({ 0: isRegistered, 1: neededVotingCount, 3: fundingAmount } = await flightSuretyData.getAirline.call(thirdAirline));

        assert.equal(isRegistered, true, "New airline should be registerd");
        assert.equal(neededVotingCount, 0, "New airline does not need voting");
        assert.equal(fundingAmount, 0, "New airline hasn't provide funding");

        await flightSuretyApp.provideFunding({ from: thirdAirline, value: weiMultiple * 10 });
        await flightSuretyApp.registerAirline(fourthAirline, { from: thirdAirline });
        ({ 0: isRegistered, 1: neededVotingCount, 3: fundingAmount } = await flightSuretyData.getAirline.call(fourthAirline));

        assert.equal(isRegistered, true, "New airline should be registerd");
        assert.equal(neededVotingCount, 0, "New airline does not need voting");
        assert.equal(fundingAmount, 0, "New airline hasn't provide funding");

        await flightSuretyApp.provideFunding({ from: fourthAirline, value: weiMultiple * 10 });
    });

    it('(airline) fifth airline cannot provide funding immediately until getting multi-party consensus', async () => {
        await flightSuretyApp.registerAirline(fifthAirline, { from: fourthAirline });

        const { 0: isRegistered, 1: neededVotingCount, 2: votingCount, 3: fundingAmount } =
            await flightSuretyData.getAirline.call(fifthAirline);

        assert.equal(isRegistered, true, "New airline should be registerd");
        assert.equal(neededVotingCount, 2, "New airline requires multi-party consensus of 50% of registered airlines");
        assert.equal(votingCount, 0, "New airline's current voting count should be 0");
        assert.equal(fundingAmount, 0, "New airline hasn't provide funding");

        let reverted = false
        try {
            await flightSuretyApp.provideFunding({ from: fifthAirline, value: weiMultiple * 10 });
        } catch(e) {
            reverted = true
        }

        assert.equal(reverted, true, 'Registration of fifth and subsequent airlines requires multi-party consensus before provide funding');
    });

    it('(airline) funding completed airline can vote for another airline (not duplicated)', async () => {
        const [, , , thirdAirline, , fifthAirline] = accounts;
        
        await flightSuretyApp.voteForAirline(fifthAirline, { from: thirdAirline });

        let duplicated = false;
        try {
            await flightSuretyApp.voteForAirline(fifthAirline, { from: thirdAirline });
        } catch(e) {
            duplicated = true
        }
        assert.equal(duplicated, true, "Not allwoed duplicated voting");

    });

    it('(airline) can provide funding after reaching multi-party consensus', async () => {
        const [, , , , fourthAirline, fifthAirline] = accounts;

        await flightSuretyApp.voteForAirline(fifthAirline, { from: fourthAirline });
        const { 1: neededVotingCount, 2: votingCount } = await flightSuretyData.getAirline.call(fifthAirline);

        assert.equal(neededVotingCount.toNumber(), votingCount.toNumber(), "Fifth airline should olready get multi-party consensus");

        await flightSuretyApp.provideFunding({ from: fifthAirline, value: weiMultiple * 10 });
    })

    it('(flight) funding completed airline can regsiter flight', async () => {
        const flight = 'N707'
        const timestamp = Math.floor(Date.now() / 1000);

        await flightSuretyApp.registerFlight(flight, timestamp, { from: firstAirline });
        const { 0: isRegistered, 1: statusCode, 2: canBuyInsurance} =
            await flightSuretyData.getFlight(firstAirline, flight, timestamp);

        assert.equal(isRegistered, true, "Flight not registered");
        assert.equal(statusCode, STATUS_CODE_UNKNOWN, "Flight status should be unknown");
        assert.equal(canBuyInsurance, true, "Flight insurance can be purchased");
    })

});
