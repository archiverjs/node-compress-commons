/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var inherits = require('util').inherits;
var crc32 = require('buffer-crc32');
var ChecksumStream = require('crc32-stream');
var DeflateCRC32Stream = require('deflate-crc32-stream');

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

  options = options || {};
  options.zlib = options.zlib || {};
  ArchiveOutputStream.call(this, options);

  this.options = options;

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
  if (source.length === 0) {
    zae.setMethod(constants.METHOD_STORED);
  }

  var method = zae.getMethod();

  if (method === constants.METHOD_STORED) {
    zae.setSize(source.length);
    zae.setCompressedSize(source.length);
    zae.setCrc(crc32.unsigned(source));
  }

  this._writeLocalFileHeader(zae);

  if (method === constants.METHOD_STORED) {
    this.write(source);
    this._afterAppend(zae);
    callback(null, zae);
    return;
  } else if (method === constants.METHOD_DEFLATED) {
    this._smartStream(zae, callback).end(source);
    return;
  } else {
    callback(new Error('compression method ' + method + ' not implemented'));
    return;
  }
};

ZipArchiveOutputStream.prototype._appendStream = function(zae, source, callback) {
  zae.getGeneralPurposeBit().useDataDescriptor(true);

  this._writeLocalFileHeader(zae);

  var smart = this._smartStream(zae, callback);
  source.pipe(smart);
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

ZipArchiveOutputStream.prototype._setDefaults = function(ae) {
  if (ae.getMethod() === -1) {
    ae.setMethod(constants.METHOD_DEFLATED);
  }

  if (ae.getTime() === -1) {
    ae.setTime(new Date());
  }

  ae._offsets = {
    file: 0,
    data: 0,
    contents: 0,
  };
};

ZipArchiveOutputStream.prototype._smartStream = function(zae, callback) {
  var deflate = zae.getMethod() === constants.METHOD_DEFLATED;
  var process = deflate ? new DeflateCRC32Stream(this.options.zlib) : new ChecksumStream();

  function handleStuff(err) {
    zae.setCrc(process.digest());
    zae.setSize(process.size());
    zae.setCompressedSize(process.size(true));
    this._afterAppend(zae);
    callback(null, zae);
  }

  process.once('error', callback);
  process.once('end', handleStuff.bind(this));

  process.pipe(this, { end: false });

  return process;
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
  var gpb = zae.getGeneralPurposeBit();
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

  if (method == constants.METHOD_DEFLATED || gpb.usesDataDescriptor()) {
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
    zae.setVersionNeededToExtract(verex);
    gpb.useDataDescriptor(true);
  }

  this.write(zipUtil.getShortBytes(verex));
  this.write(gpb.encode());
};

ZipArchiveOutputStream.prototype.getComment = function(comment) {
  return this._archive.comment === null ? '' : this._archive.comment;
};

ZipArchiveOutputStream.prototype.setComment = function(comment) {
  this._archive.comment = comment;
};