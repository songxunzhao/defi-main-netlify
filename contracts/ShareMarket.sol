// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IdentityRegistry.sol";
import "./PropertyShare.sol";

interface IPropertyFactory {
  function getListing(uint256 propertyId) external view returns (address token, address offering, bool exists);
}

/// @title ShareMarket
/// @notice Non-custodial ask book for factory listings. Fill pulls shares
///         seller → buyer so KYC and lockup stay on PropertyShare. Not an AMM.
contract ShareMarket is AccessControl {
  struct Ask {
    address seller;
    uint256 propertyId;
    address token;
    uint256 amount;
    uint256 price;
    bool active;
  }

  IdentityRegistry public immutable identity;
  IPropertyFactory public immutable factory;
  IERC20 public immutable usdc;

  bool public paused;
  uint256 public nextAskId = 1;
  mapping(uint256 => Ask) private _asks;

  event Listed(uint256 indexed id, address indexed seller, uint256 indexed propertyId, uint256 amount, uint256 price);
  event Cancelled(uint256 indexed id);
  event Filled(uint256 indexed id, address indexed buyer, uint256 amount, uint256 cost);
  event Paused(bool paused);

  constructor(address admin, address factory_, address identity_, address usdc_) {
    require(
      admin != address(0) && factory_ != address(0) && identity_ != address(0) && usdc_ != address(0),
      "zero address"
    );
    factory = IPropertyFactory(factory_);
    identity = IdentityRegistry(identity_);
    usdc = IERC20(usdc_);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
  }

  function setPaused(bool paused_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    paused = paused_;
    emit Paused(paused_);
  }

  function getAsk(uint256 id)
    external
    view
    returns (address seller, uint256 propertyId, address token, uint256 amount, uint256 price, bool active)
  {
    Ask storage ask = _asks[id];
    return (ask.seller, ask.propertyId, ask.token, ask.amount, ask.price, ask.active);
  }

  function quote(uint256 id, uint256 amount) public view returns (uint256) {
    return _asks[id].price * amount;
  }

  function list(uint256 propertyId, uint256 amount, uint256 price) external returns (uint256 id) {
    require(!paused, "paused");
    require(identity.isVerified(msg.sender), "not verified");
    require(!identity.isFrozen(msg.sender), "frozen");
    require(amount > 0 && price > 0, "invalid params");
    (address token, , bool exists) = factory.getListing(propertyId);
    require(exists && token != address(0), "no listing");
    _requireUnlocked(token);
    require(IERC20(token).balanceOf(msg.sender) >= amount, "insufficient shares");
    require(IERC20(token).allowance(msg.sender, address(this)) >= amount, "approve shares");

    id = nextAskId++;
    _asks[id] = Ask(msg.sender, propertyId, token, amount, price, true);
    emit Listed(id, msg.sender, propertyId, amount, price);
  }

  function cancel(uint256 id) external {
    Ask storage ask = _asks[id];
    require(ask.active, "inactive");
    require(ask.seller == msg.sender, "not seller");
    ask.active = false;
    emit Cancelled(id);
  }

  function fill(uint256 id, uint256 amount) external {
    require(!paused, "paused");
    Ask storage ask = _asks[id];
    require(ask.active, "inactive");
    require(identity.isVerified(msg.sender), "not verified");
    require(!identity.isFrozen(msg.sender) && !identity.isFrozen(ask.seller), "frozen");
    require(msg.sender != ask.seller, "self fill");
    require(amount > 0 && amount <= ask.amount, "bad amount");
    _requireUnlocked(ask.token);

    uint256 cost = ask.price * amount;
    ask.amount -= amount;
    if (ask.amount == 0) ask.active = false;

    bool paid = usdc.transferFrom(msg.sender, ask.seller, cost);
    require(paid, "usdc transfer failed");
    bool moved = IERC20(ask.token).transferFrom(ask.seller, msg.sender, amount);
    require(moved, "share transfer failed");

    emit Filled(id, msg.sender, amount, cost);
  }

  function _requireUnlocked(address token) internal view {
    uint256 unlockTime = PropertyShare(token).unlockTime();
    require(unlockTime == 0 || block.timestamp >= unlockTime, "transfer locked");
  }
}
