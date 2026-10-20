// Demo only: no provider requests, credentials, or account state are involved.
export function openWalletDemo() {
  const popup = window.open('/wallet-demo.html', 'realtychain-wallet-simulation', 'popup=yes,width=420,height=640');
  if (!popup) return false;
  popup.opener = null;
  popup.focus();
  return true;
}
