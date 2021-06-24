# hashhunt.josh.com
 First one to find the hash wins a bitcoin! 

## Static web site (called `docs`)

[here](docs)

The html/css/js that is served to the client. It locally generates the keys and gets other info to
generate a block template from the server over a websocket.

Can be served from anywhere since the websocket host URLs are hard coded in.

Why is it called `docs`? Because that is the only folder name you can use with github pages. :/

### Test mode 
There is a parallel set of servers and nodes set up on a regtest blockchain for testing. The puzzles on this system are much easier to solve, but the prizes are possibly less valuable. 

To tell the client to use the test mode infrastructure, add "?testmode=1" to the end of the URL.

## Server

[here](node-server)
Node.js websocket server. Responsible for...

* sending live info about the block currently being mined to new clients
* sending notifications to all clients whenever a new best block is mined
* accepting mined blocks from clients and submitting them to the network

The server listens on port 81 for (1) `/blocknotify` as either a `GET` or `PUT` with info on a new
block (the`PUT` takes the JSON that `bitcoin-core getblock` outputs), or (2) `/status` which shows a 
list of currently connected websocket clients. 

Note that the server does check incoming mined blocks to make sure that they come from hash hunt before submitting them to `bitcoin-core`.

### Connections to bitcoin-core
[here](node-server/bitcoin-core-scripts)

The websocket server interacts with an existing bitcoin-core node via RPC using a couple of scripts.

#### New best block on the network

Whenever the bitcoin-core node gets a new block, it calls our `blocknotify` script which retrieves the header for the new block and then sends it to the websocket server as JSON over an http connection (the websocket server has an internal HTTP server that listens for these updates as POST or GET requests).

#### Hash Hunt win

Whenever a player finds a valid block, it is submitted to the server over the websocket connection using the `submitblock` script. The server does some cursory validity checks before submitting to avoid DOS attacks.. The player can independently check if the block was accepted by the node and the network using any wallet or blockchain explorer.

# Installation

1. Install bitcoin-core and let it catch up. Run on `testnet` or `regtest` if you want a better chance of winning at the cost of the winning being worth much less.     
3. Clone this repo.
4. Edit the bitcoin-core config file so the `block-notify` is equal to the path to the `blocknotify`script (`.bat` or `.sh` depending on which way you swing) in this repo. Example [here](bitcoin.conf).
5. If you are running on a test net, Edit the bitcoin-core config file so `rpcport=8332`. Example [here](bitcoin.conf).
5.  Edit the `blocknotify` and `submitblock` scripts in this repo and set correct paths for `datadir`  depending on how/where bitcoin-core is set up. The `bitcoin-cli` shouldn't but needs this. 
6. Add the path to the `bitcoin-cli.exe` executable to the path environment variable. 
6. Install `node.js`.
1. Goto the `node-server` folder in this repo and do `npm install` to install the needed modules. 
8. Start the server with the command `node index.js` inside the `node-server` directory.
9. Serve the static website from somewhere (I use github pages so that folder is called `docs`). 

# Copying

All of this is (c) 2021 Josh Levine so please do not use it without asking me first. I will ~~hash~~hunt down anyone who tries to use this code in ways that dilute the message or who try to fool players.

If you see something like hashhunt running anywhere except `hashhunt.josh.com` please [let me know](https://josh.com/contact.html)!   
