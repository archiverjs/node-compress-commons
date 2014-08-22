/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var inherits = require('util').inherits;
var ArchiveOutputStream = require('../archive-entry');

var ZipArchiveOutputStream = module.exports = function(options) {
  if (!(this instanceof ZipArchiveOutputStream)) {
    return new ZipArchiveOutputStream(options);
  }

  ArchiveOutputStream.call(this, options);
};

inherits(ZipArchiveOutputStream, ArchiveOutputStream);
