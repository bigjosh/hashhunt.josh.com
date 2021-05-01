# How I made `bitcoinjs.min.js` so you can verify not trust

Installed Node version 14.16.1 from...
https://nodejs.org/en/#download

Then executed in the `/npm` directory of this repo...
```
npm -g install bitcoinjs-lib browserify uglify-js
browserify index.js -s bitcoinjs -o bitcoinjs.min.js
```

This creates a `bitcoin.min.js` that has all he functions from the `bitcoinjs` library in it, ready for the browser to access by pretending "bitcoinjs.".

If you look inside the `index.js` you'll see I also had to include the `Buffer` class, which is accessed in the browser as `bitcoinjs.buffer.Buffer`. I'm sure there is a better way to do this but damned if I could figure it out. 


Here are all the versions of NPM installed packages...
```
D:\Github\hashhunt.josh.com\npm>npm list
D:\Github\hashhunt.josh.com\npm
+-- bitcoinjs-lib@5.2.0
| +-- bech32@1.1.4
| +-- bip174@2.0.1
| +-- bip32@2.0.6
| | +-- @types/node@10.12.18
| | +-- bs58check@2.1.2 deduped
| | +-- create-hash@1.2.0 deduped
| | +-- create-hmac@1.1.7 deduped
| | +-- tiny-secp256k1@1.1.6 deduped
| | +-- typeforce@1.18.0 deduped
| | `-- wif@2.0.6 deduped
| +-- bip66@1.1.5
| | `-- safe-buffer@5.2.1
| +-- bitcoin-ops@1.4.1
| +-- bs58check@2.1.2
| | +-- bs58@4.0.1
| | | `-- base-x@3.0.8
| | |   `-- safe-buffer@5.2.1 deduped
| | +-- create-hash@1.2.0 deduped
| | `-- safe-buffer@5.2.1 deduped
| +-- create-hash@1.2.0
| | +-- cipher-base@1.0.4
| | | +-- inherits@2.0.4 deduped
| | | `-- safe-buffer@5.2.1 deduped
| | +-- inherits@2.0.4
| | +-- md5.js@1.3.5
| | | +-- hash-base@3.1.0
| | | | +-- inherits@2.0.4 deduped
| | | | +-- readable-stream@3.6.0
| | | | | +-- inherits@2.0.4 deduped
| | | | | +-- string_decoder@1.3.0
| | | | | | `-- safe-buffer@5.2.1 deduped
| | | | | `-- util-deprecate@1.0.2
| | | | `-- safe-buffer@5.2.1 deduped
| | | +-- inherits@2.0.4 deduped
| | | `-- safe-buffer@5.2.1 deduped
| | +-- ripemd160@2.0.2
| | | +-- hash-base@3.1.0 deduped
| | | `-- inherits@2.0.4 deduped
| | `-- sha.js@2.4.11
| |   +-- inherits@2.0.4 deduped
| |   `-- safe-buffer@5.2.1 deduped
| +-- create-hmac@1.1.7
| | +-- cipher-base@1.0.4 deduped
| | +-- create-hash@1.2.0 deduped
| | +-- inherits@2.0.4 deduped
| | +-- ripemd160@2.0.2 deduped
| | +-- safe-buffer@5.2.1 deduped
| | `-- sha.js@2.4.11 deduped
| +-- merkle-lib@2.0.10
| +-- pushdata-bitcoin@1.0.1
| | `-- bitcoin-ops@1.4.1 deduped
| +-- randombytes@2.1.0
| | `-- safe-buffer@5.2.1 deduped
| +-- tiny-secp256k1@1.1.6
| | +-- bindings@1.5.0
| | | `-- file-uri-to-path@1.0.0
| | +-- bn.js@4.12.0
| | +-- create-hmac@1.1.7 deduped
| | +-- elliptic@6.5.4
| | | +-- bn.js@4.12.0 deduped
| | | +-- brorand@1.1.0
| | | +-- hash.js@1.1.7
| | | | +-- inherits@2.0.4 deduped
| | | | `-- minimalistic-assert@1.0.1 deduped
| | | +-- hmac-drbg@1.0.1
| | | | +-- hash.js@1.1.7 deduped
| | | | +-- minimalistic-assert@1.0.1 deduped
| | | | `-- minimalistic-crypto-utils@1.0.1 deduped
| | | +-- inherits@2.0.4 deduped
| | | +-- minimalistic-assert@1.0.1
| | | `-- minimalistic-crypto-utils@1.0.1
| | `-- nan@2.14.2
| +-- typeforce@1.18.0
| +-- varuint-bitcoin@1.1.2
| | `-- safe-buffer@5.2.1 deduped
| `-- wif@2.0.6
|   `-- bs58check@2.1.2 deduped
`-- uniq@1.0.1
```