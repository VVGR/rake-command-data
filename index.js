'use strict';

var path = require('path');
var util = require('./lib/util');

exports.name = 'data';
exports.desc = 'download mock data form rap system';
exports.register = function(commander) {

    commander.action(function () {
        util.initProject();

        var rapId = fis.config.get('rapId');
        util.updateData( rapId );
    });

};