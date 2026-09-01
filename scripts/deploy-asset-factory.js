const hre = require('hardhat');

const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const cost = ethers.parseEther(process.env.TOKEN_COST_ETH || '0.01');
  const expiry = Number(process.env.WHITELIST_EXPIRY_SECONDS || 7 * 24 * 3600);

  const Factory = await ethers.getContractFactory('AssetFactory');
  const factory = await Factory.deploy(
    deployer.address,
    process.env.TOKEN_NAME || 'RealtyChain Property',
    process.env.TOKEN_SYMBOL || 'RCP',
    process.env.TOKEN_URI || 'https://example.com/metadata/{id}.json',
    process.env.CONTRACT_URI || 'https://example.com/contract.json',
    expiry,
    cost
  );
  await factory.waitForDeployment();
  const address = await factory.getAddress();

  const ids = [1, 2, 3, 4, 5, 6];
  const amounts = ids.map(() => 1000);
  await factory.batchMint(deployer.address, ids, amounts);

  console.log('AssetFactory deployed at', address);
  console.log('Minted 1000 units of token ids 1-6 to', deployer.address);
  console.log('Set VITE_ASSET_FACTORY_ADDRESS=' + address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
