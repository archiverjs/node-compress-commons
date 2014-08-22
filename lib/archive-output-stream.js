/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var inherits = require('util').inherits;
var Transform = require('readable-stream').Transform;

var ArchiveOutputStream = module.exports = function(options) {
  if (!(this instanceof ArchiveOutputStream)) {
    return new ArchiveOutputStream(options);
  }

  Transform.call(this, options);

  this.offset = 0;
};

inherits(ArchiveOutputStream, Transform);

ArchiveOutputStream.prototype._transform = function(chunk, encoding, callback) {
  callback(null, chunk);
};

ArchiveOutputStream.prototype.getPointer = function() {
  return this.offset;
};

ArchiveOutputStream.prototype.putArchiveEntry = function() {};

ArchiveOutputStream.prototype.closeArchiveEntry = function() {};

ArchiveOutputStream.prototype.finish = function() {};

ArchiveOutputStream.prototype.write = function(chunk, cb) {
  if (chunk) {
    this.offset += chunk.length;
  }

  return Transform.prototype.write.call(this, chunk, cb);
};