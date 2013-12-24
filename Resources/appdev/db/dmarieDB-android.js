// *****************************************************************
/*
 
 This file is now obsolete, since the module adhere's to the 
 standard calls of the Titanium.Database module.
 
 To use the attach command, simply open a database and 
 issue the attach command via the execute method on the database.
 Pass the database password as the key.
 
 */
// *****************************************************************
var SQLOBJ = require("com.dmarie.sql");

// dbPath determines where databases are stored
// var dbPath = "/sdcard/";
var dbPath = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory).nativePath.replace("file://","") + "/";

var openDB = function openDB(db, pw) {
	return SQLOBJ.openDB(dbPath + db,pw);
};

openDB.prototype.attach = function dbAttach(file, alias, key) {
	openDB.execute("attach '" + dbPath + file + "' as " + alias + " key '" + key + "';");
};
exports.openDB = openDB;
exports.dbPath = dbPath;
