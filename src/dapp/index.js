import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';
import { flights } from './config.json';

(async() => {
    const contract = new Contract('localhost', () => {

        // Read transaction & Display flights for purchasing insurance
        contract.isOperational((error, result) => {
            display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result}]);
        });

        const flightData = flights.map((flight, index) => {
            return { index: (index + 1).toString(), value: `${flight.number} / ${new Date(flight.timestamp * 1000)}` }
        })

        // Choose from a fixed list of flight numbers and departure. Purchase flight insurance
        displayFlight('Flights', 'Select flight and purchase insurance', flightData);
        
        DOM.elid('purchase-insurance').addEventListener('click', () => {
            const flightData = DOM.elid('flight-number-timestamp').value;
            if (!flightData) return alert('Select flight first');

            const [flight, flightTimestamp] = flightData.split('/');
            const timestamp = new Date(flightTimestamp).getTime();
            const amount = DOM.elid('insurance-amount').value;
            if (!amount) return alert('Input amount');
            if (amount > 1) return alert('Pay up to 1 ether');
            
            contract.purchaseInsurance(flight, timestamp, amount)
                .then(result => displayFlightInsurance('Flight Insurance Result', { value: `${result.flight} ${result.timestamp}: ${result.amount} ether` }))
                .catch(error => {
                    alert('Cannot purchase insurance twice!!');
                    console.error(error)
                });
        });

        displayFlightToFetch('Flights To Fetch', 'Select flight to sumbit to Oracles', flightData);

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            const flightData = DOM.elid('flight-fetch').value;
            if (!flightData) return alert('Select flight first');

            const [flight, flightTimestamp] = flightData.split('/');
            const timestamp = new Date(flightTimestamp).getTime();

            // Write transaction
            contract.fetchFlightStatus(flight, timestamp, (error, result) => {
                displayFetch('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })
    
        // Charge insurance
        DOM.elid('charge-insurance').addEventListener('click', () => {
            contract.chargeInsurance()
                .then(() => displayChargeInsurance('Charge Insurance is completed'))
                .catch(error => {
                    alert('All repayment was already completed');
                    console.error(error)
                });
        });
    });

})();

function display(title, description, results) {
    const displayDiv = DOM.elid("is-operational");
    const section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-2 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

function displayFlight(title, description, results) {
    const displayDiv = DOM.elid("flight-number-timestamp-selection");
    const section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    const row = section.appendChild(DOM.select({ id: 'flight-number-timestamp' }));
    row.appendChild(DOM.option({ label: '======== Select flight to purchase insurance =========' }));
    results.map((result) => {
        row.appendChild(DOM.option({ value: result.value }, `${result.index}. ${result.value}` ));
    })
    displayDiv.append(section);
}

function displayFlightInsurance(title, result) {
    const displayDiv = DOM.elid("flight-insurance-list");
    const section = DOM.section();
    section.appendChild(DOM.h2(title));
    const row = section.appendChild(DOM.div({className:'row'}));
    row.appendChild(DOM.div({className: 'col-sm-12 field-value'}, String(result.value)));
    section.appendChild(row);
    displayDiv.append(section);
}

function displayFlightToFetch(title, description, results) {
    const displayDiv = DOM.elid("fetch-flight");
    const section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    const row = section.appendChild(DOM.select({ id: 'flight-fetch' }));
    row.appendChild(DOM.option({ label: '======== Select flight to fetch =========' }));
    results.map((result) => {
        row.appendChild(DOM.option({ value: result.value }, `${result.index}. ${result.value}` ));
    })
    displayDiv.append(section);
}

function displayFetch(title, description, results) {
    const displayDiv = DOM.elid("display-fetch");
    const section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-2 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

function displayChargeInsurance(title) {
    const displayDiv = DOM.elid("charge-insurance-result");
    const section = DOM.section();
    section.appendChild(DOM.h2(title));
    const row = section.appendChild(DOM.div({className:'row'}));
    section.appendChild(row);
    displayDiv.append(section);
}




