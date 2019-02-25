const CryptoJS = require("crypto-js");
const hexToBinary = require("hex-to-binary");

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

const genesisBlock = new Block(
  0,
  "73C19CAC3EC8D8CE13F91CA2CA615F8FC5C1E304DCF1A9C4D8CB9EE4EA994F56",
  null,
  1542119980449,
  "This is the genesis!!"
);

let blockchain = [genesisBlock];

const getNewestBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => new Date().getTime();

const getBlockchain = () => blockchain;

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

const createNewBlock = data => {
  const previousBlock = getNewestBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimestamp = getTimestamp();
  const newBlock = findBlock(
    newBlockIndex,
    previousBlock.hash,
    newTimestamp,
    data,
    10
  );
  addBlockToChain(newBlock);
  require('./p2p').broadcastNewBlock();
  return newBlock;
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
}

const getBlocksHash = block =>
  createHash(block.index, block.previousHash, block.timestamp, block.data);

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
  }
  return true;
};

const isBlockStructureValid = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "string"
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

const replaceChain = candidateChain => {
  if (
    isChainValid(candidateChain) &&
    candidateChain.length > getBlockchain().length
  ) {
    blockchain = candidateChain;
    return true;
  } else {
    return false;
  }
};

const addBlockToChain = candidateBlock => {
  if (isBlockValid(candidateBlock, getNewestBlock())) {
    getBlockchain().push(candidateBlock);
    return true;
  } else {
    return false;
  }
};

module.exports = {
  getBlockchain,
  createNewBlock,
  getNewestBlock,
  isBlockStructureValid,
  addBlockToChain,
  replaceChain,
  getBlockchain
};