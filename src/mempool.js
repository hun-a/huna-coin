const R = require("ramda");
const Transactions = require("./transactions");

const { validateTx } = Transactions;

let mempool = [];

const getMempool = () => R.clone(mempool);

const getTxInsInPool = R.pipe(
  R.map(R.prop("txIns")),
  R.flatten
);

const isTxValidForPool = (tx, mempool) => {
  const txInsInPool = getTxInsInPool(mempool);

  const isTxInsAlreadyInPool = (txIns, txIn) =>
    R.find(txInsInPool =>
      txInsInPool.txOutIndex === txIn.txOutIndex
      && txInsInPool.txOutId === txIn.txOutId, txIns
    );

  for(const txIn of tx.txIns) {
    if (isTxInsAlreadyInPool(txInsInPool, txIn)) {
      return false;
    }
  }
  return true;
};

const hasTxIn = (txIn, uTxOutList) => {
  const foundTxIn = uTxOutList.find(
    uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
  );

  return !R.isNil(foundTxIn);
};

const updateMempool = uTxOutList => {
  const invalidTx = [];

  for (const tx of mempool) {
    for (const txIn of tx.txIns) {
      if (!hasTxIn(txIn, uTxOutList)) {
        invalidTx.push(tx);
        break;
      }
    }
  }

  if (invalidTx.length > 0) {
    mempool = R.without(invalidTx, mempool);
  }
};

const addToMempool = (tx, uTxOutList) => {
  if (!validateTx(tx, uTxOutList)) {
    throw Error("This tx is invalid. Will not add it to pool");
  } else if (!isTxValidForPool(tx, mempool)) {
    throw Error("This tx is not valid for the pool. Will not add it.");
  }
  mempool.push(tx);
};

module.exports = {
  addToMempool,
  getMempool,
  updateMempool
};