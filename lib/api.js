var request = require('request');
var _       = require('underscore');

function query_string(Arr)
{
    var params = [];
    if(Arr)
    {
        _.each(Arr, function(val, key){
            params.push(key + '=' + val);
        });
    }
    return params.join('&');
}

module.exports = function api(url)
{
    return {
        get : function get(route, Args, callback, username, password){
            params = query_string(Args);
            if(params != '') params = '&' + params;
            var r = request(url + route + params, function(error, response, data){
                if(typeof callback == 'object')
                {
                    if(error || response.statusCode < 200 || response.statusCode >= 300)
                    {
                        if(('fail' in callback) && (typeof callback.fail == 'function'))
                            callback.fail(error, response, data);
                    }
                    else if(('success' in callback) && (typeof callback.success == 'function'))
                    {
                        try {
                            callback.success(JSON.parse(data));
                        } catch(e) {}
                    }
                    return false;
                }
                else if(error || response.statusCode < 200 || response.statusCode >= 300)
                    return false;
                if(typeof callback == 'function')
                {
                    try {
                        callback(JSON.parse(data));
                    } catch(e) {}
                }
            });
            if(username && password) r.auth(username, password);
        },
        post : function post(route, Args, Data, callback){
            params = query_string(Args);
            if(params != '') params = '&' + params;
            request.post(url + route + params, function(error, response, data){
                if(typeof callback == 'object')
                {
                    if(error || response.statusCode < 200 || response.statusCode >= 300)
                    {
                        if(('fail' in callback) && (typeof callback.fail == 'function'))
                            callback.fail(error, response, data);
                    }
                    else if(('success' in callback) && (typeof callback.success == 'function'))
                    {
                        try {
                            callback.success(JSON.parse(data));
                        } catch(e) {}
                    }
                    return false;
                }
                else if(error || response.statusCode < 200 || response.statusCode >= 300)
                    return false;
                if(typeof callback == 'function')
                {
                    try {
                        callback(JSON.parse(data));
                    } catch(e) {}
                }
            }).form(Data);
        }
    }
};