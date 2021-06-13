# hashhunt.josh.com
 First one to find the hash wins 5 BTC! 

## Client

[here](/express_static/index.html)
The html/css/js client that the player uses. Locally generates the keys and gets other info to
generate a block header from the server.


## Server

[here](index.js)
Node.js websocket server. Responsible for...

* sending live info about the block currently being mined to new clients
* sending notifications to all clients whenever a new block is mined
* accepting mined blocks from clients and submitting them to the network

Talks to `bitcoin-core` using command line RPC to submit blocks. 
Has an internal http server that receives notifications of new blocks from a batch file called from bitcoin-core's `blocknotify`.

# Installation

1. Install bitcoin-core and let it catch up. 
3. Clone this repo
4. Edit the bitcoin-core config file so thet `block-notify` is equal to the `blocknotify`script (`.bat` or `.sh` depending on which way you swing) in this repo.
5.  Edit the `blocknotify` script in this repo and set correct paths for `datadir` and `clicmd` depending on how bitcoin-core is set up
6. Install node.js
7. 
  
