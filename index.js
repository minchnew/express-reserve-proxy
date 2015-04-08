"use strict";


var querystring = require('querystring');
var url = require('url');

var concat = require('concat-stream');
var pathToRegexp = require('path-to-regexp');
var request = require('request');




// 更新规则
var updateConfig = function(configs) {
    // 遍历更新配置
    for (var i = 0, ii = configs.length; i < ii; i++) {
        var c = configs[i];
        var keys = [];
        c.re = pathToRegexp(c.from, keys);
        c.map = {};
        keys.forEach(function(param, i) {
            param.index = i;
            c.map[param.name] = param;
        });
    }
};

// 获取规则
var getRequestConfig = function(req) {
    var path = req.path;
    for (var i = 0, ii = configs.length; i < ii; i++) {
        var c = configs[i];
        var m = c.re.exec(path);
        if (m) {
            console.log('===\n[match]\n', c, '\n===');
            var to = c.to;
            if (typeof to === 'function') to = c.to(req);
            if (typeof to === 'string') {
                to = to.replace(/\$(\d+)|(?::([a-z]+))/g, function(_, n, name) {
                    if (name) n = c.map[name].index + 1;
                    return m[n];
                });
            }
            return to;
        }
    }
};

// 应用规则
var processRequest = function(config, req, res) {
    if (typeof config === 'object') { // 配置中自定义 config，直接请求
        request(config).pipe(res);
    } else if (req.method.toUpperCase() === 'GET') { // 普通 GET 请求，转发之
        req.pipe(request(config)).pipe(res);
    } else { // 所有非 GET 请求，手动构造
        req.headers.host = url.parse(config).host; // 更新 host
        req.pipe(concat(function(data) {
            request({
                method: req.method,
                url: config,
                headers: req.headers,
                body: data
            }).pipe(res);
        }));
    }
};


module.exports = function() {
    updateConfig(configs);
    console.log('===\n[config]\n', configs, '\n===');

    var middleware = function(req, res, next) {
        var requestConfig = getRequestConfig(req);
        if (requestConfig) {
            console.log('===\n[config]\n', requestConfig, '\n===');
            processRequest(requestConfig, req, res);
        } else {
            next();
        }
    };

    return middleware;
};