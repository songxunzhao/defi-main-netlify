const { ethers } = require('hardhat');
const assert = require('node:assert/strict');
const { deployIdentityStack, verify } = require('../scripts/identity-stack');

function revertReason(err) {
  const parts = [err.shortMessage, err.message, err.reason];
  const data = typeof err.data === 'string' ? err.data : err.data?.data;
  if (typeof data === 'string' && data.startsWith('0x08c379a0') && data.length >= 138) {
    try {
      const [text] = ethers.AbiCoder.defaultAbiCoder().decode(['string'], `0x${data.slice(10)}`);
      parts.push(text);
    } catch {
      // keep the raw fields
    }
  }
  return parts.filter(Boolean).join(' ');
}

async function revertWith(promise, pattern) {
  try {
    await promise;
    assert.fail('expected revert');
  } catch (err) {
    assert.match(revertReason(err), pattern);
  }
}

async function deployPropertyFactory(admin, identityAddr, usdcAddr) {
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
  const factory = await Factory.deploy(admin, identityAddr, usdcAddr);
  await factory.waitForDeployment();
  return factory;
}

const SUBSCRIPTION_TYPES = {
  Subscription: [
    { name: 'investor', type: 'address' },
    { name: 'offering', type: 'address' },
    { name: 'documentsHash', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

async function signSubscription(signer, offeringAddr, documentsHash, amount, nonce, deadline) {
  const network = await ethers.provider.getNetwork();
  return signer.signTypedData(
    {
      name: 'RealtyChain Offering',
      version: '1',
      chainId: network.chainId,
      verifyingContract: offeringAddr,
    },
    SUBSCRIPTION_TYPES,
    {
      investor: signer.address,
      offering: offeringAddr,
      documentsHash,
      amount,
      nonce,
      deadline,
    }
  );
}

describe('Property protocol', function () {
  let admin;
  let buyer;
  let buyer2;
  let outsider;
  let usdc;
  let identity;
  let issuer;
  let onboarder;
  let trusted;
  let factory;
  const price = 1_000_000n; // 1 USDC (6 decimals)
  const cap = 1000n;
  const minTicket = 1n;

  before(async function () {
    [admin, buyer, buyer2, outsider] = await ethers.getSigners();
    const USDC = await ethers.getContractFactory('MockUSDC');
    usdc = await USDC.deploy();
    await usdc.waitForDeployment();

    const stack = await deployIdentityStack(ethers, admin.address);
    identity = stack.identity;
    issuer = stack.issuer;
    onboarder = stack.onboarder;
    trusted = stack.trusted;

    factory = await deployPropertyFactory(admin.address, await identity.getAddress(), await usdc.getAddress());
  });

  it('creates a listing and records it by property id', async function () {
    await factory.createListing(1, 'Downtown Apt', 'APT', admin.address, price, cap, minTicket, 0);
    const listing = await factory.getListing(1);
    assert.equal(listing.exists, true);
    assert.notEqual(listing.token, ethers.ZeroAddress);
    assert.notEqual(listing.offering, ethers.ZeroAddress);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    assert.equal(await token.decimals(), 0n);
  });

  it('rejects a second listing for the same property id', async function () {
    await revertWith(
      factory.createListing(1, 'Dup', 'DUP', admin.address, price, cap, minTicket, 0),
      /listing exists/
    );
  });

  it('reverts buy when the wallet is not verified', async function () {
    const listing = await factory.getListing(1);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    await usdc.mint(buyer.address, 10_000_000n);
    await usdc.connect(buyer).approve(listing.offering, 10_000_000n);
    await revertWith(offering.connect(buyer).buy(2), /not verified/);
  });

  it('sells amount * price in USDC to a verified buyer', async function () {
    await verify(onboarder, identity, buyer.address, true);
    const listing = await factory.getListing(1);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    const token = await ethers.getContractAt('PropertyShare', listing.token);

    const treasuryBefore = await usdc.balanceOf(admin.address);
    await offering.connect(buyer).buy(3);
    assert.equal(await token.balanceOf(buyer.address), 3n);
    assert.equal(await offering.sold(), 3n);
    assert.equal(await usdc.balanceOf(admin.address), treasuryBefore + price * 3n);
  });

  it('allows a second verified holder of the same property', async function () {
    await verify(onboarder, identity, buyer2.address, true);
    await usdc.mint(buyer2.address, 5_000_000n);
    const listing = await factory.getListing(1);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    await usdc.connect(buyer2).approve(listing.offering, 5_000_000n);
    await offering.connect(buyer2).buy(2);
    assert.equal(await token.balanceOf(buyer.address), 3n);
    assert.equal(await token.balanceOf(buyer2.address), 2n);
  });

  it('reverts when the purchase exceeds remaining cap', async function () {
    const listing = await factory.getListing(1);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    await revertWith(offering.connect(buyer).buy(1000), /exceeds cap/);
  });

  it('blocks secondary transfer to an unverified wallet', async function () {
    const listing = await factory.getListing(1);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    await revertWith(token.connect(buyer).transfer(outsider.address, 1n), /not verified/);
  });

  it('allows secondary transfer between verified wallets when unlocked', async function () {
    const listing = await factory.getListing(1);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    await token.connect(buyer).transfer(buyer2.address, 1n);
    assert.equal(await token.balanceOf(buyer.address), 2n);
    assert.equal(await token.balanceOf(buyer2.address), 3n);
  });

  it('enforces lockup on secondary transfers', async function () {
    const unlock = (await ethers.provider.getBlock('latest')).timestamp + 3600;
    await factory.createListing(2, 'Locked Villa', 'VIL', admin.address, price, cap, minTicket, unlock);
    await verify(onboarder, identity, buyer.address, true);
    const listing = await factory.getListing(2);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    await usdc.connect(buyer).approve(listing.offering, price * 2n);
    await offering.connect(buyer).buy(2);
    await revertWith(token.connect(buyer).transfer(buyer2.address, 1n), /transfer locked/);
  });

  it('pays rent pro-rata and withholds past distributions from new buyers', async function () {
    await factory.createListing(10, 'Rental Hall', 'HAL', admin.address, price, cap, minTicket, 0);
    await verify(onboarder, identity, buyer.address, true);
    await verify(onboarder, identity, buyer2.address, true);
    const listing = await factory.getListing(10);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    await usdc.mint(buyer.address, price * 4n);
    await usdc.connect(buyer).approve(listing.offering, price * 4n);
    await offering.connect(buyer).buy(4);

    const distTx = await factory.createDistributor(10);
    await distTx.wait();
    const distAddr = await factory.getDistributor(10);
    assert.notEqual(distAddr, ethers.ZeroAddress);
    const distributor = await ethers.getContractAt('Distributor', distAddr);

    const rent = 100_000_000n; // 100 USDC
    await usdc.mint(admin.address, rent);
    await usdc.connect(admin).approve(distAddr, rent);
    await distributor.connect(admin).deposit(rent);
    assert.equal(await distributor.pending(buyer.address), rent);

    await usdc.mint(buyer2.address, price * 4n);
    await usdc.connect(buyer2).approve(listing.offering, price * 4n);
    await offering.connect(buyer2).buy(4);
    assert.equal(await distributor.pending(buyer2.address), 0n);
    assert.equal(await distributor.pending(buyer.address), rent);

    const before = await usdc.balanceOf(buyer.address);
    await distributor.connect(buyer).claim();
    assert.equal(await usdc.balanceOf(buyer.address), before + rent);
    assert.equal(await distributor.pending(buyer.address), 0n);
  });

  it('keeps unclaimed rent with the seller after a secondary transfer', async function () {
    const listing = await factory.getListing(10);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    const distributor = await ethers.getContractAt('Distributor', await factory.getDistributor(10));
    const rent = 40_000_000n; // 40 USDC; supply is 8 shares so 5 USDC/share
    await usdc.mint(admin.address, rent);
    await usdc.connect(admin).approve(await distributor.getAddress(), rent);
    await distributor.connect(admin).deposit(rent);

    const buyerPendingBefore = await distributor.pending(buyer.address);
    await token.connect(buyer).transfer(buyer2.address, 2n);
    assert.equal(await distributor.pending(buyer.address), buyerPendingBefore);
    assert.equal(await token.balanceOf(buyer.address), 2n);
    assert.equal(await token.balanceOf(buyer2.address), 6n);
    // buyer2 only earns on shares they already held (4) for this round: 40 * 4/8 = 20 USDC
    assert.equal(await distributor.pending(buyer2.address), 20_000_000n);
  });

  describe('ShareMarket', function () {
    let market;
    let listing;
    let token;

    before(async function () {
      const Market = await ethers.getContractFactory('ShareMarket');
      market = await Market.deploy(
        admin.address,
        await factory.getAddress(),
        await identity.getAddress(),
        await usdc.getAddress()
      );
      await market.waitForDeployment();
      listing = await factory.getListing(1);
      token = await ethers.getContractAt('PropertyShare', listing.token);
    });

    it('rejects a list from an unverified wallet', async function () {
      await revertWith(market.connect(outsider).list(1, 1n, price), /not verified/);
    });

    it('lists and fills a KYC-gated ask in USDC', async function () {
      const sellerBal = await token.balanceOf(buyer.address);
      assert.ok(sellerBal >= 1n);
      await token.connect(buyer).approve(await market.getAddress(), 1n);
      const listTx = await market.connect(buyer).list(1, 1n, price);
      await listTx.wait();
      const askId = (await market.nextAskId()) - 1n;
      const ask = await market.getAsk(askId);
      assert.equal(ask.active, true);
      assert.equal(ask.seller, buyer.address);
      assert.equal(ask.amount, 1n);

      await revertWith(market.connect(outsider).fill(askId, 1n), /not verified/);
      await revertWith(market.connect(buyer).fill(askId, 1n), /self fill/);

      await usdc.mint(buyer2.address, price);
      await usdc.connect(buyer2).approve(await market.getAddress(), price);
      const sellerUsdcBefore = await usdc.balanceOf(buyer.address);
      const buyer2SharesBefore = await token.balanceOf(buyer2.address);
      await market.connect(buyer2).fill(askId, 1n);
      assert.equal(await token.balanceOf(buyer.address), sellerBal - 1n);
      assert.equal(await token.balanceOf(buyer2.address), buyer2SharesBefore + 1n);
      assert.equal(await usdc.balanceOf(buyer.address), sellerUsdcBefore + price);
      const filled = await market.getAsk(askId);
      assert.equal(filled.active, false);
      assert.equal(filled.amount, 0n);
    });

    it('lets the seller cancel an open ask', async function () {
      await token.connect(buyer).approve(await market.getAddress(), 1n);
      await market.connect(buyer).list(1, 1n, price);
      const askId = (await market.nextAskId()) - 1n;
      await market.connect(buyer).cancel(askId);
      const ask = await market.getAsk(askId);
      assert.equal(ask.active, false);
      await revertWith(market.connect(buyer2).fill(askId, 1n), /inactive/);
    });

    it('blocks listing while the share token is locked', async function () {
      await revertWith(market.connect(buyer).list(2, 1n, price), /transfer locked/);
    });
  });

  it('freezes transfers and pays sale proceeds on redeem', async function () {
    await factory.createListing(11, 'Exit House', 'EXH', admin.address, price, cap, minTicket, 0);
    await verify(onboarder, identity, buyer.address, true);
    await verify(onboarder, identity, buyer2.address, true);
    const listing = await factory.getListing(11);
    const offering = await ethers.getContractAt('Offering', listing.offering);
    const token = await ethers.getContractAt('PropertyShare', listing.token);
    await usdc.mint(buyer.address, price * 4n);
    await usdc.connect(buyer).approve(listing.offering, price * 4n);
    await offering.connect(buyer).buy(4);
    await usdc.mint(buyer2.address, price * 4n);
    await usdc.connect(buyer2).approve(listing.offering, price * 4n);
    await offering.connect(buyer2).buy(4);

    await factory.createRedemption(11);
    const redemptionAddr = await factory.getRedemption(11);
    assert.notEqual(redemptionAddr, ethers.ZeroAddress);
    const redemption = await ethers.getContractAt('Redemption', redemptionAddr);
    assert.equal(await token.transfersFrozen(), true);
    assert.equal(await offering.paused(), true);
    await revertWith(token.connect(buyer).transfer(buyer2.address, 1n), /exit frozen/);
    await revertWith(offering.connect(buyer).buy(1), /paused/);

    const proceeds = 80_000_000n; // 80 USDC; 8 shares → 10 USDC each
    await usdc.mint(admin.address, proceeds);
    await usdc.connect(admin).approve(redemptionAddr, proceeds);
    await redemption.connect(admin).open(proceeds);
    assert.equal(await redemption.opened(), true);
    assert.equal(await redemption.quote(4n), 40_000_000n);

    const buyerUsdc = await usdc.balanceOf(buyer.address);
    await redemption.connect(buyer).redeem(4n);
    assert.equal(await token.balanceOf(buyer.address), 0n);
    assert.equal(await usdc.balanceOf(buyer.address), buyerUsdc + 40_000_000n);

    await redemption.connect(buyer2).redeem(4n);
    assert.equal(await token.totalSupply(), 0n);
    assert.equal(await redemption.totalPaid(), proceeds);
  });

  describe('Compliance', function () {
    let spare;

    before(async function () {
      [, , , , spare] = await ethers.getSigners();
    });

    it('freezes a wallet and blocks buy, transfer, and rent claim', async function () {
      await factory.createListing(20, 'Frozen Loft', 'FRZ', admin.address, price, cap, minTicket, 0);
      await verify(onboarder, identity, spare.address, true);
      await verify(onboarder, identity, buyer2.address, true);
      const listing = await factory.getListing(20);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      const token = await ethers.getContractAt('PropertyShare', listing.token);
      await usdc.mint(spare.address, price * 4n);
      await usdc.connect(spare).approve(listing.offering, price * 4n);
      await offering.connect(spare).buy(4);

      await identity.setAddressFrozen(spare.address, true);
      await revertWith(token.connect(spare).transfer(buyer2.address, 1n), /frozen/);
      await revertWith(offering.connect(spare).buy(1), /frozen/);

      await factory.createDistributor(20);
      const distributor = await ethers.getContractAt('Distributor', await factory.getDistributor(20));
      const rent = 8_000_000n;
      await usdc.mint(admin.address, rent);
      await usdc.connect(admin).approve(await distributor.getAddress(), rent);
      await distributor.connect(admin).deposit(rent);
      await revertWith(distributor.connect(spare).claim(), /frozen/);

      await identity.setAddressFrozen(spare.address, false);
      await token.connect(spare).transfer(buyer2.address, 1n);
      assert.equal(await token.balanceOf(spare.address), 3n);
      const before = await usdc.balanceOf(spare.address);
      await distributor.connect(spare).claim();
      assert.ok((await usdc.balanceOf(spare.address)) > before);
    });

    it('rejects freeze and forced transfer from a non-agent', async function () {
      await revertWith(identity.connect(spare).setAddressFrozen(buyer2.address, true), /AccessControl/);
      const listing = await factory.getListing(20);
      const token = await ethers.getContractAt('PropertyShare', listing.token);
      await revertWith(token.connect(spare).forcedTransfer(spare.address, buyer2.address, 1n), /AccessControl/);
    });

    it('lets an agent forced-transfer despite freeze, lockup, and exit freeze', async function () {
      await identity.setAddressFrozen(spare.address, true);
      const listing = await factory.getListing(20);
      const token = await ethers.getContractAt('PropertyShare', listing.token);
      const spareBefore = await token.balanceOf(spare.address);
      const buyer2Before = await token.balanceOf(buyer2.address);
      await token.connect(admin).forcedTransfer(spare.address, buyer2.address, 1n);
      assert.equal(await token.balanceOf(spare.address), spareBefore - 1n);
      assert.equal(await token.balanceOf(buyer2.address), buyer2Before + 1n);
      await identity.setAddressFrozen(spare.address, false);

      const locked = await factory.getListing(2);
      const lockedToken = await ethers.getContractAt('PropertyShare', locked.token);
      await revertWith(lockedToken.connect(buyer).transfer(buyer2.address, 1n), /transfer locked/);
      const lockedBuyer = await lockedToken.balanceOf(buyer.address);
      await lockedToken.connect(admin).forcedTransfer(buyer.address, buyer2.address, 1n);
      assert.equal(await lockedToken.balanceOf(buyer.address), lockedBuyer - 1n);

      await factory.createListing(22, 'Court House', 'CRT', admin.address, price, cap, minTicket, 0);
      await verify(onboarder, identity, spare.address, true);
      const exitListing = await factory.getListing(22);
      const exitOffering = await ethers.getContractAt('Offering', exitListing.offering);
      const exitToken = await ethers.getContractAt('PropertyShare', exitListing.token);
      await usdc.mint(spare.address, price * 2n);
      await usdc.connect(spare).approve(exitListing.offering, price * 2n);
      await exitOffering.connect(spare).buy(2);
      await factory.createRedemption(22);
      await revertWith(exitToken.connect(spare).transfer(buyer2.address, 1n), /exit frozen/);
      await exitToken.connect(admin).forcedTransfer(spare.address, buyer2.address, 1n);
      assert.equal(await exitToken.balanceOf(spare.address), 1n);
      assert.equal(await exitToken.balanceOf(buyer2.address), 1n);
    });

    it('recovers identity, shares, and parked rent to a replacement wallet', async function () {
      const replacement = (await ethers.getSigners())[5];
      await factory.createListing(21, 'Lost Key', 'KEY', admin.address, price, cap, minTicket, 0);
      await verify(onboarder, identity, spare.address, true);
      const listing = await factory.getListing(21);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      const token = await ethers.getContractAt('PropertyShare', listing.token);
      await usdc.mint(spare.address, price * 4n);
      await usdc.connect(spare).approve(listing.offering, price * 4n);
      await offering.connect(spare).buy(4);

      await factory.createDistributor(21);
      const distributor = await ethers.getContractAt('Distributor', await factory.getDistributor(21));
      const rent = 40_000_000n;
      await usdc.mint(admin.address, rent);
      await usdc.connect(admin).approve(await distributor.getAddress(), rent);
      await distributor.connect(admin).deposit(rent);
      assert.equal(await distributor.pending(spare.address), rent);

      await identity.recoverIdentity(spare.address, replacement.address);
      assert.equal(await identity.isVerified(spare.address), false);
      assert.equal(await identity.isFrozen(spare.address), true);
      assert.equal(await identity.isVerified(replacement.address), true);

      await token.connect(admin).recover(spare.address, replacement.address);
      assert.equal(await token.balanceOf(spare.address), 0n);
      assert.equal(await token.balanceOf(replacement.address), 4n);
      assert.equal(await distributor.pending(spare.address), 0n);
      assert.equal(await distributor.pending(replacement.address), rent);

      await revertWith(token.connect(spare).transfer(buyer2.address, 1n), /frozen/);
      const before = await usdc.balanceOf(replacement.address);
      await distributor.connect(replacement).claim();
      assert.equal(await usdc.balanceOf(replacement.address), before + rent);
    });
  });

  describe('Offering subscription', function () {
    const docsHash = ethers.keccak256(ethers.toUtf8Bytes('demo-ppm'));

    async function deployEscrowListing(propertyId, maxPerWallet, minRaise, closeInSecs) {
      const closesAt = BigInt((await ethers.provider.getBlock('latest')).timestamp + closeInSecs);
      await factory.createListing(
        propertyId,
        'Signed Raise',
        'SUB',
        admin.address,
        price,
        cap,
        minTicket,
        0,
        maxPerWallet,
        minRaise,
        closesAt,
        docsHash
      );
      return factory.getListing(propertyId);
    }

    it('requires a subscription signature when a documents hash is set', async function () {
      const listing = await deployEscrowListing(30, 2n, 4n, 3600);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      await verify(onboarder, identity, buyer.address, true);
      await usdc.mint(buyer.address, price * 4n);
      await usdc.connect(buyer).approve(listing.offering, price * 4n);
      await revertWith(offering.connect(buyer).buy(2), /sign required/);
    });

    it('enforces max per wallet and escrows USDC until a failed raise is refunded', async function () {
      const listing = await deployEscrowListing(31, 2n, 4n, 3600);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      const token = await ethers.getContractAt('PropertyShare', listing.token);
      await verify(onboarder, identity, buyer.address, true);
      await verify(onboarder, identity, buyer2.address, true);
      await usdc.mint(buyer.address, price * 4n);
      await usdc.mint(buyer2.address, price * 4n);
      await usdc.connect(buyer).approve(listing.offering, price * 4n);
      await usdc.connect(buyer2).approve(listing.offering, price * 4n);

      const deadline = BigInt((await ethers.provider.getBlock('latest')).timestamp + 600);
      const treasuryBefore = await usdc.balanceOf(admin.address);
      const sig = await signSubscription(buyer, listing.offering, docsHash, 2n, 0n, deadline);
      await offering.connect(buyer).subscribe(2n, deadline, sig);
      assert.equal(await token.balanceOf(buyer.address), 2n);
      assert.equal(await offering.purchased(buyer.address), 2n);
      assert.equal(await usdc.balanceOf(listing.offering), price * 2n);
      assert.equal(await usdc.balanceOf(admin.address), treasuryBefore);

      const extra = await signSubscription(buyer, listing.offering, docsHash, 1n, 1n, deadline);
      await revertWith(offering.connect(buyer).subscribe(1n, deadline, extra), /exceeds wallet max/);

      const sig2 = await signSubscription(buyer2, listing.offering, docsHash, 1n, 0n, deadline);
      await offering.connect(buyer2).subscribe(1n, deadline, sig2);

      const foreign = await signSubscription(buyer2, listing.offering, docsHash, 1n, 1n, deadline);
      await revertWith(offering.connect(buyer).subscribe(1n, deadline, foreign), /bad signature/);

      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      await revertWith(
        offering.connect(buyer2).subscribe(
          1n,
          BigInt((await ethers.provider.getBlock('latest')).timestamp + 600),
          await signSubscription(
            buyer2,
            listing.offering,
            docsHash,
            1n,
            1n,
            BigInt((await ethers.provider.getBlock('latest')).timestamp + 600)
          )
        ),
        /closed/
      );

      await offering.connect(admin).finalize();
      assert.equal(await offering.finalized(), true);
      assert.equal(await offering.successful(), false);

      const buyerUsdc = await usdc.balanceOf(buyer.address);
      await offering.connect(buyer).refund();
      assert.equal(await token.balanceOf(buyer.address), 0n);
      assert.equal(await usdc.balanceOf(buyer.address), buyerUsdc + price * 2n);
      await offering.connect(buyer2).refund();
      assert.equal(await token.balanceOf(buyer2.address), 0n);
      assert.equal(await usdc.balanceOf(admin.address), treasuryBefore);
    });

    it('releases escrow to the beneficiary when the min raise is met', async function () {
      const listing = await deployEscrowListing(32, 10n, 2n, 3600);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      await verify(onboarder, identity, buyer.address, true);
      await usdc.mint(buyer.address, price * 4n);
      await usdc.connect(buyer).approve(listing.offering, price * 4n);
      const deadline = BigInt((await ethers.provider.getBlock('latest')).timestamp + 600);
      const sig = await signSubscription(buyer, listing.offering, docsHash, 2n, 0n, deadline);
      await offering.connect(buyer).subscribe(2n, deadline, sig);

      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      const treasuryBefore = await usdc.balanceOf(admin.address);
      await offering.connect(admin).finalize();
      assert.equal(await offering.successful(), true);
      assert.equal(await usdc.balanceOf(admin.address), treasuryBefore + price * 2n);
      await revertWith(offering.connect(buyer).refund(), /not failed/);
    });
  });

  describe('Claim-backed identity', function () {
    function claimIdFor(issuerAddr, topic) {
      return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [issuerAddr, topic])
      );
    }

    it('does not verify a registered identity with no KYC claim', async function () {
      const wallet = (await ethers.getSigners())[10];
      const Identity = await ethers.getContractFactory('Identity');
      const bare = await Identity.deploy(wallet.address, await issuer.getAddress());
      await bare.waitForDeployment();
      await identity.registerIdentity(wallet.address, await bare.getAddress(), 840);
      assert.equal(await identity.isVerified(wallet.address), false);

      const listing = await factory.getListing(1);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      await usdc.mint(wallet.address, price);
      await usdc.connect(wallet).approve(listing.offering, price);
      await revertWith(offering.connect(wallet).buy(1), /not verified/);
    });

    it('does not verify a claim from an untrusted issuer', async function () {
      const wallet = (await ethers.getSigners())[11];
      const Rogue = await ethers.getContractFactory('ClaimIssuer');
      const rogue = await Rogue.deploy(admin.address);
      await rogue.waitForDeployment();
      const Identity = await ethers.getContractFactory('Identity');
      const id = await Identity.deploy(wallet.address, await rogue.getAddress());
      await id.waitForDeployment();
      await rogue.issueClaim(await id.getAddress(), 1);
      await rogue.issueClaim(await id.getAddress(), 2);
      await identity.registerIdentity(wallet.address, await id.getAddress(), 840);
      assert.equal(await identity.isVerified(wallet.address), false);

      const listing = await factory.getListing(1);
      const offering = await ethers.getContractAt('Offering', listing.offering);
      await usdc.mint(wallet.address, price);
      await usdc.connect(wallet).approve(listing.offering, price);
      await revertWith(offering.connect(wallet).buy(1), /not verified/);
    });

    it('un-verifies after the KYC claim is revoked', async function () {
      const wallet = (await ethers.getSigners())[12];
      await verify(onboarder, identity, wallet.address, true);
      assert.equal(await identity.isVerified(wallet.address), true);

      const listing = await factory.createListing(40, 'Claim Loft', 'CLM', admin.address, price, cap, minTicket, 0);
      await listing.wait();
      const row = await factory.getListing(40);
      const offering = await ethers.getContractAt('Offering', row.offering);
      const token = await ethers.getContractAt('PropertyShare', row.token);
      await usdc.mint(wallet.address, price * 2n);
      await usdc.connect(wallet).approve(row.offering, price * 2n);
      await offering.connect(wallet).buy(2);
      assert.equal(await token.balanceOf(wallet.address), 2n);

      const identityAddr = await identity.identity(wallet.address);
      await issuer.revokeClaim(identityAddr, claimIdFor(await issuer.getAddress(), 1n));
      assert.equal(await identity.isVerified(wallet.address), false);
      await revertWith(offering.connect(wallet).buy(1), /not verified/);
      await revertWith(token.connect(wallet).transfer(buyer2.address, 1n), /not verified/);
    });

    it('does not verify when the accredited claim (topic 2) is missing', async function () {
      const wallet = (await ethers.getSigners())[13];
      await onboarder.onboard(wallet.address, 840, false);
      assert.equal(await identity.isVerified(wallet.address), false);
    });

    it('onboards then buys on the happy path', async function () {
      const wallet = (await ethers.getSigners())[14];
      await onboarder.onboard(wallet.address, 840, true);
      assert.notEqual(await identity.identity(wallet.address), ethers.ZeroAddress);
      assert.equal(await identity.isVerified(wallet.address), true);
      assert.equal(await identity.investorCountry(wallet.address), 840n);

      await factory.createListing(41, 'Onboard House', 'ONB', admin.address, price, cap, minTicket, 0);
      const row = await factory.getListing(41);
      const offering = await ethers.getContractAt('Offering', row.offering);
      const token = await ethers.getContractAt('PropertyShare', row.token);
      await usdc.mint(wallet.address, price);
      await usdc.connect(wallet).approve(row.offering, price);
      await offering.connect(wallet).buy(1);
      assert.equal(await token.balanceOf(wallet.address), 1n);
    });

    it('rejects onboard from a non-registrar', async function () {
      await revertWith(onboarder.connect(outsider).onboard(outsider.address, 840, true), /AccessControl/);
    });

    it('maps ISO country codes on onboardIso and rejects setVerified', async function () {
      const wallet = (await ethers.getSigners())[16];
      assert.equal(await onboarder.isoToNumeric('US'), 840n);
      assert.equal(await onboarder.isoToNumeric('gb'), 826n);
      await onboarder.onboardIso(wallet.address, 'US', true);
      assert.equal(await identity.investorCountry(wallet.address), 840n);
      assert.equal(await identity.isVerified(wallet.address), true);
      await revertWith(identity.setVerified(wallet.address, true), /use registerIdentity/);
    });

    it('un-verifies after the issuer is removed from the trusted registry', async function () {
      const wallet = (await ethers.getSigners())[15];
      await onboarder.onboard(wallet.address, 840, true);
      assert.equal(await identity.isVerified(wallet.address), true);
      await trusted.removeTrustedIssuer(await issuer.getAddress());
      assert.equal(await identity.isVerified(wallet.address), false);
      await trusted.addTrustedIssuer(await issuer.getAddress(), [1n, 2n]);
      assert.equal(await identity.isVerified(wallet.address), true);
    });
  });
});
