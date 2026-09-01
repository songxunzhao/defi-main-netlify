// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./identity/ClaimTopicsRegistry.sol";
import "./identity/TrustedIssuersRegistry.sol";
import "./identity/ClaimIssuer.sol";
import "./identity/Identity.sol";

/// @title IdentityRegistry
/// @notice ERC-3643-shaped registry: wallet → ONCHAINID, country, and
///         claim-backed isVerified. AGENT_ROLE freeze / recoverIdentity are
///         platform extensions so one freeze applies to every listing.
contract IdentityRegistry is AccessControl {
  bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
  bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

  ClaimTopicsRegistry public immutable topics;
  TrustedIssuersRegistry public immutable trustedIssuers;

  mapping(address => address) private _identities;
  mapping(address => uint16) private _countries;
  mapping(address => bool) private _frozen;
  mapping(address => uint256) public verifiedAt;

  event IdentityRegistered(address indexed account, address indexed identity, uint16 country);
  event IdentityRemoved(address indexed account, address indexed identity);
  event IdentityUpdated(address indexed account, address indexed identity);
  event AddressFrozen(address indexed account, bool frozen);
  event IdentityRecovered(address indexed lostWallet, address indexed newWallet);

  constructor(address admin, address topics_, address trustedIssuers_) {
    require(admin != address(0) && topics_ != address(0) && trustedIssuers_ != address(0), "zero address");
    topics = ClaimTopicsRegistry(topics_);
    trustedIssuers = TrustedIssuersRegistry(trustedIssuers_);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(REGISTRAR_ROLE, admin);
    _grantRole(AGENT_ROLE, admin);
  }

  function registerIdentity(address user, address identityContract, uint16 country) external onlyRole(REGISTRAR_ROLE) {
    require(user != address(0) && identityContract != address(0), "zero address");
    require(_identities[user] == address(0), "already registered");
    _identities[user] = identityContract;
    _countries[user] = country;
    verifiedAt[user] = block.timestamp;
    emit IdentityRegistered(user, identityContract, country);
  }

  function deleteIdentity(address user) external onlyRole(REGISTRAR_ROLE) {
    address id = _identities[user];
    require(id != address(0), "not registered");
    delete _identities[user];
    delete _countries[user];
    verifiedAt[user] = 0;
    emit IdentityRemoved(user, id);
  }

  function updateIdentity(address user, address identityContract) external onlyRole(REGISTRAR_ROLE) {
    require(_identities[user] != address(0), "not registered");
    require(identityContract != address(0), "zero address");
    _identities[user] = identityContract;
    emit IdentityUpdated(user, identityContract);
  }

  function setAddressFrozen(address account, bool frozen) external onlyRole(AGENT_ROLE) {
    require(account != address(0), "zero address");
    _frozen[account] = frozen;
    emit AddressFrozen(account, frozen);
  }

  /// @notice Remap the lost wallet's ONCHAINID onto a replacement. If the
  ///         replacement is not registered, it inherits the same identity
  ///         (and therefore the same claims). Lost wallet is unverified + frozen.
  function recoverIdentity(address lostWallet, address newWallet) external onlyRole(AGENT_ROLE) {
    require(lostWallet != address(0) && newWallet != address(0), "zero address");
    require(lostWallet != newWallet, "same wallet");
    address lostId = _identities[lostWallet];
    require(lostId != address(0) && _claimsValid(lostWallet), "lost not verified");
    require(!_frozen[newWallet], "new frozen");
    _bindReplacement(lostWallet, newWallet, lostId);
    _unbindLost(lostWallet, lostId);
    emit IdentityRecovered(lostWallet, newWallet);
  }

  function identity(address account) external view returns (address) {
    return _identities[account];
  }

  function investorCountry(address account) external view returns (uint16) {
    return _countries[account];
  }

  function isFrozen(address account) public view returns (bool) {
    return _frozen[account];
  }

  /// @notice True when a wallet is registered and holds a valid claim from a
  ///         trusted issuer for every required topic. Freeze is separate.
  function isVerified(address account) public view returns (bool) {
    return _identities[account] != address(0) && _claimsValid(account);
  }

  /// @dev Removed boolean whitelist. Kept so leftover callers fail closed.
  function setVerified(address, bool) external pure {
    revert("use registerIdentity");
  }

  function _bindReplacement(address lostWallet, address newWallet, address lostId) private {
    if (_identities[newWallet] == address(0)) {
      _identities[newWallet] = lostId;
      uint16 country = _countries[lostWallet];
      _countries[newWallet] = country;
      verifiedAt[newWallet] = block.timestamp;
      emit IdentityRegistered(newWallet, lostId, country);
      return;
    }
    require(_claimsValid(newWallet), "new not verified");
  }

  function _unbindLost(address lostWallet, address lostId) private {
    delete _identities[lostWallet];
    delete _countries[lostWallet];
    verifiedAt[lostWallet] = 0;
    _frozen[lostWallet] = true;
    emit IdentityRemoved(lostWallet, lostId);
    emit AddressFrozen(lostWallet, true);
  }

  function _claimsValid(address account) internal view returns (bool) {
    address id = _identities[account];
    if (id == address(0)) return false;
    uint256[] memory required = topics.getClaimTopics();
    uint256 n = required.length;
    if (n == 0) return false;
    for (uint256 t = 0; t < n; t++) {
      if (!_topicSatisfied(id, required[t])) return false;
    }
    return true;
  }

  function _topicSatisfied(address id, uint256 topic) internal view returns (bool) {
    bytes32[] memory claimIds = Identity(id).getClaimIdsByTopic(topic);
    uint256 n = claimIds.length;
    for (uint256 c = 0; c < n; c++) {
      if (_claimOk(id, topic, claimIds[c])) return true;
    }
    return false;
  }

  function _claimOk(address id, uint256 topic, bytes32 claimId) internal view returns (bool) {
    address claimIssuer = Identity(id).claimIssuerOf(claimId);
    if (claimIssuer == address(0)) return false;
    if (Identity(id).claimTopicOf(claimId) != topic) return false;
    if (!trustedIssuers.hasClaimTopic(claimIssuer, topic)) return false;
    return ClaimIssuer(claimIssuer).isClaimValid(id, topic);
  }
}
