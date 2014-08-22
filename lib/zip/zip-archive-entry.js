/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/ctalkington/node-compress-commons/blob/master/LICENSE-MIT
 */
var inherits = require('util').inherits;
var ArchiveEntry = require('../archive-entry');

var DEFAULT_DIR_MODE = 040755; // 755 drwxr-xr-x = S_IFDIR | S_IRWXU | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH
var DEFAULT_FILE_MODE = 0100644; // 644 -rw-r--r-- = S_IFREG | S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH

var PLATFORM_UNIX = 3;
var PLATFORM_FAT = 0;

var METHOD_STORED = 0;
var METHOD_DEFLATED = 8;

var SHORT_MASK = 0xFFFF;
var SHORT_SHIFT = 16;
var EMPTY = new Buffer(0);

var ZipArchiveEntry = module.exports = function(name) {
  if (!(this instanceof ZipArchiveEntry)) {
    return new ZipArchiveEntry(name);
  }

  ArchiveEntry.call(this);

  this.platform = PLATFORM_FAT;
  this.method = -1;

  this.name = null;
  this.size = -1;
  this.csize = -1;
  this.flag = 0;
  this.crc = -1;
  this.dostime = -1;

  this.mode = -1;
  this.extra = 0;
  this.exattr = 0;
  this.inattr = 0;
  this.comment = null;

  if (name) {
    this.setName(name);
  }
};

inherits(ZipArchiveEntry, ArchiveEntry);

ZipArchiveEntry.prototype.getComment = function() {
  return this.comment;
};

ZipArchiveEntry.prototype.getCompressedSize = function() {
  return this.csize;
};

ZipArchiveEntry.prototype.getCrc = function() {
  return this.crc;
};

ZipArchiveEntry.prototype.getExternalAttributes = function() {
  return this.exattr;
};

ZipArchiveEntry.prototype.getGeneralPurposeBit = function() {
  return this.flag;
};

ZipArchiveEntry.prototype.getInternalAttributes = function() {
  return this.inattr;
};

ZipArchiveEntry.prototype.getMethod = function() {
  return this.method;
};

ZipArchiveEntry.prototype.getName = function() {
  return this.name;
};

ZipArchiveEntry.prototype.getPlatform = function() {
  return this.platform;
};

ZipArchiveEntry.prototype.getSize = function() {
  return this.size;
};

ZipArchiveEntry.prototype.getDateTime = function() {
  return this.dostime !== -1 ? this._dos2DateTime(this.dostime) : -1;
};

ZipArchiveEntry.prototype.getUnixMode = function() {
  return this.platform != PLATFORM_UNIX ? 0 : (int) ((this.getExternalAttributes() >> SHORT_SHIFT) & SHORT_MASK);
};

ZipArchiveEntry.prototype.getLastModifiedDate = function() {
  return this.getDateTime();
};

ZipArchiveEntry.prototype.setCompressedSize = function(size) {
  if (size < 0) {
    throw new Error('invalid entry compressed size');
  }

  this.csize = size;
};

ZipArchiveEntry.prototype.setCrc = function(crc) {
  if (crc < 0) {
    throw new Error('invalid entry crc32');
  }

  this.crc = crc;
};

ZipArchiveEntry.prototype.setExternalAttributes = function(attr) {
  this.exattr = attr;
};

ZipArchiveEntry.prototype.setGeneralPurposeBit = function(flag) {
  this.flag = flag;
};

ZipArchiveEntry.prototype.setInternalAttributes = function(attr) {
  this.inattr = attr;
};

ZipArchiveEntry.prototype.setMethod = function(method) {
  if (method < 0) {
    throw new Error('invalid entry compression method');
  }

  this.method = method;
};

ZipArchiveEntry.prototype.setName = function(name) {
  if (name) {
    name = name.replace(/\\/g, '/').replace(/:/g, '').replace(/^\/+/, '');
  }

  this.name = name;
};

ZipArchiveEntry.prototype.setPlatform = function(platform) {
  this.platform = platform;
};

ZipArchiveEntry.prototype.setSize = function(size) {
  if (size < 0) {
    throw new Error('invalid entry size');
  }

  this.size = size;
};

ZipArchiveEntry.prototype.setDateTime = function(time) {
  if ( !d instanceof Date ) {
    throw new Error('invalid entry time');
  }

  this.time = this._dateTime2Dos(time);
};

ZipArchiveEntry.prototype.setUnixMode = function(mode) {
  this.setExternalAttributes((mode << SHORT_SHIFT) | ((mode & 0200) === 0 ? 1 : 0) | (this.isDirectory() ? 0x10 : 0));
  this.mode = mode;
  this.platform = PLATFORM_UNIX;
};

ZipArchiveEntry.prototype.isDirectory = function() {
  return this.getName().endsWith('/');
};

ZipArchiveEntry.prototype._dos2DateTime = function(dos) {
  return new Date(
    ((dos >> 25) & 0x7f) + 1980,
    ((dos >> 21) & 0x0f) - 1,
    (dos >> 16) & 0x1f,
    (dos >> 11) & 0x1f,
    (dos >> 5) & 0x3f,
    (dos & 0x1f) << 1
  );
};

ZipArchiveEntry.prototype._dateTime2Dos = function(d) {
  var year = d.getFullYear();

  if (year < 1980) {
    return 2162688; // 1980-1-1 00:00:00
  } else if (year >= 2044) {
    return 2141175677; // 2043-12-31 23:59:58
  }

  var val = {
    year: year,
    month: d.getMonth(),
    date: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds()
  };

  return ((val.year - 1980) << 25) | ((val.month + 1) << 21) | (val.date << 16) |
    (val.hours << 11) | (val.minutes << 5) | (val.seconds / 2);
};