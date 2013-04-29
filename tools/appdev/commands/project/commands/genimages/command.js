var imagemagick = null, $ = null, xmldom = null;
module.exports.load = function() {
    // Load dependencies
    imagemagick = require('imagemagick');
    $ = require('jquery');
    xmldom = require('xmldom');
};

var generateImages = function(params, callback) {
    var path = require('path');
    // The SVG filename defaults to the project name
    var svgPath = path.resolve(params.projectDir, params.svg || (params.project+'.svg'));
    
    // Calculate the output directory path
    var outputDir = params.projectResourcesDir;
    console.log('SVG file:'.label, svgPath);
    console.log('Output directory:'.label, outputDir);
    
    // Read in the SVG data files
    var fs = require('fs-extra');
    var svgData = fs.readFileSync(svgPath, 'utf8');
    
    // Prepare for XML manipulation
    var domParser = new xmldom.DOMParser();
    var xmlSerializer = new xmldom.XMLSerializer();
    
    // Load the SVG document into a jQuery environment
    var svgDoc = domParser.parseFromString(svgData, 'image/svg+xml');
    var $root = $(svgDoc);
    var $svg = $root.find('svg');
    
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
            async.each(resolutions, function(resolution, callback) {
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
                
                // Calculate the paths
                var imagePathPNG = path.resolve(outputDir, resolution.path);
                var imagePathSVG = imagePathPNG.replace('png', 'svg');
                var imageDirname = path.dirname(imagePathPNG);
                console.log('generate'.green, resolution.path.info);
                
                async.series([
                    function(callback) {
                        // Ensure that the directory exists
                        fs.mkdirs(imageDirname, Callback.suppressErrors(['EEXIST'], callback));
                    },
                    function(callback) {
                        // Manipulate the elements as necessary
                        var util = require('util');
                        $svg.attr(dimensions);
                        $svg.find('g[id=background]').attr('transform', util.format('scale(%d,%d)', scaleX, scaleY));
                        $svg.find('g[id=foreground]').attr('transform', util.format('translate(%d,%d)scale(%d,%d)', translateVector.x, translateVector.y, scale, scale));
                        
                        // Write out the modified SVG data
                        var svgData = xmlSerializer.serializeToString($svg[0]);
                        fs.writeFile(imagePathSVG, svgData, callback);
                    },
                    function(callback) {
                        // Render the SVG as a PNG file via ImageMagick
                        imagemagick.convert([imagePathSVG, imagePathPNG], callback);
                    },
                    function(callback) {
                        // Now delete the SVG file
                        fs.unlink(imagePathSVG, callback);
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
    args: [{
        name: 'svg',
        title: 'SVG image'
    }]
};
