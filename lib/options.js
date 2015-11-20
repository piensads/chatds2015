var deasync  = require('deasync');
var program  = require('commander');
module.exports = function(){
    program
    .version('0.0.1')
    .usage('[options]')
    .option('-w, --website [url]', '[*] WordPress home url')
    .option('-n, --namespace [/]', 'Server namespace. Useful if you need http://host/namespace')
    .option('-p, --port [3000]', 'Server port', parseInt)
    .option('-a, --api [1]', 'API version', parseInt)
    .option('-c, --pulse', 'Check for pulse')
    .parse(process.argv);

    var args = {
        api   : process.env.WEBSITE     || null,
        ns    : process.env.NAMESPACE   || '/',
        port  : process.env.PORT        || 3000,
        apiv  : process.env.API_VERSION || 1,
        pulse : false
    };
    if(program.namespace) args.ns  = program.namespace;
    if(program.website) args.api   = program.website;
    if(program.port)    args.port  = program.port;
    if(program.api)     args.apiv  = program.api;
    if(program.pulse)   args.pulse = true;

    if(!args.api)
    {
        console.log('-w is a required argument. Use -h for help.');
        return false;
    }
    if(args.api === true)
    {
        console.log('-w should be a url string. Use -h for help.');
        return false;
    }

    args.api = args.api.replace(/\/+$/, '');
    args.api += '/wp-content/plugins/awesome-live-chat/api';
    args.api = args.api + '/v' + args.apiv;

    var options = {
        api  : {
            o : args.api + '/o.php?r=',
            u : args.api + '/u.php?r='
        },
        ns   : args.ns,
        port : args.port
    };

    var api  = require('./api');
    var apiO = api(options.api.o);
    var apiU = api(options.api.u);

    var d     = 0;
    var pulse = true;
    apiO.get('pulse', {}, {
        fail    : function (err, res, data){
            console.log('Operator pulse not received.');
            pulse = false;
            d = 1;
        },
        success : function (data){
            if(data.version == args.apiv)
                console.log('Operator pulse received.');
            else {
                console.log('Operator pulse not received.');
                console.log(' - Request for version ' + args.apiv + '.');
                console.log(' - Received version ' + data.version + '.');
                pulse = false;
            }
            d = 1;
        }
    });
    apiU.get('pulse', {}, {
        fail    : function (err, res, data){
            console.log('Visitor pulse not received.');
            pulse = false;
            d = 2;
        },
        success : function (data){
            if(data.version == args.apiv)
                console.log('Visitor pulse received.');
            else {
                console.log('Visitor pulse not received.');
                console.log(' - Request for version ' + args.apiv + '.');
                console.log(' - Received version ' + data.version + '.');
                pulse = false;
            }
            d = 2;
        }
    });

    while(d != 2){ deasync.runLoopOnce(); }

    if(args.pulse || !pulse) return false;
    return options;

}();