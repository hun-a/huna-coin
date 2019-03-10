const fs = require('fs'),
  path = require('path'),
  EC = require("elliptic").ec;

const ec = new EC("secp256k1");

const privateKeyLocation = path.join(__dirname, 'privateKey');

const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

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