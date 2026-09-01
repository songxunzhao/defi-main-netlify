// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PropertyShare.sol";

/// @title Redemption
/// @notice Sale-exit vault: admin deposits USDC proceeds, holders burn shares
///         for a snapshot pro-rata payout. Transfers should already be frozen
///         on the share token so supply cannot change after open.
contract Redemption is AccessControl {
  IERC20 public immutable usdc;
  PropertyShare public immutable token;

  bool public opened;
  uint256 public proceeds;
  uint256 public supplyAtOpen;
  uint256 public totalRedeemed;
  uint256 public totalPaid;

  event Opened(uint256 proceeds, uint256 supply);
  event Redeemed(address indexed account, uint256 shares, uint256 payout);

  constructor(address usdc_, address token_, address admin_) {
    require(usdc_ != address(0) && token_ != address(0) && admin_ != address(0), "zero address");
    usdc = IERC20(usdc_);
    token = PropertyShare(token_);
    _grantRole(DEFAULT_ADMIN_ROLE, admin_);
  }

  function quote(uint256 shares) public view returns (uint256) {
    if (!opened || supplyAtOpen == 0) return 0;
    return (proceeds * shares) / supplyAtOpen;
  }

  function open(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!opened, "opened");
    require(amount > 0, "zero amount");
    uint256 supply = token.totalSupply();
    require(supply > 0, "no supply");
    bool ok = usdc.transferFrom(msg.sender, address(this), amount);
    require(ok, "usdc transfer failed");
    opened = true;
    proceeds = amount;
    supplyAtOpen = supply;
    emit Opened(amount, supply);
  }

  function redeem(uint256 amount) external returns (uint256 payout) {
    require(opened, "not open");
    require(amount > 0, "zero amount");
    require(token.balanceOf(msg.sender) >= amount, "insufficient shares");
    payout = quote(amount);
    require(payout > 0, "dust");
    totalRedeemed += amount;
    totalPaid += payout;
    token.burnFrom(msg.sender, amount);
    bool ok = usdc.transfer(msg.sender, payout);
    require(ok, "usdc transfer failed");
    emit Redeemed(msg.sender, amount, payout);
  }
}
