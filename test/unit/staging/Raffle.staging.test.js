const { assert } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { DevelopmentChains, networkConfig } = require("../../../helper-hardhat-config");

DevelopmentChains.includes(network.name)
    ? describe.skip
    : describe("raffle staging test", function () {
          let deployer, raffleentranceFee, interval, raffle;
          const ChainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              raffle = await ethers.getContract("Raffle", deployer);
              interval = await raffle.getInterval();
              raffleentranceFee = await raffle.getentranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  //enter the raffle, and we actually don't need to do anything except entering the raffle because chainlink VRF and keepers are gonna kickoff our contract  other fuction for us
                  const startingTimeStamp = await raffle.getLatesttimestamp();
                  const accounts = await ethers.getSigners();
                  //the reason we're getting this accounts variable here is because while asserting we need to check the deployers balance since we're only entering with our deployer. But we can not
                  // do that with the deployer variable we declared above in before each, cause it just won't work so  we're gonna that by accounts[0] which is same as deployer

                  // we wanna enter the raffle by raffle.enterraffle({value: fee}), but we don't wanna do it yet we first have to setup the listner first.
                  //Just incase the blockchain moves REALLY FAST the reason we enteer the raffle before we set up the listner in unit test was because we could blockchain so it was okay there.
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("waiting");
                          console.log("Winner Picked, event fired!");
                          try {
                              const recentWinner = await raffle.getrecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffle.getLatesttimestamp();

                              await expect(raffle.getPlayers(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleentranceFee).toString()
                              );
                              resolve();
                          } catch (e) {
                              reject(e);
                          }
                      });
                      console.log("entering Raffle");
                      const tx = await raffle.enterRaffle({ value: raffleentranceFee });
                      await tx.wait(1);
                      console.log("entered The raffle!");
                      const winnerStartingBalance = await accounts[0].getBalance();

                      //and thats it, this code won't complete until our listner is finish listnening
                  });
              });
          });
      });
