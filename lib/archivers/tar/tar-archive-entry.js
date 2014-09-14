/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var inherits = require('util').inherits;

var ArchiveEntry = require('../archive-entry');

var TarArchiveEntry = module.exports = function(name) {
  if (!(this instanceof TarArchiveEntry)) {
    return new TarArchiveEntry(name);
  }

  if (name) {
    this.setName(name);
  }

  ArchiveEntry.call(this);
};

inherits(TarArchiveEntry, ArchiveEntry);

TarArchiveEntry.prototype.getName = function() {
  return this.name;
};

TarArchiveEntry.prototype.setName = function(name) {
  name = name.replace(/\\/g, '/').replace(/:/g, '').replace(/^\/+/, '');

  this.name = name;
};