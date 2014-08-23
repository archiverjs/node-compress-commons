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
var headers = require('./headers');
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
    finish: false,
    finished: false,
    processing: false
  };
};

inherits(ZipArchiveOutputStream, ArchiveOutputStream);

ZipArchiveOutputStream.prototype._afterAppend = function(zae) {
  this._entries.push(zae);
  this._archive.processing = false;

  this._writeDataDescriptor(zae);

  this._archive.processing = false;
  this._entry = null;

  if (this._archive.finish) {
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
  } else {

  }

  self._afterAppend(zae);
  callback(null, zae);



  return;

  data.offset = self.offset;

  if (data.store) {
    self.write(source);
    self._afterAppend(data);
    callback(null, data);
  } else {
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
  }
};

ZipArchiveOutputStream.prototype._appendStream = function(zae, source, callback) {
  var self = this;

  zae.gpb.useDataDescriptor(true);

  this._writeLocalFileHeader(zae);

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
  if (this._archive.processing) {
    this._archive.finish = true;
    return;
  }

  this._writeCentralDirectory();
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
};

ZipArchiveOutputStream.prototype._transform = function(chunk, encoding, callback) {
  console.log('transform: ' + chunk.toString());
  callback(null, chunk);
};

ZipArchiveOutputStream.prototype._writeDataDescriptor = function(zae) {
  var gpb = zae.getGeneralPurposeBit();
  if (!gpb.usesDataDescriptor()) {
    return;
  }

  this.write(zipUtil.getLongBytes(constants.SIG_DD));
  // this.write(zipUtil.getLongBytes(zae.getCrc()));
};

ZipArchiveOutputStream.prototype._writeLocalFileHeader = function(zae) {
  var method = zae.getMethod();

  this.write(zipUtil.getLongBytes(constants.SIG_LFH));

  this._writeVersionGeneral(method);

  this.write(zipUtil.getShortBytes(method));
  this.write(zipUtil.getLongBytes(zae.getTime(true)));

  this._entry.localDataStart = this.offset;

  if (method === constants.METHOD_DEFLATED) {
    this.write(constants.ZERO_LONG);
    this.write(constants.ZERO_LONG);
    this.write(constants.ZERO_LONG);
  } else {

  }

   this._entry.dataStart = this.offset;
};

ZipArchiveOutputStream.prototype._writeVersionGeneral = function(method) {
  var verex = constants.INITIAL_VERSION;
  var gpb = this._entry.entry.getGeneralPurposeBit();

  if (method == constants.METHOD_DEFLATED) {
    verex = constants.DATA_DESCRIPTOR_MIN_VERSION;
    gpb.useDataDescriptor(true);
  }

  this._entry.entry.setGeneralPurposeBit(gpb);

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

  this._entries.push(ae);
  this._entry = {
    entry: ae,
    callback: callback
  };

  this._setDefaults(this._entry.entry);

  this._archive.processing = true;
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

ZipArchiveOutputStream.prototype.finish = function() {
  this._archive.finished = true;
};