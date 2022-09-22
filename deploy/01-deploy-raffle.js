const { network, ethers } = require("hardhat");
const { DevelopmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("10");

module.exports = async function (hre) {
    const { getNamedAccounts, deployments } = hre;
    const { deployer } = await getNamedAccounts();
    const { deploy, log } = deployments;
    const ChainId = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId;

    if (DevelopmentChains.includes(network.name)) {
        const vrfCoordinatorV2mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2mock.address;
        const transactionResponse = await vrfCoordinatorV2mock.createSubscription();
        const trasanctionReceipt = await transactionResponse.wait(1);
        subscriptionId = trasanctionReceipt.events[0].args.subId;
        //Now that we have subscription, we have to fund the subscription
        //Usually, you'd need the link token to fund the subscription on a real network
        await vrfCoordinatorV2mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address = networkConfig[ChainId]["VRFCoordinatorV2"];
        subscriptionId = networkConfig[ChainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[ChainId]["entranceFee"];
    const gasLane = networkConfig[ChainId]["gasLane"];
    const callbackGasLimit = networkConfig[ChainId]["callbackGasLimit"];
    const interval = networkConfig[ChainId]["interval"];
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: [
            vrfCoordinatorV2Address,
            entranceFee,
            gasLane,
            subscriptionId,
            callbackGasLimit,
            interval,
        ],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    if (!DevelopmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying........");
        await verify(raffle.address, args);
    }

    log("------------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
