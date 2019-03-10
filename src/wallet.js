const fs = require('fs'),
  path = require('path'),
  EC = require("elliptic").ec,
  R = require('ramda');

const ec = new EC("secp256k1");

const privateKeyLocation = path.join(__dirname, 'privateKey');

const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, 'utf-8');
  return buffer.toString();
};

const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = ec.keyFromPrivate(privateKey, 'hex');
  return key.getPublic().encode('hex');
};

const getBalance = (address, uTxOutList) => R.pipe(
  R.filter(uTxO => uTxO.address === address),
  R.map(R.prop('amount')),
  R.sum)(uTxOutList);

const initWallet = () => {
  if (fs.existsSync(privateKeyLocation)) {
    return;
  }

  const newPrivateKey = generatePrivateKey();

  fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

module.exports = {
  initWallet
}