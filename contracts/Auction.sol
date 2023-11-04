// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Auction
{
    address private owner;
    IERC20 private token;

    uint64 timeStampBegin;
    uint64 timeStampEnd;
    
    constructor(IERC20 _token, uint64 _timeStampBegin, uint64 _timeStampEnd)
    {
        owner = msg.sender;
        token = _token;

        timeStampBegin = _timeStampBegin;
        timeStampEnd = _timeStampEnd;
    }

    modifier onlyOwner
    {
        require(owner == msg.sender, "only owner can call that function");
        _;
    }

    modifier isActiveTime
    {
        require(block.timestamp >= timeStampBegin, "Auction is not started still");
        require(block.timestamp < timeStampEnd, "Auction is already finished");
        _;
    }
}