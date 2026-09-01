// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PropertyShare.sol";

/// @title Distributor
/// @notice Pull USDC rent for one PropertyShare. Deposits raise accUsdcPerShare;
///         holders claim pro-rata. The share token must call sync before a
///         balance change and setDebtToBalance after, so new buyers and
///         transferees cannot claim past distributions.
contract Distributor is AccessControl {
  uint256 private constant ACC = 1e18;

  IERC20 public immutable usdc;
  IERC20 public immutable token;

  uint256 public accUsdcPerShare;
  uint256 public totalDistributed;
  uint256 public totalClaimed;

  mapping(address => uint256) public debt;
  mapping(address => uint256) public accrued;

  event Deposited(address indexed from, uint256 amount);
  event Claimed(address indexed account, uint256 amount);

  constructor(address usdc_, address token_, address admin_) {
    require(usdc_ != address(0) && token_ != address(0) && admin_ != address(0), "zero address");
    usdc = IERC20(usdc_);
    token = IERC20(token_);
    _grantRole(DEFAULT_ADMIN_ROLE, admin_);
  }

  modifier onlyToken() {
    require(msg.sender == address(token), "only token");
    _;
  }

  function pending(address account) public view returns (uint256) {
    uint256 accumulated = (token.balanceOf(account) * accUsdcPerShare) / ACC;
    uint256 live = accumulated > debt[account] ? accumulated - debt[account] : 0;
    return accrued[account] + live;
  }

  function sync(address account) external onlyToken {
    if (account == address(0)) return;
    uint256 accumulated = (token.balanceOf(account) * accUsdcPerShare) / ACC;
    if (accumulated > debt[account]) {
      accrued[account] += accumulated - debt[account];
    }
    debt[account] = accumulated;
  }

  function setDebtToBalance(address account) external onlyToken {
    if (account == address(0)) return;
    debt[account] = (token.balanceOf(account) * accUsdcPerShare) / ACC;
  }

  /// @notice Move parked rent from a lost/frozen wallet onto its replacement.
  ///         Call after the share token has already transferred the balance.
  function reassignAccrued(address from, address to) external onlyToken {
    require(from != address(0) && to != address(0) && from != to, "bad wallets");
    accrued[to] += accrued[from];
    accrued[from] = 0;
  }

  function deposit(uint256 amount) external {
    require(amount > 0, "zero amount");
    uint256 supply = token.totalSupply();
    require(supply > 0, "no supply");
    bool ok = usdc.transferFrom(msg.sender, address(this), amount);
    require(ok, "usdc transfer failed");
    accUsdcPerShare += (amount * ACC) / supply;
    totalDistributed += amount;
    emit Deposited(msg.sender, amount);
  }

  function claim() external returns (uint256 amount) {
    require(!PropertyShare(address(token)).identity().isFrozen(msg.sender), "frozen");
    amount = pending(msg.sender);
    require(amount > 0, "nothing to claim");
    accrued[msg.sender] = 0;
    debt[msg.sender] = (token.balanceOf(msg.sender) * accUsdcPerShare) / ACC;
    totalClaimed += amount;
    bool ok = usdc.transfer(msg.sender, amount);
    require(ok, "usdc transfer failed");
    emit Claimed(msg.sender, amount);
  }
}
