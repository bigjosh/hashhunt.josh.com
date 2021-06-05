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
