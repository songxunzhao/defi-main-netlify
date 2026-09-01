/** Average-cost lots and a demo tax worksheet from indexed chain events. Not a K-1. */

function usdcFromRaw(raw) {
  const n = Number(raw || 0);
  if (!Number.isFinite(n)) return 0;
  return n / 1e6;
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.logIndex || 0) - (b.logIndex || 0);
  });
}

function yearBounds(year) {
  const y = Number(year);
  const start = Math.floor(Date.UTC(y, 0, 1) / 1000);
  const end = Math.floor(Date.UTC(y + 1, 0, 1) / 1000);
  return { start, end };
}

function indexWallet(events, wallet, propertyTitles = {}) {
  const addr = String(wallet || '').toLowerCase();
  const mine = sortEvents(events).filter((e) => String(e.wallet || '').toLowerCase() === addr);
  const lots = new Map();

  function lot(propertyId) {
    if (!lots.has(propertyId)) {
      lots.set(propertyId, {
        propertyId,
        propertyTitle: propertyTitles[propertyId] || propertyId,
        shares: 0,
        costUsdc: 0,
        rentClaimedUsdc: 0,
        redeemProceedsUsdc: 0,
        secondaryProceedsUsdc: 0,
      });
    }
    return lots.get(propertyId);
  }

  function reduceShares(row, shares, proceedsUsdc) {
    if (!(shares > 0) || !(row.shares > 0)) return;
    const take = Math.min(shares, row.shares);
    const fraction = take / row.shares;
    row.costUsdc = Math.max(0, row.costUsdc * (1 - fraction));
    row.shares -= take;
    if (proceedsUsdc) {
      // proceeds already recorded by caller
    }
  }

  for (const event of mine) {
    const row = lot(String(event.propertyId));
    const shares = Number(event.shares || 0);
    const usdc = usdcFromRaw(event.usdc);
    if (event.type === 'buy' || event.type === 'fill_buy') {
      row.shares += shares;
      row.costUsdc += usdc;
    } else if (event.type === 'transfer_in') {
      row.shares += shares;
    } else if (event.type === 'transfer_out') {
      reduceShares(row, shares, 0);
    } else if (event.type === 'fill_sell') {
      row.secondaryProceedsUsdc += usdc;
      reduceShares(row, shares, usdc);
    } else if (event.type === 'redeem') {
      row.redeemProceedsUsdc += usdc;
      reduceShares(row, shares, usdc);
    } else if (event.type === 'claim') {
      row.rentClaimedUsdc += usdc;
    }
  }

  const holdings = [...lots.values()].filter(
    (row) =>
      row.shares > 0 ||
      row.rentClaimedUsdc > 0 ||
      row.redeemProceedsUsdc > 0 ||
      row.secondaryProceedsUsdc > 0 ||
      row.costUsdc > 0
  );

  return {
    wallet: addr,
    events: mine,
    holdings,
    totals: holdings.reduce(
      (sum, row) => ({
        shares: sum.shares + row.shares,
        costUsdc: sum.costUsdc + row.costUsdc,
        rentClaimedUsdc: sum.rentClaimedUsdc + row.rentClaimedUsdc,
        redeemProceedsUsdc: sum.redeemProceedsUsdc + row.redeemProceedsUsdc,
        secondaryProceedsUsdc: sum.secondaryProceedsUsdc + row.secondaryProceedsUsdc,
      }),
      { shares: 0, costUsdc: 0, rentClaimedUsdc: 0, redeemProceedsUsdc: 0, secondaryProceedsUsdc: 0 }
    ),
  };
}

function taxPack(events, wallet, year, propertyTitles = {}) {
  const { start, end } = yearBounds(year);
  const snapshot = indexWallet(
    events.filter((e) => (e.timestamp || 0) < end),
    wallet,
    propertyTitles
  );
  const yearEvents = snapshot.events.filter((e) => e.timestamp >= start && e.timestamp < end);
  const yearIndex = indexWallet(yearEvents, wallet, propertyTitles);

  return {
    disclaimer:
      'Demo tax worksheet only. Not a Schedule K-1, Form 1099, or tax advice. Cost basis is average cost from indexed buys and fills; P2P transfers add shares at zero basis.',
    year: Number(year),
    wallet: snapshot.wallet,
    holdings: snapshot.holdings,
    yearActivity: yearIndex.holdings,
    events: yearEvents,
    totals: snapshot.totals,
    yearTotals: yearIndex.totals,
  };
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function taxCsv(pack) {
  const lines = [
    `# ${pack.disclaimer}`,
    `# year=${pack.year} wallet=${pack.wallet}`,
    '',
    'section,propertyId,propertyTitle,shares,costUsdc,rentClaimedUsdc,redeemProceedsUsdc,secondaryProceedsUsdc',
  ];
  for (const row of pack.holdings) {
    lines.push(
      [
        'ending-position',
        row.propertyId,
        csvEscape(row.propertyTitle),
        row.shares,
        row.costUsdc.toFixed(6),
        row.rentClaimedUsdc.toFixed(6),
        row.redeemProceedsUsdc.toFixed(6),
        row.secondaryProceedsUsdc.toFixed(6),
      ].join(',')
    );
  }
  lines.push('');
  lines.push('txHash,blockNumber,timestamp,type,propertyId,shares,usdc,counterparty');
  for (const event of pack.events) {
    lines.push(
      [
        event.txHash,
        event.blockNumber,
        event.timestamp,
        event.type,
        event.propertyId,
        event.shares,
        usdcFromRaw(event.usdc).toFixed(6),
        event.counterparty || '',
      ].join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

module.exports = { indexWallet, taxPack, taxCsv, usdcFromRaw, yearBounds, sortEvents };
