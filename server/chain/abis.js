const { parseAbiItem } = require('viem');

const factoryAbi = [
  {
    type: 'function',
    name: 'listingCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'propertyIds',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getListing',
    stateMutability: 'view',
    inputs: [{ name: 'propertyId', type: 'uint256' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'offering', type: 'address' },
      { name: 'exists', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getDistributor',
    stateMutability: 'view',
    inputs: [{ name: 'propertyId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getRedemption',
    stateMutability: 'view',
    inputs: [{ name: 'propertyId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
];

const boughtEvent = parseAbiItem('event Bought(address indexed buyer, uint256 amount, uint256 cost)');
const claimedEvent = parseAbiItem('event Claimed(address indexed account, uint256 amount)');
const redeemedEvent = parseAbiItem('event Redeemed(address indexed account, uint256 shares, uint256 payout)');
const listedEvent = parseAbiItem(
  'event Listed(uint256 indexed id, address indexed seller, uint256 indexed propertyId, uint256 amount, uint256 price)'
);
const filledEvent = parseAbiItem('event Filled(uint256 indexed id, address indexed buyer, uint256 amount, uint256 cost)');
const cancelledEvent = parseAbiItem('event Cancelled(uint256 indexed id)');
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

const ZERO = '0x0000000000000000000000000000000000000000';

module.exports = {
  factoryAbi,
  boughtEvent,
  claimedEvent,
  redeemedEvent,
  listedEvent,
  filledEvent,
  cancelledEvent,
  transferEvent,
  ZERO,
};
