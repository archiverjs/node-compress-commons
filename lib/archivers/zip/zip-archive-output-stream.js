/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var inherits = require('util').inherits;
var crc32 = require('buffer-crc32');

var ArchiveOutputStream = require('../archive-output-stream');
var ZipArchiveEntry = require('./zip-archive-entry');
var GeneralPurposeBit = require('./general-purpose-bit');

var constants = require('./constants');
var util = require('../../util');
var zipUtil = require('./util');

var ZipArchiveOutputStream = module.exports = function(options) {
  if (!(this instanceof ZipArchiveOutputStream)) {
    return new ZipArchiveOutputStream(options);
  }

  ArchiveOutputStream.call(this, options);

  this._entry = null;
  this._entries = [];
  this._archive = {
    centralLength: 0,
    centralOffset: 0,
    comment: '',
    finish: false,
    finished: false,
    processing: false
  };
};

inherits(ZipArchiveOutputStream, ArchiveOutputStream);

ZipArchiveOutputStream.prototype._afterAppend = function(zae) {
  this._entries.push(zae);
  this._writeDataDescriptor(zae);

  this._archive.processing = false;
  this._entry = null;

  if (this._archive.finish && !this._archive.finished) {
    this._finish();
  }
};

ZipArchiveOutputStream.prototype._appendBuffer = function(zae, source, callback) {
  var self = this;

  if (source.length === 0) {
    zae.setMethod(constants.METHOD_STORED);
  }

  if (zae.getMethod() === constants.METHOD_STORED) {
    zae.setSize(source.length);
    zae.setCompressedSize(source.length);
    zae.setCrc(crc32.unsigned(source));
  }

  this._writeLocalFileHeader(zae);

  if (zae.getMethod() === constants.METHOD_STORED) {
    self.write(source);
    self._afterAppend(zae);
    callback(null, zae);
    return;
  } else if (zae.getMethod() === constants.METHOD_DEFLATED) {
    callback(new Error('compression method not implemented'));
    return;

    var processStream = self._newProcessStream(data.store, function(err) {
    if (err) {
      return callback(err);
    }

    data.crc32 = processStream.digest();
    data.uncompressedSize = processStream.size();
    data.compressedSize = processStream.compressedSize || data.uncompressedSize;

    self._writeHeader('fileDescriptor', data);
      self._afterAppend(data);
      callback(null, data);
    });

    processStream.end(source);
  } else {
    callback(new Error('compression method not implemented'));
    return;
  }
};

ZipArchiveOutputStream.prototype._appendStream = function(zae, source, callback) {
  var self = this;

  // zae.gpb.useDataDescriptor(true);
  // this._writeLocalFileHeader(zae);

  callback(new Error('stream support not implemented'));
  return;

  data.flags |= (1 << 3);
  data.offset = self.offset;

  self._writeHeader('file', data);

  var processStream = self._newProcessStream(data.store, function(err) {
    if (err) {
      return callback(err);
    }

    data.crc32 = processStream.digest();
    data.uncompressedSize = processStream.size();
    data.compressedSize = processStream.size(true);

    self._writeHeader('fileDescriptor', data);
    self._afterAppend(data);
    callback(null, data);
  });

  source.pipe(processStream);
};

ZipArchiveOutputStream.prototype._emitErrorCallback = function(err) {
  if (err) {
    this.emit('error', err);
  }
};

ZipArchiveOutputStream.prototype._finish = function() {
  this._archive.centralOffset = this.offset;

  this._entries.forEach(function(zae) {
    this._writeCentralFileHeader(zae);
  }.bind(this));

  this._archive.centralLength = this.offset - this._archive.centralOffset;

  this._writeCentralDirectoryEnd();

  this._archive.finish = true;
  this._archive.finished = true;
  this.end();
};

ZipArchiveOutputStream.prototype._setDefaults = function(zae) {
  if (zae.getMethod() === -1) {
    zae.setMethod(constants.METHOD_DEFLATED);
  }

  if (zae.getTime() === -1) {
    zae.setTime(new Date());
  }

  zae._offsets = {
    file: 0,
    data: 0,
    contents: 0,
  };
};

ZipArchiveOutputStream.prototype._transform = function(chunk, encoding, callback) {
  console.log(this.offset);
  console.log('transform: ' + chunk.toString());
  callback(null, chunk);
};

ZipArchiveOutputStream.prototype._writeCentralDirectoryEnd = function() {
  // signature
  this.write(zipUtil.getLongBytes(constants.SIG_EOCD));

  // disk numbers
  this.write(constants.SHORT_ZERO);
  this.write(constants.SHORT_ZERO);

  // number of entries
  this.write(zipUtil.getShortBytes(this._entries.length));
  this.write(zipUtil.getShortBytes(this._entries.length));

  // length and location of CD
  this.write(zipUtil.getLongBytes(this._archive.centralLength));
  this.write(zipUtil.getLongBytes(this._archive.centralOffset));

  // archive comment
  var comment = this.getComment();
  this.write(zipUtil.getShortBytes(comment.length));
  this.write(comment);
};

