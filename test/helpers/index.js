var crypto = require('crypto');
var fs = require('fs');
var inherits = require('util').inherits;

var Stream = require('stream').Stream;
var Readable = require('readable-stream').Readable;
var Writable = require('readable-stream').Writable;

function binaryBuffer(n) {
  var buffer = Buffer.alloc(n);

  for (var i = 0; i < n; i++) {
    buffer.writeUInt8(i&255, i);
  }

  return buffer;
}

module.exports.binaryBuffer = binaryBuffer;

function BinaryStream(size, options) {
  Readable.call(this, options);

  var buf = Buffer.alloc(size);

  for (var i = 0; i < size; i++) {
    buf.writeUInt8(i&255, i);
  }

  this.push(buf);
  this.push(null);
}

inherits(BinaryStream, Readable);

BinaryStream.prototype._read = function(size) {};

module.exports.BinaryStream = BinaryStream;

function DeadEndStream(options) {
  Writable.call(this, options);
}

inherits(DeadEndStream, Writable);

DeadEndStream.prototype._write = function(chuck, encoding, callback) {
  callback();
};

module.exports.DeadEndStream = DeadEndStream;

function fileBuffer(filepath) {
  return fs.readFileSync(filepath);
}

module.exports.fileBuffer = fileBuffer;

function UnBufferedStream() {
  this.readable = true;
}

inherits(UnBufferedStream, Stream);

module.exports.UnBufferedStream = UnBufferedStream;

function WriteHashStream(path, options) {
  fs.WriteStream.call(this, path, options);

  this.hash = crypto.createHash('sha1');
  this.digest = null;

  this.on('close', function() {
    this.digest = this.hash.digest('hex');
  });
}

inherits(WriteHashStream, fs.WriteStream);

WriteHashStream.prototype.write = function(chunk) {
  if (chunk) {
    this.hash.update(chunk);
  }

  return fs.WriteStream.prototype.write.call(this, chunk);
};

module.exports.WriteHashStream = WriteHashStream;