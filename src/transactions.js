const CryptoJS = require("crypto-js");
const R = require("ramda");
const EC = require("elliptic").ec;
const utils = require("./utils");

const ec = new EC("secp256k1");

const COINBASE_AMOUNT = 50;

class TxOut {
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

class TxIn {
  // txOutId
  // txOutIndex
  // Signature
}

class Transaction {
  // ID
  // txIns[]
  // txOuts[]
}

class UTxOut {
  constructor(txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

const getTxId = tx => {
  const txInContent = tx.txIns
    .map(txIn => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, "");

  const txOutContent = tx.txOuts
    .map(txOut => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");

  return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

const findUTxOut = (txOutId, txOutIndex, uTxOutsList) => {
  console.log(txOutId);
  console.log(txOutIndex);
  console.log(uTxOutsList)
  return uTxOutsList.find(
    uTxO => uTxO.txOutId === txOutId && uTxO.txOutIndex === txOutIndex
  );
};

const signTxIn = (tx, txInIndex, privateKey, uTxOutList) => {
  const txIn = tx.txIns[txInIndex];
  const dataToSign = tx.id;
  const referencedUTxOut = findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList);
  if (referencedUTxOut === null || referencedUTxOut === undefined) {
    throw Error("Couldn't find the referenced uTxOut, not signing");
  }
  const referencedAddress = referencedUTxOut.address;
  if (getPublicKey(privateKey) !== referencedAddress) {
    return false;
  }
  const key = ec.keyFromPrivate(privateKey, "hex");
  const signature = utils.toHexString(key.sign(dataToSign).toDER());
  return signature;
};

const getPublicKey = privateKey => ec.keyFromPrivate(privateKey, 'hex')
  .getPublic().encode('hex');

const updateUTxOuts = (newTxs, uTxOutList) => {
  const newUTxOuts = newTxs
    .map(tx =>
      tx.txOuts.map(
        (txOut, index) => new UTxOut(tx.id, index, txOut.address, txOut.amount)
      )
    )
    .reduce((a, b) => a.concat(b), []);

  const spentTxOuts = newTxs
    .map(tx => tx.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  const resultingUTxOuts = uTxOutList
    .filter(uTxO => !findUTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts))
    .concat(newUTxOuts);

  return resultingUTxOuts;
};

const isTxInStructureValid = txIn => {
  if (typeof txIn === null) {
    return false;
  } else if (typeof txIn.signature !== "string") {
    return false;
  } else if (typeof txIn.txOutId !== "string") {
    return false;
  } else if (typeof txIn.txOutIndex !== "number") {
    return false;
  } else {
    return true;
  }
};

const isAddressValid = address => {
  if (address.length !== 130) {
    return false;
  } else if (/^[^a-f0-9]+$/i.test(address)) {
    return false;
  } else if (!address.startsWith("04")) {
    return false;
  } else {
    return true;
  }
};

const isTxOutStructureValid = txOut => {
  if (typeof txOut === null) {
    return false;
  } else if (typeof txOut.address !== "string") {
    return false;
  } else if (!isAddressValid(txOut.address)) {
    return false;
  } else if (typeof txOut.amount !== "number") {
    return false;
  } else {
    return true;
  }
};

const isTxStructureValid = tx => {
  if (typeof tx.id !== "string") {
    console.log("The Tx ID is not valid");
    return false;
  } else if (!(tx.txIns instanceof Array)) {
    console.log("The txIns are not an array");
    return false;
  } else if (tx.txIns.some(txIn => !isTxInStructureValid(txIn))) {
    console.log("The structure of one of the txIn is not valid");
    return false;
  } else if (!(tx.txOuts instanceof Array)) {
    console.log("The txOuts are not an array");
    return false;
  } else if (tx.txOuts.some(txOut => !isTxOutStructureValid(txOut))) {
    console.log("The structure of one of the txOut is not valid");
    return false;
  } else {
    return true;
  }
};

const validateTxIn = (txIn, tx, uTxOutList) => {
  const wantedTxOut = uTxOutList.find(
    uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
  );
  if (R.isNil(wantedTxOut)) {
    return false;
  } else {
    const address = wantedTxOut.address;
    const key = ec.keyFromPublic(address, "hex");
    return key.verify(tx.id, txIn.signature);
  }
};

const getAmountInTxIn = (txIn, uTxOutList) => 
  findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOutList).amount;

const validateTx = (tx, uTxOutList) => {
  if (!isTxStructureValid(tx)) {
    console.log("Tx structure is invalid");
    return false;
  }

  if (getTxId(tx) !== tx.id) {
    console.log("Tx ID is not valid");
    return false;
  }

  const hasValidTxIns = tx.txIns.map(txIn =>
    validateTxIn(txIn, tx, uTxOutList)
  );

  if (!hasValidTxIns) {
    console.log(`The tx: ${tx} doesn't have valid txIns`);
    return false;
  }

  const amountInTxIns = tx.txIns.reduce(
    (a, txIn) => a + getAmountInTxIn(txIn, uTxOutList), 0
  );

  const amountInTxOuts = tx.txOuts.reduce((a, txOut) => a + txOut.amount, 0);

  if (amountInTxIns !== amountInTxOuts) {
    console.log(
      `The tx: ${tx} doesn't have the same amount in the txOut as in the txIns`
    );
    return false;
  }

  return true;
};

const validateCoinbaseTx = (tx, blockIndex) => {
  if (getTxId(tx) !== tx.id) {
    console.log("Invalid txId on validating coinbase tx");
    return false;
  } else if (tx.txIns.length !== 1) {
    console.log("The length of txIns is not a one on validating coinbase tx");
    return false;
  } else if (tx.txIns[0].txOutIndex !== blockIndex) {
    console.log("The txOutIndex is invalid on validating coinbase tx");
    return false;
  } else if (tx.txOuts.length !== 1) {
    console.log("The length of txOuts is not a one on validating coinbase tx");
    return false;
  } else if (tx.txOuts[0].amount !== COINBASE_AMOUNT) {
    console.log("The amount of coins are not equal" + COINBASE_AMOUNT);
    return false;
  } else {
    return true;
  }
};

const createCoinbaseTx = (address, blockIndex) => {
  const tx = new Transaction();
  const txIn = new TxIn();
  txIn.signature = "";
  txIn.txOutId = "";
  txIn.txOutIndex = blockIndex;
  tx.txIns = [txIn];
  tx.txOuts = [ new TxOut(address, COINBASE_AMOUNT) ];
  tx.id = getTxId(tx);
  return tx;
};

const hasDuplicates = R.pipe(
  R.groupBy(txIn => txIn.txOutId + txIn.txOutIndex),
  R.values,
  R.all(R.pipe(R.length, R.complement(R.equals(1))))
);

const validateBlockTx = (txs, uTxOutList, blockIndex) => {
  const coinbaseTx = txs[0];
  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    console.log("Coinbase Tx is invalid");
    return false;
  }

  const txIns = R.pipe(R.map(R.prop("txIns")), R.flatten)(txs);

  if (hasDuplicates(txIns)) {
    console.log("Found duplicated txIns");
    return false;
  }

  return R.pipe(
    R.slice(1, Infinity),
    R.map(tx => validateTx(tx, uTxOutList)),
    R.all(R.equals(true))
  )(txs);
};

  const processTxs = (txs, uTxOutList, blockIndex) => {
  if (!validateBlockTx(txs, uTxOutList, blockIndex)) {
    return false;
  }
  return updateUTxOuts(txs, uTxOutList);
};

module.exports = {
  getPublicKey,
  getTxId,
  signTxIn,
  TxIn,
  Transaction,
  TxOut,
  createCoinbaseTx,
  processTxs,
  validateTx
}