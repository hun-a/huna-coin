const R = require("ramda");
const CryptoJS = require("crypto-js");
const hexToBinary = require("hex-to-binary");
const Wallet = require("./wallet");
const Transactions = require("./transactions");
const Mempool = require("./mempool");

const { getBalance, getPublicFromWallet, createTx, getPrivateFromWallet } = Wallet;

const { createCoinbaseTx, processTxs } = Transactions;

const { addToMempool, getMempool, updateMempool } = Mempool;

const BLOCK_GENERATION_INTERVAL = 10;
const DIFFICULTY_ADJUSTEMENT_INTERVAL = 10;

class Block {
  constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

const genesisTx = {
  txIns: [
    { signature: "", txOutId: "", txOutIndex: 0 }
  ],
  txOuts: [
    {
      address: "047b4407bcfe22f654480c18a9dd257108922080808481451a1bc4bb3447b8566b09ed1766a8ee24b2b114c5d5d9ee4968f9594c0b241cb3df8e7586519a9dab20",
      amount: 50
    }
  ],
  id: "09855048f739b1e42e8506c878a87b5bb94f39ddb5aea41fd03ae739f1305d35"
};

const genesisBlock = new Block(
  0,
  "710b2dcb2c8b6bc790e8428e4445602c0a943523b2527486ad3a48c0a335ab6f",
  null,
  1551275293,
  [genesisTx],
  0,
  0
);

let blockchain = [genesisBlock];

let uTxOuts = processTxs(blockchain[0].data, [], 0);

const getNewestBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => Math.round(new Date().getTime() / 1000);

const getBlockchain = () => blockchain;

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

const createNewBlock = () => {
  const coinbaseTx = createCoinbaseTx(
    getPublicFromWallet(),
    getNewestBlock().index + 1
  );
  const blockData = [coinbaseTx].concat(getMempool());
  return createNewRawBlock(blockData);
};

const createNewRawBlock = data => {
  const previousBlock = getNewestBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimestamp = getTimestamp();
  const difficulty = findDifficulty();
  const newBlock = findBlock(
    newBlockIndex,
    previousBlock.hash,
    newTimestamp,
    data,
    difficulty
  );
  addBlockToChain(newBlock);
  require('./p2p').broadcastNewBlock();
  return newBlock;
};

const findDifficulty = () => {
  const newestBlock = getNewestBlock();
  if (newestBlock.index % DIFFICULTY_ADJUSTEMENT_INTERVAL === 0 && newestBlock.index !== 0) {
    return calculateNewDifficulty(newestBlock, getBlockchain());
  } else {
    return newestBlock.difficulty;
  }
};

const calculateNewDifficulty = (newestBlock, blockchain) => {
  const lastCalculatedBlock = blockchain[blockchain.length - DIFFICULTY_ADJUSTEMENT_INTERVAL];
  const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTEMENT_INTERVAL;
  const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;
  if (timeTaken < timeExpected / 2) {
    return lastCalculatedBlock.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return lastCalculatedBlock.difficulty - 1;
  } else {
    return lastCalculatedBlock.difficulty;
  }
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  while (true) {
    console.log('nonce:', nonce);
    const hash = createHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
    }
    nonce++;
  }
};

const hashMatchesDifficulty = (hash, difficulty) => {
  const hashInBinary = hexToBinary(hash);
  const requiredZeros = "0".repeat(difficulty);
  console.log('Trying difficulty:', difficulty, 'with hash:', hashInBinary);
  return hashInBinary.startsWith(requiredZeros);
};

const getBlocksHash = block =>
  createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

const isTimestampValid = (newBlock, oldBlock) =>
  oldBlock.timestamp - 60 < newBlock.timestamp
  && newBlock.timestamp - 60 < getTimestamp();

const isBlockValid = (candidateBlock, latestBlock) => {
  if (!isBlockStructureValid(candidateBlock)) {
    console.log("The candidate block structure is not valid");
    return false;
  } else if (latestBlock.index + 1 !== candidateBlock.index) {
    console.log("The candidate block doesnt have a valid index");
    return false;
  } else if (latestBlock.hash !== candidateBlock.previousHash) {
    console.log(
      "The previousHash of the candidate block is not the hash of the latest block"
    );
    return false;
  } else if (getBlocksHash(candidateBlock) !== candidateBlock.hash) {
    console.log("The hash of this block is invalid");
    return false;
  } else if (!isTimestampValid(candidateBlock, latestBlock)) {
    console.log("The timestamp of this block is dodgy");
    return false;
  }
  return true;
};

const isBlockStructureValid = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

const isChainValid = candidateChain => {
  const isGenesisValid = block => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };

  if (!isGenesisValid(candidateChain[0])) {
    console.log(
      "The candidate chains's genesisBlock is not the same as our genesisBlock"
    );
    return false;
  }

  for (let i = 1; i < candidateChain.length; i++) {
    if (!isBlockValid(candidateChain[i], candidateChain[i - 1])) {
      return false;
    }
  }
  return true;
};

const sumDifficulty = anyBlockchain => anyBlockchain
  .map(block => Math.pow(2, block.difficulty))
  .reduce((a, b) => a + b);

const replaceChain = candidateChain => {
  if (
    isChainValid(candidateChain) &&
    sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())
  ) {
    blockchain = candidateChain;
    return true;
  } else {
    return false;
  }
};

const addBlockToChain = candidateBlock => {
  if (isBlockValid(candidateBlock, getNewestBlock())) {
    const processedTxs = processTxs(
      candidateBlock.data, uTxOuts, candidateBlock.index
    );
    if (processedTxs === null) {
      console.log("Couldn't process txs");
      return false;
    } else {
      getBlockchain().push(candidateBlock);
      uTxOuts = processedTxs;
      updateMempool(uTxOuts);
      return true;
    }
  } else {
    return false;
  }
};

const getUTxOutList = () => R.clone(uTxOuts);

const getAccountBalance = () =>
  getBalance(getPublicFromWallet(), uTxOuts);

const sendTx = (address, amount) => {
  const tx = createTx(
    address,
    amount,
    getPrivateFromWallet(),
    getUTxOutList(),
    getMempool()
  );
  addToMempool(tx, getUTxOutList());
  return tx;
};

module.exports = {
  getBlockchain,
  createNewBlock,
  getNewestBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain,
  getBlockchain,
  getAccountBalance,
  sendTx
};