"use strict";

var path = require('path')
  , basename = path.basename(__filename, '.js')
  , debug = require('debug')('castor:' + basename)
  , util = require('util')
  , fs = require('fs')
  , include = require('../helpers/include.js')
  ;


module.exports = function(config) {
  var themename = config.get('theme') || 'default'
    , themedirs = [
        path.resolve(__dirname, '..', 'themes'),
        process.cwd(),
        process.env.HOME
      ]
    , themefile = include(themedirs, themename, false)
    , themepath = path.dirname(themefile)
    , themeconf = require(themefile) || {}
    ;

  console.log('themename', themename);
  console.log('themedirs', themedirs);
  console.log('themefile', themefile);
  console.log('themepath', themepath);
  console.log('themeconf', themeconf);

  if (Array.isArray(themeconf.browserifyModules)) {
    themeconf.browserifyModules = themeconf.browserifyModules.map(function(modulename) {
        var modulefile, moduledesc = {};
        try {
          modulefile = require.resolve(modulename);
          moduledesc[modulename] = {expose : modulename};
        }
        catch (e) {
          var modulename2 = path.join(themepath, 'node_modules', modulename);
          try {
            modulefile = require.resolve(modulename2);
            moduledesc[modulename2] = {expose : modulename};
          }
          catch (e) {
            // ignore module
          }
        }
        return moduledesc;
      }
    );
  }
  else {
    themeconf.browserifyModules = [];
  }
  config.merge(themeconf);
  return themepath;
}

