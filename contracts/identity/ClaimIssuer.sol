// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Identity.sol";

/// @title ClaimIssuer
/// @notice Platform issuer that writes KYC / accredited claims onto ONCHAINID
///         contracts and can revoke them. Demo issuer — not a KYC vendor.
contract ClaimIssuer is AccessControl {
  bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

  mapping(address => mapping(bytes32 => bool)) private _revoked;

  event ClaimIssued(address indexed identity, uint256 indexed topic, bytes32 claimId);
  event ClaimRevoked(address indexed identity, bytes32 indexed claimId);

  constructor(address admin) {
    require(admin != address(0), "zero address");
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ISSUER_ROLE, admin);
  }

  function issueClaim(address identity, uint256 topic) external onlyRole(ISSUER_ROLE) returns (bytes32 claimId) {
    require(identity != address(0), "zero address");
    claimId = keccak256(abi.encode(address(this), topic));
    Identity(identity).addClaim(topic, address(this));
    _revoked[identity][claimId] = false;
    emit ClaimIssued(identity, topic, claimId);
  }

  function revokeClaim(address identity, bytes32 claimId) external onlyRole(ISSUER_ROLE) {
    require(identity != address(0), "zero address");
    _revoked[identity][claimId] = true;
    emit ClaimRevoked(identity, claimId);
  }

  function isClaimRevoked(address identity, bytes32 claimId) public view returns (bool) {
    return _revoked[identity][claimId];
  }

  /// @notice True when this issuer still stands behind `topic` on `identity`
  ///         and the claim has not been revoked.
  function isClaimValid(address identity, uint256 topic) external view returns (bool) {
    if (identity == address(0)) return false;
    bytes32 claimId = keccak256(abi.encode(address(this), topic));
    if (_revoked[identity][claimId]) return false;
    return Identity(identity).claimIssuerOf(claimId) == address(this);
  }
}
