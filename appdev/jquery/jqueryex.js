var jQuery = require('jquery');

// Attach several custom utility functions to the jQuery namespace

// Return 1 if arg1 is greater than arg2, -1 if arg1 is less than arg2, or 0 if they are equal
jQuery.compare = function(arg1, arg2) {
    if (arg1 > arg2) {
        return 1;
    }
    else if (arg1 < arg2) {
        return -1;
    }
    else {
        return 0;
    }
};

// Return an array of length 'dimension' filled with 'initial'
jQuery.createArray = function(dimension, initial) {
    var array = [];
    for (var i = 0; i < dimension; ++i) {
        array.push(initial);
    }
    return array;
};

// Return true if the arrays are equal, false if they are not
jQuery.compareArrays = function(arr1, arr2) {
    // Arrays match if the arrays are the same size and every element in arr1 matches the corresponding element in arr2
    return arr1.length === arr2.length && arr1.every(function(element, index) {
        return element === arr2[index];
    });
};

// Return true if the objects are equal for every field in the fields array, false if they are not
jQuery.compareObjects = function(obj1, obj2, fields) {
    var equal = true;
    fields.forEach(function(field) {
        equal = equal && obj1[field] === obj2[field];
    });
    return equal;
};

// Return an array of all the arguments merged
jQuery.mergeArrays = function() {
    var merged = [];
    for (var i = 0; i < arguments.length; ++i) {
        var piece = arguments[i];
        if (arguments[i]) {
            // Add 'piece' to the array
            merged = merged.concat(piece);
        }
    }
    return merged;
};

// Return an object that represents array, indexed by the specified key field
// [{id: 0, value: 'a'}, {id: 2, value: 'b'}, {id: 3, value: 'c'}] -> { 0: {id: 0, value: 'a'}, 2: {id: 2, value: 'b'}, 3: {id: 3, value: 'c'} }
jQuery.indexArray = function(array, key) {
    var object = {};
    array.forEach(function(element) {
        object[element[key]] = element;
    });
    return object;
};

// Return the string with the first leter capitalized
jQuery.capitalize = function(string) {
    return string ? (string[0].toUpperCase() + string.slice(1)) : string;
};

// Return the format string with arguments expanded
// $.formatString('Hi, my name is {0} {1}!', 'John', 'Doe') === 'Hi, my name is John Doe!'
// The format argument can reference a string in the localization file
jQuery.formatString = function(format) {
    var args = Array.prototype.slice.call(arguments, 1);
    return (L(format) || format).replace(/{(\d+)}/g, function(match, index) { 
        return typeof args[index] !== 'undefined' ? args[index] : match;
    });
};

// Return the current date as a Date object without time information
jQuery.today = function() {
    var now = new Date();
    now.setHours(0, 0, 0, 0); // remove time information
    return now;
};

// Return the date in the format mm-dd-yyy
jQuery.formatDate = function(date) {
    return (date.getMonth()+1)+'-'+date.getDate()+'-'+date.getFullYear();
};

// Output object for debugging purposes
jQuery.dumpObject = function(object, param /* name|depth */) {
    var depth = 0;
    if (typeof param === 'string') {
        // This is the name parameter
        console.log(param+':');
    }
    else if (typeof param === 'number') {
        // This is the depth parameter
        depth = param;
    }  
    var indentation = '';
    for (var i = 0; i < depth; ++i) {
        indentation += '  ';
    }
    jQuery.each(object, function(key, value) {
        console.log('.'+indentation+'|  '+key+': ['+typeof value+'] '+JSON.stringify(value));
        if (typeof value === 'object' && value) {
            jQuery.dumpObject(value, depth + 1);
        }
    });
};
