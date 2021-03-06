const toHexString = byteArray => Array.from(
  byteArray, byte => (
    "0" + (byte & 0xff).toString(16)
  ).slice(-2)).join("");

module.exports = { toHexString };