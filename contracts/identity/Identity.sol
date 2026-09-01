// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Identity
/// @notice Compact ONCHAINID-shaped claim holder (ERC-735 subset). The
///         investor is the management key; the platform ClaimIssuer may add
///         claims so local onboarding can happen in one transaction.
contract Identity {
  address public immutable owner;
  address public immutable issuer;

  mapping(bytes32 => uint256) private _claimTopic;
  mapping(bytes32 => address) private _claimIssuer;
  mapping(uint256 => bytes32[]) private _claimIdsByTopic;

  event ClaimAdded(bytes32 indexed claimId, uint256 indexed topic, address indexed issuer);
  event ClaimRemoved(bytes32 indexed claimId, uint256 indexed topic, address indexed issuer);

  constructor(address owner_, address issuer_) {
    require(owner_ != address(0) && issuer_ != address(0), "zero address");
    owner = owner_;
    issuer = issuer_;
  }

  function addClaim(uint256 topic, address issuer_) external returns (bytes32 claimId) {
    require(msg.sender == issuer || msg.sender == owner, "not authorized");
    require(issuer_ != address(0), "zero issuer");
    claimId = keccak256(abi.encode(issuer_, topic));
    if (_claimIssuer[claimId] == address(0)) {
      _claimIdsByTopic[topic].push(claimId);
    }
    _claimTopic[claimId] = topic;
    _claimIssuer[claimId] = issuer_;
    emit ClaimAdded(claimId, topic, issuer_);
  }

  function removeClaim(bytes32 claimId) external {
    require(msg.sender == owner || msg.sender == issuer, "not authorized");
    address claimIssuer = _claimIssuer[claimId];
    require(claimIssuer != address(0), "unknown claim");
    uint256 topic = _claimTopic[claimId];
    delete _claimTopic[claimId];
    delete _claimIssuer[claimId];
    bytes32[] storage ids = _claimIdsByTopic[topic];
    uint256 len = ids.length;
    for (uint256 i = 0; i < len; i++) {
      if (ids[i] == claimId) {
        ids[i] = ids[len - 1];
        ids.pop();
        break;
      }
    }
    emit ClaimRemoved(claimId, topic, claimIssuer);
  }

  function getClaimIdsByTopic(uint256 topic) external view returns (bytes32[] memory) {
    return _claimIdsByTopic[topic];
  }

  function claimIssuerOf(bytes32 claimId) external view returns (address) {
    return _claimIssuer[claimId];
  }

  function claimTopicOf(bytes32 claimId) external view returns (uint256) {
    return _claimTopic[claimId];
  }
}
