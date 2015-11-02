var generateImages = function(params, callback) {
    var path = require('path');
    // The SVG filename defaults to the project name
    var svgPath = path.resolve(params.projectDir, params.svg || (params.project+'.svg'));
    
    // Calculate the output and temporary directory paths
    var outputDir = params.projectDir;
    var tempDir = require('temp').mkdirSync('genimages');
    console.log('SVG file:'.label, svgPath);
    console.log('Output directory:'.label, outputDir);
    
    // Read in the SVG data files
    var fs = require('fs-extra');
    var svgData = fs.readFileSync(svgPath, 'utf8');
    
    // Load the SVG XML into Cheerio for jQuery-style parsing and manipulation
    var $root = require('cheerio').load(svgData, {
        xmlMode: true
    });
    var $svg = $root('svg');
    
    // Calculate the original dimensions of the SVG image
    var originalDimensions = {
        width: $svg.attr('width'),
        height: $svg.attr('height')
    };
    
    var async = require('async');
    var Callback = require('callback.js');
    async.waterfall([
        function(callback) {
            // Read in the resolutions from an external file
            var resolutionsPath = path.join(__dirname, 'resolutions.json');
            fs.readFile(resolutionsPath, 'utf8', callback);
        },
        function(resolutionsText, callback) {
            // Convert the text to JSON
            callback(null, JSON.parse(resolutionsText));
        },
        function(resolutions, callback) {
            // Create a PNG file for each resolution
            async.eachLimit(resolutions, 5, function(resolution, callback) {
                var dimensions = {
                    width: resolution.width,
                    height: resolution.height
                };
                
                // Calculate the transform for the foreground element
                var scaleX = dimensions.width / originalDimensions.width;
                var scaleY = dimensions.height / originalDimensions.height;
                var scale = Math.min(scaleX, scaleY);
                var translate = Math.abs(dimensions.width - dimensions.height) / 2;
                var translateVector = { x: 0, y: 0 };
                translateVector[scaleX > scaleY ? 'x' : 'y'] = translate;
                
                // Split the relative path into the directory components, then feed
                // that into path.join to get the platform-specific image relative path
                // On Windows, for example, this will transform
                // "android/images/high/ApplicationIcon.png" into "android\\images\\high\\ApplicationIcon.png"
                var imageRelativePath = path.join.apply(path, resolution.path.split('/'));
                // Calculate the paths of the temporary SVG and the generated PNG files
                var imagePathPNG = path.join(outputDir, imageRelativePath);
                var imagePathSVG = path.join(tempDir, imageRelativePath.replace(/(\.png)?$/, '.svg'));
                console.log('generate'.green, resolution.path.info);
                
                async.series([
                    function(callback) {
                        // Ensure that the paths to the PNG and SVG files exist
                        async.each([imagePathPNG, imagePathSVG], function(file, callback) {
                            fs.mkdirs(path.dirname(file), Callback.suppressErrors(['EEXIST'], callback));
                        }, callback);
                    },
                    function(callback) {
                        // Manipulate the elements as necessary
                        var util = require('util');
                        $svg.attr(dimensions);
                        $svg.find('g[id=background]').attr('transform', util.format('scale(%d,%d)', scaleX, scaleY));
                        $svg.find('g[id=foreground]').attr('transform', util.format('translate(%d,%d)scale(%d,%d)', translateVector.x, translateVector.y, scale, scale));
                        
                        // Write out the modified SVG data
                        var svgContent = $root.xml();
                        fs.writeFile(imagePathSVG, svgContent, callback);
                    },
                    function(callback) {
                        // Render the SVG as a PNG file via svg2png (which uses PhantomJS)
                        require('svg2png')(imagePathSVG, imagePathPNG, callback);
                    }
                ], callback);
            }, callback);
        }
    ], callback);
};

module.exports.operationStack = [
    generateImages
];
module.exports.COA = {
    title: 'Generate PNG splash screens from SVG image',
    args: ['svg'],
    definitions: {
        args: [{
            name: 'svg',
            title: 'SVG image'
        }]
    }
};
