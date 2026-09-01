// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TrustedIssuersRegistry
/// @notice ERC-3643 list of claim issuers trusted for given topics.
contract TrustedIssuersRegistry is AccessControl {
  address[] private _issuers;
  mapping(address => bool) private _isTrusted;
  mapping(address => mapping(uint256 => bool)) private _issuerTopic;

  event TrustedIssuerAdded(address indexed issuer);
  event TrustedIssuerRemoved(address indexed issuer);

  constructor(address admin) {
    require(admin != address(0), "zero address");
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
  }

  function addTrustedIssuer(address issuer, uint256[] calldata topics) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(issuer != address(0), "zero address");
    require(!_isTrusted[issuer], "issuer exists");
    require(topics.length > 0, "no topics");
    _isTrusted[issuer] = true;
    _issuers.push(issuer);
    for (uint256 i = 0; i < topics.length; i++) {
      _issuerTopic[issuer][topics[i]] = true;
    }
    emit TrustedIssuerAdded(issuer);
  }

  function removeTrustedIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(_isTrusted[issuer], "unknown issuer");
    _isTrusted[issuer] = false;
    for (uint256 i = 0; i < _issuers.length; i++) {
      if (_issuers[i] == issuer) {
        _issuers[i] = _issuers[_issuers.length - 1];
        _issuers.pop();
        break;
      }
    }
    emit TrustedIssuerRemoved(issuer);
  }

  function hasClaimTopic(address issuer, uint256 topic) external view returns (bool) {
    return _isTrusted[issuer] && _issuerTopic[issuer][topic];
  }

  function isTrustedIssuer(address issuer) external view returns (bool) {
    return _isTrusted[issuer];
  }

  function getTrustedIssuers() external view returns (address[] memory) {
    return _issuers;
  }
}
