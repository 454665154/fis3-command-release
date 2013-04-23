/*
 * fis
 * http://web.baidu.com/
 */

'use strict';

exports.name = 'release';
exports.desc = 'build and deploy your project';
exports.register = function(commander){
    
    function watch(opt){
        var root = fis.project.getProjectPath();
        var timer = -1;
        var safePathReg = /^[:\\\/ _\-.\w]+$/i;
        function listener(path){
            if(safePathReg.test(path)){
                clearTimeout(timer);
                timer = setTimeout(function(){
                    release(opt);
                }, 500);
            }
        }
        require('chokidar')
            .watch(root, {
                ignored : /[\/\\](?:output\b|\.)/i,
                persistent: true
            })
            .on('add', listener)
            .on('change', listener)
            .on('unlink', listener)
            .on('error', function(err){
                fis.log.error(err);
            });
    }
    
    
    var lastModified = {};
    var collection = {};
    var deploy = require('./lib/deploy.js');
    
    function release(opt){
        //write a white space.
        var flag, cost, index = 0;
        opt.beforeEach = function(){
            flag = ' .';
            cost = (new Date).getTime();
        };
        opt.afterEach = function(file){
            //cal compile time
            cost = (new Date).getTime() - cost;
            if(cost > 200){
                flag = flag.bold.yellow;
            } else if(cost < 100){
                flag = flag.grey;
            }
            var mtime = file.getMtime().getTime();
            //collect file to deploy
            if((file.cache && file.cache.expired) || lastModified[file.subpath] !== mtime){
                lastModified[file.subpath] = mtime;
                collection[file.subpath] = file;
                if(index > 0 && index % 50 === 0){
                    process.stdout.write('\n ');
                }
                process.stdout.write(flag);
                fis.log.debug(file.subpath);
            }
            index++;
        };
        
        //release
        fis.release(opt, function(ret){
            for(var item in collection){
                if(collection.hasOwnProperty(item)){
                    process.stdout.write('\n');
                    fis.util.map(ret.pkg, collection, true);
                    deploy(opt.dest, opt.md5, collection);
                    collection = {};
                    return;
                }
            }
        });
    }
    
    commander
        .option('-d, --dest <names>', 'release output destination', String, 'preview')
        .option('-w, --watch', 'monitor the changes of project')
        .option('-c, --clean', 'clean cache before releasing')
        .option('--md5 <level>', 'md5 release option', parseInt, 0)
        .option('--domain', 'add domain', Boolean, false)
        .option('--lint', 'with lint', Boolean, false)
        .option('--optimize', 'with optimize', Boolean, false)
        .option('--pack', 'with package', Boolean, true)
        .option('--debug', 'debug mode', Boolean, false)
        .action(function(options){
            var cwd = fis.util.realpath(process.cwd()),
                filename = fis.project.conf,
                pos = cwd.length, conf;
            do {
                cwd  = cwd.substring(0, pos);
                conf = cwd + '/' + filename;
                if(fis.util.exists(conf)){
                    //init project
                    fis.project.setProjectRoot(cwd);
                    //merge standard conf
                    fis.config.merge(fis.util.readJSON(__dirname + '/standard.json'));
                    //merge user conf
                    fis.config.merge(fis.util.readJSON(conf));
                    //configure log
                    fis.log.level = options.debug ? fis.log.L_ALL : fis.log.level;
                    fis.log.throw = true;
                    //compile setup
                    var tmp = fis.compile.setup({
                        debug    : options.debug,
                        optimize : options.optimize,
                        lint     : options.lint,
                        hash     : options.md5 > 0,
                        domain   : options.domain
                    });
                    
                    if(options.clean){
                        fis.cache.clean(tmp);
                    }
                    
                    if(options.watch){
                        watch(options);
                    } else {
                        release(options);
                    }
                    return;
                }
            } while(pos > 0);
            fis.log.error('unable to find fis-conf file [' + filename + ']');
        });
};