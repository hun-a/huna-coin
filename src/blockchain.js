class Block {
  constructor(index, hash, previousHash, timestamp, data) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
  }
}

const genesisBlock = new Block(
  0,
  '73C19CAC3EC8D8CE13F91CA2CA615F8FC5C1E304DCF1A9C4D8CB9EE4EA994F56',
  null,
  1542119980449,
  'This is the genesis!!'
);

let blockchain = [ genesisBlock ];

console.log(blockchain);