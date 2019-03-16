const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const R = require("ramda");
const Blockchain = require("./blockchain");
const P2P = require("./p2p");
const Wallet = require("./wallet");
const Mempool = require("./mempool");

const { getBlockchain, createNewBlock, getAccountBalance, sendTx, getUTxOutList } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet, getPublicFromWallet, getBalance } = Wallet;
const { getMempool } = Mempool;

const PORT = process.env.HTTP_PORT || 3000;

const app = express();

app.use(bodyParser.json());
app.use(morgan('combined'));

app.route("/blocks")
  .get((req, res) => {
    res.send(getBlockchain());
  })
  .post((req, res) => {
    const newBlock = createNewBlock();
    res.send(newBlock);
  });

app.post('/peers', (req, res) => {
  const { body: { peer } } = req;
  connectToPeers(peer);
  res.send();
});

app.get("/me/balance", (req, res) => {
  const balance = getAccountBalance();
  res.send({ balance });
});

app.get("/me/address", (req, res) => {
  res.send(getPublicFromWallet());
});

app.get("/blocks/:hash", (req, res) => {
  R.pipe(
    getBlockchain,
    R.find(b => R.equals(b.hash, req.params.hash)),
    R.ifElse(
      R.isNil,
      () => res.status(400).send("Block not found"),
      block => res.send(block)
    )
  )();
});

app.get("/transactions/:id", (req, res) => {
  R.pipe(
    getBlockchain,
    R.map(R.prop("data")),
    R.flatten,
    R.find(b => R.equals(b.id, req.params.id)),
    R.ifElse(
      R.isNil,
      () => res.status(400).send("Transaction not found"),
      tx => res.send(tx)
    )
  )();
});

app.route("/transactions")
  .get((req, res) => {
    res.send(getMempool());
  })
  .post((req, res) => {
    try {
      const { body: { address, amount } } = req;
      if (address === undefined || amount === undefined) {
        throw Error("Please specify and address and an amount");
      } else {
        const sended = sendTx(address, amount);
        res.send(sended);
      }
    } catch (e) {
      console.error(e);
      res.status(400).send(e.message);
    }
  });

app.get("/address/:address", (req, res) => {
  const { params: { address } } = req;
  const balance = getBalance(address, getUTxOutList());
  res.send({ balance });
});

const server = app.listen(PORT, () =>
  console.log(`Nomadcoin server running on port ${PORT}`));

initWallet()
startP2PServer(server);