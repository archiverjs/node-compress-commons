import { inherits } from "util";
import crc32 from "crc-32";
import { CRC32Stream, DeflateCRC32Stream } from "crc32-stream";
import ArchiveOutputStream from "../archive-output-stream.js";
import ZipArchiveEntry from "./zip-archive-entry.js";
import GeneralPurposeBit from "./general-purpose-bit.js";
import {
  LONG_ZERO,
  METHOD_DEFLATED,
  METHOD_STORED,
  MIN_VERSION_DATA_DESCRIPTOR,
  MIN_VERSION_ZIP64,
  SHORT_ZERO,
  SIG_EOCD,
  SIG_DD,
  SIG_CFH,
  SIG_LFH,
  SIG_ZIP64_EOCD,
  SIG_ZIP64_EOCD_LOC,
  VERSION_MADEBY,
  ZIP64_EXTRA_ID,
  ZIP64_MAGIC,
  ZIP64_MAGIC_SHORT,
  ZLIB_BEST_SPEED,
} from "./constants.js";
import { getEightBytes, getLongBytes, getShortBytes } from "./util.js";

function _defaults(o) {
  if (typeof o !== "object") {
    o = {};
  }
  if (typeof o.zlib !== "object") {
    o.zlib = {};
  }
  if (typeof o.zlib.level !== "number") {
    o.zlib.level = ZLIB_BEST_SPEED;
  }
  o.forceZip64 = !!o.forceZip64;
  o.forceLocalTime = !!o.forceLocalTime;
  return o;
}

export default class ZipArchiveOutputStream extends ArchiveOutputStream {
  constructor(options) {
    const _options = _defaults(options);
    super(_options);
    this.options = _options;
    this._entry = null;
    this._entries = [];
    this._centralDirectoryIndex = 0;
    this._archive = {
      centralLength: 0,
      centralOffset: 0,
      comment: "",
      finish: false,
      finished: false,
      finalizing: false,
      processing: false,
      forceZip64: _options.forceZip64,
      forceLocalTime: _options.forceLocalTime,
    };
  }

  _afterAppend(ae) {
    this._entries.push(ae);
    if (ae.getGeneralPurposeBit().usesDataDescriptor()) {
      this._writeDataDescriptor(ae);
    }
    this._archive.processing = false;
    this._entry = null;
    if (this._archive.finish && !this._archive.finished) {
      this._finish();
    }
  }

  _appendBuffer(ae, source, callback) {
    if (source.length === 0) {
      ae.setMethod(METHOD_STORED);
    }
    var method = ae.getMethod();
    if (method === METHOD_STORED) {
      ae.setSize(source.length);
      ae.setCompressedSize(source.length);
      ae.setCrc(crc32.buf(source) >>> 0);
    }
    this._writeLocalFileHeader(ae);
    if (method === METHOD_STORED) {
      this.write(source);
      this._afterAppend(ae);
      callback(null, ae);
      return;
    } else if (method === METHOD_DEFLATED) {
      this._smartStream(ae, callback).end(source);
      return;
    } else {
      callback(new Error("compression method " + method + " not implemented"));
      return;
    }
  }

  _appendStream(ae, source, callback) {
    ae.getGeneralPurposeBit().useDataDescriptor(true);
    ae.setVersionNeededToExtract(MIN_VERSION_DATA_DESCRIPTOR);
    this._writeLocalFileHeader(ae);
    var smart = this._smartStream(ae, callback);
    source.once("error", function (err) {
      smart.emit("error", err);
      smart.end();
    });
    source.pipe(smart);
  }

  _finish() {
    if (this._archive.finalizing || this._archive.finished) {
      return;
    }
    this._archive.centralOffset = this.offset;
    this._archive.finalizing = true;
    this._archive.finish = true;
    this._centralDirectoryIndex = 0;
    this._writeCentralDirectory();
  }

