// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Identity.sol";

/// @dev Linked library so InvestorOnboarder does not embed Identity create.
library IdentityDeployer {
  function deploy(address owner_, address issuer_) external returns (address) {
    return address(new Identity(owner_, issuer_));
  }
}
