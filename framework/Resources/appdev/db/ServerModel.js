var AD = require('AppDev');
var $ = require('jquery');
    
/* 
 * 
 * @class AD.Model
 * @parent AD_Server
 * @parent AD_Client
 *
 * the Model object defines a standard way of how our client side Models
 * communicate with the server side models.
 * 
 * How to use:
 *  to make a new Viewer Model obj:
 *  @codestart
 *        AD.Model.extend("Viewer",
 *        {
 *            _adModule:'test',
 *            _adModel:'viewer',
 *            id:'viewer_id',
 *            labelKey:'viewer_guid',
 *            _isMultilingual:false
 *                     
 *        },
 *        {});
 *  @codeend
 *
 * to use instance of Viewer:
 *  @codestart
 *      var skipper = new Viewer({viewer_guid:'skipper'}); // creates a local copy in client
 *      (or:  var skipper = Viewer._new({viewer_guid:'skipper'});  )
 *
 *      skipper.save();  // <-- creates a copy on the server
 *
 *      skipper.attr('viewer_guid', 'sk1pp3r'); // sets value
 *      var guid = skipper.attr('viewer_guid'); // gets value
 *
 *      skipper.save();  // <-- updates the copy on the server
 *
 *      skipper.destroy();  // <-- deletes copy on the server
 *
 *      skipper.findAll( {}, function (data) {
 *              // data is an array of object instances of Viewer 
 *              var html = '';
 *              for(var dI=0; dI<data.length; dI++) {
 *                  html += '<li>'+data[dI].attr('viewer_guid')+'</li>';
 *              }
 *              $('#'+data[dI].attr('viewer_guid')).html( html);
 *              
 *          }, function (data) { 
 *              // error handling routine 
 *      });
 *  @codeend
 *      
 */
