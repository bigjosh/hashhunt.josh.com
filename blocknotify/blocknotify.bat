REM This script is called from the `blocknotify` event in the `bitcoin-core` config file. 
REM Assumes that the hash of the new block is passed as an argument to this batch file. 

REM We need to specify the datadir used by `bitcoin-core` so that `blitcoin-cli` can find the cookie file to authenticate
REM Really bitcoin-core, you could just have the deamon and cli use the same config file by default :/
set datadir="d:\Documents\Programs\bitcoin\data"

bitcoin-cli -datadir=%datadir% getbestblockhash >%temp%\newblockhash.json

REM https://stackoverflow.com/a/2768658/3152071
set /p BH=<%temp%\newblockhash.json

bitcoin-cli -datadir=%datadir% getblockheader %BH% >%temp%\newblockinfo.json

REM POST the JSON file to our local server https://curl.se/docs/manpage.html#-d
curl -d @%temp%\newblockinfo.json http://localhost:81/blocknotify

pause

del %temp%\newblockhash.json
del %temp%\newblockinfo.json
 


	