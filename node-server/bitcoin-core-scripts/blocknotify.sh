#!/bin/bash
# This script is called from the `blocknotify` event in the `bitcoin-core` config file. 

### These first two might need to be updated to reflect desitination directory structure
# TODO: Move these out of this script and into the target envronment. What is the standard way to do this?
# NOTE: Don't use an alias becuase they work differently in interactive mode than in script. (WTF?)

#path to bitcoin-cli executable. Aparently this is a recommended way to do this, but I don't like it https://askubuntu.com/a/98786
clicmd='/d/Documents/Programs/bitcoin/bitcoin-0.20.1/bin/bitcoin-cli.exe'

 
# We need to specify the datadir used by `bitcoin-core` so that `blitcoin-cli` can find the cookie file to authenticate
# Really bitcoin-core, you could just have the deamon and cli use the same config file by default? :/
datadir="/d/Documents/Programs/bitcoin/data/";

#get the hash of the new block that trigged this blocknotify event
besthash=$($clicmd -datadir=/d/Documents/Programs/bitcoin/data/ getbestblockhash)

#get the full header of the new block in JSON and then POST to out local internal node.js webserver. 
# So ugly, but here is what it means https://stackoverflow.com/a/59690957/3152071. BASH is a hot mess. 
$clicmd -datadir=/d/Documents/Programs/bitcoin/data/ getblockheader $besthash | \
    curl -d@- http://localhost:81/blocknotify 
	