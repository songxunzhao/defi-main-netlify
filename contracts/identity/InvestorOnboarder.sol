// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IdentityDeployer.sol";
import "./ClaimIssuer.sol";
import "../IdentityRegistry.sol";

/// @title InvestorOnboarder
/// @notice Registrar helper: deploy an ONCHAINID, issue KYC (and optional
///         accredited) claims, and register the wallet in one transaction.
contract InvestorOnboarder is AccessControl {
  bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

  uint256 public constant TOPIC_KYC = 1;
  uint256 public constant TOPIC_ACCREDITED = 2;

  IdentityRegistry public immutable registry;
  ClaimIssuer public immutable issuer;

  event InvestorOnboarded(address indexed wallet, address indexed identity, uint16 country, bool accredited);

  constructor(address admin, address registry_, address issuer_) {
    require(admin != address(0) && registry_ != address(0) && issuer_ != address(0), "zero address");
    registry = IdentityRegistry(registry_);
    issuer = ClaimIssuer(issuer_);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(REGISTRAR_ROLE, admin);
  }

  function onboard(address wallet, uint16 country, bool accredited) external onlyRole(REGISTRAR_ROLE) returns (address identity) {
    identity = _onboard(wallet, country, accredited);
  }

  /// @notice Same as onboard, but maps an ISO 3166-1 alpha-2 code (e.g. "US") to numeric (840).
  function onboardIso(address wallet, string calldata isoCountry, bool accredited)
    external
    onlyRole(REGISTRAR_ROLE)
    returns (address identity)
  {
    identity = _onboard(wallet, isoToNumeric(isoCountry), accredited);
  }

  /// @notice ISO 3166-1 alpha-2 → numeric. Unknown codes map to US (840) for this demo.
  function isoToNumeric(string memory iso) public pure returns (uint16) {
    bytes memory raw = bytes(iso);
    require(raw.length == 2, "bad iso");
    uint8 a = uint8(raw[0]);
    uint8 c = uint8(raw[1]);
    if (a >= 97 && a <= 122) a -= 32;
    if (c >= 97 && c <= 122) c -= 32;
    bytes2 code = bytes2(abi.encodePacked(bytes1(a), bytes1(c)));
    if (code == "US") return 840;
    if (code == "GB") return 826;
    if (code == "CA") return 124;
    if (code == "AU") return 36;
    if (code == "DE") return 276;
    if (code == "FR") return 250;
    if (code == "ES") return 724;
    if (code == "IT") return 380;
    if (code == "NL") return 528;
    if (code == "CH") return 756;
    if (code == "IE") return 372;
    if (code == "SG") return 702;
    if (code == "JP") return 392;
    if (code == "KR") return 410;
    if (code == "IN") return 356;
    if (code == "BR") return 76;
    if (code == "MX") return 484;
    if (code == "NZ") return 554;
    if (code == "SE") return 752;
    if (code == "NO") return 578;
    if (code == "DK") return 208;
    if (code == "FI") return 246;
    if (code == "AT") return 40;
    if (code == "BE") return 56;
    if (code == "PT") return 620;
    if (code == "PL") return 616;
    if (code == "AE") return 784;
    if (code == "HK") return 344;
    return 840;
  }

  function _onboard(address wallet, uint16 country, bool accredited) private returns (address identity) {
    require(wallet != address(0), "zero address");
    identity = IdentityDeployer.deploy(wallet, address(issuer));
    _issueClaims(identity, accredited);
    registry.registerIdentity(wallet, identity, country);
    emit InvestorOnboarded(wallet, identity, country, accredited);
  }

  function _issueClaims(address identity, bool accredited) private {
    issuer.issueClaim(identity, TOPIC_KYC);
    if (accredited) {
      issuer.issueClaim(identity, TOPIC_ACCREDITED);
    }
  }
}
