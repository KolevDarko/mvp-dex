const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("@nomicfoundation/hardhat-chai-matchers");

/**
 * @notice auto-grading tests for simpleDEX challenge
 * Stages of testing are as follows: set up global test variables, test contract deployment, deploy contracts in beforeEach(), then actually test out each
 * separate function.
 * @dev this is still a rough WIP. See TODO: scattered throughout.'
 * @dev Harshit will be producing auto-grading tests in one of the next PRs.
 */
describe("🚩 Challenge 3: ⚖️ 🪙 Simple DEX", function () {
  this.timeout(45000);

  let dexContract;
  let balloonsContract;
  let deployer;
  let user2;
  let user3;

  beforeEach(async function () {
    [deployer, user2, user3] = await ethers.getSigners();

    await deployments.fixture(["Balloons", "DEX"]);

    dexContract = await ethers.getContract("DEX", deployer);
    balloonsContract = await ethers.getContract("Balloons", deployer);
  });

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  describe("DEX: Standard Path", function () {
    // TODO: need to add tests that the other functions do not work if we try calling them without init() started.
    /* TODO checking `price` calcs. Preferably calculation test should be provided by somebody who didn't implement this functions in 
    challenge to not reproduce mistakes systematically. */
    describe("init()", function () {
      describe("ethToToken()", function () {
        it("Should send 1 Ether to DEX in exchange for 1 $BAL", async function () {
          let tokensOutExpected = await dexContract.price(
            ethers.utils.parseEther("1"),
            ethers.utils.parseEther("5"),
            ethers.utils.parseEther("5")
          );

          let tx1 = await dexContract.ethToToken({
            value: ethers.utils.parseEther("1"),
          });

          expect(
            await ethers.provider.getBalance(dexContract.address)
          ).to.equal(ethers.utils.parseEther("6"));

          await expect(tx1)
            .emit(dexContract, "EthToTokenSwap")
            .withArgs(
              deployer.address,
              ethers.utils.parseEther("1"),
              tokensOutExpected.toString()
            );
        });

        it("Should send less tokens after the first trade (ethToToken called)", async function () {
          function getTokenAmount(txReceipt) {
            const logDescr = dexContract.interface.parseLog(
              txReceipt.logs.find((log) => log.address === dexContract.address)
            );
            const args = logDescr.args;
            return args[2];
          }
          const tx1 = await dexContract.ethToToken({
            value: ethers.utils.parseEther("1"),
          });
          const r1 = await tx1.wait();

          const tx2 = await dexContract.connect(user2).ethToToken({
            value: ethers.utils.parseEther("1"),
          });
          const r2 = await tx2.wait();

          const tokenAmount1 = getTokenAmount(r1);
          const tokenAmount2 = getTokenAmount(r2);
          expect(tokenAmount1).to.be.greaterThan(tokenAmount2);
          expect(tx1).emit(dexContract, "EthToTokenSwap");
          expect(tx2).emit(dexContract, "EthToTokenSwap");
        });
      });
      describe("tokenToEth", async () => {
        it("Should send 1 $BAL to DEX in exchange for _ $ETH", async function () {
          const balloons_bal_start = await balloonsContract.balanceOf(
            dexContract.address
          );
          let tx1 = await dexContract.tokenToEth(ethers.utils.parseEther("1"));
          await expect(tx1).emit(dexContract, "TokenToEthSwap");
          expect(
            await balloonsContract.balanceOf(dexContract.address)
          ).to.equal(balloons_bal_start.add(ethers.utils.parseEther("1")));
        });

        it("Should send less eth after the first trade (tokenToEth() called)", async function () {
          let tx1 = await dexContract.tokenToEth(ethers.utils.parseEther("1"));
          const tx1_receipt = await tx1.wait();

          let tx2 = await dexContract.tokenToEth(ethers.utils.parseEther("1"));
          const tx2_receipt = await tx2.wait();

          function getEthAmount(txReceipt) {
            const logDescr = dexContract.interface.parseLog(
              txReceipt.logs.find((log) => log.address === dexContract.address)
            );
            const args = logDescr.args;
            return args[1]; // index of ethAmount in event
          }
          const ethSent_1 = getEthAmount(tx1_receipt);
          const ethSent_2 = getEthAmount(tx2_receipt);
          console.log(`Eth 1 ${ethSent_1}, eth 2 ${ethSent_2}`);
          expect(ethSent_2).below(ethSent_1);
        });
      });

      describe("deposit", async () => {
        it("Should deposit 1 ETH and 1 $BAL when pool at 1:1 ratio", async function () {
          const tx1 = await dexContract.deposit(
            (ethers.utils.parseEther("5"),
            {
              value: ethers.utils.parseEther("5"),
            })
          );
          const fiveEthAmount = ethers.utils.parseEther("5");
          await expect(tx1)
            .emit(dexContract, "LiquidityProvided")
            .withArgs(
              deployer.address,
              fiveEthAmount.toString(),
              fiveEthAmount.toString(),
              "5000000000000000001"
            );
        });
      });

      // pool should have 5:5 ETH:$BAL ratio
      describe("withdraw", async () => {
        it("Should withdraw 1 ETH and 1 $BAL when pool at 1:1 ratio", async function () {
          const tx1 = await dexContract.withdraw(ethers.utils.parseEther("1"), {
            from: deployer.address,
          });
          await expect(tx1)
            .emit(dexContract, "LiquidityRemoved")
            .withArgs(
              deployer.address,
              ethers.utils.parseEther("1"),
              ethers.utils.parseEther("1")
            );
        });
      });
    });
  });
});
