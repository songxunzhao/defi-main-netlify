// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IdentityRegistry.sol";
import "./PropertyShare.sol";
import "./Offering.sol";
import "./libraries/PoolDeployer.sol";
import "./libraries/ListingDeployer.sol";

/// @title PropertyFactory
/// @notice Deploys a share token + USDC offering per listing and records them
///         against an off-chain property id.
contract PropertyFactory is AccessControl {
  struct Listing {
    address token;
    address offering;
    bool exists;
  }

  IdentityRegistry public immutable identity;
  IERC20 public immutable usdc;

  mapping(uint256 => Listing) private _listings;
  mapping(uint256 => address) private _distributors;
  mapping(uint256 => address) private _redemptions;
  uint256[] public propertyIds;

  event ListingCreated(
    uint256 indexed propertyId,
    address token,
    address offering,
    uint256 price,
    uint256 cap
  );
  event DistributorCreated(uint256 indexed propertyId, address distributor);
  event RedemptionCreated(uint256 indexed propertyId, address redemption);

  constructor(address admin, address identity_, address usdc_) {
    require(admin != address(0) && identity_ != address(0) && usdc_ != address(0), "zero address");
    identity = IdentityRegistry(identity_);
    usdc = IERC20(usdc_);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
  }

  function getListing(uint256 propertyId)
    external
    view
    returns (address token, address offering, bool exists)
  {
    Listing storage listing = _listings[propertyId];
    return (listing.token, listing.offering, listing.exists);
  }

  function listingCount() external view returns (uint256) {
    return propertyIds.length;
  }

  function getDistributor(uint256 propertyId) external view returns (address) {
    return _distributors[propertyId];
  }

  function getRedemption(uint256 propertyId) external view returns (address) {
    return _redemptions[propertyId];
  }

  function createRedemption(uint256 propertyId) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address redemption) {
    Listing storage listing = _listings[propertyId];
    require(listing.exists, "no listing");
    require(_redemptions[propertyId] == address(0), "redemption exists");
    require(PropertyShare(listing.token).totalSupply() > 0, "no supply");
    _closePrimary(listing.offering);
    PropertyShare(listing.token).setTransfersFrozen(true);
    redemption = _attachRedemption(listing.token, msg.sender);
    _redemptions[propertyId] = redemption;
    emit RedemptionCreated(propertyId, redemption);
  }

  function createDistributor(uint256 propertyId) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address distributor) {
    Listing storage listing = _listings[propertyId];
    require(listing.exists, "no listing");
    require(_distributors[propertyId] == address(0), "distributor exists");
    distributor = _attachDistributor(listing.token, msg.sender);
    _distributors[propertyId] = distributor;
    emit DistributorCreated(propertyId, distributor);
  }

  function createListing(
    uint256 propertyId,
    string calldata name_,
    string calldata symbol_,
    address beneficiary,
    uint256 price,
    uint256 cap,
    uint256 minTicket,
    uint256 unlockTime
  ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address token, address offering) {
    return
      _createListing(
        propertyId,
        name_,
        symbol_,
        beneficiary,
        price,
        cap,
        minTicket,
        unlockTime,
        0,
        0,
        0,
        bytes32(0)
      );
  }

  function createListing(
    uint256 propertyId,
    string calldata name_,
    string calldata symbol_,
    address beneficiary,
    uint256 price,
    uint256 cap,
    uint256 minTicket,
    uint256 unlockTime,
    uint256 maxPerWallet,
    uint256 minRaise,
    uint256 closesAt,
    bytes32 documentsHash
  ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address token, address offering) {
    return
      _createListing(
        propertyId,
        name_,
        symbol_,
        beneficiary,
        price,
        cap,
        minTicket,
        unlockTime,
        maxPerWallet,
        minRaise,
        closesAt,
        documentsHash
      );
  }

  function _createListing(
    uint256 propertyId,
    string calldata name_,
    string calldata symbol_,
    address beneficiary,
    uint256 price,
    uint256 cap,
    uint256 minTicket,
    uint256 unlockTime,
    uint256 maxPerWallet,
    uint256 minRaise,
    uint256 closesAt,
    bytes32 documentsHash
  ) internal returns (address token, address offering) {
    require(!_listings[propertyId].exists, "listing exists");
    require(beneficiary != address(0), "zero beneficiary");

    PropertyShare share = PropertyShare(
      ListingDeployer.deployShare(name_, symbol_, address(identity), address(this), unlockTime)
    );
    Offering sale = Offering(
      ListingDeployer.deployOffering(
        Offering.Init({
          usdc: address(usdc),
          token: address(share),
          identity: address(identity),
          beneficiary: beneficiary,
          price: price,
          cap: cap,
          minTicket: minTicket,
          maxPerWallet: maxPerWallet,
          minRaise: minRaise,
          closesAt: closesAt,
          documentsHash: documentsHash,
          admin: address(this)
        })
      )
    );
    share.grantRole(share.MINTER_ROLE(), address(sale));
    share.grantRole(share.BURNER_ROLE(), address(sale));
    share.grantRole(share.DEFAULT_ADMIN_ROLE(), msg.sender);
    share.grantRole(share.AGENT_ROLE(), msg.sender);
    sale.grantRole(sale.DEFAULT_ADMIN_ROLE(), msg.sender);

    _listings[propertyId] = Listing(address(share), address(sale), true);
    propertyIds.push(propertyId);
    emit ListingCreated(propertyId, address(share), address(sale), price, cap);
    return (address(share), address(sale));
  }

  function _attachDistributor(address token, address admin) internal returns (address) {
    address pool = PoolDeployer.deployDistributor(address(usdc), token, admin);
    PropertyShare(token).setDistributor(pool);
    return pool;
  }

  function _closePrimary(address offering) internal {
    Offering(offering).setPaused(true);
  }

  function _attachRedemption(address token, address admin) internal returns (address) {
    address redemption = PoolDeployer.deployRedemption(address(usdc), token, admin);
    PropertyShare(token).grantRole(PropertyShare(token).BURNER_ROLE(), redemption);
    return redemption;
  }
}
