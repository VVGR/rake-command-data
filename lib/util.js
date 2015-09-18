var path = require('path');
var fs = require('fs');

var endOfLine = require('os').EOL;

var _ = {};

module.exports = _;

_.updateData = function( url ){
    _.download( url, function( dataFilePath ){
        // 返回的数据格式：[{"tpl": "index.tpl", "url": "index.html", "mockData": {"a": "b"}}]
        // 遍历这个数组
        // 生成 test 数据 index.tpl 生成 index.json
        // 修改 server.conf 文件，生成重写规则

        setTimeout(function(){
            fs.readFile( dataFilePath, 'utf-8', function( err, data ){
                if ( err ) {
                    console.log( err );
                } else {
                    data = JSON.parse( data.toString() );
                    _.processProjectData( data );
                }
            });
        }, 100);
    });
};

_.processProjectData = function( projectData ){
    var serverConf = [];
    projectData.forEach(function( action ){
        _.generateMockDataFiles( action );
        serverConf.push( _.collectServerConf( action ) );
    });


    // data command 会从 rap 读取接口配置并且生成 server rewrite 配置
    // 我们也可以自己在 fis-conf.js 里写入一些默认的 conf，会自动进行合并
    var initConf = fis.config.get('server.conf') || [];


    serverConf = serverConf.concat( initConf );

    var confData = serverConf.join( endOfLine );

    fs.writeFile(_.resolveFilePath( 'server.conf' ), confData, function( err ){
        if ( err ) {
            throw err;
        }
        console.log( 'server.conf.file created');
    });
};

_.resolveFilePath = function(){
    var pathList = [ fis.project.getProjectPath() ];
    return path.join.apply( null, pathList.concat( [].slice.apply( arguments ) ) );
};

_.collectServerConf = function( actionData ){
    // template ^\/?$ common/page/library.tpl
    var namespace = fis.config.get('namespace');

    var url = actionData.url;
    var tpl = actionData.tpl;

    var regUrl = makeRegRule( url );

    return 'template ' + regUrl + ' ' + namespace + '/page/' + tpl;

    function makeRegRule( url ){
        var matchMap = {
            '/': '\\/',
            '.': '\\.',
            '-': '\\-',
            ':id': '\\d+'
        };
        var reg = url.replace(/\/|\.|\-|:id/g, function( chr ){
            return matchMap[ chr ];
        });
        return '^'+ reg +'$'
    }
};

_.generateMockDataFiles = function( actionData ){
    var tpl = actionData.tpl;
    var mockDataFileName = tpl.replace('.tpl', '.php');
    var data = JSON.parse(JSON.stringify( actionData.mockData ));
    data = '<?php $fis_data = ' + _.JSON2PHP( data ) + ';';

    fis.util.write( path.join( fis.project.getProjectPath(), 'test', 'page', mockDataFileName ), data);
};

_.JSON2PHP = function( jsonData ){
    var arrayStr = 'array(';
    var itemObj = [];
    for ( var item in jsonData  ) {
        if ( jsonData.hasOwnProperty( item ) ) {
            var currentData = jsonData[item];
            if ( typeof currentData == 'object' ) {
                itemObj.push('"' + item + '" => ' + _.JSON2PHP( currentData ));
            } else {
                if ( typeof currentData == 'string') {
                    currentData = '"' + currentData  + '"';
                }
                itemObj.push('"' + item + '" => ' + currentData);
            }
        }
    }
    arrayStr += itemObj.join(',') + ')';
    return arrayStr;
};

_.download = function ( url, cb ) {
    var filename = _.md5(url);
    var tmp_file_path = path.join(_.getTempDir(), 'file_' + _.md5(url));

    if (fs.existsSync(tmp_file_path)) {
        _.del(tmp_file_path);
    }

    var download = require('download-file');

    var options = {
        directory: tmp_file_path,
        filename: filename
    };

    download(url, options, function(err){
        if ( err ) {
            throw err;
        }
        cb( path.join( options.directory, options.filename ) );
    })
};

_.initProject = function(){
    var root, conf, filename = 'fis-conf.js';

    root = fis.util.realpath(process.cwd());
    if(!conf){
        //try to find fis-conf.js
        var cwd = root, pos = cwd.length;
        do {
            cwd  = cwd.substring(0, pos);
            conf = cwd + '/' + filename;
            if(fis.util.exists(conf)){
                root = cwd;
                break;
            } else {
                conf = false;
                pos = cwd.lastIndexOf('/');
            }
        } while(pos > 0);
    }

    //init project
    fis.project.setProjectRoot(root);

    process.title = 'fis ' + process.argv.splice(2).join(' ') + ' [ ' + root + ' ]';

    if(conf){
        var cache = fis.cache(conf, 'conf');
        if(!cache.revert()){
            cache.save();
        }
        require(conf);
    } else {
        fis.log.warning('missing config file [' + filename + ']');
    }
};

_.md5 = function (data) {
    var crypto = require('crypto');
    var md5 = crypto.createHash('md5');
    var encoding = typeof data === 'string' ? 'utf8' : 'binary';
    md5.update(data, encoding);
    return md5.digest('hex');
};

_.getTempDir = function () {
    var list = ['LOCALAPPDATA', 'APPDATA', 'HOME'];
    var tmp;
    for(var i = 0, len = list.length; i < len; i++){
        if(tmp = process.env[list[i]]){
            break;
        }
    }
    tmp = path.join(tmp, '.fis-download');

    if (!fs.existsSync(tmp)) {
        fs.mkdirSync(tmp);
    }

    return tmp;
};

_.del = function (p) {
    var stat = fs.lstatSync(p);
    if (stat.isFile() || stat.isSymbolicLink()) {
        fs.unlinkSync(p);
    } else if (stat.isDirectory()) {
        fs.readdirSync(p).forEach(function (name) {
            _.del(path.join(p, name));
        });
        fs.rmdirSync(p);
    }
    return true;
};