$.Model('AD.Model.ServerModel',
{
    //// 
    //// Class Methods
    //// These methods are defined as part of the Object/Class.  So you
    //// can do Object.findAll();
    //// 
    //// the children will also be able to access these.  However 
    //// when calling  skipper.findAll(), the 'this' inside the fn() 
    //// doesn't necessarally point to skipper. 
    
/*        
        findAll: function(params, onSuccess, onError ){

            if (this._isMultilingual) {
                params = this.verifyLangCode(params);
            }
            
            var self = this;
            
            return AD.ServiceModel.findAll({
            
                url:  '/query/findall/'+this._adModule+'/'+this._adModel+'.json' ,
                params: params,
                success: this.proxy(['wrapMany',onSuccess]),
                failure: onError,
            
            });
            
        },

*/

//// Question: do we like allowing the given onSuccess fn() to 
//// modify what is passed to the defered.resolve() ?  
////
//// if not, we could do:
////
////    success: function (data) {
////        var wrapped = this.wrapMany(data);
////        onSuccess(wrapped);
////        dfd.resolve(wrapped);
////    }
////        (or maybe this is passed by ref and wont work too...)


    findAll: function(params, onSuccess, onError ){

        params = this.verifyLangCode(params);
        
        
        var dfd = $.Deferred();
        AD.ServiceModel.findAll({
        
            url:  '/query/findall/'+this._adModule+'/'+this._adModel+'.json' ,
            params: params,
            success: this.proxy(['models',onSuccess, dfd.resolve]),
            failure: this.proxy([onError, dfd.reject]),
        
        });
        return dfd.promise();
        
    },
    
    

    findOne : function(params, onSuccess, onError){

        var id = params[this.id];
        delete params[this.id];


        params = this.verifyLangCode(params);
        
        
        var dfd = $.Deferred();
        AD.ServiceModel.findOne({
            url:  '/query/findone/'+this._adModule+'/'+this._adModel+'/'+id+'.json',
            params: params,
            success: this.proxy(['model',onSuccess, dfd.resolve]),
            failure: this.proxy([onError, dfd.reject])
        });
        return dfd.promise();

    },
      
      
      
    verifyLangCode: function( param ) {

        // Multilingual Tables require a language_code 
        // to be submitted.  if none provided, then 
        // get currentLangKey from our Multilingual System:
        // 
        if (this._isMultilingual && typeof param.language_code == 'undefined') {
            param.language_code = AD.Viewer.language_key;
        }
        
        return param;
    },
      
      
      
    create : function (attr, onSuccess, onError ) {

        if (this._isMultilingual) {
            attr = this.verifyLangCode(attr);
        }


//// TODO: should probably make sure attr doesn't include this.id


        var dfd = $.Deferred();
        AD.ServiceModel.create({
            url:  '/query/create/'+this._adModule+'/'+this._adModel+'.json',
            params: attr,
            success: this.proxy([onSuccess, dfd.resolve]),
            failure: this.proxy([onError, dfd.reject])
        });
        return dfd.promise();

    },
      
       
         
    update: function (id, attr, onSuccess, onError ) {

        if (this._isMultilingual) {
        
            attr = this.verifyLangCode(attr);
            
            // multilingual tables don't allow you to set the
            // language_code directly.
            var langCode = attr.language_code;
            delete attr.language_code;
            
            attr.dbCond = 'language_code="'+langCode+'"';
            
        }
        
        
//// TODO: should probably make sure attr doesn't include this.id
        
        
        var dfd = $.Deferred();
        AD.ServiceModel.update({
            url:  '/query/update/'+this._adModule+'/'+this._adModel+'/'+id+'.json',
            params: attr,
            success: this.proxy([onSuccess, dfd.resolve]),
            failure: this.proxy([onError, dfd.reject])
        });
        return dfd.promise();
        
    },
       
       
       
    destroy: function (id, onSuccess, onError ) {
        
        var params = {};
        
        if (typeof id != 'undefined') {
        
            if (typeof id === 'object') {
            
                // ok we're assuming this is a db condition here:
                params.dbCond = id;
                id = -1;
                
            }
            
            
            var dfd = $.Deferred();
            AD.ServiceModel.destroy({
                url:  '/query/destroy/'+this._adModule+'/'+this._adModel+'/'+id+'.json',
                params: params,
                success: this.proxy([onSuccess, dfd.resolve]),
                failure: this.proxy([onError, dfd.reject])
            });
            return dfd.promise();
        
        } else {
        
            var dfd = $.Deferred();
            
            var error = {
                success:false,
                errorMsg:'id is undefined ... why!?!'
                }
            
            if (typeof onError != 'undefined') {
                onError(error);
            }
            
            dfd.reject(error);
            
            return dfd.promise();
        
        }

    },
    
    
    
    ////--------------------------------------------------------------
    listManager: function (param) {
        //// return a ListIterator object that is based upon this Model
        ////
        //// param : (object) Key=>Value conditional lookup values
        
        return new AD.ListIterator({
            dataMgr:this,
            lookupParams: param
            });
    
    },
    
    
    
    model: function (data) {
        if (data === null) {
            return data;
        }
        return new this(data);
    },
    
    models : function(data){
        // new changes in javascriptMVC v3 : uses .apply to call our callbacks!
        // we now need to indicate that we need to ._use_call instead:
        var data = this._super(data);
        data._use_call = true; 
        
        return data;
    },

    
    ////--------------------------------------------------------------
    _new: function (data) {
        //// in order to make the client side model operate like the 
        //// serverside version, we're including this method.
        return this.model(data);
    }
      
},
{

    //// 
    //// Instance Methods: 
    //// each instance of this object will have these methods defined.
    ////
    //// inside these fn() the this refers to the instanced object.


    ////--------------------------------------------------------------
    getID: function () {
        // return the current primary key value of this instance.
        // if the pk value is not defined, return -1
        
        if (typeof this[this.Class.id] != 'undefined') {
            return this[this.Class.id];
        }
        return -1;
    
    },
    

    
    ////--------------------------------------------------------------
    getLabel: function() {
        // return the current value of the defined label field.
        // if the label value is not defined, return the primarykey
        
        if (typeof this.Class.labelKey == 'undefined') {
            this.Class.labelKey = this.Class.id; // better have this one!
        }
        
        return this[this.Class.labelKey];
    },

});
