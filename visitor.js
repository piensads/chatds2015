var deferred = require('deferred');
var _        = require('underscore');

RepoVisitors = [];

// api: ...?r=
module.exports = function visitor(io, socket, apiUrl, RepoOTokens, Visitor, first)
{
    if(!Visitor.token) return false;

    var api = require('./lib/api')(apiUrl);

    // authenticate operator
    var _auth = deferred();
    if(!first) _auth.resolve();
    else {
        api.post('auth', {token: Visitor.token}, {}, function (Response){
            if(Response.token == Visitor.token)
            {
                _.extend(Visitor, Response);
                RepoVisitors.push(Visitor.token);
                // receive full details (alias?)
                socket.emit('auth', Visitor);
                _auth.resolve();
            } // invalid token
            else socket.emit('auth', []);
        });
    }

    // Ping and remove the visitor on disconnect
    _auth.promise(function(){
        var ping = setInterval(function(){
            api.post('ping', {token: Visitor.token}, {}, function (Response){});
        }, 10000); // 10 seconds
        socket.on('disconnect', function(){
            if(ping) clearInterval(ping);
            // remove this visitor
            var index = RepoVisitors.indexOf(Visitor.token);
            if(index >= 0) delete RepoVisitors[index];
            // if no aliases available
            index = RepoVisitors.indexOf(Visitor.token);
            if(index < 0)
            {
                setTimeout(function(){
                    // if no aliases available.
                    // possible that the visitor came back within 2 minutes timeframe
                    index = RepoVisitors.indexOf(Visitor.token);
                    if(index < 0)
                    {
                        // -> lets end the chat
                        // send to operator and aliases
                        socket.broadcast.to(Visitor.token).emit('visitors', {done: [Visitor.token]});
                        // save to db
                        api.post('end', {token: Visitor.token}, {}, function (Response){});
                    }
                }, 120000); // 2 minutes
            }
        });
    });

    // get operator (for an alias)
    var _operator = deferred();
    _auth.promise(function(){
        //var index = RepoVisitors.indexOf(Visitor.token);
        //if(index < 0) RepoVisitors.push(Visitor.token);
        socket.join(Visitor.token);
        if(!first) return _operator.resolve();
        // let operators know.
        if('department' in Visitor)
        {
            for(var t in RepoOTokens)
            {
                _.each(RepoOTokens[t], function (o, i, r){
                    if(o[0].indexOf(parseInt(Visitor.department)) >= 0)
                        o[1].emit('visitors', {users: [Visitor]});
                });
            };
        }
        //socket.broadcast.to(Visitor.token).emit('visitors', {users: [Visitor]});
        api.get('operator', {token: Visitor.token, quick: true, raw: true}, function (Operator){
            socket.emit('operator', Operator);
            _operator.resolve();
        });
    });

    // get chat (for an alias)
    var _chat = deferred();
    _operator.promise(function(){
        if(!first) return _chat.resolve();
        api.get('chat', {token: Visitor.token, offset: 0, quick: true, raw: true}, function (Chat){
            io.sockets.in(Visitor.token).emit('chat', Chat);
            _chat.resolve();
        });
    });

    _chat.promise(function(){
        // notify all operators in the department
        if(!first)
        io.sockets.in(Visitor.token).emit('visitors', {users: [Visitor]});

        socket.on('message', function (Data){
            if(! 'message' in Data || ! Data.message) return false;
            // notify visitor aliases and operator (w/aliases)
            socket.broadcast.to(Visitor.token).emit('chat', {chat: [_.extend(Data, {token: Visitor.token, operator: 0})]});
            // save to db
            api.post('message', {token: Visitor.token}, Data, function(Response){
                // trivial
                //console.log(Data.message, Response);
            });
        });

        // end chat
        socket.on('end', function (Data){
            // send to operator and aliases
            socket.broadcast.to(Visitor.token).emit('visitors', {done: [Visitor.token]});
            // send to aliases
            socket.broadcast.to(Visitor.token).emit('chat', {end: true});
            // save to db
            api.post('end', {token: Visitor.token}, {}, function (Response){});
        });

        // is typing...
        socket.on('typing-start', function (){
            // notify operator (w/aliases)
            socket.broadcast.to(Visitor.token).emit('utyping-start', Visitor.name);
        });

        // is typing...
        socket.on('typing-stop', function (){
            // notify operator (w/aliases)
            socket.broadcast.to(Visitor.token).emit('utyping-stop');
        });

    });
}



