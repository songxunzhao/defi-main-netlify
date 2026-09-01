function sanitizeUser(user) {
  if (!user) return null;
  const kycStatus = user.kycStatus || 'unverified';
  const accredited = Boolean(user.accredited);
  const walletAddress = user.walletAddress || null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: user.role || 'user',
    kycStatus,
    accredited,
    walletAddress,
    kyc: user.kyc
      ? {
          legalName: user.kyc.legalName || null,
          country: user.kyc.country || null,
          submittedAt: user.kyc.submittedAt || null,
          reviewedAt: user.kyc.reviewedAt || null,
          reviewNote: user.kyc.reviewNote || null,
        }
      : null,
    user_metadata: { name: user.name || null },
  };
}

module.exports = { sanitizeUser };
