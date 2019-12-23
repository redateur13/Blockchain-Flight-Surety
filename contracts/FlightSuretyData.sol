pragma solidity 0.5.8;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract FlightSuretyData
{
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping (address => bool) private authorizedCallers;

    uint256 private constant neededFundingAmountForAirline = 10 ether;

    struct Flight
    {
        bool isRegistered;
        uint8 statusCode;
        uint256 timestamp;
        address airline;
        bool canBuyInsurance;
    }
    mapping(bytes32 => Flight) private flights;

    struct PassengerPayment
    {
        bool isAlreadyPurchased;
        uint256 amount;
    }
    struct FlightInsurance
    {
        bool haveHistory;
        address[] passengers;
        mapping(address => PassengerPayment) passengerPayments;
    }
    mapping(bytes32 => FlightInsurance) private flightInsurances;

    mapping(address => uint256) passengerRepayments;

    struct airline
    {
        bool isRegistered;
        uint256 neededVotingCount;
        uint256 votingCount;
        mapping(address => bool) voters;
        uint256 fundingAmount;
    }
    mapping(address => airline) airlines;
    uint256 private constant notNeededConsensuAirlinesCount = 4;
    uint256 private registeredAirlinesCount = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) public requireValidAddress(firstAirline)
    {
        contractOwner = msg.sender;

        registeredAirlinesCount = registeredAirlinesCount.add(1);
        airlines[firstAirline] = airline({
            isRegistered: true,
            neededVotingCount: 0,
            votingCount: 0,
            fundingAmount: 0 ether
        });
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireValidAddress(address target)
    {
        require(target != address(0), "Invalid address");
        _;
    }

    modifier requireAuthorizedCaller()
    {
        require(authorizedCallers[msg.sender], "Only authrized caller can call");
        _;
    }

    modifier requireVotingCompletedAirline(address airlineAddress)
    {
        airline storage target = airlines[airlineAddress];
        require(target.isRegistered, "Only registered airline can proceed");
        require(target.votingCount >= target.neededVotingCount, "Only voting completed airline can proceed");
        _;
    }

    modifier requireFundingCompletedAirline(address airlineAddress)
    {
        require(airlines[airlineAddress].fundingAmount >= neededFundingAmountForAirline,
            "Only funding completed airline can proceed");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */

    function isOperational() public view returns(bool)
    {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address oldAirline, address newAirline) external
        requireIsOperational
        requireAuthorizedCaller
        requireFundingCompletedAirline(oldAirline)
        returns(uint256)
    {
        registeredAirlinesCount = registeredAirlinesCount.add(1);

        if (registeredAirlinesCount <= notNeededConsensuAirlinesCount)
        {
            airlines[newAirline] = airline({
                isRegistered: true,
                neededVotingCount: 0,
                votingCount: 0,
                fundingAmount: 0 ether
            });
        } else
        {
            airlines[newAirline] = airline({
                isRegistered: true,
                neededVotingCount: registeredAirlinesCount.div(2),
                votingCount: 0,
                fundingAmount: 0 ether
            });
        }

        return airlines[newAirline].neededVotingCount;
    }


   /**
    * @dev Buy insurance for a flight
    *
    */
    function purchaseInsurance(address passengerAddress, address airlineAddress, string calldata flight, uint256 timestamp)
        external payable
        requireIsOperational
        requireAuthorizedCaller
    {
        bytes32 key = getFlightKey(airlineAddress, flight, timestamp);
        if (flightInsurances[key].haveHistory) {
            require(!flightInsurances[key].passengerPayments[passengerAddress].isAlreadyPurchased,
                "This passenger alreadey purchase this flight insurance");
        } else {
            flightInsurances[key] = FlightInsurance({
                haveHistory: true,
                passengers: new address[](0)
            });
            flightInsurances[key].passengers.push(passengerAddress);
        }
        flightInsurances[key].passengerPayments[passengerAddress] = PassengerPayment({
            isAlreadyPurchased: true,
            amount: msg.value
        });
    }

    /**
     *  @dev Credits payouts to insurees
    */
   function creditInsurees(address airlineAddress, string calldata flight, uint256 timestamp) external
        requireIsOperational
        requireAuthorizedCaller
    {
        bytes32 key = getFlightKey(airlineAddress, flight, timestamp);
        FlightInsurance storage flightInsurance = flightInsurances[key];
        if (flightInsurance.haveHistory)
        {
            for (uint i = 0; i < flightInsurance.passengers.length; i++)
            {
                address passengerAddress = flightInsurance.passengers[i];
                uint256 amount = flightInsurance.passengerPayments[passengerAddress].amount;
                uint256 added = amount.div(2);
                passengerRepayments[passengerAddress] = amount.add(added);
            }
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address payable passenger) external requireIsOperational requireAuthorizedCaller returns(uint256 repayment)
    {
        repayment = passengerRepayments[passenger];
        require(repayment > 0, "All repayment was already completed");
        passengerRepayments[passenger] = 0;
        passenger.transfer(repayment);
    }


   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
     function fund() public payable
    {
    }

    function getFlightKey(address airlineAddress, string memory flight, uint256 timestamp) internal pure returns(bytes32)
    {
        return keccak256(abi.encodePacked(airlineAddress, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable {
        fund();
    }

    function authorizeCaller(address appAddress) external
        requireContractOwner
        requireIsOperational
        requireValidAddress(appAddress)
    {
        authorizedCallers[appAddress] = true;
    }

      function voteForAirline(address voter, address candidate) external
        requireIsOperational
        requireAuthorizedCaller
        requireFundingCompletedAirline(voter)
    {
        airline storage target = airlines[candidate];
        require(!target.voters[voter], "This voter already voted for candidate");

        target.voters[voter] = true;
        target.votingCount = target.votingCount.add(1);
    }

    function provideFunding(address airlineAddress) external payable
        requireIsOperational
        requireAuthorizedCaller
        requireVotingCompletedAirline(airlineAddress)
        returns(uint256 fundingAmount)
    {
        airline storage target = airlines[airlineAddress];
        target.fundingAmount = target.fundingAmount.add(msg.value);
        return target.fundingAmount;
    }

    function getAirline(address airlineAddress) external view returns(bool, uint256, uint256, uint256)
    {
        airline storage target = airlines[airlineAddress];
        return (target.isRegistered, target.neededVotingCount, target.votingCount, target.fundingAmount);
    }

    function registerFlight(address airlineAddress, string calldata flight, uint256 timestamp) external
        requireIsOperational
        requireAuthorizedCaller
        requireFundingCompletedAirline(airlineAddress)
    {
        bytes32 key = getFlightKey(airlineAddress, flight, timestamp);
        flights[key] = Flight({
            isRegistered: true,
            statusCode: 0,
            timestamp: timestamp,
            airline: airlineAddress,
            canBuyInsurance: true
        });
    }

    function getFlight(address airlineAddress, string calldata flight, uint256 timestamp)
        external view returns(bool isRegisered, uint8 statusCode, bool canBuyInsurance)
    {
        bytes32 key = getFlightKey(airlineAddress, flight, timestamp);
        Flight storage target = flights[key];
        return (target.isRegistered, target.statusCode, target.canBuyInsurance);
    }

    function processFlightStatus(address airlineAddress, string calldata flight, uint256 timestamp, uint8 statusCode) external
        requireIsOperational
        requireAuthorizedCaller
    {
        uint256 remainingGas = gasleft();
        bytes32 key = getFlightKey(airlineAddress, flight, timestamp);
        flights[key].statusCode = statusCode;
        remainingGas = gasleft();
    }

}
