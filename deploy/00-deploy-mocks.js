const { network } = require("hardhat");
const { DevelopmentChains, networkConfig } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. It costs 0.25 LINK per request
const GAS_PRICE_LINK = 1e9; //1000000000  // also called link per gas

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
