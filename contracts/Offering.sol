// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IdentityRegistry.sol";
import "./PropertyShare.sol";

/// @title Offering
/// @notice Primary sale of PropertyShare for USDC. Price is charged per share.
///         Optional escrow (closesAt > 0) holds USDC until finalize; a failed
///         min-raise lets buyers refund. A non-zero documentsHash requires an
///         EIP-712 Subscription signature bound to that hash.
contract Offering is AccessControl, EIP712 {
  bytes32 public constant SUBSCRIPTION_TYPEHASH =
    keccak256(
      "Subscription(address investor,address offering,bytes32 documentsHash,uint256 amount,uint256 nonce,uint256 deadline)"
    );

  IERC20 public immutable usdc;
  PropertyShare public immutable token;
  IdentityRegistry public immutable identity;
  address public immutable beneficiary;

  uint256 public price;
  uint256 public cap;
  uint256 public minTicket;
  uint256 public maxPerWallet;
  uint256 public minRaise;
  uint256 public closesAt;
  bytes32 public documentsHash;
  uint256 public sold;
  bool public paused;
  bool public finalized;
  bool public successful;

  mapping(address => uint256) public purchased;
  mapping(address => uint256) public nonces;

  event Bought(address indexed buyer, uint256 amount, uint256 cost);
  event ParamsUpdated(uint256 price, uint256 cap, uint256 minTicket, uint256 maxPerWallet);
  event DocumentsHashUpdated(bytes32 documentsHash);
  event Paused(bool paused);
  event Finalized(bool successful, uint256 sold);
  event Refunded(address indexed buyer, uint256 amount, uint256 cost);

  struct Init {
    address usdc;
    address token;
    address identity;
    address beneficiary;
    uint256 price;
    uint256 cap;
    uint256 minTicket;
    uint256 maxPerWallet;
    uint256 minRaise;
    uint256 closesAt;
    bytes32 documentsHash;
    address admin;
  }

  constructor(Init memory p) EIP712("RealtyChain Offering", "1") {
    require(
      p.usdc != address(0) &&
        p.token != address(0) &&
        p.identity != address(0) &&
        p.beneficiary != address(0) &&
        p.admin != address(0),
      "zero address"
    );
    require(p.price > 0 && p.cap > 0 && p.minTicket > 0, "invalid params");
    uint256 maxWallet = p.maxPerWallet == 0 ? p.cap : p.maxPerWallet;
    require(maxWallet <= p.cap && p.minTicket <= maxWallet, "bad max");
    require(p.minRaise <= p.cap, "bad min raise");
    require(p.closesAt > 0 || p.minRaise == 0, "need close time");
    if (p.closesAt > 0) {
      require(p.closesAt > block.timestamp, "closes in past");
    }
    usdc = IERC20(p.usdc);
    token = PropertyShare(p.token);
    identity = IdentityRegistry(p.identity);
    beneficiary = p.beneficiary;
    price = p.price;
    cap = p.cap;
    minTicket = p.minTicket;
    maxPerWallet = maxWallet;
    minRaise = p.minRaise;
    closesAt = p.closesAt;
    documentsHash = p.documentsHash;
    _grantRole(DEFAULT_ADMIN_ROLE, p.admin);
  }

  function setPaused(bool paused_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    paused = paused_;
    emit Paused(paused_);
  }

  function setParams(
    uint256 price_,
    uint256 cap_,
    uint256 minTicket_,
    uint256 maxPerWallet_
  ) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!finalized, "finalized");
    require(price_ > 0 && cap_ >= sold && minTicket_ > 0, "invalid params");
    uint256 maxWallet = maxPerWallet_ == 0 ? cap_ : maxPerWallet_;
    require(maxWallet <= cap_ && minTicket_ <= maxWallet, "bad max");
    price = price_;
    cap = cap_;
    minTicket = minTicket_;
    maxPerWallet = maxWallet;
    emit ParamsUpdated(price_, cap_, minTicket_, maxWallet);
  }

  function setDocumentsHash(bytes32 hash_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(sold == 0, "already sold");
    documentsHash = hash_;
    emit DocumentsHashUpdated(hash_);
  }

  function remaining() public view returns (uint256) {
    return cap - sold;
  }

  function quote(uint256 amount) public view returns (uint256) {
    return price * amount;
  }

  function escrowed() public view returns (bool) {
    return closesAt > 0;
  }

  /// @notice Unsigned buy. Reverts if a documents hash is set; use subscribe().
  function buy(uint256 amount) external {
    require(documentsHash == bytes32(0), "sign required");
    _purchase(amount);
  }

  /// @notice Signed subscription bound to documentsHash (PPM / OA keccak).
  function subscribe(uint256 amount, uint256 deadline, bytes calldata signature) external {
    require(documentsHash != bytes32(0), "no documents");
    _verifySubscription(amount, deadline, signature);
    _purchase(amount);
  }

  function finalize() external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(!finalized, "finalized");
    require(closesAt > 0, "not escrow");
    require(block.timestamp >= closesAt || sold == cap, "not closed");
    finalized = true;
    successful = sold >= minRaise;
    paused = true;
    if (successful) {
      uint256 balance = usdc.balanceOf(address(this));
      if (balance > 0) {
        bool ok = usdc.transfer(beneficiary, balance);
        require(ok, "usdc transfer failed");
      }
    }
    emit Finalized(successful, sold);
  }

  function refund() external {
    require(finalized && !successful, "not failed");
    uint256 amount = purchased[msg.sender];
    require(amount > 0, "nothing to refund");
    require(token.balanceOf(msg.sender) >= amount, "shares moved");
    purchased[msg.sender] = 0;
    sold -= amount;
    uint256 cost = quote(amount);
    token.burnFrom(msg.sender, amount);
    bool ok = usdc.transfer(msg.sender, cost);
    require(ok, "usdc transfer failed");
    emit Refunded(msg.sender, amount, cost);
  }

  function _verifySubscription(uint256 amount, uint256 deadline, bytes calldata signature) internal {
    require(block.timestamp <= deadline, "sig expired");
    uint256 nonce = nonces[msg.sender];
    bytes32 structHash = keccak256(
      abi.encode(
        SUBSCRIPTION_TYPEHASH,
        msg.sender,
        address(this),
        documentsHash,
        amount,
        nonce,
        deadline
      )
    );
    address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
    require(signer == msg.sender, "bad signature");
    nonces[msg.sender] = nonce + 1;
  }

  function _purchase(uint256 amount) internal {
    require(!paused && !finalized, "paused");
    if (closesAt > 0) {
      require(block.timestamp < closesAt, "closed");
    }
    require(identity.isVerified(msg.sender), "not verified");
    require(!identity.isFrozen(msg.sender), "frozen");
    require(amount >= minTicket, "below min ticket");
    require(sold + amount <= cap, "exceeds cap");
    require(purchased[msg.sender] + amount <= maxPerWallet, "exceeds wallet max");

    uint256 cost = quote(amount);
    sold += amount;
    purchased[msg.sender] += amount;

    address payTo = closesAt > 0 ? address(this) : beneficiary;
    bool ok = usdc.transferFrom(msg.sender, payTo, cost);
    require(ok, "usdc transfer failed");

    token.mint(msg.sender, amount);
    emit Bought(msg.sender, amount, cost);
  }
}
