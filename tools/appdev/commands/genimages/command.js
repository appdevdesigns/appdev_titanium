var generateImages = function(svgPath) {
    var path = require('path');
    var svgPathAbsolute = path.resolve(process.cwd(), svgPath);
    
    // Read in the SVG data files
    var fs = require('fs');
    var svgData = fs.readFileSync(svgPath, 'utf8');
    
    // Load XML manipulation resources
    var $ = require('jquery');
    var xmldom = require('xmldom');
    var domParser = new xmldom.DOMParser();
    var xmlSerializer = new xmldom.XMLSerializer();
    
    // Load the SVG document into a jQuery environment
    var svgDoc = domParser.parseFromString(svgData, 'image/svg+xml');
    var $root = $(svgDoc);
    var $svg = $root.find('svg');
    
    // Calculate the output directory path
    var outputDir = path.join(path.dirname(svgPathAbsolute), 'Resources');
    console.log('outputDir:', outputDir);
    
    // Calculate the original dimensions of the SVG image
    var originalDimensions = {
        width: $svg.attr('width'),
        height: $svg.attr('height')
    };
    console.log('originalDimensions: %dx%d', originalDimensions.width, originalDimensions.height);
    
    var util = require('util');
    var im = require('imagemagick');
    var wrench = require('wrench');
    // Read in the resolutions from an external file, then create a PNG file for each resolution
    JSON.parse(fs.readFileSync(path.join(__dirname, 'resolutions.json'), 'utf8')).forEach(function(resolution) {
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
    
        // Transform the elements as necessary
        $svg.attr(dimensions);
        $svg.find('g[id=background]').attr('transform', util.format('scale(%d,%d)', scaleX, scaleY));
        $svg.find('g[id=foreground]').attr('transform', util.format('translate(%d,%d)scale(%d,%d)', translateVector.x, translateVector.y, scale, scale));
    
        // Calculate the paths
        var imagePathPNG = path.resolve(outputDir, resolution.path);
        var imageDirname = path.dirname(imagePathPNG);
        console.log(imagePathPNG);
        // Ensure that the directory exists
        wrench.mkdirSyncRecursive(imageDirname);
        // Write out the modified SVG data
        var svgData = xmlSerializer.serializeToString($svg[0]);
        var imagePathSVG = imagePathPNG.replace('png', 'svg');
        fs.writeFile(imagePathSVG, svgData, function(err) {
            if (err) throw err;
            // Render the SVG as a PNG file via ImageMagick
            im.convert([imagePathSVG, imagePathPNG], function(err){
                if (err) throw err;
                // Now delete the SVG file
                fs.unlink(imagePathSVG, function(err) {
                    if (err) throw err;
                });
            });
        });
    });
};

module.exports.COA = function() {
    this.title('Generate PNG splash screens from SVG image').helpful()
        .act(function(opts, args, res) {
            generateImages(args.svg);
        })
        .arg()
            .name('svg').title('SVG image')
            .req() // argument is required
            .end() // end argument definition
        .end(); // end subcommand definition
};
