// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Distributor.sol";
import "../Redemption.sol";

/// @dev Linked library so PropertyFactory does not embed Distributor + Redemption bytecode.
library PoolDeployer {
  function deployDistributor(address usdc, address token, address admin) external returns (address) {
    return address(new Distributor(usdc, token, admin));
  }

  function deployRedemption(address usdc, address token, address admin) external returns (address) {
    return address(new Redemption(usdc, token, admin));
  }
}
