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
              raffleentranceFee = await raffle.getentranceFee();
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
                  //In order to make it reject the entrance we have to make rafflestate = CALCULATING, but how do we change the raffle state??
                  //we are gonna make checkupkeep return true and then we are gonna make performUpkeep wich will then change the raffle state to calculating

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
                  //Now we're gonna call checkUpKeep, but since checkUpkeep is a publlic function so it'll cost us some gas and it'll start a transaction if we call it like this
                  // await raffle.checkUpkeep([]), but we don't want to spend gas to call it, if it was public view function then it wouldn't cost any gas or transaction
                  //so we can get around this problem by simulating calling this function we can do this by using "callstaic"

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
                  //The reason we're not calling check upkeep here is because in performUpkeep in raffle.sol we're already calling checkUpkeep there so no need here.
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

          describe("fullfillrandomWords", function () {
              // here we are gonna make another before each because we want someone to enter in our raffle before we run any it.
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleentranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
              });
              //wayyyy to big test
              it("picks a winner, resets the lottery, and sends money", async function () {
                  //we're gonna have additional people entring our lottery.
                  const additional_entrance = 3;
                  const startingAccountIndex = 1; //since deployer is account = 0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additional_entrance;
                      i++
                  ) {
                      const otheraccountsConnectedRaffle = await raffle.connect(accounts[i]);
                      await otheraccountsConnectedRaffle.enterRaffle({ value: raffleentranceFee });
                  }
                  const startingTimeStamp = await raffle.getLatesttimestamp();
                  //we want to perform performupkeep (mock being chainlink keepers),
                  //which will kickoff calling fullfillRandomWords() (and we're gonna mock doing that as well)(mock being the chainlink VRF)
                  //once we do that we can then check does recent winner get recorded, does raffle get reset and etc . But we wanna do this in a specific way.
                  // if we are on a testnet then we'll have to wait for the fulfillRandomWords to be called.But since we're working on hardhat locally therefore we don't have to wait for anything .
                  //But this time we're not gonna fastforward time, rather we'll wait for the time to finish and that event to be called. so inorder to simmulate waiting for that event we'll set up a listner(again).
                  //Now once we set up the listner we don't want the test to finish before listner is done listening. Therefore we once agian need to create a new promise.
                  //If this promise seems going a bit backward or in reverse direction then watch its explanation at 15.56.49
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event!");
                          try {
                              const recenntWinner = await raffle.getrecentWinner();
                              console.log(recenntWinner);
                              console.log(accounts[2].address);
                              console.log(accounts[0].address);
                              console.log(accounts[1].address);
                              console.log(accounts[3].address);
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatesttimestamp();
                              const numPlayers = await raffle.getNumberofPlayers();
                              const winnerEndingBalance = await accounts[1].getBalance();
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      raffleentranceFee
                                          .mul(additional_entrance)
                                          .add(raffleentranceFee)
                                          .toString()
                                  )
                              );
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });
                      //below, we wil fire the event, and the listner will pick it up, and resolve.
                      const tx = await raffle.performUpkeep([]);
                      const txReciept = await tx.wait(1);
                      const winnerStartingBalance = await accounts[1].getBalance();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReciept.events[1].args.requestID,
                          raffle.address
                      );
                  });
              });
          });
      });
