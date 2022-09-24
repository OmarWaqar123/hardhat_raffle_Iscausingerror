const { network } = require("hardhat");
const { DevelopmentChains, networkConfig } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. It costs 0.25 LINK per request
const GAS_PRICE_LINK = 1e9; //1000000000  // also called link per gas
//calculated value based on the gas price of the chain
// If we were to request a random number on ethereum, and if the price of ethereum is skyrocketed up to like
//$1,000,000,00 then gas will be incredebly expensive, now when chainlink responds ,chainlink nodes pay the gas fee to give us randomness
// and do external execution, so basically the price of requests change based on the price of gas

module.exports = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const { log, deploy } = deployments;
    const chainId = network.config.chainId;

    if (DevelopmentChains.includes(network.name)) {
        log("local network detected Deploying Mocks.....");
        // deploy a mock vrfCoordinator

        await deploy("VRFCoordinatorV2Mock", {
            log: true,
            from: deployer,
            args: [BASE_FEE, GAS_PRICE_LINK],
        });

        log("Mocks Deployed!");
        log("-------------------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
