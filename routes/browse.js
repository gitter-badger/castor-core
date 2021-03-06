'use strict';

var path = require('path')
  , basename = path.basename(__filename, '.js')
  , debug = require('debug')('castor:routes:' + basename)
  , util = require('util')
  , datamodel = require('datamodel')
  , render = require('../helpers/render.js')
  , pmongo = require('promised-mongo')
  ;

module.exports = function(config) {
  var coll = pmongo(config.get('connexionURI')).collection(config.get('collectionName')) ;

  return datamodel()
  .declare('template', function(req, fill) {
    fill(basename + '.html');
  })
  .declare('site', function(req, fill) {
    fill({
      title : config.get('title'),
      description : config.get('description')
    });
  })
  .declare('page', function(req, fill) {
    fill({
      title : config.get('pages:' + req.params.name + ':title'),
      description : config.get('pages:' + req.params.name + ':description'),
      types : ['text/html', 'application/atom+xml', 'application/rss+xml', 'application/json', 'application/zip']
    });
  })
  .declare('draw', function(req, fill) {
    fill(parseInt(req.query.draw, 10));
  })
  .declare('user', function(req, fill) {
    fill(req.user ? req.user : {});
  })
  .declare('config', function(req, fill) {
    fill(config.get());
  })
  .declare('url', function(req, fill) {
    fill(require('url').parse(req.protocol + '://' + req.get('host') + req.originalUrl));
  })
  .declare('selector', function(req, fill) {
    fill({ state: { $nin: [ "deleted", "hidden" ] } });
  })
  .declare('parameters', function(req, fill) {
    var schema = {
      "searchTerms" : {
        "alias": ["query", "search", "q"],
        "type" : "text",
        "pattern" : "[a-z*-][a-z0-9*. _-]*",
        "required" : false
      },
      "itemsPerPage" : {
        "alias": ["count", "length", "l"],
        "type" : "number",
        "required" : false
      },
      "startIndex" : {
        "alias": ["start", "i"],
        "type" : "number",
        "required" : false
      },
      "startPage" : {
        "alias": ["page", "p"],
        "type" : "number",
        "required" : false
      },
      "order" : {
        "alias": ["sort"],
        "type" : "object",
        "required" : false,
        "array": true
      },
      "columns" : {
        "alias": ["cols"],
        "type" : "object",
        "required" : false,
        "array": true
      }
    };
    var form = require('formatik').parse(req.query, schema);
    if (form.isValid()) {
      var v = form.mget('value');
      if (!v.itemsPerPage) {
        v.itemsPerPage = config.get('itemsPerPage');
      }
      if (v.startPage) {
        v.startIndex = (v.startPage - 1) * v.itemsPerPage;
      }
      if (!v.startIndex) {
        v.startIndex = 0;
      }
      fill(v);
    }
    else {
      fill(false);
    }
  })
  .declare('filters', function(req, fill) {
    // Filter by field/column
    // URL syntax: /browse.json?columns[i][data]=content.json.Field&columns[i][search][value]=value
    var filters = {};
    //  for each column
    if (req.query.columns) {
      req.query.columns.forEach(function (c) {
        if (c.search && c.search.value) {
          filters[c.data] = c.search.value;
        }
      });
    }
    fill(filters);
  })
  .declare('sort', function(req, fill) {
    var s = {};
    if (Array.isArray(req.query.order)) {
      req.query.order.forEach(function(itm) {
        if (req.query.columns && req.query.columns[itm.column] && req.query.columns[itm.column].data) {
          s[req.query.columns[itm.column].data] = itm.dir === 'asc' ? 1 : -1;
        }
      });
    }
    fill(s);
  })
  .append('headers', function(req, fill) {
    var headers = {};
    headers['Content-Type'] = require('../helpers/format.js')(req.params.format);
    if (req.params.format === 'zip') {
      headers['Content-Disposition'] = 'attachment; filename="export.zip"';
    }
    fill(headers);
  })
  .append('recordsTotal', function(req, fill) {
    if (this.parameters === false) {
      return fill(0);
    }
    coll.find(this.selector).count().then(fill).catch(fill);
  })
  .append('mongoquery', function(req, fill) {
    var sel = {};
    require('extend')(true, sel, this.selector, this.filters);
    fill(sel);
  })
  .complete('recordsFiltered', function(req, fill) {
    if (this.parameters === false) {
      return fill(0);
    }
    coll.find(this.mongoquery).count().then(fill).catch(fill);
  })
  .complete('data', function(req, fill) {
    if (this.parameters === false) {
      return fill({});
    }
    coll.find(this.mongoquery).sort(this.sort).skip(this.parameters.startIndex).limit(this.parameters.itemsPerPage).toArray().then(fill).catch(fill);
  })
  .send(function(res, next) {
    res.set(this.headers);
    render(res, this, next);
  }
)
.takeout();
}
