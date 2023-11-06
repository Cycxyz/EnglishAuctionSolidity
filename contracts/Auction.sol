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
    bool private moneyReceived;

    uint64 public timeStampBegin = 2**64 - 1;
    uint64 public timeStampEnd = 2**64 - 1;

    bool public isInitialized;
    

    bool private locked;
    modifier noReentrancy() {
        require(!locked, "Blocked from reentrancy.");
        locked = true;
        _;
        locked = false;
    }

    constructor(IERC20 _token, uint _startPrice)
    {
        owner = msg.sender;
        token = _token;

        winner = address(0);
        bets[address(0)] = _startPrice;
    }

    function Initialize(uint64 _timeStampBegin, uint64 _timeStampEnd) isOwner noReentrancy public
    {
        require(!isInitialized, "Already initialized");
        require(_timeStampBegin > block.timestamp, "Can't set auction start time"
            "in the past");
        require(_timeStampBegin < _timeStampEnd, "Can't set end time less then"
            "start time");

        bool isSuccess = token.transferFrom(owner, address(this), SELL_AMOUNT);
        require(isSuccess, "Owner didn't approve enough money for contract");

        timeStampBegin = _timeStampBegin;
        timeStampEnd = _timeStampEnd;

        isInitialized = true;
    }

    function myBet() isAuctionInitialized isActiveTime 
        public view returns(uint)
    {
        return bets[msg.sender];
    }

    function winnerBet() isAuctionInitialized isActiveTime 
        public view returns(uint)
    {
        return bets[winner];
    }

    function increaseMyBet() isAuctionInitialized isActiveTime external payable
    {
        uint newBet = myBet() + msg.value;

        require(newBet > winnerBet(), "New bet is too low");

        bets[msg.sender] = newBet;
        winner = msg.sender;
    }

    function getBetBack() isAuctionInitialized isEnded noReentrancy external
    {
        require(msg.sender != winner, "Winner can't get his bet back");
        uint senderBet = bets[msg.sender];
        require(senderBet != 0, "Sender doesn't have any locked money");

        bets[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: senderBet}("");
        require(success);
    }

    function getWonTokens() isAuctionInitialized isEnded noReentrancy external
    {
        address sendTokensTo = address(0);

        if (msg.sender == winner)
        {
            sendTokensTo = winner;
        }
        else if(winner == address(0))
        {
            sendTokensTo = owner;
        }
        else
        {
            revert("Only winner can get tokens");
        }
        require(!isWinReceived, "Impossible to get tokens twice");

        isWinReceived = true;

        bool success = token.transfer(sendTokensTo, SELL_AMOUNT);
        require(success);
    }

    function getOwnersMoney() isAuctionInitialized isOwner isEnded noReentrancy external
    {
        require(!moneyReceived, "Owner can't get money twice");
        require(winner != address(0), "No participants");

        uint ownersMoney = bets[winner];
        moneyReceived = true;

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

    modifier isEnded
    {
        require(isEndTimePassed(), "Auction is not ended still");
        _;
    }

    modifier isAuctionInitialized
    {
        require(isInitialized, "Auction is not initialized");
        _;
    }
}

contract AuctionMock is Auction
{
    constructor(IERC20 token) Auction(token, 1000)
    {}

    function InitializeMock() external
    {
        Initialize(2**64 - 2, 2**64 - 1);
    }

    function StartAuction() external
    {
        timeStampBegin = uint64(block.timestamp);
    }

    function StopAuction() external
    {
        timeStampEnd = uint64(block.timestamp);
    }
}