ZipArchiveOutputStream.prototype._writeCentralFileHeader = function(zae) {
  var method = zae.getMethod();
  var offsets = zae._offsets;

  // signature
  this.write(zipUtil.getLongBytes(constants.SIG_CFH));

  // version made by
  this.write(zipUtil.getShortBytes(
    (zae.getPlatform() << 8) | constants.DATA_DESCRIPTOR_MIN_VERSION
  ));

  // version to extract and general bit flag
  this._writeVersionGeneral(zae);

  // compression method
  this.write(zipUtil.getShortBytes(method));

  // datetime
  this.write(zipUtil.getLongBytes(zae.getTime(true)));

  // crc32 checksum
  this.write(zipUtil.getLongBytes(zae.getCrc()));

  // sizes
  this.write(zipUtil.getLongBytes(zae.getCompressedSize()));
  this.write(zipUtil.getLongBytes(zae.getSize()));

  var name = zae.getName();
  var comment = zae.getComment();
  var extra = zae.getCentralDirectoryExtra();

  // name length
  this.write(zipUtil.getShortBytes(name.length));

  // extra length
  this.write(zipUtil.getShortBytes(extra.length));

  // comments length
  this.write(zipUtil.getShortBytes(comment.length));

  // disk number start
  this.write(constants.SHORT_ZERO);

  // internal attributes
  this.write(zipUtil.getShortBytes(zae.getInternalAttributes()));

  // external attributes
  this.write(zipUtil.getLongBytes(zae.getExternalAttributes()));

  // relative offset of LFH
  this.write(zipUtil.getLongBytes(offsets.file));

  // name
  this.write(name);

  // extra
  this.write(extra);

  // comment
  this.write(comment);
};

ZipArchiveOutputStream.prototype._writeDataDescriptor = function(zae) {
  var gpb = zae.getGeneralPurposeBit();
  if (!gpb.usesDataDescriptor()) {
    return;
  }

  // signature
  this.write(zipUtil.getLongBytes(constants.SIG_DD));

  // crc32 checksum
  this.write(zipUtil.getLongBytes(zae.getCrc()));

  // sizes
  this.write(zipUtil.getLongBytes(zae.getCompressedSize()));
  this.write(zipUtil.getLongBytes(zae.getSize()));
};

ZipArchiveOutputStream.prototype._writeLocalFileHeader = function(zae) {
  var method = zae.getMethod();
  var name = zae.getName();
  var extra = zae.getLocalFileDataExtra();

  zae._offsets.file = this.offset;

  // signature
  this.write(zipUtil.getLongBytes(constants.SIG_LFH));

  // version to extract and general bit flag
  this._writeVersionGeneral(zae);

  // compression method
  this.write(zipUtil.getShortBytes(method));

  // datetime
  this.write(zipUtil.getLongBytes(zae.getTime(true)));

  zae._offsets.data = this.offset;

  if (method === constants.METHOD_DEFLATED) {
    // zero fill and set later
    this.write(constants.LONG_ZERO);
    this.write(constants.LONG_ZERO);
    this.write(constants.LONG_ZERO);
  } else {
    // crc32 checksum and sizes
    this.write(zipUtil.getLongBytes(zae.getCrc()));
    this.write(zipUtil.getLongBytes(zae.getCompressedSize()));
    this.write(zipUtil.getLongBytes(zae.getSize()));
  }

  // name length
  this.write(zipUtil.getShortBytes(name.length));

  // extra length
  this.write(zipUtil.getShortBytes(extra.length));

  // name
  this.write(name);

  // extra
  this.write(extra);

  zae._offsets.contents = this.offset;
};

ZipArchiveOutputStream.prototype._writeVersionGeneral = function(zae) {
  var method = zae.getMethod();
  var verex = zae.getVersionNeededToExtract();
  var gpb = zae.getGeneralPurposeBit();

  if (method == constants.METHOD_DEFLATED) {
    verex = constants.DATA_DESCRIPTOR_MIN_VERSION;
    gpb.useDataDescriptor(true);
  }

  zae.setGeneralPurposeBit(gpb);
  zae.setVersionNeededToExtract(verex);

  this.write(zipUtil.getShortBytes(verex));
  this.write(gpb.encode());
};

ZipArchiveOutputStream.prototype.entry = function(ae, source, callback) {
  if (typeof callback !== 'function') {
    callback = this._emitErrorCallback.bind(this);
  }

  if (!(ae instanceof ZipArchiveEntry)) {
    callback(new Error('not a valid instance of ZipArchiveEntry'));
    return;
  }

  if (this._archive.close || this._archive.finished) {
    callback(new Error('entry after close'));
    return;
  }

  if (this._archive.processing) {
    callback(new Error('already processing an entry'));
    return;
  }

  this._archive.processing = true;
  this._entry = ae;

  this._setDefaults(this._entry);
  source = util.normalizeInputSource(source);

  // if (this._entry.entry.getMethod() == constants.METHOD_DEFLATED && hasCompressionLevelChanged) {
  //   def.setLevel(level);
  //   hasCompressionLevelChanged = false;
  // }

  if (Buffer.isBuffer(source)) {
    this._appendBuffer(ae, source, callback);
  } else if (util.isStream(source)) {
    this._appendStream(ae, source, callback);
  } else {
    this._archive.processing = false;
    callback(new Error('input source must be valid Stream or Buffer instance'));
    return;
  }
};

ZipArchiveOutputStream.prototype.getComment = function(comment) {
  return this._archive.comment === null ? '' : this._archive.comment;
};

ZipArchiveOutputStream.prototype.finish = function() {
  if (this._archive.processing) {
    this._archive.finish = true;
    return;
  }

  this._finish();
};

ZipArchiveOutputStream.prototype.setComment = function(comment) {
  this._archive.comment = comment;
};