const { ethers } = require("hardhat");

const networkConfig = {
    5: {
        name: "Goerli",
        VRFCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        //we are gonna make  entranceFee dynamic meaning if we are on a expensive chain then entranceFee will be more
        entranceFee: ethers.utils.parseEther("0.02"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: "0",
        callbackGasLimit: "5000000",
        interval: "30", //30 seconds
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.1"),
        //for hardhat our mock don't care about what gas lane we're working on because we're gonna be mocking gaslane anyways
        //so we can use Goerli's gas lane bytes code
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        callbackGasLimit: "5000000",
        interval: "30", //30 seconds
    },
};

const DevelopmentChains = ["hardhat", "localhost"];
module.exports = { DevelopmentChains, networkConfig };
