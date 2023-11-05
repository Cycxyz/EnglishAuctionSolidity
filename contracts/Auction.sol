// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Auction
{
    uint32 constant SELL_AMOUNT = 1000; 

    address private owner;
    IERC20 private token;

    mapping(address => uint) private bets;

    address private winner;
    bool private isWinReceived;

    uint8 constant public BET_STEP_PERCENTAGE = 5;

    uint64 public timeStampBegin;
    uint64 public timeStampEnd;

    bool public isApproved;
    
    constructor(IERC20 _token, uint64 _timeStampBegin, uint64 _timeStampEnd,
        uint _startPrice)
    {
        require(_timeStampBegin > block.timestamp, "Can't set auction start time"
            "in the past");
        require(_timeStampBegin < _timeStampEnd, "Can't set end time less then"
            "start time");

        owner = msg.sender;
        token = _token;

        timeStampBegin = _timeStampBegin;
        timeStampEnd = _timeStampEnd;

        winner = address(0);
        bets[address(0)] = _startPrice;
    }

    function approve() external
    {
        require(!isApproved, "Already approved");
        require(!isStartTimePassed(), 
            "Can't approve anymore, start time passed");
        require(token.balanceOf(address(this)) >= SELL_AMOUNT, 
            "Money weren't transfered");
        isApproved = true;
    }

    function myBet() isActiveTime isApprovedInTime 
        public view returns(uint)
    {
        return bets[msg.sender];
    }

    function winnerBet() isActiveTime isApprovedInTime 
        public view returns(uint)
    {
        return bets[winner];
    }

    function increaseMyBet() isActiveTime isApprovedInTime external payable
    {
        uint newBet = myBet() + msg.value;

        uint nextMinimalBet = winnerBet() * (100 + BET_STEP_PERCENTAGE) / 100;

        require(newBet >= nextMinimalBet, "New bet is too low");

        bets[msg.sender] = newBet;
        winner = msg.sender;
    }

    function getBetBack() isApprovedInTime isEnded external
    {
        require(msg.sender != winner, "Winner can't get his bet back");
        uint senderBet = bets[msg.sender];
        require(senderBet != 0, "Sender doesn't have any locked money");

        (bool success, ) = msg.sender.call{value: senderBet}("");
        require(success);
    }

    function getWonTokens() isApprovedInTime isEnded external
    {
        require(msg.sender == winner, "Only winner can get tokens");
        require(!isWinReceived, "Winner can't get his win twice");
        
        bool success = token.transfer(winner, SELL_AMOUNT);
        require(success);
        isWinReceived = true;
    }

    // Needed to get tokens from contract account if owner or someone else
    // by mistake sent too much tokens to contract. Also used to get back
    // tokens if noone participated
    function getRemainingTokens() isEnded isOwner external
    {
        uint remainingTokens = token.balanceOf(address(this));

        if (!isWinReceived && isApproved && winner != address(0))
        {
            remainingTokens -= SELL_AMOUNT;
        }
        if (remainingTokens > 0)
        {
            bool success = token.transfer(owner, remainingTokens);
            require(success);
        }
    }

    function getOwnersMoney() isOwner isApprovedInTime isEnded external
    {
        require(winner != address(0), "No participants");
        uint ownersMoney = bets[winner];
        (bool success,) = owner.call{value : ownersMoney}("");
        require(success);
    }

    function isStartTimePassed() private view returns(bool)
    {
        return block.timestamp >= timeStampBegin;
    }

    function isEndTimePassed() private view returns(bool)
    {
        return block.timestamp >= timeStampEnd;
    }

    modifier isOwner
    {
        require(owner == msg.sender, "only owner can call that function");
        _;
    }

    modifier isActiveTime
    {
        require(isStartTimePassed(), "Auction is not started still");
        require(!isEndTimePassed(), "Auction is already finished");
        _;
    }

    modifier isApprovedInTime
    {
        require(isApproved && isStartTimePassed(),
         "Auction wasn't started because wasn't approved in time");
        _;
    }

    modifier isEnded
    {
        require(isEndTimePassed(), "Auction is not ended still");
        _;
    }
}

contract AuctionMock is Auction
{
    constructor(IERC20 token) Auction(token, 2**64 - 2, 2**64 - 1, 1000)
    {}

    function StartAuction() external
    {
        timeStampBegin = uint64(block.timestamp);
    }

    function StopAuction() external
    {
        timeStampEnd = uint64(block.timestamp);
    }
}