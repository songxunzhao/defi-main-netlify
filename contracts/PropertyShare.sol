// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IdentityRegistry.sol";

interface IShareDistributor {
  function sync(address account) external;
  function setDebtToBalance(address account) external;
  function reassignAccrued(address from, address to) external;
}

/// @title PropertyShare
/// @notice Fungible shares of one SPV/property. Transfers are blocked unless
///         both sender and recipient are verified, neither is frozen, and any
///         lockup has elapsed. AGENT_ROLE can forced-transfer or recover.
contract PropertyShare is ERC20, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
  bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

  IdentityRegistry public immutable identity;
  uint256 public immutable unlockTime;
  IShareDistributor public distributor;
  bool public transfersFrozen;
  bool private _agentOverride;

  event ForcedTransfer(address indexed from, address indexed to, uint256 amount);
  event Recovered(address indexed lostWallet, address indexed newWallet, uint256 amount);

  constructor(
    string memory name_,
    string memory symbol_,
    address identity_,
    address admin_,
    uint256 unlockTime_
  ) ERC20(name_, symbol_) {
    require(identity_ != address(0) && admin_ != address(0), "zero address");
    identity = IdentityRegistry(identity_);
    unlockTime = unlockTime_;
    _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    _grantRole(AGENT_ROLE, admin_);
  }

  function decimals() public pure override returns (uint8) {
    return 0;
  }

  function setDistributor(address distributor_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(address(distributor) == address(0), "distributor set");
    require(distributor_ != address(0), "zero address");
    distributor = IShareDistributor(distributor_);
  }

  function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    _mint(to, amount);
  }

  function burnFrom(address account, uint256 amount) external onlyRole(BURNER_ROLE) {
    _burn(account, amount);
  }

  function setTransfersFrozen(bool frozen) external onlyRole(DEFAULT_ADMIN_ROLE) {
    transfersFrozen = frozen;
  }

  /// @notice Agent move that bypasses lockup, listing freeze, and a frozen sender.
  ///         Recipient must still be verified and not frozen.
  function forcedTransfer(address from, address to, uint256 amount) external onlyRole(AGENT_ROLE) {
    require(from != address(0) && to != address(0) && from != to, "bad wallets");
    require(amount > 0, "zero amount");
    _agentMove(from, to, amount);
    emit ForcedTransfer(from, to, amount);
  }

  /// @notice Move the full balance (and parked rent) after identity recovery.
  ///         Call IdentityRegistry.recoverIdentity first so `newWallet` is verified.
  function recover(address lostWallet, address newWallet) external onlyRole(AGENT_ROLE) {
    require(lostWallet != newWallet && newWallet != address(0), "bad wallets");
    uint256 amount = balanceOf(lostWallet);
    require(amount > 0, "no shares");
    _agentMove(lostWallet, newWallet, amount);
    if (address(distributor) != address(0)) {
      distributor.reassignAccrued(lostWallet, newWallet);
    }
    emit Recovered(lostWallet, newWallet, amount);
  }

  function _agentMove(address from, address to, uint256 amount) internal {
    _agentOverride = true;
    _transfer(from, to, amount);
    _agentOverride = false;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    super._beforeTokenTransfer(from, to, amount);
    if (_agentOverride) {
      require(to != address(0), "agent burn");
      require(identity.isVerified(to), "not verified");
      require(!identity.isFrozen(to), "frozen");
    } else if (from == address(0)) {
      require(!transfersFrozen, "exit frozen");
      require(identity.isVerified(to), "buyer not verified");
      require(!identity.isFrozen(to), "frozen");
    } else if (to == address(0)) {
      require(!identity.isFrozen(from), "frozen");
    } else {
      require(!transfersFrozen, "exit frozen");
      if (unlockTime > 0) {
        require(block.timestamp >= unlockTime, "transfer locked");
      }
      require(!identity.isFrozen(from) && !identity.isFrozen(to), "frozen");
      require(identity.isVerified(from) && identity.isVerified(to), "not verified");
    }
    if (address(distributor) != address(0)) {
      if (from != address(0)) distributor.sync(from);
      if (to != address(0)) distributor.sync(to);
    }
  }

  function _afterTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    super._afterTokenTransfer(from, to, amount);
    if (address(distributor) != address(0)) {
      if (from != address(0)) distributor.setDebtToBalance(from);
      if (to != address(0)) distributor.setDebtToBalance(to);
    }
  }
}
