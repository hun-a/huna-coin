const fs = require('fs'),
  path = require('path'),
  EC = require("elliptic").ec,
  R = require('ramda'),
  Transactions = require('./transactions');

const {
  getPublicKey, getTxId, signTxIn, TxIn, Transaction, TxOut
} = Transactions;

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
  R.sum
)(uTxOutList);

const initWallet = () => {
  if (fs.existsSync(privateKeyLocation)) {
    return;
  }

  const newPrivateKey = generatePrivateKey();

  fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

const findAmountInUTxOuts = (amountNeeded, myUTxOuts) => {
  let currentAmount = 0;
  const includedUTxOuts = [];
  for (const myUTxOut of myUTxOuts) {
    includedUTxOuts.push(myUTxOut);
    currentAmount += myUTxOut.amount;
    if (currentAmount >= amountNeeded) {
      const leftOverAmount = currentAmount - amountNeeded;
      return { includedUTxOuts, leftOverAmount };
    }
  }
  throw Error('Not enough founds');
};

const createTxOut = (receierAddress, myAddress, amount, leftOverAmount) => {
  const receiverTxOut = new TxOut(receierAddress, amount);
  if (leftOverAmount === 0) {
    return [receiverTxOut];
  } else {
    const leftOverTxOut = new TxOut(myAddress, leftOverAmount);
    return [receiverTxOut, leftOverTxOut];
  }
};

const filterUTxOutsFromMempool = (uTxOutList, mempool) => {
  const txIns = R.pipe(
    R.map(R.prop("txIns")),
    R.flatten
  )(mempool);

  const removables = [];

  for (const uTxOut of uTxOutList) {
    const txIn = txIns.find(
      tIn => tIn.txOutIndex === uTxOut.txOutIndex && tIn.txOutId === uTxOut.txOutId
    );
    if (!R.isNil(txIn)) {
      removables.push(uTxOut);
    }
  }

  return R.without(removables, uTxOutList);
};

const createTx = (receiverAddress, amount, privateKey, uTxOutList, mempool) => {
  const myAddress = getPublicKey(privateKey);
  const myUTxOuts = uTxOutList.filter(uTxO => uTxO.address === myAddress);

  const filteredUTxOuts = filterUTxOutsFromMempool(myUTxOuts, mempool);

  const { includedUTxOuts, leftOverAmount } = findAmountInUTxOuts(amount, filteredUTxOuts);

  const toUnsignedTxIn = uTxOut => {
    const txIn = new TxIn();
    txIn.txOutId = uTxOut.txOutId;
    txIn.txOutIndex = uTxOut.txOutIndex;
    return txIn;
  };

  const unsignedTxIns = includedUTxOuts.map(toUnsignedTxIn);

  const tx = new Transaction();
  tx.txIns = unsignedTxIns;
  tx.txOuts = createTxOut(receiverAddress, myAddress, amount, leftOverAmount);
  tx.id = getTxId(tx);
  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = signTxIn(tx, index, privateKey, uTxOutList);
    return txIn;
  });

  return tx;
};

module.exports = {
  initWallet,
  getBalance,
  getPublicFromWallet,
  createTx,
  getPrivateFromWallet
}