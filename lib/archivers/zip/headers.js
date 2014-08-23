/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var zipUtil = require('./util');

var headers = module.exports = {};

var LocalFile = function() {
  if (!(this instanceof LocalFile)) {
    return new LocalFile();
  }
};

LocalFile.prototype.encode = function(zae) {
  var buf = new Buffer();
  buf.write(zipUtil.getLongBytes(constants.SIG_LFH));

  console.log(zae);
  return buf;
};

headers.LocalFile = LocalFile;