const { ethers } = require('hardhat');
const assert = require('node:assert/strict');

async function revertWith(promise, pattern) {
  try {
    await promise;
    assert.fail('expected revert');
  } catch (err) {
    const text = [err.shortMessage, err.message, err.reason].filter(Boolean).join(' ');
    assert.match(text, pattern);
  }
}

describe('AssetFactory', function () {
  let admin;
  let buyer;
  let extra;
  let factory;
  const cost = ethers.parseEther('0.01');

  before(async function () {
    [admin, buyer, extra] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('AssetFactory');
    factory = await Factory.deploy(
      admin.address,
      'Realty',
      'RLTY',
      'https://example.com/{id}.json',
      'https://example.com/contract.json',
      3600,
      cost
    );
    await factory.waitForDeployment();
  });

  it('deploys with the configured cost and admin role', async function () {
    assert.equal(await factory.getCost(), cost);
    assert.equal(await factory.name(), 'Realty');
    const adminRole = await factory.DEFAULT_ADMIN_ROLE();
    assert.equal(await factory.isRole(adminRole, admin.address), true);
  });

  it('lets the admin mint supply to the owner wallet', async function () {
    await factory.batchMint(admin.address, [1], [100]);
    assert.equal(await factory.balanceOf(admin.address, 1n), 100n);
  });

  it('reverts buy when the buyer is not whitelisted', async function () {
    await revertWith(
      factory.connect(buyer).buy(1, buyer.address, 1, '0x', { value: cost }),
      /not listed/
    );
  });

  it('reverts buy when msg.value does not equal cost', async function () {
    await factory.addToWhitelist(1, buyer.address);
    await revertWith(
      factory.connect(buyer).buy(1, buyer.address, 1, '0x', { value: cost + 1n }),
      /Value is not correct/
    );
  });

  it('transfers a token to a whitelisted buyer who pays cost', async function () {
    await factory.connect(buyer).buy(1, buyer.address, 1, '0x', { value: cost });
    assert.equal(await factory.balanceOf(buyer.address, 1n), 1n);
    assert.equal(await factory.balanceOf(admin.address, 1n), 99n);
  });

  it('pauses purchases', async function () {
    await factory.addToWhitelist(1, extra.address);
    await factory.setPaused(true);
    await revertWith(
      factory.connect(extra).buy(1, extra.address, 1, '0x', { value: cost }),
      /paused/
    );
    await factory.setPaused(false);
  });
});
