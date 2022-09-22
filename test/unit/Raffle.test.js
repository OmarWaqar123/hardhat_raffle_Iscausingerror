const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { DevelopmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!DevelopmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let raffle, vrfCoordinatorV2Mock, raffleentranceFee, deployer, interval;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              raffle = await ethers.getContract("Raffle", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              raffleentranceFee = raffle.getentranceFee();
              interval = await raffle.getInterval();
          });

          describe("Constructor", function () {
              it("Initializes the raffle Correctly", async function () {
                  //Ideally we make our tests have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState(); //we are calling the getter function at the end of the Raffle.sol
                  assert.equal(raffleState.toString(), "0"); //raffleState is gonna be of type BgNummber so that's why we have converted it to string
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", function () {
              it("Revert when you don't Pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  );
              });

              it("Records Players when they enter into raffle", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  const playerFromContract = await raffle.getPlayers(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits event when entered", async function () {
                  await expect(raffle.enterRaffle({ value: raffleentranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  );
              });
              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  // we're gonna pretend to be chainlink keeper here and call performUpKeep
                  await raffle.performUpkeep([]); // by blankarray we're passing blank call data
                  // Now, the raffleState should be CALCULATING
                  await expect(raffle.enterRaffle({ value: raffleentranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  );
              });
          });

          describe("CheckUpKeep", function () {
              it("returns false if people haven't send any eth", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);

                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(!upKeepNeeded);
              });

              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep([]);
                  const raffleState = await raffle.getRaffleState();
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upKeepNeeded, false);
              });

              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]);
                  await network.provider.send("evm_mine", []);
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(!upKeepNeeded);
              });
              it("returns true if enough time  has passed, has players, eth, and isOpen", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert(upKeepNeeded);
              });
          });

          describe("PerformUpKeep", function () {
              it("It can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await raffle.performUpkeep([]);
                  assert(tx);
              });
              //   important thing to note here is explained in readme2.md at point 10
              it("It should revert an error if upkeep is not not true", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotneeded"
                  );
              });

              it("updates the raffle state, emits an event and calls the vrf coordinate function", async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep([]);
                  const txReciept = await txResponse.wait(1);
                  const requestId = await txReciept.events[1].args.requestID;
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert(raffleState.toString() == "1");
              });
          });
      });
