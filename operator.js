var deferred = require('deferred');
var _        = require('underscore');

RepoOperators = [];

// api: ...?r=
module.exports = function operator(io, socket, apiUrl, RepoOTokens, Operator, first)
{
    if(!Operator.token && !(Operator.username && Operator.password)) return false;

    var api = require('./lib/api')(apiUrl);

    // authenticate operator
    var _auth = deferred();
    if(Operator.token || ('username' in Operator && 'password' in Operator))
    {
        var Params = {};
        if(Operator.token) Params.token = Operator.token;
        api.get('auth', Params, {
            fail : function (err, res, data)
            {
                socket.emit('auth:fail', data);
            },
            success : function (Response){
                //http://127.0.0.1:3000
                if(
                    (Operator.token && Response.token == Operator.token)
                    ||
                    (!Operator.token && Response.token)
                )
                {
                    if(!first) return _auth.resolve();

                    RepoOperators.push(Operator.token);
                    if(! (Operator.token in RepoOTokens))
                        RepoOTokens[Operator.token] = [];
                    RepoOTokens[Operator.token].push([Response.departments, socket]);
                    socket.emit('auth:success', Response);
                    _auth.resolve();
                }
                else socket.emit('auth:fail', Response);
            }
        }, Operator.username ? Operator.username : null,
        Operator.password ? Operator.password : null);
    }

    // remove the operator on disconnect
    _auth.promise(function(){
        var ping = setInterval(function(){
            api.post('ping', {token: Operator.token}, {}, function (Response){});
        }, 10000); // 10 seconds
        socket.on('disconnect', function(){
            if(ping) clearInterval(ping);
            // remove this operator
            var index = RepoOperators.indexOf(Operator.token);
            if(index >= 0) delete RepoOperators[index];
            // remove the token
            if(Operator.token in RepoOTokens)
                for(var arr in RepoOTokens[Operator.token])
                {
                    for(var i = 0; i < arr.length; i++)
                    {
                        if(arr[i][1] && arr[i][1].id == socket.id)
                        {
                            delete RepoOTokens[Operator.token][RepoOTokens[Operator.token].indexOf(arr)];
                            break;
                        }
                    }
                }
            // if no aliases available
            index = RepoOperators.indexOf(Operator.token);
            if(index < 0)
            {
                setTimeout(function(){
                    // if no aliases available.
                    // possible that the operator came back within 2 minutes timeframe
                    index = RepoOperators.indexOf(Operator.token);
                    if(index < 0)
                    {
                        // -> lets end the chat
                        if(Operator.token in RepoOTokens)
                            delete RepoOTokens[Operator.token];
                        //socket.broadcast.to(Visitor.token).emit('chat', {end: true});
                        // send to visitor and aliases
                        // TODO
                        /*socket.broadcast.to(Operator.token).emit('chat', {
                            end: true
                        });*/
                        // save to db
                        api.post('end', {token: Operator.token}, {}, function (Response){});
                    }
                }, 120000); // 2 minutes
            }
        });
    });

    // get online visitors
    var _visitors = deferred();
    _auth.promise(function(){
        api.get('visitors', {token: Operator.token, offset: 0, quick: true, raw: true}, function (Response){
            var index;
            _.each(Response.users, function (Visitor){
                //index = RepoOperators.indexOf(Visitor.token);
                //if(index < 0) RepoOperators.push(Visitor.token);
                socket.join(Visitor.token);
            });
            if(!first) return _visitors.resolve();
            socket.emit('visitors', Response);
            _visitors.resolve();
        });
    });

    // get chat
    var _chat = deferred();
    _visitors.promise(function(){
        if(!first) return _chat.resolve();
        api.get('chat', {token: Operator.token, offset: 0, quick: true}, function (Response){
            socket.emit('chat', {chat: Response.chat});
            /*var t = [];
            _.each(Response.chat, function (Chat){
                if(t.indexOf(Chat.token) < 0)
                {
                    t.push(Chat.token);
                    io.sockets.in(Chat.token).emit('chat', {chat: Response.chat});
                }
            });*/
            _chat.resolve();
        });
    });

    _chat.promise(function(){
        // welcome a user
        socket.on('welcome', function (Data){
            if(!Data.token) return false;
            // let operator join the visitor
            //var index = RepoOperators.indexOf(Data.token);
            //if(index < 0) RepoOperators.push(Data.token);
            socket.join(Data.token);
            // aliases should join too
            if(Operator.token in RepoOTokens)
                _.each(RepoOTokens[Operator.token], function (o, i, r){
                    o[1].join(Data.token);
                });
            // others should be robbed
            for(var t in RepoOTokens)
            {
                if(t != Operator.token)
                    _.each(RepoOTokens[t], function (o, i, r){
                        o[1].emit('visitors', {stolen: [Data.token]});
                    });
            };
            api.post('welcome', {token: Operator.token}, Data, function (Chat){
                // -> received welcome message
                // notify visitor and aliases
                io.sockets.in(Data.token).emit('operator', {
                    name: Operator.name,
                    gravatar: Operator.gravatar
                });
                // aliases should welcome visitor too
                socket.broadcast.to(Data.token).emit('visitors', {
                    welcome: [Data.token]
                });
                // send welcome message to everyone
                io.sockets.in(Data.token).emit('chat', {
                    chat: [Chat]
                });
            });
        });

        // send a message to a visitor
        socket.on('message', function (Data){
            if(! 'message' in Data || ! Data.message) return false;
            if(! 'token'   in Data || ! Data.token)   return false;
            // send to visitors and operator (w/aliases)
            socket.broadcast.to(Data.token).emit('chat', {
                chat: [_.extend(Data, {operator: 1})]
            });
            // save to db
            api.post('message', {token: Operator.token}, Data, function (Response){});
        });

        // saw a visitor's chat
        socket.on('seen', function (Data){
            if(!Data.token) return false;
            // send to aliases
            socket.broadcast.to(Data.token).emit('visitors', {
                seen: Data.token
            });
            // save to db
            api.post('seen', {token: Operator.token}, Data, function (Response){});
        });

        // end a visitor's chat
        socket.on('end', function (Data){
            if(!Data.token) return false;
            // send to visitor and aliases
            io.sockets.in(Data.token).emit('chat', {
                end: true
            });
            // send to aliases
            socket.broadcast.to(Data.token).emit('visitors', {
                done: [Data.token]
            });
            // save to db
            api.post('end', {token: Operator.token}, Data, function (Response){});
        });

        // archive a visitor's chat
        socket.on('archive', function (Data){
            if(!Data.token) return false;
            // send to aliases
            io.sockets.in(Data.token).emit('visitors', {
                stolen: [Data.token]
            });
            // save to db
            api.post('archive', {token: Operator.token}, Data, function (Response){});
        });

        // is typing...
        socket.on('typing-start', function (token){
            // notify visitor (w/aliases)
            socket.broadcast.to(token).emit('otyping-start');
        });

        // is typing...
        socket.on('typing-stop', function (token){
            // notify visitor (w/aliases)
            socket.broadcast.to(token).emit('otyping-stop');
        });

    });
}




