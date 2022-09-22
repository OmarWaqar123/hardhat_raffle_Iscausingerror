//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotneeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
// import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

/** @title A sample Raffle Contract
 * @author Muhammad Omar
 * @notice This contract is for creating an untamperable decentralized smartcontract
 * @dev This implements ChainLink VRF v2 and Chainlink Keepers
 *
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /*Type Declarations */
    enum Rafflestate {
        OPEN,
        CALCULATING
    } //  uint256 0 = OPEN,uint256 1 = CALCULATING

    /* State Variables */
    uint256 private immutable i_entrancefee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfcoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackgaslimit;
    uint32 private constant NUM_WORDS = 1;

    /*Lottery Variables*/
    address private s_recentwinner;
    // bool private s_islotteryopen;
    Rafflestate private s_rafflestate;
    uint256 private s_LastTimeStamp;
    uint256 private immutable i_interval;

    /*Events*/
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestID);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(
        address VRFCoordinatorV2, //contract address
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(VRFCoordinatorV2) {
        i_entrancefee = entranceFee;
        i_vrfcoordinator = VRFCoordinatorV2Interface(VRFCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackgaslimit = callbackGasLimit;
        s_rafflestate = Rafflestate.OPEN;
        s_LastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        // require (msg.value > i_entranceFee,"Not enough ETH")
        if (msg.value < i_entrancefee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_rafflestate != Rafflestate.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        //Events are emitted at the data storage outside the smart contract
        emit RaffleEnter(msg.sender);
    }

    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        override
        returns (
            bool upKeepNeeded,
            bytes memory /*performData */
        )
    {
        bool isOpen = (Rafflestate.OPEN == s_rafflestate);
        bool timepassed = ((block.timestamp - s_LastTimeStamp) > i_interval);
        bool hasplayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upKeepNeeded = (isOpen && timepassed && hasplayers && hasBalance);
    }

    function performUpkeep(
        /*RequestRandomWinner*/
        bytes calldata /*performData*/
    ) external override {
        (bool upKeepNeeded, ) = checkUpkeep("");

        if (!upKeepNeeded) {
            revert Raffle__UpkeepNotneeded(
                address(this).balance,
                s_players.length,
                uint256(s_rafflestate)
            );
        }
        s_rafflestate = Rafflestate.CALCULATING;

        uint256 requestId = i_vrfcoordinator.requestRandomWords(
            i_gasLane, //or keyHash
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackgaslimit,
            NUM_WORDS
        );
        //This is redundant
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexofWinner = randomWords[0] % s_players.length; //this will give us number between 0 and 10
        address payable recentWinner = s_players[indexofWinner];
        s_recentwinner = recentWinner;
        s_rafflestate = Rafflestate.OPEN;
        s_players = new address payable[](0);
        s_LastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        //require(success)
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* View / Pure functions */

    function getrecentWinner() public view returns (address) {
        return s_recentwinner;
    }

    function getentranceFee() public view returns (uint256) {
        return i_entrancefee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRaffleState() public view returns (Rafflestate) {
        return s_rafflestate;
    }

    function getNumwords() public pure returns (uint256) {
        return NUM_WORDS;
        //since NUM_WORDS is in the bytecode since it is a constant variable and technically it is not reading from storage therefore
        //this can be a pure function instead of view function
    }

    function getNumberofPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatesttimestamp() public view returns (uint256) {
        return s_LastTimeStamp;
    }

    function getRequestConfirmation() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
