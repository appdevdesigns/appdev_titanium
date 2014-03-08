exports.cliVersion = '>=3.X';
 
exports.init = function(logger, config, cli, appc) {
    cli.addHook('build.pre.compile', function(build, finished) {
        // "config" variable contains Titanium CLI configuration
        // "cli" variable contains the CLI state including parsed arguments
        // "appc" is a library we wrote full of random stuff
        // "build" variable contains the build state
        
        var args = ['project', 'update'];
        args.push(require('path').basename(cli.argv['project-dir']));
        if (process.platform === 'win32') {
            // Copy resources under Windows
            args.push('--copy');
        }
        logger.info('Spawning "tiad ' + args.join(' ') + '"');
        var child = require('child_process').spawn('tiad', args, { stdio: 'inherit' });
        child.on('close', function(code) {
            finished();
        });
    });
};
