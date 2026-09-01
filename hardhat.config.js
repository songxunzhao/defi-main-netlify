require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');

function deployerAccounts() {
  const key = process.env.DEPLOYER_PRIVATE_KEY || '';
  if (/^0x[0-9a-fA-F]{64}$/.test(key)) return [key];
  return [];
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './contracts/cache',
    artifacts: './contracts/artifacts',
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      accounts: deployerAccounts(),
    },
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: deployerAccounts(),
    },
  },
};
