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

var SHORT_MASK = 0xFFFF;
var SHORT_SHIFT = 16;

var ZipArchiveEntry = module.exports = function(name) {
  if (!(this instanceof ZipArchiveEntry)) {
    return new ZipArchiveEntry(name);
  }

  ArchiveEntry.call(this);

  this.name = null;
  this.method = -1;
  this.size = 0;
  this.compressedSize = 0;

  this.crc = 0;
  this.dostime = 0;
  this.externalAttributes = 0;
  this.internalAttributes = 0;
  this.platform = PLATFORM_UNIX;

  this.setName(name);
};

inherits(ZipArchiveEntry, ArchiveEntry);

ZipArchiveEntry.prototype.getExternalAttributes = function() {
  return this.externalAttributes;
};

ZipArchiveEntry.prototype.getInternalAttributes = function() {
  return this.internalAttributes;
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

ZipArchiveEntry.prototype.getTime = function() {
  return this.time;
};

ZipArchiveEntry.prototype.getUnixMode = function() {
  return this.platform != PLATFORM_UNIX ? 0 : (int) ((this.getExternalAttributes() >> SHORT_SHIFT) & SHORT_MASK);
};

ZipArchiveEntry.prototype.getLastModifiedDate = function() {
  return new Date(this.getTime());
};

ZipArchiveEntry.prototype.setExternalAttributes = function(attributes) {
  this.externalAttributes = attributes;
};

ZipArchiveEntry.prototype.setInternalAttributes = function(attributes) {
  this.internalAttributes = attributes;
};

ZipArchiveEntry.prototype.setMethod = function(name) {
  // check its a method supported
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

ZipArchiveEntry.prototype.setUnixMode = function(mode) {
  this.mode = mode;
};

ZipArchiveEntry.prototype.isDirectory = function() {
  return this.getName().endsWith('/');
};