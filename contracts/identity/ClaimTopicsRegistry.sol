// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ClaimTopicsRegistry
/// @notice ERC-3643 list of claim topics required for isVerified.
contract ClaimTopicsRegistry is AccessControl {
  uint256[] private _topics;
  mapping(uint256 => bool) private _hasTopic;

  event ClaimTopicAdded(uint256 indexed topic);
  event ClaimTopicRemoved(uint256 indexed topic);

  constructor(address admin) {
    require(admin != address(0), "zero address");
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
  }

  function addClaimTopic(uint256 topic) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!_hasTopic[topic], "topic exists");
    _hasTopic[topic] = true;
    _topics.push(topic);
    emit ClaimTopicAdded(topic);
  }

  function removeClaimTopic(uint256 topic) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(_hasTopic[topic], "unknown topic");
    _hasTopic[topic] = false;
    for (uint256 i = 0; i < _topics.length; i++) {
      if (_topics[i] == topic) {
        _topics[i] = _topics[_topics.length - 1];
        _topics.pop();
        break;
      }
    }
    emit ClaimTopicRemoved(topic);
  }

  function getClaimTopics() external view returns (uint256[] memory) {
    return _topics;
  }

  function hasClaimTopic(uint256 topic) external view returns (bool) {
    return _hasTopic[topic];
  }
}
