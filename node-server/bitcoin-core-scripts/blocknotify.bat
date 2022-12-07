REM This script is called from the `blocknotify` event in the `bitcoin-core` config file. 
REM Assumes that the hash of the new block is passed as an argument to this batch file. 



REM bitcoin-core does not serialize calls to blocknotify, so this at least isolatyes them
REM Yes durring catch up it is possible these could end up out of order, but once
REM we do catch up then eveything will be OK

set "tempdir=%temp%\%random%"

mkdir %tempdir%

bitcoin-cli getbestblockhash >%tempdir%\newblockhash.json

REM https://stackoverflow.com/a/2768658/3152071
set /p BH=<%tempdir%\newblockhash.json

bitcoin-cli getblockheader %BH% >%tempdir%\newblockinfo.json

REM POST the JSON file to our local server https://curl.se/docs/manpage.html#-d
curl -d @%tempdir%\newblockinfo.json http://localhost:81/blocknotify

del %tempdir%\newblockhash.json
del %tempdir%\newblockinfo.json
 
rmdir %tempdir%
