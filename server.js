var http    = require('http').Server();
var io      = require('socket.io')(http);

var Options = require('./lib/options');
if(!Options) return null;

console.log('*--------------------------------------*');
console.log('|       Awesome Live Chat Server       |');
console.log('|   http://awe5o.me/live-chat-server   |');
console.log('*--------------------------------------*');

http.listen(Options.port, function(){
console.log('      Server running on port %d', Options.port);
console.log('       Hit Ctrl+C anytime to quit');
console.log('----------------------------------------');
console.log('----------------------------------------');
console.log('   To run in background, use forever:');
console.log('      sudo npm install -g forever');
console.log('      forever start server.js -w ...');
console.log('   To stop running in background:');
console.log('      forever stop server.js');
console.log('----------------------------------------');
console.log('         ...HAPPY CHATTING...');
});

RepoOTokens = [];

io.of(Options.ns).on('connection', function connect (socket) {
    //console.log('A user connected.');
    socket.on('disconnect', function disconnect () {
        //console.log('A user disconnected.');
    });
    socket.on('operator-auth', function operator (Operator) {
        var first = false;
        if(Operator.first)
        {
            first = Operator.first;
            delete Operator.first;
        }
        require('./operator')
        (io, socket, Options.api.o, RepoOTokens, Operator, first);
    });
    socket.on('visitor-auth', function visitor (Visitor) {
        var first = false;
        if(Visitor.first)
        {
            first = Visitor.first;
            delete Visitor.first;
        }
        require('./visitor')
        (io, socket, Options.api.u, RepoOTokens, Visitor, first);
    });
});