  _writeCentralDirectory() {
    while (this._centralDirectoryIndex < this._entries.length) {
      var index = this._centralDirectoryIndex;
      var ae = this._entries[index];
      this._entries[index] = undefined;
      this._centralDirectoryIndex += 1;
      if (!this._writeCentralFileHeader(ae)) {
        this.once("drain", this._writeCentralDirectory.bind(this));
        return;
      }
    }
    this._archive.centralLength = this.offset - this._archive.centralOffset;
    if (this.isZip64()) {
      this._writeCentralDirectoryZip64();
    }
    this._writeCentralDirectoryEnd();
    this._archive.processing = false;
    this._archive.finalizing = false;
    this._archive.finished = true;
    this._entries = [];
    this.end();
  }

  _normalizeEntry(ae) {
    if (ae.getMethod() === -1) {
      ae.setMethod(METHOD_DEFLATED);
    }
    if (ae.getMethod() === METHOD_DEFLATED) {
      ae.getGeneralPurposeBit().useDataDescriptor(true);
      ae.setVersionNeededToExtract(MIN_VERSION_DATA_DESCRIPTOR);
    }
    if (ae.getTime() === -1) {
      ae.setTime(new Date(), this._archive.forceLocalTime);
    }
    ae._offsets = {
      file: 0,
      data: 0,
      contents: 0,
    };
  }

  _smartStream(ae, callback) {
    var deflate = ae.getMethod() === METHOD_DEFLATED;
    var process = deflate
      ? new DeflateCRC32Stream(this.options.zlib)
      : new CRC32Stream();
    var error = null;
    function handleStuff() {
      var digest = process.digest().readUInt32BE(0);
      ae.setCrc(digest);
      ae.setSize(process.size());
      ae.setCompressedSize(process.size(true));
      this._afterAppend(ae);
      callback(error, ae);
    }
    process.once("end", handleStuff.bind(this));
    process.once("error", function (err) {
      error = err;
    });
    process.pipe(this, { end: false });
    return process;
  }

  _writeCentralDirectoryEnd() {
    var records = this._entries.length;
    var size = this._archive.centralLength;
    var offset = this._archive.centralOffset;
    if (this.isZip64()) {
      records = ZIP64_MAGIC_SHORT;
      size = ZIP64_MAGIC;
      offset = ZIP64_MAGIC;
    }
    // signature
    this.write(getLongBytes(SIG_EOCD));
    // disk numbers
    this.write(SHORT_ZERO);
    this.write(SHORT_ZERO);
    // number of entries
    this.write(getShortBytes(records));
    this.write(getShortBytes(records));
    // length and location of CD
    this.write(getLongBytes(size));
    this.write(getLongBytes(offset));
    // archive comment
    var comment = this.getComment();
    var commentLength = Buffer.byteLength(comment);
    this.write(getShortBytes(commentLength));
    this.write(comment);
  }

  _writeCentralDirectoryZip64() {
    // signature
    this.write(getLongBytes(SIG_ZIP64_EOCD));
    // size of the ZIP64 EOCD record
    this.write(getEightBytes(44));
    // version made by
    this.write(getShortBytes(MIN_VERSION_ZIP64));
    // version to extract
    this.write(getShortBytes(MIN_VERSION_ZIP64));
    // disk numbers
    this.write(LONG_ZERO);
    this.write(LONG_ZERO);
    // number of entries
    this.write(getEightBytes(this._entries.length));
    this.write(getEightBytes(this._entries.length));
    // length and location of CD
    this.write(getEightBytes(this._archive.centralLength));
    this.write(getEightBytes(this._archive.centralOffset));
    // extensible data sector
    // not implemented at this time
    // end of central directory locator
    this.write(getLongBytes(SIG_ZIP64_EOCD_LOC));
    // disk number holding the ZIP64 EOCD record
    this.write(LONG_ZERO);
    // relative offset of the ZIP64 EOCD record
    this.write(
      getEightBytes(this._archive.centralOffset + this._archive.centralLength),
    );
    // total number of disks
    this.write(getLongBytes(1));
  }

