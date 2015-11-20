var fs       = require('fs.extra');
var ncp      = require('graceful-ncp').ncp;
var path     = require('path');
var targz    = require('tar.gz');
var request  = require('request');
var deasync  = require('deasync');
var program  = require('commander');

program
    .version('0.0.1')
    .usage('[options]')
    .option('-k, --key [your-purchase-key]', '[*] License key')
    .option('-v, --verify',                  'Verify purchase')
    .option('-u, --unverify',                'Unverify purchase')
    .option('-c, --check',                   'Check/View release info')
    .option('-r, --release [latest]',        'Update to this release version')
    .option('-f, --force',                   'Force update')
    .option('-a, --api [1]',                 'API version', parseInt)
    .parse(process.argv);

var args = {
    v : false,
    u : false,
    c : false,
    f : false,
    r : 'latest',
    h : process.env.LICENSE_KEY || null,
    a : process.env.UPDATE_API_VERSION || 1
};

if(program.verify)   args.v = true;
if(program.unverify) args.u = true;
if(program.check)    args.c = true;
if(program.force)    args.f = true;
if(program.key)      args.k = program.key;
if(program.release)  args.r = program.release;
if(program.api)      args.a = program.api;

if(!args.k)
{
    console.log('-k is a required argument. Use node update -h for help.');
    return false;
}

if(!fs.existsSync('./.token')) {
    fs.writeFileSync('./.token', '', {
        encoding: 'utf8'
    });
}
var token = fs.readFileSync('./.token', {
    encoding: 'utf8'
});
if(!token.trim()) {
    token = ('xxxyxxxyxxxyxxxy').replace(/[xy]/g, function (c) {
        r = Math.random()*16|0;
        v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
    fs.writeFileSync('./.token', token, {
        encoding: 'utf8'
    });
}
if(!fs.existsSync('./.gitignore')) {
    fs.writeFileSync('./.gitignore', '.token', {
        encoding: 'utf8'
    });
}
if(!fs.existsSync('./.npmignore')) {
    fs.writeFileSync('./.npmignore', '.token', {
        encoding: 'utf8'
    });
}

var apiBase      = 'http://api.awe5o.me/v' + args.a + '/packages/live-chat-server';
//var apiLatest    = apiBase + '/releases/latest';
var apiRelease   = apiBase + '/releases/' + args.r;
var apiVerify    = apiBase + '/verify:'   + args.k + '?token=' + token + '&r=nodejs';
var apiUnverify  = apiBase + '/unverify:' + args.k;
var apiDownload  = apiBase + '/releases/' + args.r + '/download:' + args.k + '?token=' + token;

function parseJSON (body) {
    try {
        body = JSON.parse(body);
    } catch (e) {
        body = {
            error   : 'There was an error. Please try again',
            message : 'The api path could not be located.'
        }
    }
    return body;
}
function throwJSON (json) {
    for(var key in json) {
        console.log(key + ' : ' + json[key]);
    }
}

var verified = false;
if(args.v) {
    var sync = false;
    request({
        url: apiVerify,
        headers: {
            'User-Agent': 'Nodejs'
        }
    }, function (err, response, body) {
        sync = true;
        return verified = parseJSON(body) || {
            error   : 'There was an error. Please try again'
        };
    });
    while(!sync) { deasync.runLoopOnce(); }
    if(typeof verified == 'object') return throwJSON(verified);
    if(verified != true) {
        return throwJSON({
            'error' : 'Invalid license.'
        });
    }
    console.log('Verified successfully.')
    return false;
}

if(args.u) {
    var unverified = false;
    var sync = false;
    request({
        url: apiUnverify,
        headers: {
            'User-Agent': 'Nodejs'
        }
    }, function (err, response, body) {
        sync = true;
        return unverified = parseJSON(body) || {
            error   : 'There was an error. Please try again'
        };
    });
    while(!sync) { deasync.runLoopOnce(); }
    if(typeof unverified == 'object') return throwJSON(unverified);
    if(unverified != true) {
        return throwJSON({
            'error' : 'There was an error. Please try again'
        });
    }
    console.log('Unverified successfully.')
    return false;
}

var info = false;
request(apiRelease, function (err, response, body) {
    return info = parseJSON(body) || {
        error   : 'There was an error. Please try again'
    };
});
while(!info) { deasync.runLoopOnce(); }


if(! ('version' in info)) return throwJSON({
    'error' : 'Release v'+ args.r + ' not found'
});
if(args.c || 'error' in info) return throwJSON(info);

/*
if(apiRelease != apiLatest && args.r != info['version'])
var info = false;
request(apiRelease, function (err, response, body) {
    return info = parseJSON(body) || {
        error   : 'There was an error. Please try again'
    };
});
while(!info) { deasync.runLoopOnce(); }
if('error' in info) return throwJSON(info);
*/

var install = JSON.parse(fs.readFileSync('package.json', {
    encoding : 'utf8'
}));

if(!args.f && (install.version == info.version))
{
    console.log('Nothing to update. You have the same version (v' + install.version + ')');
    console.log('If you want to re-install this version, use -f or --force.');
    return false;
}

if(!args.f && (install.version > info.version))
{
    console.log('You already have an updated version (v' + install.version + ')');
    console.log('If you want to update to a previous version, use -f or --force.');
    return false;
}

var sync = false;
if(verified != true) {
    request({
        url: apiVerify,
        headers: {
            'User-Agent': 'Nodejs'
        }
    }, function (err, response, body) {
        sync = true;
        return verified = parseJSON(body) || {
            error   : 'There was an error. Please try again'
        };
    });
    while(!sync) { deasync.runLoopOnce(); }
}
if(typeof verified == 'object') return throwJSON(verified);
if(verified != true) {
    var err = 'Whoops! Could not continue.\n';
    err += 'The license key is invalid.\n';
    err += 'Try again later or update manually.';
    return throwJSON({
        'error' : err
    });
}

// All Good! Lets wrap it up :)

function fetch(file, cb) {
    console.log('Fetching.');
    var spawn = require('child_process').spawn;
    var command = spawn('npm', ['pack', file]);
    var result = '';
    command.stdout.on('data', function (data) {
        result += data.toString();
    }).on('close', function (code) {
        var filename = result.trim();
        var err = 'Whoops! Could not find a package.\n';
        err += 'Try again later or update manually.';
        cb(filename ? null : err, filename);
    });
}
function update(cb) {
    console.log('Running npm install.');
    var spawn = require('child_process').spawn;
    var command = spawn('npm', ['install']);
    var result = '';
    command.stdout.on('data', function (data) {
        result += data.toString();
    }).on('close', function (code) {
        cb(null, result.trim());
    });
}


console.log('Changelog: ' + (info.changelog ? info.changelog : 'N/A'));
fetch(apiDownload, function (err, tgz) {
    if(err) return console.log(err);
    //console.log('Tarball:', tgz);
    console.log('Installing.');

    new targz().extract(tgz, './.tmp', function (err) {
        if(err) return console.error(err);
        console.log('Installed.');

        ncp('./.tmp/package', './', function (err) {
            if (err) return console.error(err);
            //console.log('Copied!');

            // cleanup
            console.log('Cleaning.');
            fs.unlinkSync(tgz, function (err) {
                if (err) return console.error(err);
                //console.log('Removed ./' + tgz);
            });
            fs.rmrf('./.tmp', function (err) {
                if (err) return console.error(err);
                //console.log('Removed ./.tmp/package');

                update(function (err, res) {
                    if (err) return console.error(err);

                    console.log(res);
                    console.log('ENJOY! Updated to version ' + info.version);
                })
            });
        });
    });
});