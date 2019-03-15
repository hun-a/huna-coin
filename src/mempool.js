const R = require("ramda");
const Transactions = require("./transactions");

const { validateTx } = Transactions;

let mempool = [];

const getTxInsInPool = mempool => R.pipe(
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