  _writeCentralFileHeader(ae) {
    var gpb = ae.getGeneralPurposeBit();
    var method = ae.getMethod();
    var fileOffset = ae._offsets.file;
    var size = ae.getSize();
    var compressedSize = ae.getCompressedSize();
    if (ae.isZip64() || fileOffset > ZIP64_MAGIC) {
      size = ZIP64_MAGIC;
      compressedSize = ZIP64_MAGIC;
      fileOffset = ZIP64_MAGIC;
      ae.setVersionNeededToExtract(MIN_VERSION_ZIP64);
      var extraBuf = Buffer.concat(
        [
          getShortBytes(ZIP64_EXTRA_ID),
          getShortBytes(24),
          getEightBytes(ae.getSize()),
          getEightBytes(ae.getCompressedSize()),
          getEightBytes(ae._offsets.file),
        ],
        28,
      );
      ae.setExtra(extraBuf);
    }
    var name = ae.getName();
    var comment = ae.getComment();
    var extra = ae.getCentralDirectoryExtra();
    if (gpb.usesUTF8ForNames()) {
      name = Buffer.from(name);
      comment = Buffer.from(comment);
    }
    if (!Buffer.isBuffer(name)) {
      name = Buffer.from(name);
    }
    if (!Buffer.isBuffer(comment)) {
      comment = Buffer.from(comment);
    }
    var header = Buffer.concat(
      [
        getLongBytes(SIG_CFH),
        getShortBytes((ae.getPlatform() << 8) | VERSION_MADEBY),
        getShortBytes(ae.getVersionNeededToExtract()),
        gpb.encode(),
        getShortBytes(method),
        getLongBytes(ae.getTimeDos()),
        getLongBytes(ae.getCrc()),
        getLongBytes(compressedSize),
        getLongBytes(size),
        getShortBytes(name.length),
        getShortBytes(extra.length),
        getShortBytes(comment.length),
        SHORT_ZERO,
        getShortBytes(ae.getInternalAttributes()),
        getLongBytes(ae.getExternalAttributes()),
        getLongBytes(fileOffset),
        name,
        extra,
        comment,
      ],
      46 + name.length + extra.length + comment.length,
    );
    return this.write(header);
  }

  _writeDataDescriptor(ae) {
    // signature
    this.write(getLongBytes(SIG_DD));
    // crc32 checksum
    this.write(getLongBytes(ae.getCrc()));
    // sizes
    if (ae.isZip64()) {
      this.write(getEightBytes(ae.getCompressedSize()));
      this.write(getEightBytes(ae.getSize()));
    } else {
      this.write(getLongBytes(ae.getCompressedSize()));
      this.write(getLongBytes(ae.getSize()));
    }
  }

  _writeLocalFileHeader(ae) {
    var gpb = ae.getGeneralPurposeBit();
    var method = ae.getMethod();
    var name = ae.getName();
    var extra = ae.getLocalFileDataExtra();
    if (ae.isZip64()) {
      gpb.useDataDescriptor(true);
      ae.setVersionNeededToExtract(MIN_VERSION_ZIP64);
    }
    if (gpb.usesUTF8ForNames()) {
      name = Buffer.from(name);
    }
    ae._offsets.file = this.offset;
    // signature
    this.write(getLongBytes(SIG_LFH));
    // version to extract and general bit flag
    this.write(getShortBytes(ae.getVersionNeededToExtract()));
    this.write(gpb.encode());
    // compression method
    this.write(getShortBytes(method));
    // datetime
    this.write(getLongBytes(ae.getTimeDos()));
    ae._offsets.data = this.offset;
    // crc32 checksum and sizes
    if (gpb.usesDataDescriptor()) {
      this.write(LONG_ZERO);
      this.write(LONG_ZERO);
      this.write(LONG_ZERO);
    } else {
      this.write(getLongBytes(ae.getCrc()));
      this.write(getLongBytes(ae.getCompressedSize()));
      this.write(getLongBytes(ae.getSize()));
    }
    // name length
    this.write(getShortBytes(name.length));
    // extra length
    this.write(getShortBytes(extra.length));
    // name
    this.write(name);
    // extra
    this.write(extra);
    ae._offsets.contents = this.offset;
  }

  getComment(comment) {
    return this._archive.comment !== null ? this._archive.comment : "";
  }

  isZip64() {
    return (
      this._archive.forceZip64 ||
      this._entries.length > ZIP64_MAGIC_SHORT ||
      this._archive.centralLength > ZIP64_MAGIC ||
      this._archive.centralOffset > ZIP64_MAGIC
    );
  }

  setComment(comment) {
    this._archive.comment = comment;
  }
}
