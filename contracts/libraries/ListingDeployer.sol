// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../PropertyShare.sol";
import "../Offering.sol";

/// @dev Linked library so PropertyFactory does not embed share + offering bytecode.
library ListingDeployer {
  function deployShare(
    string memory name_,
    string memory symbol_,
    address identity,
    address admin,
    uint256 unlockTime
  ) external returns (address) {
    return address(new PropertyShare(name_, symbol_, identity, admin, unlockTime));
  }

  function deployOffering(Offering.Init memory init) external returns (address) {
    return address(new Offering(init));
  }
}
