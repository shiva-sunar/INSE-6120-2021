phone=`ls ~/.local/share/signal-cli/data/ | grep -v d`;
echo '{"jsonrpc":"2.0","method":"receive"}' | signal-cli -u $phone jsonRpc | grep SignalEncrypted | grep dataMessage >> ~/Desktop/signalMessages ;
