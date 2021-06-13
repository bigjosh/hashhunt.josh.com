# hashhunt.josh.com
 First one to find the hash wins a bitcoin! 

## Static web

[here](static_web)
The html/css/js client that the player uses. Locally generates the keys and gets other info to
generate a block template from the server over a websocket.

Can be served from anywhere since the websocket host URLs are hard coded in.

### Test mode 
There is a parallel set of servers and nodes set up on a test block chain for testing. The puzzles on this system are much easier to solve, but the prizes are not as valuable. 

To tell the client to use the test mode infrastructure, add "?testmode=1" to the end of the URL.

## Server

[here](node-server)
Node.js websocket server. Responsible for...

* sending live info about the block currently being mined to new clients
* sending notifications to all clients whenever a new best block is mined
* accepting mined blocks from clients and submitting them to the network

### Connections to bitcoin-core

The websocket server uses an existing bitcoin-core node to interact with the blockchain.

#### New best block on the network

Whenever the bitcoin-core node gets a new block, it calls our `blocknotify` script which retrieves the header for the new block and then sends it to the websocket server as JSON over an http connection (the websocket server has an internal HTTP server that listens for these updates as POST or GET requests).

#### Hash Hunt win

Whenever a player finds a valid block, it is submitted to the server over the websocket connection. The serverd does some cursory validity checks to avoid DOS attacks and then calls the "submitblock" script to submit the block to the bitcoin-core node over RPC. The player can independently check if the block was accepted by the node and the network using any wallet or blockchain explorer.

# Installation

1. Install bitcoin-core and let it catch up. 
3. Clone this repo
4. Edit the bitcoin-core config file so the `block-notify` is equal to the `blocknotify`script (`.bat` or `.sh` depending on which way you swing) in this repo. Example [here](bitcoin.conf).
5.  Edit the `blocknotify` and `submitblock` scripts in this repo and set correct paths for `datadir` and `clicmd` depending on how/where bitcoin-core is set up
6. On windows, add the path to the `bitcoin-cli.exe` executable to the `PATH` environment variable. 
6. Install node.js
7. Start the server with the command `node index.js` inside the `node-server` directory.
8.   
  


