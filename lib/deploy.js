/*
 * fis
 * http://web.baidu.com/
 */

'use strict';

function upload(receiver, to, release, file){
    fis.util.upload(
        //url, request options, post data, file
        receiver, null, { to : to + release }, file,
        function(err, res){
            if(err || res != '0'){
                fis.log.error('upload file [' + file.subpath + '] to [' + to +
                    '] by receiver [' + receiver + '] error [' + (err || res) + ']');
            } else {
                var time = '[' + fis.log.now(true) + ']';
                process.stdout.write(
                    ' - '.green.bold +
                    time.grey + ' ' + 
                    file.subpath.replace(/^\//, '') +
                    ' >> '.yellow.bold +
                    to + release +
                    '\n'
                );
            }
        }
    );
}

function deploy(dest, file){
    if(file.release){
        if(dest.receiver){
            if(!file.useHash || dest.md5 != 1){
                upload(dest.receiver, dest.to, file.release, file);
            }
            if(file.useHash && dest.md5 > 0){
                upload(dest.receiver, dest.to, file.getHashRelease(), file);
            }
        } else {
            file.deliver(dest.to, dest.md5);
        }
    } else {
        fis.log.error('unreleasable file [' + file.realpath + ']');
    }
}

function normilize(str){
    return '/' + String(str || '').replace(/^\/|\/$/, '');
}

module.exports = function(dest, md5, collection){
    var settings = fis.config.get('deploy', {});
    var root = fis.project.getProjectPath();
    var dests = [];
    dest.split(/,/g).forEach(function(d){
        var opt = settings[d] || {};
        opt.md5 = md5;
        opt.root = opt.root || root;
        opt.from = normilize(opt.from);
        if(opt.to){
            opt.to = fis.util(opt.to);
        } else if(/^(?:\.|output\b)/.test(d)){ //local
            opt.to = fis.util(root, d);
        } else if(d === 'preview'){
            opt.to = fis.project.getTempPath('www');
        } else if(fis.util.isAbsolute(d)) {
            opt.to = fis.util(d);
        } else {
            fis.log.error('invalid deploy destination options [' + d + ']');
        }
        dests.push(opt);
    });
    fis.util.map(collection, function(subpath, file){
        dests.forEach(function(d){
            if(file.release && file.release.indexOf(d.from) === 0 && fis.util.filter(file.subpath, d.include, d.exclude)){
                deploy(d, file);
            }
        });
    });
};