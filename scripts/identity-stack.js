/** Deploy ERC-3643-shaped identity: topics, trusted issuers, claim issuer, registry, onboarder. */

async function deployIdentityStack(ethers, admin) {
  const Topics = await ethers.getContractFactory('ClaimTopicsRegistry');
  const topics = await Topics.deploy(admin);
  await topics.waitForDeployment();

  const Trusted = await ethers.getContractFactory('TrustedIssuersRegistry');
  const trusted = await Trusted.deploy(admin);
  await trusted.waitForDeployment();

  const Issuer = await ethers.getContractFactory('ClaimIssuer');
  const issuer = await Issuer.deploy(admin);
  await issuer.waitForDeployment();

  const Identity = await ethers.getContractFactory('IdentityRegistry');
  const identity = await Identity.deploy(admin, await topics.getAddress(), await trusted.getAddress());
  await identity.waitForDeployment();

  await topics.addClaimTopic(1);
  await topics.addClaimTopic(2);
  await trusted.addTrustedIssuer(await issuer.getAddress(), [1n, 2n]);

  const IdentityDeployer = await ethers.getContractFactory('IdentityDeployer');
  const identityDeployer = await IdentityDeployer.deploy();
  await identityDeployer.waitForDeployment();

  const Onboarder = await ethers.getContractFactory('InvestorOnboarder', {
    libraries: {
      IdentityDeployer: await identityDeployer.getAddress(),
    },
  });
  const onboarder = await Onboarder.deploy(admin, await identity.getAddress(), await issuer.getAddress());
  await onboarder.waitForDeployment();

  await issuer.grantRole(await issuer.ISSUER_ROLE(), await onboarder.getAddress());
  await identity.grantRole(await identity.REGISTRAR_ROLE(), await onboarder.getAddress());

  return { topics, trusted, issuer, identity, onboarder, identityDeployer };
}

const ZERO = '0x0000000000000000000000000000000000000000';

async function verify(onboarder, registry, wallet, accredited = true) {
  if ((await registry.identity(wallet)) !== ZERO) return;
  await onboarder.onboard(wallet, 840, accredited);
}

module.exports = { deployIdentityStack, verify };
