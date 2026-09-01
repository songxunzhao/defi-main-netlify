const hre = require('hardhat');
const { deployIdentityStack } = require('./identity-stack');

const { ethers } = hre;

async function main() {
  const network = hre.network.name;
  const usdcAddress = process.env.USDC_ADDRESS;
  if ((network === 'base' || network === 'mainnet') && !usdcAddress) {
    throw new Error(`Set USDC_ADDRESS to canonical USDC before deploying to ${network}. MockUSDC is not allowed there.`);
  }

  const [deployer] = await ethers.getSigners();

  let usdc;
  if (usdcAddress) {
    usdc = await ethers.getContractAt('MockUSDC', usdcAddress);
    console.log('Using existing USDC at', usdcAddress);
  } else {
    const USDC = await ethers.getContractFactory('MockUSDC');
    usdc = await USDC.deploy();
    await usdc.waitForDeployment();
    console.log('MockUSDC deployed at', await usdc.getAddress());
    await usdc.mint(deployer.address, 1_000_000n * 1_000_000n);
    console.log('Minted 1,000,000 mock USDC to', deployer.address);
  }

  const { identity, issuer, onboarder } = await deployIdentityStack(ethers, deployer.address);

  const PoolDeployer = await ethers.getContractFactory('PoolDeployer');
  const poolDeployer = await PoolDeployer.deploy();
  await poolDeployer.waitForDeployment();
  const ListingDeployer = await ethers.getContractFactory('ListingDeployer');
  const listingDeployer = await ListingDeployer.deploy();
  await listingDeployer.waitForDeployment();
  const Factory = await ethers.getContractFactory('PropertyFactory', {
    libraries: {
      PoolDeployer: await poolDeployer.getAddress(),
      ListingDeployer: await listingDeployer.getAddress(),
    },
  });
  const factory = await Factory.deploy(
    deployer.address,
    await identity.getAddress(),
    await usdc.getAddress()
  );
  await factory.waitForDeployment();

  const listings = [
    { id: 1, name: 'Downtown Apt', symbol: 'APT', priceUsd: 450, cap: 1000 },
    { id: 3, name: 'Office Tower', symbol: 'OFF', priceUsd: 3500, cap: 1000 },
    { id: 5, name: 'Retail Space', symbol: 'RET', priceUsd: 680, cap: 1000 },
  ];

  for (const item of listings) {
    const price = BigInt(item.priceUsd) * 1_000_000n;
    await factory.createListing(
      item.id,
      item.name,
      item.symbol,
      deployer.address,
      price,
      item.cap,
      1,
      0
    );
    const listing = await factory.getListing(item.id);
    const distTx = await factory.createDistributor(item.id);
    await distTx.wait();
    console.log(
      `Listing ${item.id} token=${listing.token} offering=${listing.offering} distributor=${await factory.getDistributor(item.id)} price=${item.priceUsd} USDC`
    );
  }

  const Market = await ethers.getContractFactory('ShareMarket');
  const market = await Market.deploy(
    deployer.address,
    await factory.getAddress(),
    await identity.getAddress(),
    await usdc.getAddress()
  );
  await market.waitForDeployment();
  console.log('ShareMarket deployed at', await market.getAddress());

  console.log('\nSet these in .env:');
  console.log('VITE_IDENTITY_REGISTRY_ADDRESS=' + (await identity.getAddress()));
  console.log('VITE_CLAIM_ISSUER_ADDRESS=' + (await issuer.getAddress()));
  console.log('VITE_INVESTOR_ONBOARDER_ADDRESS=' + (await onboarder.getAddress()));
  console.log('VITE_USDC_ADDRESS=' + (await usdc.getAddress()));
  console.log('VITE_PROPERTY_FACTORY_ADDRESS=' + (await factory.getAddress()));
  console.log('VITE_SHARE_MARKET_ADDRESS=' + (await market.getAddress()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
