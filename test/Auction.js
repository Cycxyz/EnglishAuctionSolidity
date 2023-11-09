const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("TokenAndAuction", () => {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ONE_HOUR_IN_SECONDS = 60 * 60;
  const TOKEN_TO_APPROVE = 1000;
  const INITIAL_TOKEN_COUNT = 100000;
  const START_PRICE = 1000;

  async function deployTokenAndAuction() {
    const [owner, first, second, third] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("GLDToken");
    const token = await tokenFactory.deploy(INITIAL_TOKEN_COUNT);

    const auctionFactory = await ethers.getContractFactory("Auction");
    const auction = await auctionFactory.deploy(token.target, START_PRICE);

    return { token, auction, owner, first, second, third };
  }

  async function initialize(auction, token, approveCount = TOKEN_TO_APPROVE) {
    const startTime = (await time.latest()) + ONE_HOUR_IN_SECONDS;
    const endTime = startTime + ONE_HOUR_IN_SECONDS;

    await token.approve(auction.target, approveCount);

    await auction.Initialize(startTime, endTime);

    return { startTime, endTime };
  }

  async function startAuction() {
    const { auction, token, owner, first } = await deployTokenAndAuction();
    const { startTime, endTime } = await initialize(auction, token);

    await time.increaseTo(startTime);

    return { auction, first, endTime, token, owner };
  }

  async function expectFail(fn, message) {
    await expect(fn).to.be.revertedWith(message);
  }

  describe("Deployement", function () {
    it("Owner correct", async function () {
      const { auction } = await deployTokenAndAuction();

      expect(await auction.winner()).to.equal(ZERO_ADDRESS);
    });
    it("Not initialized", async function () {
      const { auction } = await deployTokenAndAuction();

      expect(await auction.isInitialized()).to.false;
    });
  });

  describe("Initialization", function () {
    it("Timestamps are correct", async function () {
      const { auction, token } = await deployTokenAndAuction()
      const { startTime, endTime } = await initialize(auction, token);

      expect(await auction.timeStampBegin()).to.equal(startTime);
      expect(await auction.timeStampEnd()).to.equal(endTime);
    });

    it("Initialized successfuly", async function () {
      const { auction, token } = await deployTokenAndAuction();
      await initialize(auction, token);

      expect(await auction.isInitialized()).to.true;
    });

    it("Token count is correct", async function () {
      const { auction, token } = await deployTokenAndAuction();

      const startTime = (await time.latest()) + ONE_HOUR_IN_SECONDS;

      const TOKEN_COUNT = 1000;

      await token.approve(auction.target, TOKEN_COUNT);

      await auction.Initialize(startTime, startTime + 1);

      expect(await auction.isInitialized()).to.true;
      expect(await token.balanceOf(auction.target))
        .to.be.equal(TOKEN_COUNT);
    })

    it("Good start timestamp", async function () {
      const { auction } = await deployTokenAndAuction();

      const startTime = (await time.latest()) - 1;


      await expectFail(auction.Initialize(startTime, startTime),
        "Can't set auction start time in the past");
    });

    it("Good end timestamp", async function () {
      const { auction } = await deployTokenAndAuction();

      const startTime = (await time.latest()) + ONE_HOUR_IN_SECONDS;

      await expectFail(auction.Initialize(startTime, startTime - 1),
        "Can't set end time less then start time");
    });

    it("Requires tokens", async function () {
      const { auction } = await deployTokenAndAuction();

      const ONE_HOUR_IN_SECONDS = 60 * 60;

      const startTime = (await time.latest()) + ONE_HOUR_IN_SECONDS;

      await expect(auction.Initialize(startTime, startTime + 1))
        .to.be.reverted;
    });

    it("Nothing available if not initialized", async function () {
      const { auction } = await deployTokenAndAuction();

      const basicCheck = async (fn) => {
        await expectFail(fn, "Auction is not initialized");
      }

      await basicCheck(auction.myBet());
      await basicCheck(auction.winnerBet());
      await basicCheck(auction.increaseMyBet({ value: 5 }));
      await basicCheck(auction.getBetBack());
      await basicCheck(auction.getWonTokens());
      await basicCheck(auction.getOwnersMoney());
    })
  });

  describe("Auction not started time", function () {
    it("Nothing is available", async function () {
      const { auction, token } = await deployTokenAndAuction();
      await initialize(auction, token);

      const basicCheckStartTime = async (fn) => {
        await expectFail(fn, "Auction is not started still");
      }

      const basicCheckEndTime = async (fn) => {
        await expectFail(fn, "Auction is not ended still");
      }

      await basicCheckStartTime(auction.myBet());
      await basicCheckStartTime(auction.winnerBet());
      await basicCheckStartTime(auction.increaseMyBet({ value: 5 }));
      await basicCheckEndTime(auction.getBetBack());
      await basicCheckEndTime(auction.getWonTokens());
      await basicCheckEndTime(auction.getOwnersMoney());
    });
  });

  describe("Auction started time", function () {
    const WEI_COUNT = 100000;

    it("Can increase my bet", async function () {
      const { auction, first } = await startAuction();

      await expect(auction.connect(first).increaseMyBet({ value: WEI_COUNT }))
        .to.changeEtherBalances([first, auction], [-WEI_COUNT, WEI_COUNT]);
    })

    it("Can check my bet", async function () {
      const { auction, first } = await startAuction();

      await auction.connect(first).increaseMyBet({ value: WEI_COUNT });

      expect(await auction.connect(first).myBet()).to.equal(WEI_COUNT);
    });

    it("Can check winner bet", async function () {
      const { auction, first } = await startAuction();

      await auction.connect(first).increaseMyBet({ value: WEI_COUNT });

      expect(await auction.winnerBet()).to.equal(WEI_COUNT);
    });

    it("Can't do nothing else", async function () {
      const { auction } = await startAuction();
      const basicCheckEndTime = async (fn) => {
        await expectFail(fn, "Auction is not ended still");
      }

      await basicCheckEndTime(auction.getBetBack());
      await basicCheckEndTime(auction.getWonTokens());
      await basicCheckEndTime(auction.getOwnersMoney());
    });

    it("Can't increase too low amount", async function () {
      const { auction, first } = await startAuction();
      await expectFail(
        auction.connect(first).increaseMyBet({ value: 1 }), "New bet is too low");
    });
  });

  describe("Auction ended time", function () {
    const OWNER_BET = 12000;
    const FIRST_ACC_BET = 6000;
    const SECOND_ACC_BET = 13000;
    const THIRD_ACC_BET = 10000;

    async function endWithoutWinner() {
      const { auction, endTime, owner, token } = await startAuction();

      await time.increaseTo(endTime);

      return { auction, token, owner };
    }

    async function emulateAuction() {
      const { token, auction, owner, first, second, third } = await deployTokenAndAuction();
      const { startTime, endTime } = await initialize(auction, token);

      await time.increaseTo(startTime);

      await auction.increaseMyBet({ value: 5000 });
      const auctionFirst = auction.connect(first);
      const auctionSecond = auction.connect(second);
      const auctionThird = auction.connect(third);

      await auctionFirst.increaseMyBet({ value: FIRST_ACC_BET });
      await auctionSecond.increaseMyBet({ value: 8000 });
      await auctionThird.increaseMyBet({ value: THIRD_ACC_BET });

      await auction.increaseMyBet({ value: 7000 });

      await auctionSecond.increaseMyBet({ value: 5000 });

      return { auction, first, second, third, endTime, owner, token };
    }

    it("Can't call active time functions", async function () {
      const { auction } = await endWithoutWinner();

      const basicCheckActiveTime = async (fn) => {
        await expectFail(fn, "Auction is already finished");
      };

      await basicCheckActiveTime(auction.myBet());
      await basicCheckActiveTime(auction.winnerBet());
      await basicCheckActiveTime(auction.increaseMyBet({ value: 5 }));
    });

    it("Noone attended, owner's return", async function () {
      const { auction, token, owner } = await endWithoutWinner();

      await expect(auction.getWonTokens()).to.changeTokenBalances(token,
        [auction.target, owner.address], [-TOKEN_TO_APPROVE, TOKEN_TO_APPROVE]);
    });



    it("Current bets are correct", async function () {
      const { auction, first, second, third } = await emulateAuction();

      expect(await auction.myBet()).to.equal(12000);
      expect(await auction.winnerBet()).to.equal(SECOND_ACC_BET);
      expect(await auction.connect(first).myBet()).to.equal(6000);
      expect(await auction.connect(second).myBet()).to.equal(SECOND_ACC_BET);
      expect(await auction.connect(third).myBet()).to.equal(10000);
    });

    it("Can get bet back", async function () {
      const { auction, first, endTime } = await emulateAuction();
      await time.increaseTo(endTime);

      await expect(auction.connect(first).getBetBack()).to.changeEtherBalances
        ([auction, first], [-FIRST_ACC_BET, FIRST_ACC_BET]);
    });

    it("Can get owners money", async function () {
      const { auction, endTime, owner } = await emulateAuction();

      await time.increaseTo(endTime);

      await expect(auction.getOwnersMoney())
        .to.changeEtherBalances([auction, owner], [-SECOND_ACC_BET, SECOND_ACC_BET]);
    })

    it("Can't get money twice", async function () {
      const { auction, first, second, third, endTime, owner }
        = await emulateAuction();

      await time.increaseTo(endTime);

      await auction.connect(first).getBetBack()
      await expectFail(auction.connect(first).getBetBack(), "Sender doesn't have any locked money");

      await auction.getOwnersMoney();
      await expectFail(auction.getOwnersMoney(), "Owner can't get money twice");
    });

    it("Reentrancy get bet back", async function () {
      const { auction, endTime, first } = await emulateAuction();

      const trickyFactory = await ethers.getContractFactory("ReetrancyBetBack");

      const tricky = await trickyFactory.deploy(auction.target);
      await tricky.waitForDeployment();

      await tricky.increaseBet({ value: SECOND_ACC_BET + 1000 });
      await auction.connect(first).increaseMyBet({ value: SECOND_ACC_BET + 2000 });

      await time.increaseTo(endTime);

      await expect(tricky.getBetBack()).to.reverted;
    });

    it("Reetrancy owners money", async function () {
      const trickyOwnerFactory = await ethers.getContractFactory("ReetrancyOwnersMoney");
      trickyOwner = await trickyOwnerFactory.deploy();

      await trickyOwner.waitForDeployment();

      await trickyOwner.createAndInitialize();

      const auction = await ethers.getContractAt("Auction", await trickyOwner.auction());
      const startTime = await trickyOwner.startTime();
      const endTime = await trickyOwner.endTime();

      const [first, second, third] = await ethers.getSigners();

      await time.increaseTo(startTime);

      await auction.connect(first).increaseMyBet({ value: 2000 });
      await auction.connect(second).increaseMyBet({ value: 2001 });
      await auction.connect(third).increaseMyBet({ value: 2002 });

      await trickyOwner.initializeWin();

      await time.increaseTo(endTime);

      await expect(trickyOwner.getOwnersMoney()).to.reverted;
    });

    it("General test, normal behaviour", async function () {
      const { auction, first, second, third, endTime, owner, token }
        = await emulateAuction();
      await time.increaseTo(endTime);

      await expect(auction.getBetBack()).to.changeEtherBalances
        ([auction, owner], [-OWNER_BET, OWNER_BET]);

      await expect(auction.connect(first).getBetBack()).to.changeEtherBalances
        ([auction, first], [-FIRST_ACC_BET, FIRST_ACC_BET]);

      await expect(auction.connect(third).getBetBack()).to.changeEtherBalances
        ([auction, third], [-THIRD_ACC_BET, THIRD_ACC_BET]);

      await expect(auction.connect(second).getWonTokens()).to.changeTokenBalances
        (token, [auction, second], [-TOKEN_TO_APPROVE, TOKEN_TO_APPROVE]);

      await expect(auction.getOwnersMoney()).to.changeEtherBalances
        ([auction, owner], [-SECOND_ACC_BET, SECOND_ACC_BET]);

      expect(await ethers.provider.getBalance(auction)).to.equal(0);
      expect(await token.balanceOf(auction.target)).to.equal(0);
    });
  });

});